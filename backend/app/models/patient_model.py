from backend.app.utils.database_helpers import insert_row, update_row

_COLUMNS = ['user_id', 'full_name', 'dob', 'gender', 'id_card', 'address', 'phone',
            'health_insurance', 'relationship']
_UPDATABLE = {'full_name', 'dob', 'gender', 'id_card', 'address', 'phone',
              'health_insurance', 'relationship'}


def _nurse_scope(patient_expression):
    return (f'EXISTS (SELECT 1 FROM encounter ne JOIN nurse_assignment na '
            f'ON na.schedule_id = ne.schedule_id WHERE ne.patient_id = {patient_expression} '
            'AND na.nurse_id = %s AND na.revoked_at IS NULL)')


def nurse_can_view(db, patient_id, nurse_id):
    return db.execute('SELECT 1 FROM patient p WHERE p.patient_id = %s AND '
                      + _nurse_scope('p.patient_id'), (patient_id, nurse_id)).fetchone() is not None


def list_patients(db, *, user_id=None, nurse_id=None, q=None, include_archived=False, phone=None, booked_by_id=None, limit=20, offset=0):
    where, params = ['TRUE'], []
    if user_id is not None:
        where.append('(user_id = %s OR EXISTS (SELECT 1 FROM patient_delegate pd '
                     'WHERE pd.patient_id=patient.patient_id AND pd.user_id=%s))')
        params.extend([user_id, user_id])
    if nurse_id is not None:
        where.append(_nurse_scope('patient.patient_id'))
        params.append(nurse_id)
    if not include_archived:
        where.append('archived_at IS NULL')
    if phone is not None:
        where.append('phone=%s')
        params.append(phone)
    if booked_by_id is not None:
        where.append("EXISTS (SELECT 1 FROM encounter booked WHERE booked.patient_id=patient.patient_id "
                     "AND booked.created_by_id=%s AND booked.encounter_type='ONLINE')")
        params.append(booked_by_id)
    if q:
        like = '%' + q.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
        where.append('(full_name ILIKE %s OR phone ILIKE %s OR id_card ILIKE %s)')
        params.extend([like, like, like])
    clause = ' AND '.join(where)
    total = db.execute(f'SELECT COUNT(*) AS n FROM patient WHERE {clause}', params).fetchone()['n']
    rows = db.execute(f'SELECT * FROM patient WHERE {clause} ORDER BY patient_id DESC LIMIT %s OFFSET %s',
                      params + [limit, offset]).fetchall()
    return rows, total


def get_patient(db, patient_id):
    return db.execute('SELECT * FROM patient WHERE patient_id = %s', (patient_id,)).fetchone()


def can_book(db, patient_id, user_id):
    return db.execute('SELECT 1 FROM patient p WHERE p.patient_id=%s AND '
                      '(p.user_id=%s OR EXISTS (SELECT 1 FROM patient_delegate pd '
                      'WHERE pd.patient_id=p.patient_id AND pd.user_id=%s))',
                      (patient_id, user_id, user_id)).fetchone() is not None


def add_delegate(db, patient_id, user_id, relationship):
    db.execute('INSERT INTO patient_delegate(patient_id,user_id,relationship) VALUES (%s,%s,%s) '
               'ON CONFLICT(patient_id,user_id) DO NOTHING', (patient_id, user_id, relationship))


def find_booking_contact(db, fields):
    return db.execute("SELECT * FROM patient WHERE phone=%s "
                      "AND lower(regexp_replace(trim(full_name), '\\s+', ' ', 'g'))=%s "
                      "ORDER BY patient_id FOR UPDATE",
                      (fields['phone'], ' '.join(fields['full_name'].split()).lower())).fetchall()


def find_identity(db, fields):
    return db.execute("SELECT * FROM patient WHERE (id_card IS NOT NULL AND id_card=%s) OR "
                      "(phone=%s AND lower(regexp_replace(trim(full_name), '\\s+', ' ', 'g'))=%s "
                      "AND dob=%s) ORDER BY patient_id FOR UPDATE",
                      (fields.get('id_card'), fields['phone'],
                       ' '.join(fields['full_name'].split()).lower(), fields.get('dob'))).fetchall()


def create_patient(db, fields):
    return insert_row(db, 'patient', fields, _COLUMNS)


def update_patient(db, patient_id, fields):
    return update_row(db, 'patient', 'patient_id', patient_id, fields, _UPDATABLE)


def archive_patient(db, patient_id):
    """Chỉ đánh dấu archived_at, không xóa hồ sơ hay bệnh án."""
    return db.execute('UPDATE patient SET archived_at = CURRENT_TIMESTAMP '
                      'WHERE patient_id = %s AND archived_at IS NULL RETURNING *',
                      (patient_id,)).fetchone()


def list_encounters(db, patient_id, limit, offset, *, nurse_id=None, user_id=None):
    clause, params = 'e.patient_id = %s', [patient_id]
    if user_id is not None:
        clause += (' AND (EXISTS (SELECT 1 FROM patient p WHERE p.patient_id=e.patient_id '
                   'AND p.user_id=%s) OR e.created_by_id=%s)')
        params.extend([user_id, user_id])
    if nurse_id is not None:
        clause += (' AND EXISTS (SELECT 1 FROM nurse_assignment na WHERE na.schedule_id = e.schedule_id '
                   'AND na.nurse_id = %s AND na.revoked_at IS NULL)')
        params.append(nurse_id)
    total = db.execute(f'SELECT COUNT(*) AS n FROM encounter e WHERE {clause}',
                       params).fetchone()['n']
    rows = db.execute(
        'SELECT e.encounter_id, e.encounter_type, e.encounter_status, e.ticket_code, e.appointment_end_at, '
        'e.estimated_exam_at, e.symptoms, e.created_at, e.doctor_profile_id, '
        'du.full_name AS doctor_name, e.schedule_id, s.work_date, s.start_time, s.end_time, '
        'r.room_name FROM encounter e '
        'JOIN doctor_profile d ON d.doctor_profile_id = e.doctor_profile_id '
        'JOIN users du ON du.user_id = d.user_id '
        'JOIN work_schedule s ON s.schedule_id = e.schedule_id '
        'LEFT JOIN room r ON r.room_id = COALESCE(e.room_id, s.room_id) '
        f'WHERE {clause} ORDER BY e.created_at DESC, e.encounter_id DESC LIMIT %s OFFSET %s',
        params + [limit, offset]).fetchall()
    return rows, total
