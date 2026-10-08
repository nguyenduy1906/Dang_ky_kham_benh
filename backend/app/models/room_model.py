from backend.app.models._sql import update_row

_SELECT = ('SELECT r.*, d.name AS department_name FROM room r '
           'JOIN department d ON d.department_id = r.department_id')


def list_rooms(db, department_id=None, include_inactive=False):
    where, params = ['TRUE'], []
    if not include_inactive:
        where.append('r.is_active = 1')
    if department_id:
        where.append('r.department_id = %s')
        params.append(department_id)
    return db.execute(f'{_SELECT} WHERE {" AND ".join(where)} ORDER BY d.name, r.room_name', params).fetchall()


def get_room(db, room_id):
    return db.execute(f'{_SELECT} WHERE r.room_id = %s', (room_id,)).fetchone()


def name_exists(db, department_id, room_name, exclude_id=None):
    row = db.execute('SELECT room_id FROM room WHERE department_id = %s AND lower(room_name) = lower(%s)',
                     (department_id, room_name)).fetchone()
    return bool(row) and row['room_id'] != exclude_id


def create_room(db, fields):
    row = db.execute('INSERT INTO room (department_id, room_name, description, is_active) '
                     'VALUES (%s, %s, %s, %s) RETURNING room_id',
                     (fields['department_id'], fields['room_name'], fields['description'],
                      fields['is_active'])).fetchone()
    return row['room_id']


def update_room(db, room_id, fields):
    update_row(db, 'room', 'room_id', room_id, fields,
               {'department_id', 'room_name', 'description', 'is_active'})
