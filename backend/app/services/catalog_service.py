from psycopg import errors as pg_errors

from backend.app.core.errors import bad_request, conflict, not_found
from backend.app.db.database import get_db_connection
from backend.app.models import catalog_model
from backend.app.models._sql import flags, jsonable


def _present(row):
    return jsonable(flags(row, 'is_active'))


def list_departments(include_inactive):
    with get_db_connection() as db:
        rows = catalog_model.list_departments(db, include_inactive)
    return {'items': [_present(r) for r in rows]}


def get_department(department_id, include_inactive):
    with get_db_connection() as db:
        row = catalog_model.get_department(db, department_id)
    if row is None or (not row['is_active'] and not include_inactive):
        raise not_found('Không tìm thấy chuyên khoa', 'DEPARTMENT_NOT_FOUND')
    return {'department': _present(row)}


def create_department(fields):
    with get_db_connection() as db:
        if catalog_model.department_name_exists(db, fields['name']):
            raise conflict('Tên chuyên khoa đã tồn tại', 'DUPLICATE_DEPARTMENT')
        try:
            row = catalog_model.create_department(db, fields)
        except pg_errors.UniqueViolation:
            raise conflict('Tên chuyên khoa đã tồn tại', 'DUPLICATE_DEPARTMENT') from None
    return {'department': _present(row)}


def update_department(department_id, fields):
    with get_db_connection() as db:
        if catalog_model.get_department(db, department_id) is None:
            raise not_found('Không tìm thấy chuyên khoa', 'DEPARTMENT_NOT_FOUND')
        if 'name' in fields and catalog_model.department_name_exists(db, fields['name'], department_id):
            raise conflict('Tên chuyên khoa đã tồn tại', 'DUPLICATE_DEPARTMENT')
        row = catalog_model.update_department(db, department_id, fields)
    return {'department': _present(row)}


def _check_department(db, department_id):
    department = catalog_model.get_department(db, department_id)
    if department is None or not department['is_active']:
        raise bad_request('Chuyên khoa không tồn tại hoặc đã ngưng hoạt động', 'DEPARTMENT_INVALID')


def list_rooms(department_id, include_inactive):
    with get_db_connection() as db:
        rows = catalog_model.list_rooms(db, department_id, include_inactive)
    return {'items': [_present(r) for r in rows]}


def create_room(fields):
    with get_db_connection() as db:
        _check_department(db, fields['department_id'])
        if catalog_model.room_name_exists(db, fields['department_id'], fields['room_name']):
            raise conflict('Phòng cùng tên đã tồn tại trong chuyên khoa', 'DUPLICATE_ROOM')
        room_id = catalog_model.create_room(db, fields)
        row = catalog_model.get_room(db, room_id)
    return {'room': _present(row)}


def update_room(room_id, fields):
    with get_db_connection() as db:
        current = catalog_model.get_room(db, room_id)
        if current is None:
            raise not_found('Không tìm thấy phòng', 'ROOM_NOT_FOUND')
        if 'department_id' in fields and fields['department_id'] != current['department_id']:
            _check_department(db, fields['department_id'])
        dept = fields.get('department_id', current['department_id'])
        name = fields.get('room_name', current['room_name'])
        if ('department_id' in fields or 'room_name' in fields) and \
                catalog_model.room_name_exists(db, dept, name, room_id):
            raise conflict('Phòng cùng tên đã tồn tại trong chuyên khoa', 'DUPLICATE_ROOM')
        catalog_model.update_room(db, room_id, fields)
        row = catalog_model.get_room(db, room_id)
    return {'room': _present(row)}
