from backend.app.models._sql import insert_row

COLUMNS = ('record_id', 'medication_name', 'dosage', 'quantity', 'instructions')


def list_items(db, record_id):
    return db.execute('SELECT * FROM prescription_item WHERE record_id=%s ORDER BY item_id', (record_id,)).fetchall()


def replace_items(db, record_id, items):
    db.execute('DELETE FROM prescription_item WHERE record_id=%s', (record_id,))
    return [insert_row(db, 'prescription_item', {'record_id': record_id, **item}, COLUMNS) for item in items]
