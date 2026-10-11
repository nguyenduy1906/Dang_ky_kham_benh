"""SQL queries using the connection supplied by the service."""
from backend.app.repositories import encounter_repository as model


def list_walk_in_candidates(db, fields, local):
    return db.execute("SELECT schedule_id FROM work_schedule WHERE doctor_profile_id=%s AND schedule_status='OPEN' AND booked_count<max_quota AND (work_date>%s OR (work_date=%s AND end_time>%s)) ORDER BY work_date,start_time,schedule_id", (fields['doctor_profile_id'], local.date(), local.date(), local.time().replace(tzinfo=None))).fetchall()


def get_schedule_doctor(db, schedule_id):
    return db.execute('SELECT s.schedule_id,d.user_id AS doctor_user_id FROM work_schedule s JOIN doctor_profile d ON d.doctor_profile_id=s.doctor_profile_id WHERE s.schedule_id=%s', (schedule_id,)).fetchone()


def find_nurse_assignment(db, actor, schedule_id):
    return db.execute('SELECT 1 FROM nurse_assignment WHERE nurse_id=%s AND schedule_id=%s AND revoked_at IS NULL', (actor['user_id'], schedule_id)).fetchone()


def count_affected(db, base, params):
    return db.execute(f'SELECT COUNT(*) AS n FROM ({base}) affected', params).fetchone()


def list_affected(db, base, params, query):
    return db.execute(f'{base} ORDER BY e.encounter_id LIMIT %s OFFSET %s', params + [query['page_size'], (query['page'] - 1) * query['page_size']]).fetchall()


def count_transfer_options(db, base, params):
    return db.execute('SELECT COUNT(*) AS n ' + base, params).fetchone()


def list_transfer_options(db, base, page, page_size, params):
    return db.execute('SELECT s.*,u.full_name AS doctor_name,r.room_name ' + base + ' ORDER BY s.work_date,s.start_time,s.schedule_id LIMIT %s OFFSET %s', params + [page_size, (page - 1) * page_size]).fetchall()


def get_patient_reference(db, encounter_id):
    return db.execute('SELECT patient_id FROM encounter WHERE encounter_id=%s', (encounter_id,)).fetchone()


def lock_transfer_patient(db, patient):
    return db.execute('SELECT patient_id FROM patient WHERE patient_id=%s FOR UPDATE', (patient['patient_id'],))


def affected_scope(actor, schedule_id):
    clause, params = model.access_clause(actor)
    base = (f'{model.SELECT} WHERE e.schedule_id=%s AND {clause} '
            "AND e.encounter_status IN ('HOLDING','CONFIRMED','CHECKED_IN','IN_PROGRESS')")
    params = [schedule_id] + params
    return base, params


def transfer_scope(encounter, local):
    base = ('''FROM work_schedule s JOIN doctor_profile d ON d.doctor_profile_id=s.doctor_profile_id
               JOIN users u ON u.user_id=d.user_id JOIN role role ON role.role_id=u.role_id
               JOIN room r ON r.room_id=s.room_id JOIN department dep ON dep.department_id=d.department_id
               WHERE d.department_id=%s AND d.doctor_profile_id<>%s AND s.schedule_status='OPEN'
               AND s.booked_count<s.max_quota AND d.is_active=1 AND r.is_active=1 AND dep.is_active=1
               AND u.deleted_at IS NULL AND u.account_status='ACTIVE' AND u.approval_status='APPROVED'
               AND role.role_name='DOCTOR' AND (s.work_date>%s OR (s.work_date=%s AND s.end_time>%s))''')
    params = [encounter['department_id'], encounter['doctor_profile_id'], local.date(), local.date(), local.time().replace(tzinfo=None)]
    return base, params
