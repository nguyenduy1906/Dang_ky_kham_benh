def get(db, key, *, lock=False):
    return db.execute('SELECT * FROM system_configuration WHERE config_key=%s' + (' FOR UPDATE' if lock else ''), (key,)).fetchone()


def count_configurations(db):
    return db.execute('SELECT COUNT(*) n FROM system_configuration').fetchone()


def list_configurations(db, page, size):
    return db.execute('SELECT * FROM system_configuration ORDER BY config_key LIMIT %s OFFSET %s', (size, (page - 1) * size)).fetchall()


def update_value(db, key, value):
    return db.execute('UPDATE system_configuration SET config_value=%s WHERE config_key=%s RETURNING *', (value, key)).fetchone()
