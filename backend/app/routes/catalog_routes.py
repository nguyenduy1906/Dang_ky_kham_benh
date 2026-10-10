"""Route danh mục chuyên khoa và phòng khám."""
from flask import Blueprint, jsonify, request

from backend.app.core import constants
from backend.app.core.security import is_admin, optional_user, roles_required
from backend.app.schemas import catalog_schema
from backend.app.schemas.common_schema import bool_arg, optional_int_arg
from backend.app.services import catalog_service

department_bp = Blueprint('department', __name__)


def _admin_view():
    return is_admin(optional_user())


@department_bp.get('/departments')
def list_departments():
    """Danh sách chuyên khoa (công khai, chỉ chuyên khoa đang hoạt động)
    ---
    tags:
      - Departments
    parameters:
      - {in: query, name: include_inactive, type: boolean, description: Chỉ ADMIN có hiệu lực}
    responses:
      200:
        description: Danh sách chuyên khoa
    """
    include = bool_arg(request.args, 'include_inactive') and _admin_view()
    return jsonify(catalog_service.list_departments(include))


@department_bp.get('/departments/<int:department_id>')
def get_department(department_id):
    """Chi tiết chuyên khoa
    ---
    tags:
      - Departments
    parameters:
      - {in: path, name: department_id, type: integer, required: true}
    responses:
      200:
        description: Chuyên khoa
      404:
        description: Không tìm thấy
    """
    return jsonify(catalog_service.get_department(department_id, _admin_view()))


@department_bp.post('/admin/departments')
@roles_required(constants.ROLE_ADMIN)
def create_department():
    """Tạo chuyên khoa
    ---
    tags:
      - Departments
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [name]
          properties:
            name: {type: string, example: Nội tổng quát}
            description: {type: string}
            is_active: {type: boolean}
    responses:
      201:
        description: Đã tạo
      409:
        description: Trùng tên
    """
    fields = catalog_schema.validate_department_create(request.get_json(silent=True))
    return jsonify(catalog_service.create_department(fields)), 201


@department_bp.patch('/admin/departments/<int:department_id>')
@roles_required(constants.ROLE_ADMIN)
def update_department(department_id):
    """Sửa chuyên khoa
    ---
    tags:
      - Departments
    security:
      - Bearer: []
    parameters:
      - {in: path, name: department_id, type: integer, required: true}
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            name: {type: string}
            description: {type: string}
            is_active: {type: boolean}
    responses:
      200:
        description: Đã cập nhật
    """
    fields = catalog_schema.validate_department_update(request.get_json(silent=True))
    return jsonify(catalog_service.update_department(department_id, fields))


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
    return jsonify(catalog_service.list_rooms(optional_int_arg(request.args, 'department_id'), include))


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
    fields = catalog_schema.validate_room_create(request.get_json(silent=True))
    return jsonify(catalog_service.create_room(fields)), 201


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
    fields = catalog_schema.validate_room_update(request.get_json(silent=True))
    return jsonify(catalog_service.update_room(room_id, fields))
