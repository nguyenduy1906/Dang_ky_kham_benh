from backend.app.core.errors import conflict, not_found
from backend.app.db.database import get_db_connection
from backend.app.models import medical_record_model as records
from backend.app.models._sql import jsonable
from backend.app.services import encounter_service as encounters


def _read_access(db, actor, encounter_id):
    # Lễ tân tiếp nhận không cần nội dung bệnh án; NURSE xem theo phân công còn hiệu lực.
    encounters.require_role(actor, 'USER', 'DOCTOR', 'NURSE', 'ADMIN')
    return encounters._visible(db, actor, encounter_id)


def _snapshot(db, record):
    return {'diagnosis': record['diagnosis'], 'treatment': record['treatment'],
            'doctor_notes': record['doctor_notes'], 'examined_at': record['examined_at'],
            'prescription_items': records.list_items(db, record['record_id'])}


def _public(row):
    data = dict(row)
    data.pop('revision_history', None)
    return jsonable(data)


def get_record(actor, encounter_id):
    with get_db_connection() as db:
        _read_access(db, actor, encounter_id)
        record = records.get(db, encounter_id)
        if record is None:
            raise not_found('Chưa có bệnh án', 'MEDICAL_RECORD_NOT_FOUND')
    return {'medical_record': _public(record)}


def _editable(encounter, record, fields):
    if encounter['encounter_status'] not in ('IN_PROGRESS', 'COMPLETED'):
        raise conflict('Chỉ ghi bệnh án khi đang khám hoặc bổ sung sau hoàn tất', 'INVALID_ENCOUNTER_STATUS')
    if encounter['encounter_status'] == 'COMPLETED':
        if record is None:
            raise conflict('Lượt hoàn tất thiếu bệnh án; cần đối soát dữ liệu', 'MEDICAL_RECORD_REQUIRED')
        if not fields['reason']:
            raise conflict('Sửa sau hoàn tất phải có lý do', 'AMENDMENT_REASON_REQUIRED')
        if fields['expected_version'] is None:
            raise conflict('Sửa sau hoàn tất cần expected_version hiện tại', 'RECORD_VERSION_REQUIRED')
    if fields['expected_version'] is not None and fields['expected_version'] != (record['version'] if record else 0):
        raise conflict('Bệnh án đã thay đổi, đọc lại version trước khi ghi', 'RECORD_VERSION_CONFLICT')


def put_record(actor, encounter_id, fields):
    encounters.require_role(actor, 'DOCTOR')
    with get_db_connection() as db:
        encounter, _ = encounters.locked_context(db, encounter_id)
        encounters._visible(db, actor, encounter_id)
        record = records.get(db, encounter_id, lock=True)
        _editable(encounter, record, fields)
        before = _snapshot(db, record) if record else None
        values = {k: fields[k] for k in ('diagnosis', 'treatment', 'doctor_notes')}
        if record:
            if all(record[k] == v for k, v in values.items()):
                return {'medical_record': _public(record)}
            db.execute('UPDATE medical_record SET diagnosis=%s,treatment=%s,doctor_notes=%s WHERE record_id=%s',
                       (values['diagnosis'], values['treatment'], values['doctor_notes'], record['record_id']))
        else:
            record = db.execute('INSERT INTO medical_record(encounter_id,diagnosis,treatment,doctor_notes,examined_at) '
                                'VALUES (%s,%s,%s,%s,%s) RETURNING *',
                                (encounter_id, values['diagnosis'], values['treatment'], values['doctor_notes'], encounters.utc_now())).fetchone()
        after = records.get(db, encounter_id)
        records.append_revision(db, record['record_id'], actor['user_id'], fields['reason'] or 'Ghi bệnh án', before, _snapshot(db, after))
        result = records.get(db, encounter_id)
    return {'medical_record': _public(result)}


def _record_encounter_id(db, record_id):
    row = db.execute('SELECT encounter_id FROM medical_record WHERE record_id=%s', (record_id,)).fetchone()
    if row is None:
        raise not_found('Không tìm thấy bệnh án', 'MEDICAL_RECORD_NOT_FOUND')
    return row['encounter_id']


def get_items(actor, record_id, page, size):
    with get_db_connection() as db:
        encounter_id = _record_encounter_id(db, record_id)
        _read_access(db, actor, encounter_id)
        record = records.get(db, encounter_id, lock='share')
        rows = records.list_items(db, record_id)
    return {'items': jsonable(rows[(page - 1) * size:page * size]), 'total': len(rows),
            'page': page, 'page_size': size, 'record_version': record['version']}


def put_items(actor, record_id, fields):
    encounters.require_role(actor, 'DOCTOR')
    with get_db_connection() as db:
        encounter_id = _record_encounter_id(db, record_id)
        encounter, _ = encounters.locked_context(db, encounter_id)
        encounters._visible(db, actor, encounter_id)
        record = records.get(db, encounter_id, lock=True)
        _editable(encounter, record, fields)
        before = _snapshot(db, record)
        existing = [{k: r[k] for k in ('medication_name', 'dosage', 'quantity', 'instructions')} for r in before['prescription_items']]
        if existing != fields['items']:
            records.replace_items(db, record_id, fields['items'])
            records.append_revision(db, record_id, actor['user_id'], fields['reason'] or 'Cập nhật đơn thuốc', before, _snapshot(db, record))
        result = records.get(db, encounter_id)
        rows = records.list_items(db, record_id)
    return {'items': jsonable(rows), 'record_version': result['version']}


def complete(actor, encounter_id):
    encounters.require_role(actor, 'DOCTOR')
    with get_db_connection() as db:
        encounter, _ = encounters.locked_context(db, encounter_id)
        encounters._visible(db, actor, encounter_id)
        record = records.get(db, encounter_id, lock=True)
        if record is None or not (record['diagnosis'] or '').strip() or record['examined_at'] is None:
            raise conflict('Cần bệnh án có chẩn đoán và thời điểm khám trước khi hoàn tất', 'MEDICAL_RECORD_INCOMPLETE')
        result = encounters.complete_with_medical_record(db, actor, encounter_id)
    return result
