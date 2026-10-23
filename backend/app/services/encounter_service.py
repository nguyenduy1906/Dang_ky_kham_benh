"""Đầu mối gói 3 cho quyền truy cập và transaction lượt khám."""
from datetime import timedelta
from psycopg.types.json import Jsonb
from backend.app.services.appointment_slot_service import reserve_interval, reserve_walk_in_interval, schedule_bounds
from backend.app.services import patient_service
from backend.app.utils.validation import normalize_phone

from backend.app.core.errors import AppError, conflict, not_found
from backend.app.core.security import require_role
from backend.app.utils.date import VN_TZ, utc_now  # Keep the previous import path available.
from backend.app.utils import date as date_utils
from backend.app.db.database import get_db_connection
from backend.app.models import (encounter_model as model, configuration_model, patient_model,
                                doctor_model, catalog_model, schedule_model, medical_record_model)
from backend.app.utils.database_helpers import jsonable


def visible_encounter(db, actor, encounter_id):
    """Load by record permissions using the caller's connection; do not lock or commit."""
    row = model.get_encounter(db, encounter_id, actor)
    if row is None:
        raise not_found('Không tìm thấy lượt khám', 'ENCOUNTER_NOT_FOUND')
    return row


_visible = visible_encounter  # Compatibility for existing callers, including payment adapters.


def _present(row):
    return jsonable(dict(row))


def _page(rows, total, query):
    return {'items': [_present(row) for row in rows], 'total': total,
            'page': query['page'], 'page_size': query['page_size']}


def list_encounters(actor, query):
    with get_db_connection() as db:
        rows, total = model.list_encounters(db, actor, query)
    return _page(rows, total, query)


def get_encounter(actor, encounter_id):
    with get_db_connection() as db:
        row = visible_encounter(db, actor, encounter_id)
    return {'encounter': _present(row)}


def update_registration(actor, encounter_id, fields):
    require_role(actor, 'USER')
    with get_db_connection() as db:
        visible_encounter(db, actor, encounter_id)
        encounter, _ = locked_context(db, encounter_id)
        visible_encounter(db, actor, encounter_id)
        if (encounter['encounter_type'] != 'ONLINE' or encounter['encounter_status'] != 'HOLDING'
                or date_utils.utc_now() >= encounter['hold_expires_at']):
            raise conflict('Chỉ sửa thông tin đăng ký khi lượt khám còn giữ chỗ', 'INVALID_ENCOUNTER_STATUS')
        model.update_registration(db, encounter_id, fields['symptoms'], Jsonb(fields['registration_details']))
        return {'encounter': _present(visible_encounter(db, actor, encounter_id))}


def get_ticket(actor, encounter_id):
    with get_db_connection() as db:
        row = visible_encounter(db, actor, encounter_id)
        if not row['ticket_code']:
            raise conflict('Lượt khám chưa được phát phiếu', 'TICKET_NOT_ISSUED')
        ticket = {key: row[key] for key in (
            'encounter_id', 'ticket_code', 'patient_name', 'doctor_name', 'room_name',
            'work_date', 'estimated_exam_at', 'appointment_end_at', 'encounter_status')}
    return {'ticket': jsonable(ticket)}


def history(actor, encounter_id, kind, page, page_size):
    with get_db_connection() as db:
        visible_encounter(db, actor, encounter_id)
        rows, total = model.list_logs(db, encounter_id, kind, page, page_size)
    return _page(rows, total, {'page': page, 'page_size': page_size})


def locked_context(db, encounter_id, *, target_schedule_id=None):
    """Khóa ca theo ID tăng dần trước lượt khám, dùng chung cho mọi action gói 3.

    Nếu lượt khám vừa được chuyển ca giữa peek và lock, yêu cầu phải thử lại;
    không tiếp tục với ca cũ và không đảo thứ tự khóa gây deadlock.
    """
    peek = model.schedule_reference(db, encounter_id)
    if peek is None:
        raise not_found('Không tìm thấy lượt khám', 'ENCOUNTER_NOT_FOUND')
    ids = [peek['schedule_id']]
    if target_schedule_id is not None:
        ids.append(target_schedule_id)
    schedules = {s['schedule_id']: s for s in schedule_model.lock_schedules(db, ids)}
    if len(schedules) != len(set(ids)):
        raise not_found('Không tìm thấy ca làm việc', 'SCHEDULE_NOT_FOUND')
    encounter = model.lock_encounter(db, encounter_id)
    if encounter['schedule_id'] != peek['schedule_id']:
        raise conflict('Lượt khám vừa được chuyển ca; vui lòng thử lại', 'ENCOUNTER_CHANGED')
    return encounter, schedules


def require_clinical_shift(schedule, now=None):
    start,end = schedule_bounds(schedule)
    instant = now if now is not None else date_utils.utc_now()
    if instant < start or instant >= end:
        raise conflict('Chỉ thao tác bệnh án trong thời gian ca làm việc', 'CLINICAL_SHIFT_CLOSED')
    if schedule['schedule_status'] in ('CLOSED','UNAVAILABLE'):
        raise conflict('Ca đã đóng hoặc bác sĩ nghỉ', 'SCHEDULE_UNAVAILABLE')


def _active_doctor(db, schedule):
    row = doctor_model.get_for_reception(db, schedule['doctor_profile_id'])
    if (row is None or not row['is_active'] or row['deleted_at'] is not None
            or row['role_name'] != 'DOCTOR' or row['account_status'] != 'ACTIVE'
            or row['approval_status'] != 'APPROVED'):
        raise conflict('Bác sĩ không còn tiếp nhận', 'DOCTOR_UNAVAILABLE')
    room = catalog_model.room_activity(db, schedule['room_id'])
    if room is None or not room['is_active']:
        raise conflict('Phòng không còn hoạt động', 'ROOM_UNAVAILABLE')
    return row


def _change_quota(db, schedule, delta):
    booked = schedule['booked_count'] + delta
    if booked < 0 or booked > schedule['max_quota']:
        raise conflict('Số lượt trong ca không hợp lệ', 'QUOTA_CONFLICT')
    status = schedule['schedule_status']
    if status in ('OPEN', 'FULL'):
        status = 'FULL' if booked >= schedule['max_quota'] else 'OPEN'
    schedule_model.set_booking_count(db, schedule['schedule_id'], booked, status)
    schedule['booked_count'], schedule['schedule_status'] = booked, status


def _require_available(schedule, now, *, online=False):
    start, end = schedule_bounds(schedule)
    if schedule['schedule_status'] not in ('OPEN', 'FULL'):
        raise conflict('Ca đã đóng hoặc bác sĩ báo nghỉ', 'SCHEDULE_UNAVAILABLE')
    if online and now > start - timedelta(hours=5):
        raise conflict('Phải đặt online ít nhất 5 giờ trước giờ bắt đầu ca', 'SCHEDULE_TOO_LATE')
    if not online and now >= end:
        raise conflict('Ca không còn tiếp nhận', 'SCHEDULE_TOO_LATE')
    if schedule['booked_count'] >= schedule['max_quota']:
        raise conflict('Ca đã hết chỗ', 'SCHEDULE_FULL')


def _extra_walk_in_allowed(db,schedule,now):
    start,end=schedule_bounds(schedule)
    return (schedule['schedule_status'] in ('OPEN','FULL') and start<=now<end
            and model.finished_schedule(db,schedule['schedule_id']))


def _make_reception_capacity(db,schedule,now):
    if schedule['booked_count']<schedule['max_quota']:return
    if not _extra_walk_in_allowed(db,schedule,now):raise conflict('Ca đã hết chỗ và chưa khám hết danh sách','SCHEDULE_FULL')
    # One extra place per accepted visit; completed appointments and audit counts stay intact.
    schedule['max_quota']=schedule['booked_count']+1
    schedule_model.update_schedule(db,schedule['schedule_id'],{'max_quota':schedule['max_quota'],'schedule_status':'OPEN'})
    schedule['schedule_status']='OPEN'


def _patient_for_booking(db, patient_id, actor, *, online):
    if not online:
        patient_model.lock_account_links(db)
    patient = patient_model.get_for_update(db, patient_id)
    if patient is None or (online and not patient_model.can_book(db, patient_id, actor['user_id'])):
        raise not_found('Không tìm thấy hồ sơ bệnh nhân', 'PATIENT_NOT_FOUND')
    if patient['archived_at'] is not None:
        raise conflict('Hồ sơ đã lưu trữ, không thể tạo lượt khám mới', 'PATIENT_ARCHIVED')
    if not online and patient['user_id'] is None:
        if not patient['phone']:
            raise conflict('Cần bổ sung số điện thoại cho hồ sơ trước khi tiếp nhận', 'PATIENT_PHONE_REQUIRED')
        phone = normalize_phone(patient['phone'])
        account, _ = patient_service.ensure_patient_account(db, {**patient, 'phone': phone})
        patient_model.link_account_and_phone(db, patient_id, account['user_id'], phone)
        patient = patient_model.get_patient(db, patient_id)
    return patient


def _reject_duplicate(db, patient_id, doctor_id, work_date):
    duplicate = model.find_active_same_day(db, patient_id, doctor_id, work_date)
    if duplicate:
        raise conflict('Bệnh nhân đã có lượt khám với bác sĩ trong ngày; dùng lượt khám hiện có',
                       'DUPLICATE_ENCOUNTER')


def create_online(actor, fields):
    require_role(actor, 'USER')
    with get_db_connection() as db:
        _patient_for_booking(db, fields['patient_id'], actor, online=True)
        schedules = schedule_model.lock_schedules(db, [fields['schedule_id']])
        if not schedules:
            raise not_found('Không tìm thấy ca làm việc', 'SCHEDULE_NOT_FOUND')
        schedule = schedules[0]
        now = date_utils.utc_now()
        _require_available(schedule, now, online=True)
        doctor = _active_doctor(db, schedule)
        _reject_duplicate(db, fields['patient_id'], doctor['doctor_profile_id'], schedule['work_date'])
        policy = configuration_model.policies(db)
        start, finish = reserve_interval(db, schedule, fields['appointment_time'])
        booking_fields = {k: v for k, v in fields.items() if k != 'appointment_time'}
        if 'registration_details' in booking_fields:
            booking_fields['registration_details'] = Jsonb(booking_fields['registration_details'])
        row = model.create_encounter(db, {
            **booking_fields, 'encounter_type': 'ONLINE', 'encounter_status': 'HOLDING',
            'doctor_profile_id': doctor['doctor_profile_id'], 'room_id': schedule['room_id'],
            'created_by_id': actor['user_id'], 'consultation_fee_snapshot': doctor['consultation_fee'],
            'deposit_amount_snapshot': doctor['consultation_fee'] * policy['DEFAULT_DEPOSIT_PERCENT'] // 100,
            'policy_snapshot': Jsonb(policy),
            'estimated_exam_at': start, 'appointment_end_at': finish, 'hold_expires_at': now + timedelta(minutes=policy['APPOINTMENT_HOLD_MINUTES'])})
        _change_quota(db, schedule, 1)
        model.add_status(db, row['encounter_id'], None, 'HOLDING', actor['user_id'], f"Giữ chỗ online {policy['APPOINTMENT_HOLD_MINUTES']} phút")
        result = _present(visible_encounter(db, actor, row['encounter_id']))
    return {'encounter': result}


def confirm_paid_online(db, encounter_id, actor_id):
    """Adapter gói 4: gọi trong cùng transaction lưu DEPOSIT SUCCESS; không mở API xác nhận tùy ý.

    Kết quả False khi giữ chỗ đã hết hạn; gói 4 vẫn phải commit EXPIRED và xử lý
    thanh toán muộn riêng, không rollback trạng thái hết hạn rồi tái giữ chỗ.
    """
    encounter, schedules = locked_context(db, encounter_id)
    if encounter['encounter_type'] != 'ONLINE':
        raise conflict('Chỉ xác nhận lượt online', 'NOT_ONLINE')
    paid = db.execute("SELECT SUM(amount) AS amount FROM payment WHERE encounter_id=%s "
                      "AND payment_type='DEPOSIT' AND transaction_status='SUCCESS'", (encounter_id,)).fetchone()['amount']
    if paid is None or paid != encounter['deposit_amount_snapshot']:
        raise conflict('Chưa thanh toán đủ tiền đăng ký khám đã chốt', 'DEPOSIT_NOT_PAID')
    if encounter['encounter_status'] in ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'):
        return True
    if encounter['encounter_status'] in ('CANCELLED', 'NO_SHOW', 'EXPIRED'):
        return False
    schedule = schedules[encounter['schedule_id']]
    if date_utils.utc_now() >= encounter['hold_expires_at']:
        expire_locked(db, encounter, schedule, actor_id)
        return False
    if schedule['schedule_status'] in ('CLOSED', 'UNAVAILABLE'):
        raise conflict('Ca đã đóng hoặc báo nghỉ; cần điều phối lượt khám', 'SCHEDULE_UNAVAILABLE')
    ticket = model.update_encounter(db, encounter_id, {'encounter_status': 'CONFIRMED'})['ticket_code']
    model.add_status(db, encounter_id, 'HOLDING', 'CONFIRMED', actor_id, 'Đã thanh toán đủ tiền; phát phiếu ' + ticket)
    return True


def expire_locked(db, encounter, schedule, actor_id):
    if encounter['encounter_status'] != 'HOLDING' or date_utils.utc_now() < encounter['hold_expires_at']:
        return False
    model.update_encounter(db, encounter['encounter_id'], {'encounter_status': 'EXPIRED'})
    from backend.app.models.payment_model import fail_pending_deposits
    fail_pending_deposits(db, encounter['encounter_id'], 'HOLD_EXPIRED')
    _change_quota(db, schedule, -1)
    model.add_status(db, encounter['encounter_id'], 'HOLDING', 'EXPIRED', actor_id, 'Hết hạn giữ chỗ')
    return True


def cancel_hospital_locked(db, encounter, schedule, actor_id, reason):
    """Gói 4 trả cọc ca bị bệnh viện hủy trước xác nhận; gói 3 sở hữu quota/trạng thái."""
    if encounter['encounter_status'] != 'HOLDING':
        raise conflict('Chỉ hủy giữ chỗ chưa xác nhận trong adapter này', 'INVALID_ENCOUNTER_STATUS')
    model.update_encounter(db, encounter['encounter_id'], {'encounter_status': 'CANCELLED',
        'cancelled_by_id': actor_id, 'cancelled_at': date_utils.utc_now(), 'cancel_reason': reason,
        'cancel_origin': 'HOSPITAL', 'refund_reference_at': encounter['estimated_exam_at']})
    _change_quota(db, schedule, -1)
    from backend.app.models.payment_model import fail_pending_deposits
    fail_pending_deposits(db, encounter['encounter_id'], 'HOSPITAL_CANCELLED')
    model.add_status(db, encounter['encounter_id'], 'HOLDING', 'CANCELLED', actor_id, reason)


def action(actor, encounter_id, operation, reason=None, *, cancel_origin='PATIENT'):
    roles = ('USER', 'ADMIN', 'RECEPTIONIST') if operation == 'cancel' else (
        ('DOCTOR',) if operation == 'start' else ('ADMIN', 'RECEPTIONIST'))
    require_role(actor, *roles)
    if operation == 'cancel' and cancel_origin == 'HOSPITAL':
        require_role(actor, 'ADMIN', 'RECEPTIONIST')
    with get_db_connection() as db:
        if operation == 'check-in':
            visible = visible_encounter(db, actor, encounter_id)
            _patient_for_booking(db, visible['patient_id'], actor, online=False)
        encounter, schedules = locked_context(db, encounter_id)
        visible_encounter(db, actor, encounter_id)
        schedule = schedules[encounter['schedule_id']]
        status, now = encounter['encounter_status'], date_utils.utc_now()
        terminal = {'cancel': 'CANCELLED', 'check-in': 'CHECKED_IN', 'no-show': 'NO_SHOW', 'start': 'IN_PROGRESS'}[operation]
        if status == terminal:
            return {'encounter': _present(visible_encounter(db, actor, encounter_id))}
        fields = {'encounter_status': terminal}
        start, end = schedule_bounds(schedule)
        if operation == 'cancel':
            allowed = ('HOLDING', 'CONFIRMED') if actor['role_name'] == 'USER' else ('HOLDING', 'CONFIRMED', 'CHECKED_IN')
            if status not in allowed:
                raise conflict('Không thể hủy ở trạng thái hiện tại', 'INVALID_ENCOUNTER_STATUS')
            origin = 'HOSPITAL' if schedule['schedule_status'] == 'UNAVAILABLE' else cancel_origin
            fields.update(cancelled_by_id=actor['user_id'], cancelled_at=now, cancel_reason=reason,
                          cancel_origin=origin, refund_reference_at=encounter['estimated_exam_at'])
            _change_quota(db, schedule, -1)
        elif operation == 'check-in':
            policy = configuration_model.encounter_policy(encounter)
            deadline = encounter['estimated_exam_at'] + timedelta(minutes=policy['CHECKIN_LATE_MINUTES'] - policy['CHECKIN_EARLY_MINUTES'])
            if status != 'CONFIRMED':
                raise conflict('Chỉ check-in lượt đã thanh toán xác nhận', 'INVALID_ENCOUNTER_STATUS')
            if now.astimezone(VN_TZ).date() != schedule['work_date']:
                raise conflict('Chỉ check-in trong đúng ngày khám', 'CHECK_IN_WRONG_DAY')
            if now > deadline:
                raise conflict('Đã quá thời hạn check-in áp dụng cho lượt khám', 'CHECK_IN_TOO_LATE')
            if schedule['schedule_status'] in ('CLOSED', 'UNAVAILABLE'):
                raise conflict('Ca không hoạt động; cần điều phối', 'SCHEDULE_UNAVAILABLE')
            fields['checked_in_at'] = now
        elif operation == 'no-show':
            if status != 'CONFIRMED':
                raise conflict('Chỉ đánh dấu vắng mặt lượt chưa check-in', 'INVALID_ENCOUNTER_STATUS')
            if now <= end + timedelta(minutes=configuration_model.encounter_policy(encounter)['NO_SHOW_GRACE_MINUTES']):
                raise conflict('Chưa đến mốc vắng mặt áp dụng cho lượt khám', 'NO_SHOW_TOO_EARLY')
            _change_quota(db, schedule, -1)
        else:
            if status != 'CHECKED_IN':
                raise conflict('Chỉ bắt đầu khám lượt đã check-in', 'INVALID_ENCOUNTER_STATUS')
            if not encounter.get('checked_in_at') or encounter['checked_in_at'] > now:
                raise conflict('Chưa có xác nhận bệnh nhân đã đến hợp lệ', 'CHECK_IN_REQUIRED')
            if now < encounter['estimated_exam_at']:
                raise conflict('Chưa đến giờ hẹn khám của người bệnh', 'APPOINTMENT_NOT_STARTED')
            require_clinical_shift(schedule, now)
            if now < start or schedule['schedule_status'] in ('CLOSED', 'UNAVAILABLE'):
                raise conflict('Ca chưa bắt đầu hoặc không hoạt động', 'SCHEDULE_UNAVAILABLE')
            schedule_model.lock_doctor_and_room(db,schedule['doctor_profile_id'],schedule['room_id'])
            if model.clinical_in_progress(db,schedule['doctor_profile_id'],schedule['room_id']):
                raise conflict('Bác sĩ hoặc phòng vẫn đang khám lượt trước','EXAMINATION_IN_PROGRESS')
            next_ready=model.next_checked_in(db,schedule['schedule_id'])
            if next_ready is None or next_ready['encounter_id']!=encounter_id:
                raise conflict('Cần gọi người bệnh đã có mặt theo thứ tự trước','ENCOUNTER_NOT_NEXT')
        model.update_encounter(db, encounter_id, fields)
        if operation == 'cancel':
            from backend.app.models.payment_model import fail_pending_deposits
            fail_pending_deposits(db, encounter_id, 'ENCOUNTER_CANCELLED')
        model.add_status(db, encounter_id, status, terminal, actor['user_id'], reason or operation)
        result = _present(visible_encounter(db, actor, encounter_id))
    return {'encounter': result}


def complete_with_medical_record(db, actor, encounter_id):
    """Adapter gói 5, cùng transaction lưu bệnh án; không mở API hoàn tất ở gói 3.

    Bên gọi khóa ca/lượt trước khi ghi bệnh án rồi gọi adapter; tránh khóa bệnh án
    trước ca, làm đảo thứ tự khóa giữa các service.
    """
    require_role(actor, 'DOCTOR')
    encounter, schedules = locked_context(db, encounter_id)
    visible_encounter(db, actor, encounter_id)
    if encounter['encounter_status'] == 'COMPLETED':
        return _completion_result(db,actor,encounter_id,encounter['schedule_id'])
    if encounter['encounter_status'] != 'IN_PROGRESS':
        raise conflict('Chỉ hoàn tất lượt đang khám', 'INVALID_ENCOUNTER_STATUS')
    if medical_record_model.find_for_completion(db, encounter_id) is None:
        raise conflict('Cần lưu bệnh án trước khi hoàn tất', 'MEDICAL_RECORD_REQUIRED')
    model.update_encounter(db, encounter_id, {'encounter_status': 'COMPLETED'})
    model.add_status(db, encounter_id, 'IN_PROGRESS', 'COMPLETED', actor['user_id'], 'Hoàn tất khám và lưu bệnh án')
    return _completion_result(db,actor,encounter_id,encounter['schedule_id'])


def _completion_result(db,actor,encounter_id,schedule_id):
    next_ready=model.next_checked_in(db,schedule_id)
    return {'encounter':_present(visible_encounter(db,actor,encounter_id)),
            'next_encounter':_present(visible_encounter(db,actor,next_ready['encounter_id'])) if next_ready else None}


def create_walk_in(actor, fields):
    require_role(actor, 'ADMIN', 'RECEPTIONIST')
    with get_db_connection() as db:
        if not configuration_model.walk_in_allowed(db):
            raise conflict('Tiếp nhận walk-in đang tạm dừng', 'WALK_IN_DISABLED')
        _patient_for_booking(db, fields['patient_id'], actor, online=False)
        now = date_utils.utc_now()
        local = now.astimezone(VN_TZ)
        candidates = ([{'schedule_id':fields['schedule_id']}] if fields.get('schedule_id') else schedule_model.walk_in_candidates(db, fields['doctor_profile_id'], local))
        schedule = None
        interval = None
        locked_candidates = {row['schedule_id']: row for row in
                             schedule_model.lock_schedules(db, [c['schedule_id'] for c in candidates])} if candidates else {}
        for candidate in candidates:
            locked = locked_candidates.get(candidate['schedule_id'])
            if locked is None:raise not_found('Không tìm thấy ca','SCHEDULE_NOT_FOUND')
            if locked['doctor_profile_id']!=fields['doctor_profile_id']:raise conflict('Ca không thuộc bác sĩ đã chọn','SCHEDULE_DOCTOR_MISMATCH')
            # Sau khi chờ khóa, ca có thể đã hết chỗ; chọn ca tiếp theo.
            if locked['schedule_status'] in ('OPEN','FULL') and (locked['booked_count']<locked['max_quota'] or _extra_walk_in_allowed(db,locked,now)):
                try:
                    interval = reserve_walk_in_interval(db, locked, now)
                except AppError as error:
                    if error.code == 'SLOT_UNAVAILABLE':
                        continue
                    raise
                schedule = locked
                break
        if schedule is None:
            raise conflict('Không có ca còn tiếp nhận cho bác sĩ', 'NO_AVAILABLE_SCHEDULE')
        _make_reception_capacity(db,schedule,now)
        _require_available(schedule, now)
        doctor = _active_doctor(db, schedule)
        _reject_duplicate(db, fields['patient_id'], doctor['doctor_profile_id'], schedule['work_date'])
        start, finish = interval
        row = model.create_encounter(db, {
            'patient_id': fields['patient_id'], 'symptoms': fields.get('symptoms'),
            'encounter_type': 'WALK_IN', 'encounter_status': 'CHECKED_IN',
            'doctor_profile_id': doctor['doctor_profile_id'], 'schedule_id': schedule['schedule_id'],
            'room_id': schedule['room_id'], 'created_by_id': actor['user_id'],
            'consultation_fee_snapshot': doctor['consultation_fee'], 'deposit_amount_snapshot': 0,
            'policy_snapshot': Jsonb(configuration_model.policies(db)),
            'estimated_exam_at': start, 'appointment_end_at': finish, 'checked_in_at': now})
        ticket = row['ticket_code']
        _change_quota(db, schedule, 1)
        model.add_status(db, row['encounter_id'], None, 'CHECKED_IN', actor['user_id'], 'Tiếp nhận walk-in, phát phiếu ' + ticket)
        result = _present(visible_encounter(db, actor, row['encounter_id']))
    return {'encounter': result}


def queues(actor, query):
    require_role(actor, 'ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE')
    with get_db_connection() as db:
        rows, total = model.list_encounters(db, actor, query, queue=True)
    return _page(rows, total, query)


def affected_encounters(actor, schedule_id, query):
    require_role(actor, 'ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE')
    with get_db_connection() as db:
        schedule = schedule_model.doctor_owner(db, schedule_id)
        if schedule is None:
            raise not_found('Không tìm thấy ca', 'SCHEDULE_NOT_FOUND')
        allowed = actor['role_name'] in ('ADMIN', 'RECEPTIONIST')
        if actor['role_name'] == 'DOCTOR':
            allowed = schedule['doctor_user_id'] == actor['user_id']
        if actor['role_name'] == 'NURSE':
            allowed = schedule_model.active_nurse_assignment(db, actor['user_id'], schedule_id) is not None
        if not allowed:
            raise not_found('Không tìm thấy ca', 'SCHEDULE_NOT_FOUND')
        query = {**query, 'schedule_id': schedule_id}
        # Giữ cả HOLDING để điều phối ca báo nghỉ.
        query['encounter_status'] = None
        rows, total = model.list_affected(db, actor, schedule_id, query)
    return _page(rows, total, query)


def transfer_options(actor, encounter_id, page, page_size):
    require_role(actor, 'ADMIN', 'RECEPTIONIST')
    with get_db_connection() as db:
        encounter = visible_encounter(db, actor, encounter_id)
        if encounter['encounter_status'] not in ('CONFIRMED', 'CHECKED_IN'):
            raise conflict('Chỉ điều phối lượt đã xác nhận hoặc đang chờ', 'INVALID_ENCOUNTER_STATUS')
        local = date_utils.utc_now().astimezone(VN_TZ)
        rows, total = schedule_model.transfer_options(db, encounter, local, page, page_size)
        from backend.app.services.appointment_slot_service import available_slots
        now = date_utils.utc_now()
        for row in rows:
            row['slots'] = [{'appointment_time': start.strftime('%H:%M'),
                             'starts_at': start.isoformat(), 'ends_at': end.isoformat()}
                            for start, end in available_slots(db, row) if start >= now]
            if _extra_walk_in_allowed(db,row,now):
                try:
                    immediate_start,immediate_end=reserve_walk_in_interval(db,row,now)
                    row['slots'].insert(0,{'appointment_time':'AUTO','automatic':True,'starts_at':immediate_start.isoformat(),'ends_at':immediate_end.isoformat()})
                except AppError as error:
                    if error.code!='SLOT_UNAVAILABLE':raise
    return _page(rows, total, {'page': page, 'page_size': page_size})


def transfer(actor, encounter_id, fields):
    require_role(actor, 'ADMIN', 'RECEPTIONIST')
    with get_db_connection() as db:
        patient = model.patient_reference(db, encounter_id)
        if patient is None:
            raise not_found('Không tìm thấy lượt khám', 'ENCOUNTER_NOT_FOUND')
        patient_model.lock_reference(db, patient['patient_id'])
        encounter, schedules = locked_context(db, encounter_id, target_schedule_id=fields['schedule_id'])
        visible = visible_encounter(db, actor, encounter_id)
        if encounter['encounter_status'] not in ('CONFIRMED', 'CHECKED_IN'):
            raise conflict('Chỉ chuyển lượt đã xác nhận hoặc đang chờ', 'INVALID_ENCOUNTER_STATUS')
        old = schedules[encounter['schedule_id']]
        target = schedules[fields['schedule_id']]
        if target['doctor_profile_id'] == encounter['doctor_profile_id']:
            raise conflict('Bác sĩ mới phải khác bác sĩ hiện tại', 'SAME_DOCTOR')
        now=date_utils.utc_now()
        _make_reception_capacity(db,target,now)
        _require_available(target,now)
        doctor = _active_doctor(db, target)
        if doctor['department_id'] != visible['department_id']:
            raise conflict('Chỉ chuyển bác sĩ cùng chuyên khoa', 'DEPARTMENT_MISMATCH')
        _reject_duplicate(db, encounter['patient_id'], doctor['doctor_profile_id'], target['work_date'])
        start, finish = (reserve_walk_in_interval(db,target,now) if fields.get('appointment_time') is None else reserve_interval(db,target,fields['appointment_time'],now=now))
        _change_quota(db, target, 1)
        _change_quota(db, old, -1)
        model.update_encounter(db, encounter_id, {'doctor_profile_id': doctor['doctor_profile_id'],
                                                'schedule_id': target['schedule_id'], 'room_id': target['room_id'],
                                                'appointment_end_at': finish, 'estimated_exam_at': start})
        transfer_log_id = model.add_transfer(db, encounter_id, encounter['doctor_profile_id'], doctor['doctor_profile_id'], actor['user_id'], fields['reason'])
        from backend.app.services.staff_notification_service import encounter_transferred
        encounter_transferred(db, actor, encounter_id, transfer_log_id, old, target)
        model.add_status(db, encounter_id, encounter['encounter_status'], encounter['encounter_status'],
                        actor['user_id'], 'Chuyển khung giờ/bác sĩ; giữ giá và mã phiếu đã phát')
        result = _present(visible_encounter(db, actor, encounter_id))
    return {'encounter': result}
