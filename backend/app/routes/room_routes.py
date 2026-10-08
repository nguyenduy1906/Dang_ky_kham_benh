"""Route phòng khám."""
from flask import Blueprint, jsonify, request

from backend.app.core import constants
from backend.app.core.security import is_admin, optional_user, roles_required
from backend.app.schemas import room_schema
from backend.app.schemas.common_schema import bool_arg, optional_int_arg
from backend.app.services import room_service

room_bp = Blueprint('room', __name__)


@room_bp.get('/rooms')
def list_rooms():
    """Danh sách phòng (công khai, chỉ phòng đang hoạt động)
    ---
    tags:
      - Rooms
    parameters:
      - {in: query, name: department_id, type: integer}
      - {in: query, name: include_inactive, type: boolean, description: Chỉ ADMIN có hiệu lực}
    responses:
      200:
        description: Danh sách phòng
    """
    include = bool_arg(request.args, 'include_inactive') and is_admin(optional_user())
    return jsonify(room_service.list_rooms(optional_int_arg(request.args, 'department_id'), include))


@room_bp.post('/admin/rooms')
@roles_required(constants.ROLE_ADMIN)
def create_room():
    """Tạo phòng
    ---
    tags:
      - Rooms
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [department_id, room_name]
          properties:
            department_id: {type: integer}
            room_name: {type: string, example: Phòng 101}
            description: {type: string}
            is_active: {type: boolean}
    responses:
      201:
        description: Đã tạo
      409:
        description: Trùng tên phòng trong chuyên khoa
    """
    fields = room_schema.validate_create(request.get_json(silent=True))
    return jsonify(room_service.create_room(fields)), 201


@room_bp.patch('/admin/rooms/<int:room_id>')
@roles_required(constants.ROLE_ADMIN)
def update_room(room_id):
    """Sửa phòng
    ---
    tags:
      - Rooms
    security:
      - Bearer: []
    parameters:
      - {in: path, name: room_id, type: integer, required: true}
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            department_id: {type: integer}
            room_name: {type: string}
            description: {type: string}
            is_active: {type: boolean}
    responses:
      200:
        description: Đã cập nhật
    """
    fields = room_schema.validate_update(request.get_json(silent=True))
    return jsonify(room_service.update_room(room_id, fields))
