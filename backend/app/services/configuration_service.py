from backend.app.repositories import configuration_repository as queries
from backend.app.utils.errors import not_found
from backend.app.config.database import get_db_connection
from backend.app.repositories import configuration_repository as model
from backend.app.utils.serialization import jsonable
from backend.app.validators.configuration_validator import FIXED, EDITABLE, validate_configuration
from backend.app.services.encounter_service import require_role


def _present(row):
    return {**jsonable(row), 'read_only': row['config_key'] not in EDITABLE,
            'effective_value': FIXED.get(row['config_key'], row['config_value'])}


def listing(actor, page, size):
    require_role(actor, 'ADMIN')
    with get_db_connection() as db:
        total = queries.count_configurations(db)['n']
        rows = queries.list_configurations(db, page, size)
    return {'items': [_present(r) for r in rows], 'total': total, 'page': page, 'page_size': size}


def update(actor, key, value):
    require_role(actor, 'ADMIN')
    value = validate_configuration(key, {'config_value': value})
    with get_db_connection() as db:
        if model.get(db, key, lock=True) is None:
            raise not_found('Không tìm thấy khóa cấu hình', 'CONFIGURATION_NOT_FOUND')
        row = queries.update_value(db, key, value)
    return {'configuration': _present(row)}


def reminder_hours(db):
    row = model.get(db, 'REMINDER_BEFORE_HOURS')
    value = int(row['config_value']) if row else 24
    if not 1 <= value <= 168:
        raise RuntimeError('REMINDER_BEFORE_HOURS phải từ 1 đến 168')
    return value


def walk_in_allowed(db):
    row = model.get(db, 'ALLOW_WALK_IN')
    return row is None or row['config_value'].lower() == 'true'
