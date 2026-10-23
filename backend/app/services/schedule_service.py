from psycopg import errors as pg_errors

from backend.app.core import constants
from backend.app.core.errors import bad_request, conflict, forbidden, not_found
from datetime import datetime
from backend.app.utils.date import today_vn, utc_now, VN_TZ
from backend.app.db.database import get_db_connection
from backend.app.models import doctor_model, catalog_model, schedule_model, auth_model
from backend.app.utils.database_helpers import jsonable
from backend.app.models import staff_leave_model
from backend.app.services import staff_leave_service, staff_notification_service as staff_notifications

_CHANGES_TIME_OR_ROOM = ('room_id', 'work_date', 'start_time', 'end_time', 'slot_minutes')


def _present(row):
    result = dict(row)
    if result.get('move'):
        status = 'MOVED'
    elif result['schedule_status'] == 'UNAVAILABLE':
        status = 'OFF'
    elif result['schedule_status'] == 'CLOSED':
        status = 'CLOSED'
    else:
        now = utc_now()
        start = datetime.combine(result['work_date'], result['start_time'], VN_TZ)
        end = datetime.combine(result['work_date'], result['end_time'], VN_TZ)
        status = 'UPCOMING' if now < start else ('COMPLETED' if now >= end else 'WORKING')
    result['work_status'] = status
    return jsonable(result)


def _page(rows, total, query):
    return {'items': [_present(r) for r in rows], 'total': total,
            'page': query['page'], 'page_size': query['page_size']}


def list_schedules(query):
    with get_db_connection() as db:
        rows, total = schedule_model.list_schedules(
            db, doctor_profile_id=query['doctor_profile_id'], room_id=query['room_id'],
            department_id=query['department_id'], from_date=query['from_date'],
            to_date=query['to_date'], status=query['status'], limit=query['page_size'],
            offset=(query['page'] - 1) * query['page_size'])
    return _page(rows, total, query)


def list_doctor_public(doctor_profile_id, query):
    """Lịch công khai từ hôm nay, hoặc tuần hiện tại để trình bày hồ sơ; luôn bỏ ca đã đóng."""
    with get_db_connection() as db:
        doctor = doctor_model.get_by_id(db, doctor_profile_id)
        if doctor is None or not doctor['is_active'] or not doctor['account_ok']:
            raise not_found('Không tìm thấy bác sĩ', 'DOCTOR_NOT_FOUND')
        today = today_vn()
        start = max(query['from_date'] or today, today)
        end = query['to_date']
        if query.get('current_week'):
            from datetime import timedelta
            start = today - timedelta(days=today.weekday())
            end = start + timedelta(days=6)
        rows, total = schedule_model.list_schedules(
            db, doctor_profile_id=doctor_profile_id, from_date=start, to_date=end,
            status=query['status'], exclude_closed=True, limit=query['page_size'],
            offset=(query['page'] - 1) * query['page_size'])
        from backend.app.services.appointment_slot_service import available_slots, schedule_bounds
        from backend.app.utils import date as date_utils
        from datetime import timedelta
        for row in rows:
            allowed = (row['schedule_status'] == 'OPEN' and row['remaining'] > 0
                       and date_utils.utc_now() <= schedule_bounds(row)[0] - timedelta(hours=5))
            row['slots'] = [{'appointment_time': start.strftime('%H:%M'),
                             'starts_at': start.isoformat(), 'ends_at': end.isoformat()}
                            for start, end in available_slots(db, row)] if allowed else []
    return _page(rows, total, query)


def list_own(user, query):
    with get_db_connection() as db:
        doctor = doctor_model.get_by_user_id(db, user['user_id'])
        if doctor is None:
            raise not_found('Tài khoản chưa có hồ sơ bác sĩ', 'DOCTOR_PROFILE_MISSING')
        rows, total = schedule_model.list_schedules(
            db, doctor_profile_id=doctor['doctor_profile_id'], room_id=query['room_id'],
            from_date=query['from_date'], to_date=query['to_date'], status=query['status'],
            limit=query['page_size'], offset=(query['page'] - 1) * query['page_size'])
    return _page(rows, total, query)


def _check_free(db, doctor_id, room_id, work_date, start, end, exclude_id=None):
    if schedule_model.find_overlap(db, 'doctor_profile_id', doctor_id, work_date, start, end, exclude_id):
        raise conflict('Bác sĩ đã có ca trùng giờ', 'DOCTOR_SCHEDULE_OVERLAP')
    if schedule_model.find_overlap(db, 'room_id', room_id, work_date, start, end, exclude_id):
        raise conflict('Phòng đã có ca trùng giờ', 'ROOM_SCHEDULE_OVERLAP')


def _active_room(db, room_id):
    room = catalog_model.get_room(db, room_id)
    if room is None or not room['is_active']:
        raise bad_request('Phòng không tồn tại hoặc đã ngưng hoạt động', 'ROOM_INVALID')
    return room


def create_schedule(fields):
    if fields['work_date'] < today_vn():
        raise bad_request('Không thể tạo ca trong quá khứ', 'DATE_IN_PAST')
    with get_db_connection() as db:
        staff_leave_model.lock_changes(db)
        doctor = doctor_model.get_by_id(db, fields['doctor_profile_id'])
        if doctor is None or not doctor['is_active'] or not doctor['account_ok']:
            raise bad_request('Bác sĩ không tồn tại hoặc đã ngưng hoạt động', 'DOCTOR_INVALID')
        staff_leave_service.ensure_available(db, doctor['user_id'], fields['work_date'], fields['start_time'], fields['end_time'])
        fields = dict(fields)
        if fields.get('slot_minutes') is None:
            department = catalog_model.doctor_department_name(db, fields['doctor_profile_id'])
            fields['slot_minutes'] = 15 if department['name'] in ('Da liễu', 'Tai Mũi Họng', 'Mắt', 'Răng Hàm Mặt') else 30
        _active_room(db, fields['room_id'])
        schedule_model.lock_doctor_and_room(db, fields['doctor_profile_id'], fields['room_id'])
        _check_free(db, fields['doctor_profile_id'], fields['room_id'], fields['work_date'],
                    fields['start_time'], fields['end_time'])
        try:
            schedule_id = schedule_model.create_schedule(db, fields)
        except pg_errors.UniqueViolation:
            raise conflict('Ca làm việc bị trùng', 'SCHEDULE_OVERLAP') from None
        row = schedule_model.get_schedule(db, schedule_id)
        staff_notifications.schedule_changed(db, row, "created")
    return {'schedule': _present(row)}


def update_schedule(schedule_id, fields):
    with get_db_connection() as db:
        staff_leave_model.lock_changes(db)
        current = schedule_model.get_for_update(db, schedule_id)
        if current is None:
            raise not_found('Không tìm thấy ca làm việc', 'SCHEDULE_NOT_FOUND')
        if schedule_model.get_move(db, schedule_id):
            raise conflict('Ca đã chuyển, không thể sửa hoặc mở lại', 'SCHEDULE_MOVED')
        if current['schedule_status'] == 'UNAVAILABLE':
            raise conflict('Ca đã báo nghỉ, cần xử lý theo quy trình báo nghỉ', 'SCHEDULE_UNAVAILABLE')
        if current['work_date'] < today_vn():
            raise conflict('Ca đã qua, không thể sửa', 'SCHEDULE_IN_PAST')

        changed = [k for k in _CHANGES_TIME_OR_ROOM if k in fields and fields[k] != current[k]]
        if changed and (current['booked_count'] > 0
                        or schedule_model.has_locking_encounters(db, schedule_id)):
            raise conflict('Ca đã có lượt khám, không được đổi phòng, ngày hoặc giờ',
                           'SCHEDULE_HAS_ENCOUNTERS')
        if 'max_quota' in fields and fields['max_quota'] < current['booked_count']:
            raise conflict('Quota không được thấp hơn số lượt đã đặt', 'QUOTA_BELOW_BOOKED')

        merged = {k: fields.get(k, current[k]) for k in
                  ('room_id', 'work_date', 'start_time', 'end_time', 'max_quota')}
        if merged['end_time'] <= merged['start_time']:
            raise bad_request('end_time phải sau start_time')
        if merged['work_date'] < today_vn():
            raise bad_request('Không thể dời ca về quá khứ', 'DATE_IN_PAST')
        doctor = doctor_model.get_by_id(db, current['doctor_profile_id'])
        staff_leave_service.ensure_available(db, doctor['user_id'], merged['work_date'], merged['start_time'], merged['end_time'])
        for assignment in schedule_model.active_nurses(db, schedule_id):
            staff_leave_service.ensure_available(db, assignment['nurse_id'], merged['work_date'], merged['start_time'], merged['end_time'])
            if schedule_model.nurse_overlap(db, assignment['nurse_id'], merged['work_date'], merged['start_time'], merged['end_time'], schedule_id):
                raise conflict('Y tá đã được phân công ca khác trùng giờ', 'NURSE_SCHEDULE_OVERLAP')
        if changed:
            if 'room_id' in changed:
                _active_room(db, merged['room_id'])
            schedule_model.lock_doctor_and_room(db, current['doctor_profile_id'], merged['room_id'])
            _check_free(db, current['doctor_profile_id'], merged['room_id'], merged['work_date'],
                        merged['start_time'], merged['end_time'], schedule_id)

        status = fields.get('schedule_status', current['schedule_status'])
        if status in ('OPEN', 'FULL'):
            status = 'FULL' if current['booked_count'] >= merged['max_quota'] else 'OPEN'
        updates = dict(fields)
        updates['schedule_status'] = status
        try:
            schedule_model.update_schedule(db, schedule_id, updates)
        except pg_errors.UniqueViolation:
            raise conflict('Ca làm việc bị trùng', 'SCHEDULE_OVERLAP') from None
        row = schedule_model.get_schedule(db, schedule_id)
        staff_notifications.schedule_changed(db, row, "updated", before=current)
    return {'schedule': _present(row)}


def report_unavailable(user, schedule_id, reason):
    with get_db_connection() as db:
        doctor = doctor_model.get_by_user_id(db, user['user_id'])
        schedule = schedule_model.get_schedule(db, schedule_id)
        if doctor is None or schedule is None or schedule['doctor_profile_id'] != doctor['doctor_profile_id']:
            raise not_found('Không tìm thấy ca làm việc của bạn', 'SCHEDULE_NOT_FOUND')
        if schedule['schedule_status'] == 'UNAVAILABLE':
            raise conflict('Ca đã được báo nghỉ trước đó', 'ALREADY_UNAVAILABLE')
        if schedule['schedule_status'] == 'CLOSED':
            raise conflict('Ca đã đóng', 'SCHEDULE_CLOSED')
        if schedule['work_date'] < today_vn():
            raise conflict('Ca đã qua', 'SCHEDULE_IN_PAST')
        affected = schedule_model.count_active_encounters(db, schedule_id)
    from datetime import time
    from backend.app.schemas.staff_leave_schema import validate_create
    period = 'FULL_DAY' if schedule['start_time'] < time(12) < schedule['end_time'] else (
        'MORNING' if schedule['end_time'] <= time(12) else 'AFTERNOON')
    result = staff_leave_service.create(user, validate_create({'from_date': schedule['work_date'].isoformat(),
        'period': period, 'reason': reason}))
    return {**result, 'schedule': _present(schedule), 'affected_encounters': affected,
            'message': 'Đã gửi đơn nghỉ, ca khám giữ nguyên cho đến khi admin duyệt'}


def list_assignments(query, nurse_id=None):
    with get_db_connection() as db:
        rows, total = schedule_model.list_assignments(
            db, nurse_id=nurse_id if nurse_id is not None else query['nurse_id'],
            schedule_id=query['schedule_id'], include_revoked=query['include_revoked'],
            limit=query['page_size'], offset=(query['page'] - 1) * query['page_size'])
    return {'items': [_assignment_present(row) for row in rows], 'total': total,
            'page': query['page'], 'page_size': query['page_size']}


def create_assignment(actor, fields):
    with get_db_connection() as db:
        staff_leave_model.lock_changes(db)
        # Khóa tài khoản để vai trò/trạng thái không đổi trong lúc phân công.
        nurse = auth_model.get_for_assignment(db, fields['nurse_id'])
        if nurse is None or nurse['deleted_at'] is not None:
            raise not_found('Không tìm thấy tài khoản y tá', 'NURSE_NOT_FOUND')
        if nurse['role_name'] != constants.ROLE_NURSE:
            raise bad_request('Tài khoản phải có vai trò NURSE', 'NOT_A_NURSE')
        if (nurse['account_status'] != constants.ACCOUNT_ACTIVE
                or nurse['approval_status'] != constants.APPROVAL_APPROVED):
            raise bad_request('Tài khoản y tá chưa được duyệt hoặc bị khóa', 'NURSE_INACTIVE')
        schedule = schedule_model.get_for_update(db, fields['schedule_id'])
        if schedule is None:
            raise not_found('Không tìm thấy ca làm việc', 'SCHEDULE_NOT_FOUND')
        if schedule['schedule_status'] not in ('OPEN','FULL'):
            raise conflict('Ca đã đóng hoặc nghỉ, không thể phân công','SCHEDULE_NOT_OPEN')
        if datetime.combine(schedule['work_date'],schedule['end_time'],VN_TZ)<=utc_now():
            raise conflict('Không thể phân công vào ca đã kết thúc','SCHEDULE_IN_PAST')
        staff_leave_service.ensure_available(db, nurse['user_id'], schedule['work_date'], schedule['start_time'], schedule['end_time'])
        if schedule_model.nurse_overlap(db, nurse['user_id'], schedule['work_date'], schedule['start_time'], schedule['end_time'], schedule['schedule_id']):
            raise conflict('Y tá đã được phân công ca khác trùng giờ', 'NURSE_SCHEDULE_OVERLAP')
        try:
            assignment_id = schedule_model.create_assignment(db, actor['user_id'], fields)
        except pg_errors.UniqueViolation:
            raise conflict('Y tá đã được phân công trong ca này', 'DUPLICATE_NURSE_ASSIGNMENT') from None
        row = schedule_model.get_assignment(db, assignment_id)
        staff_notifications.assignment_changed(db, row, "assigned")
    return {'assignment': _assignment_present(row)}


def revoke_assignment(actor, assignment_id):
    with get_db_connection() as db:
        if schedule_model.revoke_assignment(db, assignment_id, actor['user_id']) is None:
            if schedule_model.get_assignment(db, assignment_id) is None:
                raise not_found('Không tìm thấy phân công', 'ASSIGNMENT_NOT_FOUND')
            raise conflict('Phân công đã được thu hồi', 'ASSIGNMENT_ALREADY_REVOKED')
        row = schedule_model.get_assignment(db, assignment_id)
        staff_notifications.assignment_changed(db, row, "revoked")
    return {'assignment': _assignment_present(row)}


def move_schedule(actor, source_id, fields):
    target_id = fields['target_schedule_id']
    if source_id == target_id:
        raise bad_request('Ca mới phải khác ca cũ', 'SAME_SCHEDULE')
    with get_db_connection() as db:
        staff_leave_model.lock_changes(db)
        rows = {r['schedule_id']: r for r in schedule_model.lock_schedules(db, [source_id,target_id])}
        if source_id not in rows or target_id not in rows:
            raise not_found('Không tìm thấy ca làm việc', 'SCHEDULE_NOT_FOUND')
        source, target = rows[source_id], rows[target_id]
        if source['doctor_profile_id'] != target['doctor_profile_id']:
            raise conflict('Chỉ chuyển sang ca của cùng bác sĩ', 'DOCTOR_MISMATCH')
        if schedule_model.get_move(db,source_id) or schedule_model.get_move(db,target_id):
            raise conflict('Ca đã được chuyển trước đó', 'SCHEDULE_MOVED')
        if source['schedule_status'] != 'OPEN' or target['schedule_status'] != 'OPEN':
            raise conflict('Hai ca phải đang mở', 'SCHEDULE_NOT_OPEN')
        now = utc_now()
        if any(datetime.combine(r['work_date'],r['start_time'],VN_TZ) <= now for r in (source,target)):
            raise conflict('Chỉ chuyển ca chưa bắt đầu', 'SCHEDULE_ALREADY_STARTED')
        if source['booked_count'] or schedule_model.has_locking_encounters(db,source_id):
            raise conflict('Ca cũ đã có lượt khám, cần xử lý lịch hẹn trước', 'SCHEDULE_HAS_ENCOUNTERS')
        doctor = doctor_model.get_by_id(db,target['doctor_profile_id'])
        staff_leave_service.ensure_available(db,doctor['user_id'],target['work_date'],target['start_time'],target['end_time'])
        recipients = staff_notifications.schedule_recipients(db, source_id)
        schedule_model.record_move(db,source_id,target_id,actor['user_id'],fields['reason'])
        staff_notifications.schedule_changed(db, schedule_model.get_schedule(db, target_id), "moved",
            before=source, key=f'staff-schedule-move:{source_id}:{target_id}', extra_recipients=recipients)
        return {'schedule':_present(schedule_model.get_schedule(db,source_id)),
                'target_schedule':_present(schedule_model.get_schedule(db,target_id))}


def _assignment_present(row):
    import hashlib, json
    result=jsonable(dict(row))
    snapshot={k:result.get(k) for k in ('assignment_id','nurse_id','schedule_id','note','assigned_at','revoked_at','revoked_by_id')}
    result['version']=hashlib.sha256(json.dumps(snapshot,sort_keys=True).encode()).hexdigest()
    return result


def get_assignment(assignment_id):
    with get_db_connection() as db:
        row=schedule_model.get_assignment(db,assignment_id)
        if row is None:raise not_found('Không tìm thấy phân công','ASSIGNMENT_NOT_FOUND')
        return {'assignment':_assignment_present(row)}


def update_assignment(actor, assignment_id, fields):
    with get_db_connection() as db:
        staff_leave_model.lock_changes(db)
        current=schedule_model.lock_assignment(db,assignment_id)
        if current is None:raise not_found('Không tìm thấy phân công','ASSIGNMENT_NOT_FOUND')
        if _assignment_present(current)['version']!=fields['expected_version']:
            raise conflict('Phân công đã thay đổi. Hãy mở lại để tải dữ liệu mới.','ASSIGNMENT_STALE')
        changed=current['nurse_id']!=fields['nurse_id'] or current['schedule_id']!=fields['schedule_id']
        active=fields['assignment_status']=='ACTIVE'
        if not active and changed:
            raise conflict('Không đổi y tá hoặc ca của phân công thu hồi. Chọn đang phân công để giao ca mới.','REVOKED_ASSIGNMENT_IMMUTABLE')
        before=_assignment_present(current)
        resulting_id=assignment_id
        if active and (changed or current['revoked_at'] is not None):
            nurse=auth_model.get_for_assignment(db,fields['nurse_id'])
            if nurse is None or nurse['deleted_at'] is not None:raise not_found('Không tìm thấy y tá','NURSE_NOT_FOUND')
            if nurse['role_name']!=constants.ROLE_NURSE:raise bad_request('Tài khoản phải có vai trò NURSE','NOT_A_NURSE')
            if nurse['account_status']!=constants.ACCOUNT_ACTIVE or nurse['approval_status']!=constants.APPROVAL_APPROVED:
                raise bad_request('Y tá chưa được duyệt hoặc bị khóa','NURSE_INACTIVE')
            locked={r['schedule_id']:r for r in schedule_model.lock_schedules(db,[current['schedule_id'],fields['schedule_id']])}
            target=locked.get(fields['schedule_id'])
            if target is None:raise not_found('Không tìm thấy ca','SCHEDULE_NOT_FOUND')
            if target['schedule_status'] not in ('OPEN','FULL'):
                raise conflict('Ca đã đóng, nghỉ hoặc chuyển, không thể phân công','SCHEDULE_NOT_OPEN')
            if datetime.combine(target['work_date'],target['end_time'],VN_TZ)<=utc_now():
                raise conflict('Không thể phân công vào ca đã kết thúc','SCHEDULE_IN_PAST')
            staff_leave_service.ensure_available(db,nurse['user_id'],target['work_date'],target['start_time'],target['end_time'])
            if current['revoked_at'] is None:schedule_model.revoke_assignment(db,assignment_id,actor['user_id'])
            if schedule_model.active_nurse_assignment(db,nurse['user_id'],target['schedule_id']):
                raise conflict('Y tá đã được giao ca này','DUPLICATE_NURSE_ASSIGNMENT')
            if schedule_model.nurse_overlap(db,nurse['user_id'],target['work_date'],target['start_time'],target['end_time'],target['schedule_id']):
                raise conflict('Y tá có ca trùng giờ','NURSE_SCHEDULE_OVERLAP')
            resulting_id=schedule_model.create_assignment(db,actor['user_id'],fields)
        else:
            if not active and current['revoked_at'] is None:schedule_model.revoke_assignment(db,assignment_id,actor['user_id'])
            schedule_model.update_assignment_note(db,assignment_id,fields['note'])
        after=_assignment_present(schedule_model.get_assignment(db,resulting_id))
        if before['version']!=after['version']:
            change_id = schedule_model.record_assignment_change(db,assignment_id,resulting_id,actor['user_id'],before,after)
            if current['revoked_at'] is None and (changed or not active):
                staff_notifications.assignment_changed(db, schedule_model.get_assignment(db, assignment_id), "revoked",
                    key=f'staff-assignment-revoke:{change_id}')
            if active:
                staff_notifications.assignment_changed(db, schedule_model.get_assignment(db, resulting_id),
                    "assigned" if changed or current['revoked_at'] is not None else "updated",
                    key=f'staff-assignment-update:{change_id}')
        return {'assignment':after,'previous_assignment_id':assignment_id}
