from backend.app.core.errors import not_found
from backend.app.db.database import get_db_connection
from backend.app.models import configuration_model as model
from backend.app.models._sql import jsonable
from backend.app.schemas.configuration_schema import FIXED, EDITABLE, validate_configuration
from backend.app.services.encounter_service import require_role


def _present(row):
    return {**jsonable(row), 'read_only': row['config_key'] not in EDITABLE,
            'effective_value': FIXED.get(row['config_key'], row['config_value'])}


def listing(actor, page, size):
    require_role(actor, 'ADMIN')
    with get_db_connection() as db:
        total = db.execute('SELECT COUNT(*) n FROM system_configuration').fetchone()['n']
        rows = db.execute('SELECT * FROM system_configuration ORDER BY config_key LIMIT %s OFFSET %s', (size, (page - 1) * size)).fetchall()
    return {'items': [_present(r) for r in rows], 'total': total, 'page': page, 'page_size': size}


def update(actor, key, value):
    require_role(actor, 'ADMIN')
    value = validate_configuration(key, {'config_value': value})
    with get_db_connection() as db:
        if model.get(db, key, lock=True) is None:
            raise not_found('Không tìm thấy khóa cấu hình', 'CONFIGURATION_NOT_FOUND')
        row = db.execute('UPDATE system_configuration SET config_value=%s WHERE config_key=%s RETURNING *', (value, key)).fetchone()
    return {'configuration': _present(row)}
