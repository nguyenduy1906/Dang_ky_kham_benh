from backend.app.models._sql import update_row


def list_departments(db, include_inactive=False):
    where = '' if include_inactive else ' WHERE is_active = 1'
    return db.execute(f'SELECT * FROM department{where} ORDER BY name').fetchall()


def get_department(db, department_id):
    return db.execute('SELECT * FROM department WHERE department_id = %s', (department_id,)).fetchone()


def name_exists(db, name, exclude_id=None):
    row = db.execute('SELECT department_id FROM department WHERE lower(name) = lower(%s)', (name,)).fetchone()
    return bool(row) and row['department_id'] != exclude_id


def create_department(db, fields):
    return db.execute('INSERT INTO department (name, description, is_active) VALUES (%s, %s, %s) RETURNING *',
                      (fields['name'], fields['description'], fields['is_active'])).fetchone()


def update_department(db, department_id, fields):
    return update_row(db, 'department', 'department_id', department_id, fields,
                      {'name', 'description', 'is_active'})
