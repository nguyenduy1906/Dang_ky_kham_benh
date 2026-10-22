from backend.app.models.configuration_model import encounter_policy
from backend.app.core.errors import conflict, not_found
from backend.app.core.security import require_role
from backend.app.utils import date as date_utils
from backend.app.db.database import get_db_connection
from backend.app.models import medical_record_model as records, doctor_model
from backend.app.utils.database_helpers import jsonable
from backend.app.services import encounter_service as encounters


def _read_access(db, actor, encounter_id):
    # Lễ tân tiếp nhận không cần nội dung bệnh án; NURSE xem theo phân công còn hiệu lực.
    require_role(actor, 'USER', 'DOCTOR', 'NURSE', 'ADMIN')
    return encounters.visible_encounter(db, actor, encounter_id)


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
    require_role(actor, 'DOCTOR')
    with get_db_connection() as db:
        encounter, schedules = encounters.locked_context(db, encounter_id)
        encounters.visible_encounter(db, actor, encounter_id)
        encounters.require_clinical_shift(schedules[encounter["schedule_id"]])
        record = records.get(db, encounter_id, lock=True)
        _editable(encounter, record, fields)
        before = _snapshot(db, record) if record else None
        values = {k: fields[k] for k in ('diagnosis', 'treatment', 'doctor_notes')}
        if record:
            if all(record[k] == v for k, v in values.items()):
                return {'medical_record': _public(record)}
            records.update_record(db, record['record_id'], values)
        else:
            record = records.create_record(db, encounter_id, values, date_utils.utc_now())
        after = records.get(db, encounter_id)
        records.append_revision(db, record['record_id'], actor['user_id'], fields['reason'] or 'Ghi bệnh án', before, _snapshot(db, after))
        result = records.get(db, encounter_id)
    return {'medical_record': _public(result)}


def _record_encounter_id(db, record_id):
    row = records.encounter_reference(db, record_id)
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
    require_role(actor, 'DOCTOR')
    with get_db_connection() as db:
        encounter_id = _record_encounter_id(db, record_id)
        encounter, schedules = encounters.locked_context(db, encounter_id)
        encounters.visible_encounter(db, actor, encounter_id)
        encounters.require_clinical_shift(schedules[encounter["schedule_id"]])
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
    require_role(actor, 'DOCTOR')
    with get_db_connection() as db:
        encounter, schedules = encounters.locked_context(db, encounter_id)
        encounters.visible_encounter(db, actor, encounter_id)
        if encounter["encounter_status"] != "COMPLETED":
            encounters.require_clinical_shift(schedules[encounter["schedule_id"]])
        record = records.get(db, encounter_id, lock=True)
        if record is None or not (record['diagnosis'] or '').strip() or record['examined_at'] is None:
            raise conflict('Cần bệnh án có chẩn đoán và thời điểm khám trước khi hoàn tất', 'MEDICAL_RECORD_INCOMPLETE')
        result = encounters.complete_with_medical_record(db, actor, encounter_id)
    return result


def create_review(actor, encounter_id, fields):
    require_role(actor, 'USER')
    with get_db_connection() as db:
        encounter, schedules = encounters.locked_context(db, encounter_id)
        encounters.visible_encounter(db, actor, encounter_id)
        if encounter['encounter_status'] != 'COMPLETED':
            raise conflict('Chỉ đánh giá lượt khám đã hoàn tất', 'ENCOUNTER_NOT_COMPLETED')
        record = records.lock_review_record(db, encounter_id)
        if record is None:
            raise conflict('Lượt khám chưa có bệnh án', 'MEDICAL_RECORD_REQUIRED')
        if fields['rating'] > encounter_policy(encounter)['MAX_REVIEW_RATING']:
            raise conflict('Điểm đánh giá vượt giới hạn áp dụng cho lượt khám', 'REVIEW_RATING_LIMIT')
        row = records.create_review(db, record['record_id'], fields)
    return {'review': jsonable(row)}, True


def list_public_reviews(doctor_id, page, size):
    with get_db_connection() as db:
        doctor = doctor_model.get_by_id(db, doctor_id)
        if doctor is None or not doctor['is_active'] or not doctor['account_ok']:
            raise not_found('Không tìm thấy bác sĩ', 'DOCTOR_NOT_FOUND')
        rows, stats = records.list_public_reviews(db, doctor_id, page, size)
    return {'items': jsonable(rows), 'total': stats['total'],
            'average_rating': round(float(stats['average_rating']), 2) if stats['average_rating'] is not None else None,
            'page': page, 'page_size': size}


def admin_reviews(actor, page, size, review_id=None):
    require_role(actor, 'ADMIN')
    with get_db_connection() as db:
        rows, total = records.admin_reviews(db, page, size, review_id)
    return {'items': jsonable(rows), 'total': total, 'page': page, 'page_size': size}


def set_review_visibility(actor, review_id, hidden):
    require_role(actor, 'ADMIN')
    with get_db_connection() as db:
        row = records.set_review_visibility(db, review_id, hidden)
        if row is None:
            raise not_found('Không tìm thấy đánh giá')
    return {'review': jsonable(row)}


def doctor_history(actor, patient_id, page, size, encounter_id=None):
    """Read-only history; generic encounter/write permissions are deliberately unchanged."""
    require_role(actor,'DOCTOR')
    from backend.app.models import encounter_model
    with get_db_connection(read_only=True) as db:
        local_now=date_utils.utc_now().astimezone(date_utils.VN_TZ)
        scope=encounter_model.doctor_history_scope(db,actor,patient_id,local_now)
        if not scope['own_history'] and not scope['current_assignment']:
            raise not_found('Không có hồ sơ bệnh nhân trong phạm vi phụ trách','PATIENT_HISTORY_NOT_FOUND')
        rows,total=encounter_model.doctor_patient_history(db,actor,patient_id,bool(scope['current_assignment']),page,size,encounter_id)
        if encounter_id is None:
            return {'items':[encounters._present(row) for row in rows],'total':total,'page':page,'page_size':size,
                    'can_view_other_doctors':bool(scope['current_assignment'])}
        if not rows:
            raise not_found('Không tìm thấy lần khám được phép xem','ENCOUNTER_NOT_FOUND')
        encounter=rows[0]
        record=records.get(db,encounter['encounter_id']) if encounter['encounter_status']=='COMPLETED' else None
        items=records.list_items(db,record['record_id']) if record else []
        return {'encounter':encounters._present(encounter),'medical_record':_public(record) if record else None,
                'items':jsonable(items)}
