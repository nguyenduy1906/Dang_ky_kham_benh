from psycopg import errors as pg_errors

from backend.app.core.errors import bad_request, conflict, forbidden, not_found
from backend.app.core.utils import today_vn
from backend.app.db.database import get_db_connection
from backend.app.models import doctor_model, room_model, schedule_model
from backend.app.models._sql import jsonable

_CHANGES_TIME_OR_ROOM = ('room_id', 'work_date', 'start_time', 'end_time')


def _present(row):
    return jsonable(dict(row))


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
    """Lịch của một bác sĩ cho người dùng thường: chỉ từ hôm nay, không lộ ca đã đóng."""
    with get_db_connection() as db:
        doctor = doctor_model.get_by_id(db, doctor_profile_id)
        if doctor is None or not doctor['is_active'] or not doctor['account_ok']:
            raise not_found('Không tìm thấy bác sĩ', 'DOCTOR_NOT_FOUND')
        start = max(query['from_date'] or today_vn(), today_vn())
        rows, total = schedule_model.list_schedules(
            db, doctor_profile_id=doctor_profile_id, from_date=start, to_date=query['to_date'],
            status=query['status'], limit=query['page_size'],
            offset=(query['page'] - 1) * query['page_size'])
    rows = [r for r in rows if r['schedule_status'] != 'CLOSED']
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
    room = room_model.get_room(db, room_id)
    if room is None or not room['is_active']:
        raise bad_request('Phòng không tồn tại hoặc đã ngưng hoạt động', 'ROOM_INVALID')
    return room


def create_schedule(fields):
    if fields['work_date'] < today_vn():
        raise bad_request('Không thể tạo ca trong quá khứ', 'DATE_IN_PAST')
    with get_db_connection() as db:
        doctor = doctor_model.get_by_id(db, fields['doctor_profile_id'])
        if doctor is None or not doctor['is_active'] or not doctor['account_ok']:
            raise bad_request('Bác sĩ không tồn tại hoặc đã ngưng hoạt động', 'DOCTOR_INVALID')
        _active_room(db, fields['room_id'])
        schedule_model.lock_doctor_and_room(db, fields['doctor_profile_id'], fields['room_id'])
        _check_free(db, fields['doctor_profile_id'], fields['room_id'], fields['work_date'],
                    fields['start_time'], fields['end_time'])
        try:
            schedule_id = schedule_model.create_schedule(db, fields)
        except pg_errors.UniqueViolation:
            raise conflict('Ca làm việc bị trùng', 'SCHEDULE_OVERLAP') from None
        row = schedule_model.get_schedule(db, schedule_id)
    return {'schedule': _present(row)}


def update_schedule(schedule_id, fields):
    with get_db_connection() as db:
        current = schedule_model.get_for_update(db, schedule_id)
        if current is None:
            raise not_found('Không tìm thấy ca làm việc', 'SCHEDULE_NOT_FOUND')
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
    return {'schedule': _present(row)}


def report_unavailable(user, schedule_id, reason):
    with get_db_connection() as db:
        doctor = doctor_model.get_by_user_id(db, user['user_id'])
        schedule = schedule_model.get_for_update(db, schedule_id)
        if doctor is None or schedule is None or schedule['doctor_profile_id'] != doctor['doctor_profile_id']:
            raise not_found('Không tìm thấy ca làm việc của bạn', 'SCHEDULE_NOT_FOUND')
        if schedule['schedule_status'] == 'UNAVAILABLE':
            raise conflict('Ca đã được báo nghỉ trước đó', 'ALREADY_UNAVAILABLE')
        if schedule['schedule_status'] == 'CLOSED':
            raise conflict('Ca đã đóng', 'SCHEDULE_CLOSED')
        if schedule['work_date'] < today_vn():
            raise conflict('Ca đã qua', 'SCHEDULE_IN_PAST')
        affected = schedule_model.count_active_encounters(db, schedule_id)
        schedule_model.mark_unavailable(db, schedule_id, reason)
        row = schedule_model.get_schedule(db, schedule_id)
    # Việc huỷ/chuyển các lượt khám bị ảnh hưởng, hoàn cọc và thông báo do Gói 3 xử lý.
    return {'schedule': _present(row), 'affected_encounters': affected}
