from psycopg.types.json import Jsonb


def get(db, encounter_id, *, lock=False):
    suffix = ' FOR SHARE' if lock == 'share' else (' FOR UPDATE' if lock else '')
    return db.execute('SELECT * FROM medical_record WHERE encounter_id=%s' + suffix,
                      (encounter_id,)).fetchone()


def append_revision(db, record_id, entry):
    db.execute('UPDATE medical_record SET version=version+1,revision_history=revision_history || %s::jsonb '
               'WHERE record_id=%s', (Jsonb([entry]), record_id))


def update_content(db, record, values):
    return db.execute('UPDATE medical_record SET diagnosis=%s,treatment=%s,doctor_notes=%s WHERE record_id=%s', (values['diagnosis'], values['treatment'], values['doctor_notes'], record['record_id']))


def create_record(db, current_time, encounter_id, values):
    return db.execute('INSERT INTO medical_record(encounter_id,diagnosis,treatment,doctor_notes,examined_at) VALUES (%s,%s,%s,%s,%s) RETURNING *', (encounter_id, values['diagnosis'], values['treatment'], values['doctor_notes'], current_time)).fetchone()


def get_encounter_reference(db, record_id):
    return db.execute('SELECT encounter_id FROM medical_record WHERE record_id=%s', (record_id,)).fetchone()
