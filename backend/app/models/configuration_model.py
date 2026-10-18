def get(db, key, *, lock=False):
    return db.execute('SELECT * FROM system_configuration WHERE config_key=%s' + (' FOR UPDATE' if lock else ''), (key,)).fetchone()


def listing(db, page, size):
    total = db.execute('SELECT COUNT(*) n FROM system_configuration').fetchone()['n']
    rows = db.execute('SELECT * FROM system_configuration ORDER BY config_key LIMIT %s OFFSET %s', (size, (page - 1) * size)).fetchall()
    return rows, total


def update(db, key, value):
    return db.execute('UPDATE system_configuration SET config_value=%s WHERE config_key=%s RETURNING *', (value, key)).fetchone()


def contact_values(db):
    return db.execute(
        'SELECT config_key, config_value FROM system_configuration '
        'WHERE config_key IN (%s, %s, %s, %s)',
        ('HOSPITAL_NAME', 'SUPPORT_PHONE', 'SUPPORT_EMAIL', 'EXAM_HOURS')).fetchall()


def reminder_hours(db):
    row = get(db, 'REMINDER_BEFORE_HOURS')
    value = int(row['config_value']) if row else 24
    if not 1 <= value <= 168:
        raise RuntimeError('REMINDER_BEFORE_HOURS phải từ 1 đến 168')
    return value


def walk_in_allowed(db):
    row = get(db, 'ALLOW_WALK_IN')
    return row is None or row['config_value'].lower() == 'true'
