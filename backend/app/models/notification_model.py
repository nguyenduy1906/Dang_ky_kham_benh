def encounter_owner(db, encounter_id):
    return db.execute('SELECT p.user_id FROM encounter e JOIN patient p ON p.patient_id=e.patient_id '
                       'WHERE e.encounter_id=%s', (encounter_id,)).fetchone()


def create_once(db, user_id, event_key, kind, title, content, encounter_id):
    return db.execute('INSERT INTO notification(user_id,event_key,notification_type,title,content,reference_type,reference_id) '
                      "VALUES (%s,%s,%s,%s,%s,'ENCOUNTER',%s) ON CONFLICT (user_id,event_key) DO NOTHING RETURNING notification_id",
                      (user_id, event_key, kind, title, content, encounter_id)).fetchone()


def listing(db, user_id, page, size, unread_only):
    clause = 'user_id=%s' + (' AND is_read=0' if unread_only else '')
    total = db.execute('SELECT COUNT(*) AS n FROM notification WHERE ' + clause, (user_id,)).fetchone()['n']
    rows = db.execute('SELECT * FROM notification WHERE ' + clause + ' ORDER BY created_at DESC,notification_id DESC LIMIT %s OFFSET %s',
                      (user_id, size, (page - 1) * size)).fetchall()
    return rows, total


def unread_count(db, user_id):
    return db.execute('SELECT COUNT(*) AS n FROM notification WHERE user_id=%s AND is_read=0',
                       (user_id,)).fetchone()['n']


def mark_read(db, notification_id, user_id):
    return db.execute('UPDATE notification SET is_read=1 WHERE notification_id=%s AND user_id=%s RETURNING *',
                       (notification_id, user_id)).fetchone()


def read_all(db, user_id):
    return db.execute('UPDATE notification SET is_read=1 WHERE user_id=%s AND is_read=0',
                       (user_id,)).rowcount
