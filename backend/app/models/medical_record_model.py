from psycopg.types.json import Jsonb
from backend.app.models._sql import insert_row, jsonable


def get(db, encounter_id, *, lock=False):
    suffix = ' FOR SHARE' if lock == 'share' else (' FOR UPDATE' if lock else '')
    return db.execute('SELECT * FROM medical_record WHERE encounter_id=%s' + suffix,
                      (encounter_id,)).fetchone()


def append_revision(db, record_id, actor_id, reason, before, after):
    # Snapshot trước/sau cả bệnh án và thuốc, khóa record do service sở hữu.
    from backend.app.services.encounter_service import utc_now
    entry = {'actor_id': actor_id, 'reason': reason, 'changed_at': utc_now().isoformat(),
             'before': jsonable(before), 'after': jsonable(after)}
    db.execute('UPDATE medical_record SET version=version+1,revision_history=revision_history || %s::jsonb '
               'WHERE record_id=%s', (Jsonb([entry]), record_id))


PRESCRIPTION_COLUMNS = ('record_id', 'medication_name', 'dosage', 'quantity', 'instructions')


def list_items(db, record_id):
    return db.execute('SELECT * FROM prescription_item WHERE record_id=%s ORDER BY item_id', (record_id,)).fetchall()


def replace_items(db, record_id, items):
    db.execute('DELETE FROM prescription_item WHERE record_id=%s', (record_id,))
    return [insert_row(db, 'prescription_item', {'record_id': record_id, **item}, PRESCRIPTION_COLUMNS) for item in items]


def create(db, record_id, fields):
    return db.execute('INSERT INTO review(record_id,rating,comment) VALUES (%s,%s,%s) RETURNING *',
                      (record_id, fields['rating'], fields['comment'])).fetchone()


def list_public(db, doctor_id, page, size):
    base = ('FROM review r JOIN medical_record m ON m.record_id=r.record_id '
            "JOIN encounter e ON e.encounter_id=m.encounter_id WHERE e.doctor_profile_id=%s AND e.encounter_status='COMPLETED'")
    stats = db.execute('SELECT COUNT(*) AS total,AVG(r.rating) AS average_rating ' + base, (doctor_id,)).fetchone()
    # Không JOIN patient/users, không trả record/encounter ID hoặc bệnh án.
    rows = db.execute('SELECT r.review_id,r.rating,r.comment,r.created_at ' + base +
                      ' ORDER BY r.created_at DESC,r.review_id DESC LIMIT %s OFFSET %s',
                      (doctor_id, size, (page - 1) * size)).fetchall()
    return rows, stats
