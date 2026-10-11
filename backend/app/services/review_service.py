from backend.app.repositories import review_repository as queries
from backend.app.utils.errors import conflict, not_found
from backend.app.config.database import get_db_connection
from backend.app.repositories import review_repository as model, doctor_repository
from backend.app.utils.serialization import jsonable
from backend.app.services import encounter_service as encounters


def create(actor, encounter_id, fields):
    encounters.require_role(actor, 'USER')
    with get_db_connection() as db:
        encounter, _ = encounters.locked_context(db, encounter_id)
        encounters._visible(db, actor, encounter_id)
        if encounter['encounter_status'] != 'COMPLETED':
            raise conflict('Chỉ đánh giá lượt khám đã hoàn tất', 'ENCOUNTER_NOT_COMPLETED')
        record = queries.lock_review_record(db, encounter_id)
        if record is None:
            raise conflict('Lượt khám chưa có bệnh án', 'MEDICAL_RECORD_REQUIRED')
        existing = queries.find_existing_review(db, record)
        if existing:
            if existing['rating'] == fields['rating'] and existing['comment'] == fields['comment']:
                return {'review': jsonable(existing)}, False
            raise conflict('Lượt khám đã được đánh giá; không ghi đè đánh giá cũ', 'REVIEW_ALREADY_EXISTS')
        row = model.create(db, record['record_id'], fields)
    return {'review': jsonable(row)}, True


def list_public(doctor_id, page, size):
    with get_db_connection() as db:
        doctor = doctor_repository.get_by_id(db, doctor_id)
        if doctor is None or not doctor['is_active'] or not doctor['account_ok']:
            raise not_found('Không tìm thấy bác sĩ', 'DOCTOR_NOT_FOUND')
        rows, stats = model.list_public(db, doctor_id, page, size)
    return {'items': jsonable(rows), 'total': stats['total'],
            'average_rating': round(float(stats['average_rating']), 2) if stats['average_rating'] is not None else None,
            'page': page, 'page_size': size}
