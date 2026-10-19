from backend.app.utils.database_helpers import update_row

_SELECT = '''SELECT s.schedule_id, s.doctor_profile_id, s.room_id, s.work_date, s.start_time, s.end_time,
 s.slot_minutes, s.max_quota, s.booked_count, (s.max_quota - s.booked_count) AS remaining, s.schedule_status,
 (SELECT row_to_json(m) FROM schedule_move m WHERE m.source_schedule_id=s.schedule_id) AS move,
 s.unavailable_reason, s.created_at, s.updated_at, u.full_name AS doctor_name,
 r.room_name, r.department_id, dep.name AS department_name
 FROM work_schedule s JOIN doctor_profile d ON d.doctor_profile_id = s.doctor_profile_id
 JOIN users u ON u.user_id = d.user_id JOIN room r ON r.room_id = s.room_id
 JOIN department dep ON dep.department_id = r.department_id'''

_UPDATABLE = {'room_id', 'work_date', 'start_time', 'end_time', 'max_quota', 'slot_minutes', 'schedule_status'}
_LOCKING = ('HOLDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED')
_ACTIVE = ('HOLDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')


def list_schedules(db, *, doctor_profile_id=None, room_id=None, department_id=None,
                   from_date=None, to_date=None, status=None, exclude_closed=False, limit=20, offset=0):
    where, params = ['TRUE'], []
    if exclude_closed:
        where.append("s.schedule_status <> 'CLOSED'")
    for clause, value in (('s.doctor_profile_id = %s', doctor_profile_id),
                          ('s.room_id = %s', room_id), ('r.department_id = %s', department_id),
                          ('s.work_date >= %s', from_date), ('s.work_date <= %s', to_date),
                          ('s.schedule_status = %s', status)):
        if value is not None:
            where.append(clause)
            params.append(value)
    clause = ' AND '.join(where)
    total = db.execute('SELECT COUNT(*) AS n FROM work_schedule s JOIN room r ON r.room_id = s.room_id '
                       f'WHERE {clause}', params).fetchone()['n']
    rows = db.execute(f'{_SELECT} WHERE {clause} ORDER BY s.work_date, s.start_time, s.schedule_id '
                      'LIMIT %s OFFSET %s', params + [limit, offset]).fetchall()
    return rows, total


def get_schedule(db, schedule_id):
    return db.execute(f'{_SELECT} WHERE s.schedule_id = %s', (schedule_id,)).fetchone()


def get_for_update(db, schedule_id):
    return db.execute('SELECT * FROM work_schedule WHERE schedule_id = %s FOR UPDATE',
                      (schedule_id,)).fetchone()


def lock_schedules(db, schedule_ids):
    return db.execute('SELECT * FROM work_schedule WHERE schedule_id=ANY(%s) '
                      'ORDER BY schedule_id FOR UPDATE', (sorted(set(schedule_ids)),)).fetchall()


def lock_doctor_and_room(db, doctor_profile_id, room_id):
    """Khóa hàng bác sĩ rồi phòng (luôn theo thứ tự này) để hai yêu cầu đồng thời không chèn ca trùng."""
    db.execute('SELECT 1 FROM doctor_profile WHERE doctor_profile_id = %s FOR UPDATE', (doctor_profile_id,))
    db.execute('SELECT 1 FROM room WHERE room_id = %s FOR UPDATE', (room_id,))


def find_overlap(db, column, value, work_date, start, end, exclude_id=None):
    if column not in ('doctor_profile_id', 'room_id'):
        raise ValueError(column)
    sql = (f'SELECT schedule_id FROM work_schedule WHERE {column} = %s AND work_date = %s '
           'AND start_time < %s AND end_time > %s')
    params = [value, work_date, end, start]
    if exclude_id is not None:
        sql += ' AND schedule_id <> %s'
        params.append(exclude_id)
    return db.execute(sql + ' LIMIT 1', params).fetchone() is not None


def has_locking_encounters(db, schedule_id):
    return db.execute('SELECT 1 FROM encounter WHERE schedule_id = %s AND encounter_status = ANY(%s) LIMIT 1',
                      (schedule_id, list(_LOCKING))).fetchone() is not None


def count_active_encounters(db, schedule_id):
    return db.execute('SELECT COUNT(*) AS n FROM encounter WHERE schedule_id = %s '
                      'AND encounter_status = ANY(%s)', (schedule_id, list(_ACTIVE))).fetchone()['n']


def create_schedule(db, f):
    return db.execute(
        'INSERT INTO work_schedule (doctor_profile_id, room_id, work_date, start_time, end_time, max_quota, slot_minutes) '
        'VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING schedule_id',
        (f['doctor_profile_id'], f['room_id'], f['work_date'], f['start_time'], f['end_time'],
         f['max_quota'], f['slot_minutes'])).fetchone()['schedule_id']


def update_schedule(db, schedule_id, fields):
    update_row(db, 'work_schedule', 'schedule_id', schedule_id, fields, _UPDATABLE)


def mark_unavailable(db, schedule_id, reason):
    """Legacy Python entry point; HTTP leave requests use the approval workflow."""
    db.execute("UPDATE work_schedule SET schedule_status = 'UNAVAILABLE', unavailable_reason = %s "
               'WHERE schedule_id = %s', (reason, schedule_id))


def set_booking_count(db, schedule_id, booked, status):
    db.execute('UPDATE work_schedule SET booked_count=%s,schedule_status=%s WHERE schedule_id=%s',
               (booked, status, schedule_id))


def walk_in_candidates(db, doctor_profile_id, local):
    return db.execute("SELECT schedule_id FROM work_schedule WHERE doctor_profile_id=%s "
                                "AND schedule_status IN ('OPEN','FULL') AND "
                                "(work_date>%s OR (work_date=%s AND end_time>%s)) "
                                'ORDER BY work_date,start_time,schedule_id',
                                (doctor_profile_id, local.date(), local.date(), local.time().replace(tzinfo=None))).fetchall()


def doctor_owner(db, schedule_id):
    return db.execute('SELECT s.schedule_id,d.user_id AS doctor_user_id FROM work_schedule s '
                              'JOIN doctor_profile d ON d.doctor_profile_id=s.doctor_profile_id WHERE s.schedule_id=%s',
                              (schedule_id,)).fetchone()


def transfer_options(db, encounter, local, page, page_size):
    base = ('''FROM work_schedule s JOIN doctor_profile d ON d.doctor_profile_id=s.doctor_profile_id
               JOIN users u ON u.user_id=d.user_id JOIN role role ON role.role_id=u.role_id
               JOIN room r ON r.room_id=s.room_id JOIN department dep ON dep.department_id=d.department_id
               WHERE d.department_id=%s AND d.doctor_profile_id<>%s AND s.schedule_status IN ('OPEN','FULL')
               AND (s.booked_count<s.max_quota OR (EXISTS(SELECT 1 FROM encounter done WHERE done.schedule_id=s.schedule_id AND done.encounter_status='COMPLETED') AND NOT EXISTS(SELECT 1 FROM encounter pending WHERE pending.schedule_id=s.schedule_id AND pending.encounter_status IN ('HOLDING','CONFIRMED','CHECKED_IN','IN_PROGRESS')))) AND d.is_active=1 AND r.is_active=1 AND dep.is_active=1
               AND u.deleted_at IS NULL AND u.account_status='ACTIVE' AND u.approval_status='APPROVED'
               AND role.role_name='DOCTOR' AND (s.work_date>%s OR (s.work_date=%s AND s.end_time>%s))''')
    params = [encounter['department_id'], encounter['doctor_profile_id'], local.date(), local.date(), local.time().replace(tzinfo=None)]
    total = db.execute('SELECT COUNT(*) AS n ' + base, params).fetchone()['n']
    rows = db.execute('SELECT s.*,u.full_name AS doctor_name,r.room_name ' + base +
                      ' ORDER BY s.work_date,s.start_time,s.schedule_id LIMIT %s OFFSET %s',
                      params + [page_size, (page - 1) * page_size]).fetchall()
    return rows, total


def staff_calendar(db, target_id, role, leaves, query):
    scope = 'd.user_id=%s' if role == 'DOCTOR' else '''EXISTS(SELECT 1 FROM nurse_assignment a
        WHERE a.schedule_id=s.schedule_id AND a.nurse_id=%s AND (a.revoked_at IS NULL OR a.assignment_id=ANY(%s)))'''
    scope_args = [target_id]
    if role == 'NURSE':
        # Keep approved absences visible after approval revokes clinical access.
        scope_args.append([aid for leave in leaves if leave['status'] == 'APPROVED'
                           for aid in (leave.get('effects') or {}).get('revoked_assignment_ids', [])])
    return db.execute('''SELECT s.schedule_id,s.work_date,s.start_time,s.end_time,s.schedule_status,s.room_id,r.room_name
        FROM work_schedule s JOIN doctor_profile d USING(doctor_profile_id) JOIN room r ON r.room_id=s.room_id WHERE ''' + scope +
        ' AND s.work_date BETWEEN %s AND %s ORDER BY s.work_date,s.start_time',
        (*scope_args, query['from_date'], query['to_date'])).fetchall()


def mark_unavailable_schedules(db, ids, reason):
    return db.execute("""UPDATE work_schedule SET schedule_status='UNAVAILABLE',unavailable_reason=%s
                    WHERE schedule_id=ANY(%s) AND schedule_status IN ('OPEN','FULL') RETURNING schedule_id""",
                    (reason, ids)).fetchall()


_ASSIGNMENT_SELECT = '''SELECT a.*, u.full_name AS nurse_name, s.work_date, s.start_time,
 s.end_time, s.schedule_status, s.doctor_profile_id, s.room_id, r.room_name
 FROM nurse_assignment a JOIN users u ON u.user_id = a.nurse_id
 JOIN work_schedule s ON s.schedule_id = a.schedule_id
 JOIN room r ON r.room_id = s.room_id'''


def list_assignments(db, *, nurse_id=None, schedule_id=None, include_revoked=False,
                     limit=20, offset=0):
    where, params = ['TRUE'], []
    for column, value in (('nurse_id', nurse_id), ('schedule_id', schedule_id)):
        if value is not None:
            where.append(f'a.{column} = %s')
            params.append(value)
    if not include_revoked:
        where.append('a.revoked_at IS NULL')
    clause = ' AND '.join(where)
    total = db.execute(f'SELECT COUNT(*) AS n FROM nurse_assignment a WHERE {clause}',
                       params).fetchone()['n']
    rows = db.execute(f'{_ASSIGNMENT_SELECT} WHERE {clause} ORDER BY a.assignment_id DESC LIMIT %s OFFSET %s',
                      params + [limit, offset]).fetchall()
    return rows, total


def get_assignment(db, assignment_id):
    return db.execute(f'{_ASSIGNMENT_SELECT} WHERE a.assignment_id = %s', (assignment_id,)).fetchone()


def nurse_overlap(db, nurse_id, work_date, start, end, exclude_schedule_id=None):
    return db.execute('''SELECT a.assignment_id FROM nurse_assignment a
        JOIN work_schedule s USING(schedule_id)
        WHERE a.nurse_id=%s AND a.revoked_at IS NULL AND s.work_date=%s
        AND s.start_time<%s AND s.end_time>%s
        AND (%s::integer IS NULL OR s.schedule_id<>%s) LIMIT 1''',
        (nurse_id, work_date, end, start, exclude_schedule_id, exclude_schedule_id)).fetchone()


def create_assignment(db, actor_id, fields):
    return db.execute('INSERT INTO nurse_assignment (nurse_id, schedule_id, assigned_by_id, note) '
                      'VALUES (%s, %s, %s, %s) RETURNING assignment_id',
                      (fields['nurse_id'], fields['schedule_id'], actor_id, fields['note'])).fetchone()['assignment_id']


def revoke_assignment(db, assignment_id, actor_id):
    return db.execute('UPDATE nurse_assignment SET revoked_at = CURRENT_TIMESTAMP, revoked_by_id = %s '
                      'WHERE assignment_id = %s AND revoked_at IS NULL RETURNING assignment_id',
                      (actor_id, assignment_id)).fetchone()


def active_nurse_assignment(db, nurse_id, schedule_id):
    return db.execute('SELECT 1 FROM nurse_assignment WHERE nurse_id=%s AND schedule_id=%s '
                                 'AND revoked_at IS NULL', (nurse_id, schedule_id)).fetchone()


def active_nurses(db, schedule_id):
    return db.execute('SELECT nurse_id FROM nurse_assignment WHERE schedule_id=%s AND revoked_at IS NULL', (schedule_id,))


def revoke_leave_assignments(db, actor_id, user_id, ids):
    return db.execute('''UPDATE nurse_assignment SET revoked_at=CURRENT_TIMESTAMP,revoked_by_id=%s
                    WHERE nurse_id=%s AND schedule_id=ANY(%s) AND revoked_at IS NULL RETURNING assignment_id''',
                    (actor_id, user_id, ids)).fetchall()


def get_move(db, schedule_id):
    return db.execute('SELECT * FROM schedule_move WHERE source_schedule_id=%s', (schedule_id,)).fetchone()


def record_move(db, source_id, target_id, actor_id, reason):
    db.execute('INSERT INTO schedule_move(source_schedule_id,target_schedule_id,moved_by_id,reason) '
               'VALUES (%s,%s,%s,%s)', (source_id,target_id,actor_id,reason))
    db.execute("UPDATE work_schedule SET schedule_status='CLOSED',updated_at=CURRENT_TIMESTAMP WHERE schedule_id=%s", (source_id,))


def lock_assignment(db, assignment_id):
    return db.execute('SELECT * FROM nurse_assignment WHERE assignment_id=%s FOR UPDATE',(assignment_id,)).fetchone()


def update_assignment_note(db, assignment_id, note):
    db.execute('UPDATE nurse_assignment SET note=%s WHERE assignment_id=%s',(note,assignment_id))


def record_assignment_change(db, assignment_id, resulting_id, actor_id, before, after):
    from psycopg.types.json import Jsonb
    db.execute('INSERT INTO nurse_assignment_change(assignment_id,resulting_assignment_id,changed_by_id,before_data,after_data) VALUES (%s,%s,%s,%s,%s)',
               (assignment_id,resulting_id,actor_id,Jsonb(before),Jsonb(after)))
