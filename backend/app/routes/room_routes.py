"""Route phòng khám."""
from backend.app.controllers import room_controller as controller
from flask import Blueprint

from backend.app.config import constants
from backend.app.middlewares.auth_middleware import roles_required


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
    return controller.list_rooms()


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
    return controller.create_room()


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
    return controller.update_room(room_id)
