"""Bệnh án, đơn thuốc, lịch sử sửa và đánh giá lượt khám. Xử lý nghiệp vụ, quyền truy cập và transaction."""
from backend.app.core.errors import conflict, not_found
from backend.app.db.database import get_db_connection
from backend.app.medical_records import queries as records
from backend.app.doctors import queries as doctor_model
from backend.app.utils.database_helpers import jsonable
from backend.app.visits import service as encounters


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


def create_review(actor, encounter_id, fields):
    encounters.require_role(actor, 'USER')
    with get_db_connection() as db:
        encounter, _ = encounters.locked_context(db, encounter_id)
        encounters._visible(db, actor, encounter_id)
        if encounter['encounter_status'] != 'COMPLETED':
            raise conflict('Chỉ đánh giá lượt khám đã hoàn tất', 'ENCOUNTER_NOT_COMPLETED')
        record = db.execute('SELECT record_id FROM medical_record WHERE encounter_id=%s FOR UPDATE', (encounter_id,)).fetchone()
        if record is None:
            raise conflict('Lượt khám chưa có bệnh án', 'MEDICAL_RECORD_REQUIRED')
        existing = db.execute('SELECT * FROM review WHERE record_id=%s', (record['record_id'],)).fetchone()
        if existing:
            if existing['rating'] == fields['rating'] and existing['comment'] == fields['comment']:
                return {'review': jsonable(existing)}, False
            raise conflict('Lượt khám đã được đánh giá; không ghi đè đánh giá cũ', 'REVIEW_ALREADY_EXISTS')
        row = records.create(db, record['record_id'], fields)
    return {'review': jsonable(row)}, True


def list_public_reviews(doctor_id, page, size):
    with get_db_connection() as db:
        doctor = doctor_model.get_by_id(db, doctor_id)
        if doctor is None or not doctor['is_active'] or not doctor['account_ok']:
            raise not_found('Không tìm thấy bác sĩ', 'DOCTOR_NOT_FOUND')
        rows, stats = records.list_public(db, doctor_id, page, size)
    return {'items': jsonable(rows), 'total': stats['total'],
            'average_rating': round(float(stats['average_rating']), 2) if stats['average_rating'] is not None else None,
            'page': page, 'page_size': size}
