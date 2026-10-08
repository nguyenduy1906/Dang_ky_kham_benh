"""Route chuyên khoa."""
from flask import Blueprint, jsonify, request

from backend.app.core import constants
from backend.app.core.security import is_admin, optional_user, roles_required
from backend.app.schemas import department_schema
from backend.app.schemas.common_schema import bool_arg
from backend.app.services import department_service

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
    return jsonify(department_service.list_departments(include))


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
    return jsonify(department_service.get_department(department_id, _admin_view()))


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
    fields = department_schema.validate_create(request.get_json(silent=True))
    return jsonify(department_service.create_department(fields)), 201


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
    fields = department_schema.validate_update(request.get_json(silent=True))
    return jsonify(department_service.update_department(department_id, fields))
