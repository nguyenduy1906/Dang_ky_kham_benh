from backend.app.core.errors import conflict, not_found
from backend.app.db.database import get_db_connection
from backend.app.models import medical_record_model as model, doctor_model
from backend.app.models._sql import jsonable
from backend.app.services import encounter_service as encounters


def create(actor, encounter_id, fields):
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
        row = model.create(db, record['record_id'], fields)
    return {'review': jsonable(row)}, True


def list_public(doctor_id, page, size):
    with get_db_connection() as db:
        doctor = doctor_model.get_by_id(db, doctor_id)
        if doctor is None or not doctor['is_active'] or not doctor['account_ok']:
            raise not_found('Không tìm thấy bác sĩ', 'DOCTOR_NOT_FOUND')
        rows, stats = model.list_public(db, doctor_id, page, size)
    return {'items': jsonable(rows), 'total': stats['total'],
            'average_rating': round(float(stats['average_rating']), 2) if stats['average_rating'] is not None else None,
            'page': page, 'page_size': size}
