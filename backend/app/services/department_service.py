from psycopg import errors as pg_errors

from backend.app.utils.errors import conflict, not_found
from backend.app.config.database import get_db_connection
from backend.app.repositories import department_repository
from backend.app.utils.serialization import flags, jsonable


def _present(row):
    return jsonable(flags(row, 'is_active'))


def list_departments(include_inactive):
    with get_db_connection() as db:
        rows = department_repository.list_departments(db, include_inactive)
    return {'items': [_present(r) for r in rows]}


def get_department(department_id, include_inactive):
    with get_db_connection() as db:
        row = department_repository.get_department(db, department_id)
    if row is None or (not row['is_active'] and not include_inactive):
        raise not_found('Không tìm thấy chuyên khoa', 'DEPARTMENT_NOT_FOUND')
    return {'department': _present(row)}


def create_department(fields):
    with get_db_connection() as db:
        if department_repository.name_exists(db, fields['name']):
            raise conflict('Tên chuyên khoa đã tồn tại', 'DUPLICATE_DEPARTMENT')
        try:
            row = department_repository.create_department(db, fields)
        except pg_errors.UniqueViolation:
            raise conflict('Tên chuyên khoa đã tồn tại', 'DUPLICATE_DEPARTMENT') from None
    return {'department': _present(row)}


def update_department(department_id, fields):
    with get_db_connection() as db:
        if department_repository.get_department(db, department_id) is None:
            raise not_found('Không tìm thấy chuyên khoa', 'DEPARTMENT_NOT_FOUND')
        if 'name' in fields and department_repository.name_exists(db, fields['name'], department_id):
            raise conflict('Tên chuyên khoa đã tồn tại', 'DUPLICATE_DEPARTMENT')
        row = department_repository.update_department(db, department_id, fields)
    return {'department': _present(row)}
