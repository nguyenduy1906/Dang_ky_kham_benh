"""Tiếp nhận và điều phối, dùng transaction/khóa/quota chung của gói 3."""
from backend.app.services import encounter_log_service
from backend.app.repositories import reception_repository as queries
from backend.app.utils.errors import conflict, not_found
from backend.app.config.database import get_db_connection
from backend.app.repositories import encounter_repository as model, encounter_log_repository as logs
from backend.app.services import encounter_service as service, configuration_service


def create_walk_in(actor, fields):
    service.require_role(actor, 'ADMIN', 'RECEPTIONIST')
    with get_db_connection() as db:
        if not configuration_service.walk_in_allowed(db):
            raise conflict('Tiếp nhận walk-in đang tạm dừng', 'WALK_IN_DISABLED')
        service._patient_for_booking(db, fields['patient_id'], actor, online=False)
        now = service.utc_now()
        local = now.astimezone(service.VN_TZ)
        candidates = queries.list_walk_in_candidates(db, fields, local)
        schedule = None
        locked_candidates = {row['schedule_id']: row for row in
                             model.lock_schedules(db, [c['schedule_id'] for c in candidates])} if candidates else {}
        for candidate in candidates:
            locked = locked_candidates[candidate['schedule_id']]
            # Sau khi chờ khóa, ca có thể đã hết chỗ; chọn ca tiếp theo.
            if locked['schedule_status'] == 'OPEN' and locked['booked_count'] < locked['max_quota']:
                schedule = locked
                break
        if schedule is None:
            raise conflict('Không có ca còn tiếp nhận cho bác sĩ', 'NO_AVAILABLE_SCHEDULE')
        service._require_available(schedule, now)
        doctor = service._active_doctor(db, schedule)
        service._reject_duplicate(db, fields['patient_id'], doctor['doctor_profile_id'], schedule['work_date'])
        queue = model.next_queue_number(db, schedule['schedule_id'])
        start, _ = service.schedule_bounds(schedule)
        row = model.create_encounter(db, {
            'patient_id': fields['patient_id'], 'symptoms': fields.get('symptoms'),
            'encounter_type': 'WALK_IN', 'encounter_status': 'CHECKED_IN',
            'doctor_profile_id': doctor['doctor_profile_id'], 'schedule_id': schedule['schedule_id'],
            'room_id': schedule['room_id'], 'created_by_id': actor['user_id'],
            'consultation_fee_snapshot': doctor['consultation_fee'], 'deposit_amount_snapshot': 0,
            'queue_number': queue, 'estimated_exam_at': max(start, now), 'checked_in_at': now})
        service._change_quota(db, schedule, 1)
        encounter_log_service.add_status(db, row['encounter_id'], None, 'CHECKED_IN', actor['user_id'], 'Tiếp nhận walk-in, cấp số ' + str(queue))
        result = service._present(service._visible(db, actor, row['encounter_id']))
    return {'encounter': result}


def queues(actor, query):
    service.require_role(actor, 'ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE')
    with get_db_connection() as db:
        rows, total = model.list_encounters(db, actor, query, queue=True)
    return service._page(rows, total, query)


def affected_encounters(actor, schedule_id, query):
    service.require_role(actor, 'ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE')
    with get_db_connection() as db:
        schedule = queries.get_schedule_doctor(db, schedule_id)
        if schedule is None:
            raise not_found('Không tìm thấy ca', 'SCHEDULE_NOT_FOUND')
        allowed = actor['role_name'] in ('ADMIN', 'RECEPTIONIST')
        if actor['role_name'] == 'DOCTOR':
            allowed = schedule['doctor_user_id'] == actor['user_id']
        if actor['role_name'] == 'NURSE':
            allowed = queries.find_nurse_assignment(db, actor, schedule_id) is not None
        if not allowed:
            raise not_found('Không tìm thấy ca', 'SCHEDULE_NOT_FOUND')
        query = {**query, 'schedule_id': schedule_id}
        # Giữ cả HOLDING để điều phối ca báo nghỉ.
        query['encounter_status'] = None
        base, params = queries.affected_scope(actor, schedule_id)
        total = queries.count_affected(db, base, params)['n']
        rows = queries.list_affected(db, base, params, query)
    return service._page(rows, total, query)


def transfer_options(actor, encounter_id, page, page_size):
    service.require_role(actor, 'ADMIN', 'RECEPTIONIST')
    with get_db_connection() as db:
        encounter = service._visible(db, actor, encounter_id)
        if encounter['encounter_status'] not in ('CONFIRMED', 'CHECKED_IN'):
            raise conflict('Chỉ điều phối lượt đã xác nhận hoặc đang chờ', 'INVALID_ENCOUNTER_STATUS')
        local = service.utc_now().astimezone(service.VN_TZ)
        base, params = queries.transfer_scope(encounter, local)
        total = queries.count_transfer_options(db, base, params)['n']
        rows = queries.list_transfer_options(db, base, page, page_size, params)
    return service._page(rows, total, {'page': page, 'page_size': page_size})


def transfer(actor, encounter_id, fields):
    service.require_role(actor, 'ADMIN', 'RECEPTIONIST')
    with get_db_connection() as db:
        patient = queries.get_patient_reference(db, encounter_id)
        if patient is None:
            raise not_found('Không tìm thấy lượt khám', 'ENCOUNTER_NOT_FOUND')
        queries.lock_transfer_patient(db, patient)
        encounter, schedules = service.locked_context(db, encounter_id, target_schedule_id=fields['schedule_id'])
        visible = service._visible(db, actor, encounter_id)
        if encounter['encounter_status'] not in ('CONFIRMED', 'CHECKED_IN'):
            raise conflict('Chỉ chuyển lượt đã xác nhận hoặc đang chờ', 'INVALID_ENCOUNTER_STATUS')
        old = schedules[encounter['schedule_id']]
        target = schedules[fields['schedule_id']]
        if target['doctor_profile_id'] == encounter['doctor_profile_id']:
            raise conflict('Bác sĩ mới phải khác bác sĩ hiện tại', 'SAME_DOCTOR')
        service._require_available(target, service.utc_now())
        doctor = service._active_doctor(db, target)
        if doctor['department_id'] != visible['department_id']:
            raise conflict('Chỉ chuyển bác sĩ cùng chuyên khoa', 'DEPARTMENT_MISMATCH')
        service._reject_duplicate(db, encounter['patient_id'], doctor['doctor_profile_id'], target['work_date'])
        queue = model.next_queue_number(db, target['schedule_id'])
        start, _ = service.schedule_bounds(target)
        service._change_quota(db, target, 1)
        service._change_quota(db, old, -1)
        model.update_encounter(db, encounter_id, {'doctor_profile_id': doctor['doctor_profile_id'],
                                                'schedule_id': target['schedule_id'], 'room_id': target['room_id'],
                                                'queue_number': queue, 'estimated_exam_at': start})
        logs.add_transfer(db, encounter_id, encounter['doctor_profile_id'], doctor['doctor_profile_id'], actor['user_id'], fields['reason'])
        encounter_log_service.add_status(db, encounter_id, encounter['encounter_status'], encounter['encounter_status'],
                        actor['user_id'], 'Chuyển ca/bác sĩ; giữ giá đã chốt; cấp số ' + str(queue))
        result = service._present(service._visible(db, actor, encounter_id))
    return {'encounter': result}
