from backend.app.models._sql import insert_row, update_row

_SELECT = '''SELECT d.doctor_profile_id, d.user_id, d.department_id, dep.name AS department_name,
 u.full_name, u.email, u.phone, d.academic_degree, d.specialization, d.experience_years,
 d.introduction, d.consultation_fee, d.avatar_url, d.is_active, d.created_at, d.updated_at,
 (u.deleted_at IS NULL AND u.account_status = 'ACTIVE' AND u.approval_status = 'APPROVED') AS account_ok
 FROM doctor_profile d JOIN users u ON u.user_id = d.user_id
 JOIN department dep ON dep.department_id = d.department_id'''

_COLUMNS = ['user_id', 'department_id', 'academic_degree', 'specialization', 'experience_years',
            'introduction', 'consultation_fee', 'is_active']
_UPDATABLE = {'department_id', 'academic_degree', 'specialization', 'experience_years',
              'introduction', 'consultation_fee', 'is_active', 'avatar_url'}


def list_doctors(db, *, department_id=None, q=None, include_inactive=False, limit=20, offset=0):
    where, params = ['TRUE'], []
    if not include_inactive:
        where.append('d.is_active = 1')
        where.append("u.deleted_at IS NULL AND u.account_status = 'ACTIVE' AND u.approval_status = 'APPROVED'")
    if department_id:
        where.append('d.department_id = %s')
        params.append(department_id)
    if q:
        like = '%' + q.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
        where.append('(u.full_name ILIKE %s OR d.specialization ILIKE %s)')
        params.extend([like, like])
    clause = ' AND '.join(where)
    total = db.execute('SELECT COUNT(*) AS n FROM doctor_profile d JOIN users u ON u.user_id = d.user_id '
                       f'WHERE {clause}', params).fetchone()['n']
    rows = db.execute(f'{_SELECT} WHERE {clause} ORDER BY u.full_name LIMIT %s OFFSET %s',
                      params + [limit, offset]).fetchall()
    return rows, total


def get_by_id(db, doctor_profile_id):
    return db.execute(f'{_SELECT} WHERE d.doctor_profile_id = %s', (doctor_profile_id,)).fetchone()


def get_by_user_id(db, user_id):
    return db.execute(f'{_SELECT} WHERE d.user_id = %s', (user_id,)).fetchone()


def create_profile(db, fields):
    return insert_row(db, 'doctor_profile', fields, _COLUMNS)['doctor_profile_id']


def update_profile(db, doctor_profile_id, fields):
    update_row(db, 'doctor_profile', 'doctor_profile_id', doctor_profile_id, fields, _UPDATABLE)
