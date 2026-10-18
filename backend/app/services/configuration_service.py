from backend.app.core.errors import not_found
from backend.app.db.database import get_db_connection
from backend.app.models import configuration_model as model
from backend.app.utils.database_helpers import jsonable
from backend.app.schemas.configuration_schema import FIXED, EDITABLE, validate_configuration
from backend.app.core.security import require_role


def _present(row):
    return {**jsonable(row), 'read_only': row['config_key'] not in EDITABLE,
            'effective_value': FIXED.get(row['config_key'], row['config_value'])}


def listing(actor, page, size):
    require_role(actor, 'ADMIN')
    with get_db_connection() as db:
        rows, total = model.listing(db, page, size)
    return {'items': [_present(r) for r in rows], 'total': total, 'page': page, 'page_size': size}


def public_contact():
    with get_db_connection() as db:
        values = {row['config_key']: row['config_value'] for row in model.contact_values(db)}
    return {field: values.get(key, '').strip() or None for field, key in (
        ('hospital_name', 'HOSPITAL_NAME'), ('support_phone', 'SUPPORT_PHONE'),
        ('support_email', 'SUPPORT_EMAIL'), ('exam_hours', 'EXAM_HOURS'))}


def update(actor, key, value):
    require_role(actor, 'ADMIN')
    value = validate_configuration(key, {'config_value': value})
    with get_db_connection() as db:
        if model.get(db, key, lock=True) is None:
            raise not_found('Không tìm thấy khóa cấu hình', 'CONFIGURATION_NOT_FOUND')
        row = model.update(db, key, value)
    return {'configuration': _present(row)}
