"""Đầu mối gói 3 cho quyền truy cập và transaction lượt khám."""
from datetime import datetime, timedelta, timezone

from backend.app.core.errors import conflict, forbidden, not_found
from backend.app.core.utils import VN_TZ
from backend.app.db.database import get_db_connection
from backend.app.models import encounter_model as model
from backend.app.models._sql import jsonable


def _visible(db, actor, encounter_id):
    row = model.get_encounter(db, encounter_id, actor)
    if row is None:
        raise not_found('Không tìm thấy lượt khám', 'ENCOUNTER_NOT_FOUND')
    return row


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
        row = _visible(db, actor, encounter_id)
    return {'encounter': _present(row)}


def history(actor, encounter_id, kind, page, page_size):
    with get_db_connection() as db:
        _visible(db, actor, encounter_id)
        rows, total = model.list_logs(db, encounter_id, kind, page, page_size)
    return _page(rows, total, {'page': page, 'page_size': page_size})


def locked_context(db, encounter_id, *, target_schedule_id=None):
    """Khóa ca theo ID tăng dần trước lượt khám, dùng chung cho mọi action gói 3.

    Nếu lượt khám vừa được chuyển ca giữa peek và lock, yêu cầu phải thử lại;
    không tiếp tục với ca cũ và không đảo thứ tự khóa gây deadlock.
    """
    peek = db.execute('SELECT schedule_id FROM encounter WHERE encounter_id=%s',
                      (encounter_id,)).fetchone()
    if peek is None:
        raise not_found('Không tìm thấy lượt khám', 'ENCOUNTER_NOT_FOUND')
    ids = [peek['schedule_id']]
    if target_schedule_id is not None:
        ids.append(target_schedule_id)
    schedules = {s['schedule_id']: s for s in model.lock_schedules(db, ids)}
    if len(schedules) != len(set(ids)):
        raise not_found('Không tìm thấy ca làm việc', 'SCHEDULE_NOT_FOUND')
    encounter = model.lock_encounter(db, encounter_id)
    if encounter['schedule_id'] != peek['schedule_id']:
        raise conflict('Lượt khám vừa được chuyển ca; vui lòng thử lại', 'ENCOUNTER_CHANGED')
    return encounter, schedules


def require_role(actor, *roles):
    if actor['role_name'] not in roles:
        raise forbidden()


def utc_now():
    return datetime.now(timezone.utc)


def schedule_bounds(schedule):
    return (datetime.combine(schedule['work_date'], schedule['start_time'], VN_TZ),
            datetime.combine(schedule['work_date'], schedule['end_time'], VN_TZ))


def _active_doctor(db, schedule):
    row = db.execute('SELECT d.*, u.account_status,u.approval_status,u.deleted_at,r.role_name '
                     'FROM doctor_profile d JOIN users u ON u.user_id=d.user_id '
                     'JOIN role r ON r.role_id=u.role_id JOIN department dep ON dep.department_id=d.department_id '
                     'WHERE d.doctor_profile_id=%s AND dep.is_active=1',
                     (schedule['doctor_profile_id'],)).fetchone()
    if (row is None or not row['is_active'] or row['deleted_at'] is not None
            or row['role_name'] != 'DOCTOR' or row['account_status'] != 'ACTIVE'
            or row['approval_status'] != 'APPROVED'):
        raise conflict('Bác sĩ không còn tiếp nhận', 'DOCTOR_UNAVAILABLE')
    room = db.execute('SELECT is_active FROM room WHERE room_id=%s', (schedule['room_id'],)).fetchone()
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
    db.execute('UPDATE work_schedule SET booked_count=%s,schedule_status=%s WHERE schedule_id=%s',
               (booked, status, schedule['schedule_id']))
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


def _patient_for_booking(db, patient_id, actor, *, online):
    patient = db.execute('SELECT * FROM patient WHERE patient_id=%s FOR UPDATE', (patient_id,)).fetchone()
    if patient is None or (online and patient['user_id'] != actor['user_id']):
        raise not_found('Không tìm thấy hồ sơ bệnh nhân', 'PATIENT_NOT_FOUND')
    if patient['archived_at'] is not None:
        raise conflict('Hồ sơ đã lưu trữ, không thể tạo lượt khám mới', 'PATIENT_ARCHIVED')
    return patient


def _reject_duplicate(db, patient_id, doctor_id, work_date):
    duplicate = db.execute('SELECT e.encounter_id FROM encounter e JOIN work_schedule s ON s.schedule_id=e.schedule_id '
                           "WHERE e.patient_id=%s AND e.doctor_profile_id=%s AND s.work_date=%s "
                           "AND e.encounter_status IN ('HOLDING','CONFIRMED','CHECKED_IN','IN_PROGRESS') LIMIT 1",
                           (patient_id, doctor_id, work_date)).fetchone()
    if duplicate:
        raise conflict('Bệnh nhân đã có lượt khám với bác sĩ trong ngày; dùng lượt khám hiện có',
                       'DUPLICATE_ENCOUNTER')


def create_online(actor, fields):
    require_role(actor, 'USER')
    with get_db_connection() as db:
        _patient_for_booking(db, fields['patient_id'], actor, online=True)
        schedules = model.lock_schedules(db, [fields['schedule_id']])
        if not schedules:
            raise not_found('Không tìm thấy ca làm việc', 'SCHEDULE_NOT_FOUND')
        schedule = schedules[0]
        now = utc_now()
        _require_available(schedule, now, online=True)
        doctor = _active_doctor(db, schedule)
        _reject_duplicate(db, fields['patient_id'], doctor['doctor_profile_id'], schedule['work_date'])
        # Quyết định mới: cọc bằng toàn bộ giá đăng ký khám của bác sĩ.
        start, _ = schedule_bounds(schedule)
        row = model.create_encounter(db, {
            **fields, 'encounter_type': 'ONLINE', 'encounter_status': 'HOLDING',
            'doctor_profile_id': doctor['doctor_profile_id'], 'room_id': schedule['room_id'],
            'created_by_id': actor['user_id'], 'consultation_fee_snapshot': doctor['consultation_fee'],
            'deposit_amount_snapshot': doctor['consultation_fee'],
            'estimated_exam_at': start, 'hold_expires_at': now + timedelta(minutes=10)})
        _change_quota(db, schedule, 1)
        model.add_status(db, row['encounter_id'], None, 'HOLDING', actor['user_id'], 'Giữ chỗ online 10 phút')
        result = _present(_visible(db, actor, row['encounter_id']))
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
    if utc_now() >= encounter['hold_expires_at']:
        expire_locked(db, encounter, schedule, actor_id)
        return False
    if schedule['schedule_status'] in ('CLOSED', 'UNAVAILABLE'):
        raise conflict('Ca đã đóng hoặc báo nghỉ; cần điều phối lượt khám', 'SCHEDULE_UNAVAILABLE')
    queue = model.next_queue_number(db, schedule['schedule_id'])
    model.update_encounter(db, encounter_id, {'encounter_status': 'CONFIRMED', 'queue_number': queue})
    model.add_status(db, encounter_id, 'HOLDING', 'CONFIRMED', actor_id, 'Đã thanh toán đủ tiền; cấp số ' + str(queue))
    return True


def expire_locked(db, encounter, schedule, actor_id):
    if encounter['encounter_status'] != 'HOLDING' or utc_now() < encounter['hold_expires_at']:
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
        'cancelled_by_id': actor_id, 'cancelled_at': utc_now(), 'cancel_reason': reason,
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
        encounter, schedules = locked_context(db, encounter_id)
        _visible(db, actor, encounter_id)
        schedule = schedules[encounter['schedule_id']]
        status, now = encounter['encounter_status'], utc_now()
        terminal = {'cancel': 'CANCELLED', 'check-in': 'CHECKED_IN', 'no-show': 'NO_SHOW', 'start': 'IN_PROGRESS'}[operation]
        if status == terminal:
            return {'encounter': _present(_visible(db, actor, encounter_id))}
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
            if status != 'CONFIRMED':
                raise conflict('Chỉ check-in lượt đã thanh toán xác nhận', 'INVALID_ENCOUNTER_STATUS')
            if now > encounter['estimated_exam_at'] - timedelta(minutes=30):
                raise conflict('Phải check-in ít nhất 30 phút trước giờ hẹn', 'CHECK_IN_TOO_LATE')
            if schedule['schedule_status'] in ('CLOSED', 'UNAVAILABLE'):
                raise conflict('Ca không hoạt động; cần điều phối', 'SCHEDULE_UNAVAILABLE')
            fields['checked_in_at'] = now
        elif operation == 'no-show':
            if status != 'CONFIRMED':
                raise conflict('Chỉ đánh dấu vắng mặt lượt chưa check-in', 'INVALID_ENCOUNTER_STATUS')
            if now <= end + timedelta(minutes=15):
                raise conflict('Chưa đến mốc vắng mặt (kết thúc ca + 15 phút)', 'NO_SHOW_TOO_EARLY')
            _change_quota(db, schedule, -1)
        else:
            if status != 'CHECKED_IN':
                raise conflict('Chỉ bắt đầu khám lượt đã check-in', 'INVALID_ENCOUNTER_STATUS')
            if now < start or schedule['schedule_status'] in ('CLOSED', 'UNAVAILABLE'):
                raise conflict('Ca chưa bắt đầu hoặc không hoạt động', 'SCHEDULE_UNAVAILABLE')
        model.update_encounter(db, encounter_id, fields)
        if operation == 'cancel':
            from backend.app.models.payment_model import fail_pending_deposits
            fail_pending_deposits(db, encounter_id, 'ENCOUNTER_CANCELLED')
        model.add_status(db, encounter_id, status, terminal, actor['user_id'], reason or operation)
        result = _present(_visible(db, actor, encounter_id))
    return {'encounter': result}


def complete_with_medical_record(db, actor, encounter_id):
    """Adapter gói 5, cùng transaction lưu bệnh án; không mở API hoàn tất ở gói 3.

    Bên gọi khóa ca/lượt trước khi ghi bệnh án rồi gọi adapter; tránh khóa bệnh án
    trước ca, làm đảo thứ tự khóa giữa các service.
    """
    require_role(actor, 'DOCTOR')
    encounter, _ = locked_context(db, encounter_id)
    _visible(db, actor, encounter_id)
    if encounter['encounter_status'] == 'COMPLETED':
        return {'encounter': _present(_visible(db, actor, encounter_id))}
    if encounter['encounter_status'] != 'IN_PROGRESS':
        raise conflict('Chỉ hoàn tất lượt đang khám', 'INVALID_ENCOUNTER_STATUS')
    if db.execute('SELECT 1 FROM medical_record WHERE encounter_id=%s', (encounter_id,)).fetchone() is None:
        raise conflict('Cần lưu bệnh án trước khi hoàn tất', 'MEDICAL_RECORD_REQUIRED')
    model.update_encounter(db, encounter_id, {'encounter_status': 'COMPLETED'})
    model.add_status(db, encounter_id, 'IN_PROGRESS', 'COMPLETED', actor['user_id'], 'Hoàn tất khám và lưu bệnh án')
    return {'encounter': _present(_visible(db, actor, encounter_id))}
