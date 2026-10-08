"""Truy vấn SQL cho bảng users và role (db là kết nối psycopg trả về dict)."""

_USER_SELECT = 'SELECT u.*, r.role_name FROM users u JOIN role r ON r.role_id = u.role_id'

_UPDATABLE = {'role_id', 'full_name', 'phone', 'email', 'password_hash',
              'approval_status', 'account_status', 'email_verified'}


def _iso(value):
    return value.isoformat() if value is not None else None


def to_public(user):
    """Chuyển một dòng users thành dict an toàn để trả về API (không có password_hash)."""
    return {
        'user_id': user['user_id'],
        'role_id': user['role_id'],
        'role_name': user['role_name'],
        'full_name': user['full_name'],
        'phone': user['phone'],
        'email': user['email'],
        'approval_status': user['approval_status'],
        'account_status': user['account_status'],
        'email_verified': bool(user['email_verified']),
        'is_deleted': user['deleted_at'] is not None,
        'created_at': _iso(user['created_at']),
        'updated_at': _iso(user['updated_at']),
    }


def get_role_by_name(db, role_name):
    return db.execute('SELECT * FROM role WHERE role_name = %s', (role_name,)).fetchone()


def list_roles(db):
    return db.execute('SELECT role_id, role_name, description, requires_approval '
                      'FROM role ORDER BY role_id').fetchall()


def get_user_by_id(db, user_id):
    if not isinstance(user_id, int):
        return None
    return db.execute(_USER_SELECT + ' WHERE u.user_id = %s', (user_id,)).fetchone()


def get_user_by_email(db, email):
    return db.execute(_USER_SELECT + ' WHERE u.email = %s', (email,)).fetchone()


def get_user_by_phone(db, phone):
    return db.execute(_USER_SELECT + ' WHERE u.phone = %s', (phone,)).fetchone()


def find_identity_conflict(db, email, phone, exclude_user_id=None):
    """Trả về 'email' hoặc 'phone' nếu đã có người khác dùng, ngược lại None."""
    if email:
        row = db.execute('SELECT user_id FROM users WHERE email = %s', (email,)).fetchone()
        if row and row['user_id'] != exclude_user_id:
            return 'email'
    if phone:
        row = db.execute('SELECT user_id FROM users WHERE phone = %s', (phone,)).fetchone()
        if row and row['user_id'] != exclude_user_id:
            return 'phone'
    return None


def create_user(db, *, role_id, full_name, email, phone, password_hash,
                approval_status, email_verified=0):
    row = db.execute(
        'INSERT INTO users (role_id, full_name, email, phone, password_hash, '
        'approval_status, email_verified) VALUES (%s, %s, %s, %s, %s, %s, %s) '
        'RETURNING user_id',
        (role_id, full_name, email, phone, password_hash, approval_status, email_verified),
    ).fetchone()
    return row['user_id']


def update_user(db, user_id, fields):
    """Cập nhật các cột nằm trong danh sách cho phép. Trả về True nếu có dòng được sửa."""
    columns = [c for c in fields if c in _UPDATABLE]
    if not columns:
        return False
    assignments = ', '.join(f'{c} = %s' for c in columns)
    values = [fields[c] for c in columns] + [user_id]
    row = db.execute(
        f'UPDATE users SET {assignments} WHERE user_id = %s AND deleted_at IS NULL '
        'RETURNING user_id', values).fetchone()
    return row is not None


def soft_delete_user(db, user_id):
    row = db.execute('UPDATE users SET deleted_at = CURRENT_TIMESTAMP '
                     'WHERE user_id = %s AND deleted_at IS NULL RETURNING user_id',
                     (user_id,)).fetchone()
    return row is not None


def _escape_like(text):
    return text.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')


def list_users(db, *, role=None, account_status=None, approval_status=None,
               q=None, include_deleted=False, limit=20, offset=0):
    where, params = ['TRUE'], []
    if not include_deleted:
        where.append('u.deleted_at IS NULL')
    if role:
        where.append('r.role_name = %s')
        params.append(role)
    if account_status:
        where.append('u.account_status = %s')
        params.append(account_status)
    if approval_status:
        where.append('u.approval_status = %s')
        params.append(approval_status)
    if q:
        like = f'%{_escape_like(q)}%'
        where.append('(u.full_name ILIKE %s OR u.email ILIKE %s OR u.phone ILIKE %s)')
        params.extend([like, like, like])
    clause = ' AND '.join(where)
    base = 'FROM users u JOIN role r ON r.role_id = u.role_id WHERE ' + clause
    total = db.execute('SELECT COUNT(*) AS n ' + base, params).fetchone()['n']
    rows = db.execute('SELECT u.*, r.role_name ' + base +
                      ' ORDER BY u.user_id LIMIT %s OFFSET %s',
                      params + [limit, offset]).fetchall()
    return rows, total
