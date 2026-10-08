from backend.app.models._sql import update_row

_SELECT = '''SELECT s.schedule_id, s.doctor_profile_id, s.room_id, s.work_date, s.start_time, s.end_time,
 s.max_quota, s.booked_count, (s.max_quota - s.booked_count) AS remaining, s.schedule_status,
 s.unavailable_reason, s.created_at, s.updated_at, u.full_name AS doctor_name,
 r.room_name, r.department_id, dep.name AS department_name
 FROM work_schedule s JOIN doctor_profile d ON d.doctor_profile_id = s.doctor_profile_id
 JOIN users u ON u.user_id = d.user_id JOIN room r ON r.room_id = s.room_id
 JOIN department dep ON dep.department_id = r.department_id'''

_UPDATABLE = {'room_id', 'work_date', 'start_time', 'end_time', 'max_quota', 'schedule_status'}
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
        'INSERT INTO work_schedule (doctor_profile_id, room_id, work_date, start_time, end_time, max_quota) '
        'VALUES (%s, %s, %s, %s, %s, %s) RETURNING schedule_id',
        (f['doctor_profile_id'], f['room_id'], f['work_date'], f['start_time'], f['end_time'],
         f['max_quota'])).fetchone()['schedule_id']


def update_schedule(db, schedule_id, fields):
    update_row(db, 'work_schedule', 'schedule_id', schedule_id, fields, _UPDATABLE)


def mark_unavailable(db, schedule_id, reason):
    db.execute("UPDATE work_schedule SET schedule_status = 'UNAVAILABLE', unavailable_reason = %s "
               'WHERE schedule_id = %s', (reason, schedule_id))
