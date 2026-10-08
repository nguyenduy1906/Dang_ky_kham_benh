def get(db, key, *, lock=False):
    return db.execute('SELECT * FROM system_configuration WHERE config_key=%s' + (' FOR UPDATE' if lock else ''), (key,)).fetchone()


def reminder_hours(db):
    row = get(db, 'REMINDER_BEFORE_HOURS')
    value = int(row['config_value']) if row else 24
    if not 1 <= value <= 168:
        raise RuntimeError('REMINDER_BEFORE_HOURS phải từ 1 đến 168')
    return value


def walk_in_allowed(db):
    row = get(db, 'ALLOW_WALK_IN')
    return row is None or row['config_value'].lower() == 'true'
