def add_status(db, encounter_id, old_status, new_status, actor_id, note=None):
    row = db.execute('INSERT INTO encounter_status_log '
                     '(encounter_id,old_status,new_status,changed_by_id,note) VALUES (%s,%s,%s,%s,%s) RETURNING log_id',
                     (encounter_id, old_status, new_status, actor_id, note)).fetchone()
    from backend.app.services.notification_service import notify_status
    notify_status(db, encounter_id, row['log_id'], new_status, note)


def add_transfer(db, encounter_id, old_doctor_id, new_doctor_id, actor_id, reason):
    db.execute('INSERT INTO encounter_transfer_log '
               '(encounter_id,old_doctor_id,new_doctor_id,transferred_by_id,reason) VALUES (%s,%s,%s,%s,%s)',
               (encounter_id, old_doctor_id, new_doctor_id, actor_id, reason))


def list_logs(db, encounter_id, kind, page, page_size):
    table = {'status': 'encounter_status_log', 'transfer': 'encounter_transfer_log'}[kind]
    total = db.execute(f'SELECT COUNT(*) AS n FROM {table} WHERE encounter_id=%s',
                       (encounter_id,)).fetchone()['n']
    rows = db.execute(f'SELECT * FROM {table} WHERE encounter_id=%s ORDER BY log_id '
                      'LIMIT %s OFFSET %s', (encounter_id, page_size, (page - 1) * page_size)).fetchall()
    return rows, total
