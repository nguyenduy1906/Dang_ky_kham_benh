"""SQL cho gói 3; tất cả nghiệp vụ nhiều bước dùng connection do service truyền vào."""
from backend.app.models._sql import insert_row, update_row

SELECT = '''SELECT e.*, p.full_name AS patient_name, p.user_id AS owner_id,
 d.department_id, u.full_name AS doctor_name, d.user_id AS doctor_user_id,
 s.work_date, s.start_time, s.end_time, s.schedule_status, r.room_name
 FROM encounter e JOIN patient p ON p.patient_id=e.patient_id
 JOIN doctor_profile d ON d.doctor_profile_id=e.doctor_profile_id
 JOIN users u ON u.user_id=d.user_id JOIN work_schedule s ON s.schedule_id=e.schedule_id
 JOIN room r ON r.room_id=s.room_id'''

COLUMNS = ('encounter_type', 'patient_id', 'doctor_profile_id', 'schedule_id', 'room_id',
           'created_by_id', 'consultation_fee_snapshot', 'deposit_amount_snapshot', 'symptoms',
           'encounter_status', 'queue_number', 'estimated_exam_at', 'hold_expires_at', 'checked_in_at')
UPDATABLE = {'doctor_profile_id', 'schedule_id', 'room_id', 'encounter_status', 'queue_number',
             'estimated_exam_at', 'checked_in_at', 'cancelled_by_id', 'cancel_reason', 'cancelled_at',
             'cancel_origin', 'refund_reference_at'}


def access_clause(actor):
    """Điều kiện áp dụng cả cho SELECT lẫn COUNT, không lọc sau phân trang."""
    role = actor['role_name']
    if role in ('ADMIN', 'RECEPTIONIST'):
        return 'TRUE', []
    if role == 'USER':
        return 'p.user_id = %s', [actor['user_id']]
    if role == 'DOCTOR':
        return 'd.user_id = %s', [actor['user_id']]
    if role == 'NURSE':
        return ('EXISTS (SELECT 1 FROM nurse_assignment na WHERE na.schedule_id=e.schedule_id '
                'AND na.nurse_id=%s AND na.revoked_at IS NULL)', [actor['user_id']])
    return 'FALSE', []


def get_encounter(db, encounter_id, actor=None):
    clause, params = access_clause(actor) if actor else ('TRUE', [])
    return db.execute(f'{SELECT} WHERE e.encounter_id=%s AND {clause}', [encounter_id] + params).fetchone()


def list_encounters(db, actor, query, *, queue=False):
    clause, params = access_clause(actor)
    where = [clause]
    for column in ('patient_id', 'schedule_id', 'doctor_profile_id', 'encounter_status', 'encounter_type'):
        value = query.get(column)
        if value is not None:
            where.append(f'e.{column}=%s')
            params.append(value)
    if queue:
        where.append("e.encounter_status IN ('CONFIRMED','CHECKED_IN','IN_PROGRESS')")
    if query.get('work_date'):
        where.append('s.work_date=%s')
        params.append(query['work_date'])
    # SELECT có đầy đủ JOIN dùng cho quyền; COUNT đếm trên cùng tập dữ liệu.
    base = f'{SELECT} WHERE ' + ' AND '.join(where)
    total = db.execute(f'SELECT COUNT(*) AS n FROM ({base}) visible', params).fetchone()['n']
    order = 's.work_date,s.start_time,e.schedule_id,e.queue_number NULLS LAST,e.encounter_id' if queue else 'e.created_at DESC,e.encounter_id DESC'
    rows = db.execute(f'{base} ORDER BY {order} LIMIT %s OFFSET %s',
                      params + [query['page_size'], (query['page'] - 1) * query['page_size']]).fetchall()
    return rows, total


def lock_schedules(db, schedule_ids):
    return db.execute('SELECT * FROM work_schedule WHERE schedule_id=ANY(%s) '
                      'ORDER BY schedule_id FOR UPDATE', (sorted(set(schedule_ids)),)).fetchall()


def lock_encounter(db, encounter_id):
    return db.execute('SELECT * FROM encounter WHERE encounter_id=%s FOR UPDATE', (encounter_id,)).fetchone()


def create_encounter(db, fields):
    return insert_row(db, 'encounter', fields, COLUMNS)


def update_encounter(db, encounter_id, fields):
    return update_row(db, 'encounter', 'encounter_id', encounter_id, fields, UPDATABLE)


def next_queue_number(db, schedule_id):
    # Ca đã khóa; bộ đếm vẫn tồn tại khi lượt khám chuyển khỏi ca.
    return db.execute('UPDATE work_schedule SET last_queue_number=GREATEST(last_queue_number, '
                      '(SELECT COALESCE(MAX(queue_number),0) FROM encounter WHERE schedule_id=%s))+1 '
                      'WHERE schedule_id=%s RETURNING last_queue_number AS n',
                      (schedule_id, schedule_id)).fetchone()['n']


def add_status(db, encounter_id, old_status, new_status, actor_id, note=None):
    row = db.execute('INSERT INTO encounter_status_log '
                     '(encounter_id,old_status,new_status,changed_by_id,note) VALUES (%s,%s,%s,%s,%s) RETURNING log_id',
                     (encounter_id, old_status, new_status, actor_id, note)).fetchone()
    from backend.app.services.notification_service import notify_status
    notify_status(db, encounter_id, row['log_id'], new_status, note)


def add_transfer(db, encounter_id, old_doctor_id, new_doctor_id, actor_id, reason):
    db.execute('INSERT INTO encounter_transfer_log '
               '(encounter_id,old_doctor_id,new_doctor_id,transferred_by_id,reason) VALUES (%s,%s,%s,%s,%s)',
               (encounter_id, old_doctor_id, new_doctor_id, actor_id, reason))


def list_logs(db, encounter_id, kind, page, page_size):
    table = {'status': 'encounter_status_log', 'transfer': 'encounter_transfer_log'}[kind]
    total = db.execute(f'SELECT COUNT(*) AS n FROM {table} WHERE encounter_id=%s',
                       (encounter_id,)).fetchone()['n']
    rows = db.execute(f'SELECT * FROM {table} WHERE encounter_id=%s ORDER BY log_id '
                      'LIMIT %s OFFSET %s', (encounter_id, page_size, (page - 1) * page_size)).fetchall()
    return rows, total
