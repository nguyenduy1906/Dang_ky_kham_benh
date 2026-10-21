from psycopg.types.json import Jsonb
from backend.app.utils.database_helpers import insert_row, jsonable
from backend.app.utils import date as date_utils


def get(db, encounter_id, *, lock=False):
    suffix = ' FOR SHARE' if lock == 'share' else (' FOR UPDATE' if lock else '')
    return db.execute('SELECT * FROM medical_record WHERE encounter_id=%s' + suffix,
                      (encounter_id,)).fetchone()


def create_record(db, encounter_id, values, examined_at):
    return db.execute('INSERT INTO medical_record(encounter_id,diagnosis,treatment,doctor_notes,examined_at) '
                                'VALUES (%s,%s,%s,%s,%s) RETURNING *',
                                (encounter_id, values['diagnosis'], values['treatment'], values['doctor_notes'], examined_at)).fetchone()


def update_record(db, record_id, values):
    db.execute('UPDATE medical_record SET diagnosis=%s,treatment=%s,doctor_notes=%s WHERE record_id=%s',
                       (values['diagnosis'], values['treatment'], values['doctor_notes'], record_id))


def encounter_reference(db, record_id):
    return db.execute('SELECT encounter_id FROM medical_record WHERE record_id=%s', (record_id,)).fetchone()


def find_for_completion(db, encounter_id):
    return db.execute('SELECT 1 FROM medical_record WHERE encounter_id=%s', (encounter_id,)).fetchone()


def append_revision(db, record_id, actor_id, reason, before, after):
    # Snapshot trước/sau cả bệnh án và thuốc, khóa record do service sở hữu.
    entry = {'actor_id': actor_id, 'reason': reason, 'changed_at': date_utils.utc_now().isoformat(),
             'before': jsonable(before), 'after': jsonable(after)}
    db.execute('UPDATE medical_record SET version=version+1,revision_history=revision_history || %s::jsonb '
               'WHERE record_id=%s', (Jsonb([entry]), record_id))


PRESCRIPTION_COLUMNS = ('record_id', 'medication_name', 'dosage', 'quantity', 'instructions')


def list_items(db, record_id):
    return db.execute('SELECT * FROM prescription_item WHERE record_id=%s ORDER BY item_id', (record_id,)).fetchall()


def replace_items(db, record_id, items):
    db.execute('DELETE FROM prescription_item WHERE record_id=%s', (record_id,))
    return [insert_row(db, 'prescription_item', {'record_id': record_id, **item}, PRESCRIPTION_COLUMNS) for item in items]


def lock_review_record(db, encounter_id):
    return db.execute('SELECT record_id FROM medical_record WHERE encounter_id=%s FOR UPDATE', (encounter_id,)).fetchone()


def create_review(db, record_id, fields):
    return db.execute('INSERT INTO review(record_id,rating,comment) VALUES (%s,%s,%s) RETURNING *',
                      (record_id, fields['rating'], fields['comment'])).fetchone()


def list_public_reviews(db, doctor_id, page, size):
    base = ('FROM review r JOIN medical_record m ON m.record_id=r.record_id '
            "JOIN encounter e ON e.encounter_id=m.encounter_id WHERE e.doctor_profile_id=%s AND e.encounter_status='COMPLETED' AND NOT r.is_hidden")
    stats = db.execute('SELECT COUNT(*) AS total,AVG(r.rating) AS average_rating ' + base, (doctor_id,)).fetchone()
    # Không JOIN patient/users, không trả record/encounter ID hoặc bệnh án.
    rows = db.execute('SELECT r.review_id,r.rating,r.comment,r.created_at ' + base +
                      ' ORDER BY r.created_at DESC,r.review_id DESC LIMIT %s OFFSET %s',
                      (doctor_id, size, (page - 1) * size)).fetchall()
    return rows, stats


# Keep the old Python names available; new callers use the review-specific names.
create = create_review
list_public = list_public_reviews


def admin_reviews(db, page, size, review_id=None):
    base = (' FROM review r JOIN medical_record m ON m.record_id=r.record_id '
            'JOIN encounter e ON e.encounter_id=m.encounter_id '
            'JOIN doctor_profile d ON d.doctor_profile_id=e.doctor_profile_id '
            'JOIN users u ON u.user_id=d.user_id '
            'JOIN department dep ON dep.department_id=d.department_id ')
    params = []
    if review_id is not None:
        base += ' WHERE r.review_id=%s'
        params.append(review_id)
    total = db.execute('SELECT COUNT(*) AS n' + base, params).fetchone()['n']
    rows = db.execute('SELECT r.review_id,r.rating,r.comment,r.created_at,r.is_hidden,'
                      'u.full_name AS doctor,dep.name AS department' + base +
                      ' ORDER BY r.created_at DESC,r.review_id DESC LIMIT %s OFFSET %s',
                      params + [size, (page-1)*size]).fetchall()
    return rows, total


def set_review_visibility(db, review_id, hidden):
    return db.execute('UPDATE review SET is_hidden=%s WHERE review_id=%s RETURNING review_id,is_hidden',
                      (hidden, review_id)).fetchone()
