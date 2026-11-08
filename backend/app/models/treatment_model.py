SELECT = '''SELECT t.*,p.full_name AS patient_name,p.patient_id,p.patient_code,p.dob AS patient_dob,
 u.full_name AS doctor_name,u.avatar_url AS doctor_avatar_url
 FROM treatment_appointment t JOIN encounter e USING(encounter_id)
 JOIN patient p USING(patient_id) JOIN users u ON u.user_id=t.doctor_user_id'''


def listing(db, actor, page, size, *, view=None, patient_id=None):
    if actor['role_name'] == 'DOCTOR':
        clause, values = 't.doctor_user_id=%s', [actor['user_id']]
    else:
        clause, values = '(p.user_id=%s OR e.created_by_id=%s)', [actor['user_id'], actor['user_id']]
    if view:
        clause += ' AND t.ends_at' + ('>=CURRENT_TIMESTAMP' if view == 'upcoming' else '<CURRENT_TIMESTAMP')
    if patient_id is not None:
        clause += ' AND p.patient_id=%s'
        values.append(patient_id)
    total = db.execute('SELECT count(*) AS n FROM (' + SELECT + ' WHERE ' + clause + ') visible', values).fetchone()['n']
    order = 'DESC' if view == 'history' else 'ASC'
    rows = db.execute(SELECT + ' WHERE ' + clause + f' ORDER BY t.starts_at {order},t.treatment_id {order} LIMIT %s OFFSET %s', values + [size, (page-1)*size]).fetchall()
    return rows, total


def batch(db, key):
    return db.execute('SELECT * FROM treatment_appointment WHERE request_key=%s ORDER BY batch_index', (key,)).fetchall()
