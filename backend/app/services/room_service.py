from backend.app.core.errors import bad_request, conflict, not_found
from backend.app.db.database import get_db_connection
from backend.app.models import department_model, room_model
from backend.app.models._sql import flags, jsonable


def _present(row):
    return jsonable(flags(row, 'is_active'))


def _check_department(db, department_id):
    department = department_model.get_department(db, department_id)
    if department is None or not department['is_active']:
        raise bad_request('Chuyên khoa không tồn tại hoặc đã ngưng hoạt động', 'DEPARTMENT_INVALID')


def list_rooms(department_id, include_inactive):
    with get_db_connection() as db:
        rows = room_model.list_rooms(db, department_id, include_inactive)
    return {'items': [_present(r) for r in rows]}


def create_room(fields):
    with get_db_connection() as db:
        _check_department(db, fields['department_id'])
        if room_model.name_exists(db, fields['department_id'], fields['room_name']):
            raise conflict('Phòng cùng tên đã tồn tại trong chuyên khoa', 'DUPLICATE_ROOM')
        room_id = room_model.create_room(db, fields)
        row = room_model.get_room(db, room_id)
    return {'room': _present(row)}


def update_room(room_id, fields):
    with get_db_connection() as db:
        current = room_model.get_room(db, room_id)
        if current is None:
            raise not_found('Không tìm thấy phòng', 'ROOM_NOT_FOUND')
        if 'department_id' in fields and fields['department_id'] != current['department_id']:
            _check_department(db, fields['department_id'])
        dept = fields.get('department_id', current['department_id'])
        name = fields.get('room_name', current['room_name'])
        if ('department_id' in fields or 'room_name' in fields) and \
                room_model.name_exists(db, dept, name, room_id):
            raise conflict('Phòng cùng tên đã tồn tại trong chuyên khoa', 'DUPLICATE_ROOM')
        room_model.update_room(db, room_id, fields)
        row = room_model.get_room(db, room_id)
    return {'room': _present(row)}
