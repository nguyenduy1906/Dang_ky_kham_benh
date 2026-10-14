from psycopg.types.json import Jsonb
from backend.app.utils.database_helpers import update_row, insert_row

DEPARTMENT_FIELDS = {'name','description','is_active','overview','mission','cover_image_url','group_type',
                     'specialties','clinical_services','equipment','achievements','patient_guide','gallery','extra_sections','content_is_demo'}
DEPARTMENT_JSON = {'specialties','clinical_services','equipment','achievements','patient_guide','gallery','extra_sections'}


def _department_values(fields):
    return {key: Jsonb(value) if key in DEPARTMENT_JSON else value for key,value in fields.items() if key in DEPARTMENT_FIELDS}


def list_departments(db, include_inactive=False):
    where = '' if include_inactive else ' WHERE is_active = 1'
    return db.execute(f'SELECT * FROM department{where} ORDER BY name').fetchall()


def get_department(db, department_id):
    return db.execute('SELECT * FROM department WHERE department_id = %s', (department_id,)).fetchone()


def department_name_exists(db, name, exclude_id=None):
    row = db.execute('SELECT department_id FROM department WHERE lower(name) = lower(%s)', (name,)).fetchone()
    return bool(row) and row['department_id'] != exclude_id


def create_department(db, fields):
    return insert_row(db, 'department', _department_values(fields), sorted(DEPARTMENT_FIELDS))


def update_department(db, department_id, fields):
    values = _department_values(fields)
    values.update(updated_at=db.execute('SELECT CURRENT_TIMESTAMP AS now').fetchone()['now'])
    update_row(db, 'department', 'department_id', department_id, values, DEPARTMENT_FIELDS | {'updated_at'})
    return db.execute('UPDATE department SET version=version+1 WHERE department_id=%s RETURNING *',(department_id,)).fetchone()


def department_doctors(db, department_id, *, include_inactive=False):
    active = '' if include_inactive else "AND d.is_active=1 AND u.deleted_at IS NULL AND u.account_status='ACTIVE' AND u.approval_status='APPROVED' AND r.role_name='DOCTOR'"
    return db.execute(f'''SELECT d.doctor_profile_id,d.department_id,dep.name AS department_name,u.full_name,d.academic_degree,
        d.specialization,d.experience_years,d.avatar_url,d.is_active FROM doctor_profile d JOIN users u USING(user_id)
        JOIN role r USING(role_id) JOIN department dep ON dep.department_id=d.department_id WHERE d.department_id=%s {active} ORDER BY u.full_name''',(department_id,)).fetchall()


def department_leaders(db, department_id, *, history=False, include_inactive=False):
    conditions = '' if history else 'AND l.ended_at IS NULL'
    if not include_inactive:
        conditions += " AND d.is_active=1 AND u.deleted_at IS NULL AND u.account_status='ACTIVE' AND u.approval_status='APPROVED' AND r.role_name='DOCTOR'"
    return db.execute(f'''SELECT l.*,u.full_name,d.avatar_url,d.academic_degree,d.specialization,d.experience_years,
        d.is_active,d.department_id AS current_department_id FROM department_leadership l
        JOIN doctor_profile d USING(doctor_profile_id) JOIN users u USING(user_id) JOIN role r USING(role_id)
        WHERE l.department_id=%s {conditions} ORDER BY l.appointed_at DESC,l.leadership_id DESC''',(department_id,)).fetchall()


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


def room_name_exists(db, department_id, room_name, exclude_id=None):
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
