"""Tiếp nhận và điều phối, dùng transaction/khóa/quota chung của gói 3."""
from backend.app.core.errors import conflict, not_found
from backend.app.db.database import get_db_connection
from backend.app.models import encounter_model as model, encounter_log_model as logs, configuration_model
from backend.app.services import encounter_service as service


def create_walk_in(actor, fields):
    service.require_role(actor, 'ADMIN', 'RECEPTIONIST')
    with get_db_connection() as db:
        if not configuration_model.walk_in_allowed(db):
            raise conflict('Tiếp nhận walk-in đang tạm dừng', 'WALK_IN_DISABLED')
        service._patient_for_booking(db, fields['patient_id'], actor, online=False)
        now = service.utc_now()
        local = now.astimezone(service.VN_TZ)
        candidates = db.execute("SELECT schedule_id FROM work_schedule WHERE doctor_profile_id=%s "
                                "AND schedule_status='OPEN' AND booked_count<max_quota AND "
                                "(work_date>%s OR (work_date=%s AND end_time>%s)) "
                                'ORDER BY work_date,start_time,schedule_id',
                                (fields['doctor_profile_id'], local.date(), local.date(), local.time().replace(tzinfo=None))).fetchall()
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
        logs.add_status(db, row['encounter_id'], None, 'CHECKED_IN', actor['user_id'], 'Tiếp nhận walk-in, cấp số ' + str(queue))
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
        schedule = db.execute('SELECT s.schedule_id,d.user_id AS doctor_user_id FROM work_schedule s '
                              'JOIN doctor_profile d ON d.doctor_profile_id=s.doctor_profile_id WHERE s.schedule_id=%s',
                              (schedule_id,)).fetchone()
        if schedule is None:
            raise not_found('Không tìm thấy ca', 'SCHEDULE_NOT_FOUND')
        allowed = actor['role_name'] in ('ADMIN', 'RECEPTIONIST')
        if actor['role_name'] == 'DOCTOR':
            allowed = schedule['doctor_user_id'] == actor['user_id']
        if actor['role_name'] == 'NURSE':
            allowed = db.execute('SELECT 1 FROM nurse_assignment WHERE nurse_id=%s AND schedule_id=%s '
                                 'AND revoked_at IS NULL', (actor['user_id'], schedule_id)).fetchone() is not None
        if not allowed:
            raise not_found('Không tìm thấy ca', 'SCHEDULE_NOT_FOUND')
        query = {**query, 'schedule_id': schedule_id}
        # Giữ cả HOLDING để điều phối ca báo nghỉ.
        query['encounter_status'] = None
        clause, params = model.access_clause(actor)
        base = (f'{model.SELECT} WHERE e.schedule_id=%s AND {clause} '
                "AND e.encounter_status IN ('HOLDING','CONFIRMED','CHECKED_IN','IN_PROGRESS')")
        params = [schedule_id] + params
        total = db.execute(f'SELECT COUNT(*) AS n FROM ({base}) affected', params).fetchone()['n']
        rows = db.execute(f'{base} ORDER BY e.encounter_id LIMIT %s OFFSET %s',
                          params + [query['page_size'], (query['page'] - 1) * query['page_size']]).fetchall()
    return service._page(rows, total, query)


def transfer_options(actor, encounter_id, page, page_size):
    service.require_role(actor, 'ADMIN', 'RECEPTIONIST')
    with get_db_connection() as db:
        encounter = service._visible(db, actor, encounter_id)
        if encounter['encounter_status'] not in ('CONFIRMED', 'CHECKED_IN'):
            raise conflict('Chỉ điều phối lượt đã xác nhận hoặc đang chờ', 'INVALID_ENCOUNTER_STATUS')
        local = service.utc_now().astimezone(service.VN_TZ)
        base = ('''FROM work_schedule s JOIN doctor_profile d ON d.doctor_profile_id=s.doctor_profile_id
                   JOIN users u ON u.user_id=d.user_id JOIN role role ON role.role_id=u.role_id
                   JOIN room r ON r.room_id=s.room_id JOIN department dep ON dep.department_id=d.department_id
                   WHERE d.department_id=%s AND d.doctor_profile_id<>%s AND s.schedule_status='OPEN'
                   AND s.booked_count<s.max_quota AND d.is_active=1 AND r.is_active=1 AND dep.is_active=1
                   AND u.deleted_at IS NULL AND u.account_status='ACTIVE' AND u.approval_status='APPROVED'
                   AND role.role_name='DOCTOR' AND (s.work_date>%s OR (s.work_date=%s AND s.end_time>%s))''')
        params = [encounter['department_id'], encounter['doctor_profile_id'], local.date(), local.date(), local.time().replace(tzinfo=None)]
        total = db.execute('SELECT COUNT(*) AS n ' + base, params).fetchone()['n']
        rows = db.execute('SELECT s.*,u.full_name AS doctor_name,r.room_name ' + base +
                          ' ORDER BY s.work_date,s.start_time,s.schedule_id LIMIT %s OFFSET %s',
                          params + [page_size, (page - 1) * page_size]).fetchall()
    return service._page(rows, total, {'page': page, 'page_size': page_size})


def transfer(actor, encounter_id, fields):
    service.require_role(actor, 'ADMIN', 'RECEPTIONIST')
    with get_db_connection() as db:
        patient = db.execute('SELECT patient_id FROM encounter WHERE encounter_id=%s', (encounter_id,)).fetchone()
        if patient is None:
            raise not_found('Không tìm thấy lượt khám', 'ENCOUNTER_NOT_FOUND')
        db.execute('SELECT patient_id FROM patient WHERE patient_id=%s FOR UPDATE', (patient['patient_id'],))
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
        logs.add_status(db, encounter_id, encounter['encounter_status'], encounter['encounter_status'],
                        actor['user_id'], 'Chuyển ca/bác sĩ; giữ giá đã chốt; cấp số ' + str(queue))
        result = service._present(service._visible(db, actor, encounter_id))
    return {'encounter': result}
