_SELECT = '''SELECT a.*, u.full_name AS nurse_name, s.work_date, s.start_time,
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
    rows = db.execute(f'{_SELECT} WHERE {clause} ORDER BY a.assignment_id DESC LIMIT %s OFFSET %s',
                      params + [limit, offset]).fetchall()
    return rows, total


def get_assignment(db, assignment_id):
    return db.execute(f'{_SELECT} WHERE a.assignment_id = %s', (assignment_id,)).fetchone()


def create_assignment(db, actor_id, fields):
    return db.execute('INSERT INTO nurse_assignment (nurse_id, schedule_id, assigned_by_id, note) '
                      'VALUES (%s, %s, %s, %s) RETURNING assignment_id',
                      (fields['nurse_id'], fields['schedule_id'], actor_id, fields['note'])).fetchone()['assignment_id']


def revoke_assignment(db, assignment_id, actor_id):
    return db.execute('UPDATE nurse_assignment SET revoked_at = CURRENT_TIMESTAMP, revoked_by_id = %s '
                      'WHERE assignment_id = %s AND revoked_at IS NULL RETURNING assignment_id',
                      (actor_id, assignment_id)).fetchone()
