"""Route chuyên khoa."""
from backend.app.controllers import department_controller as controller
from flask import Blueprint

from backend.app.config import constants
from backend.app.middlewares.auth_middleware import roles_required


department_bp = Blueprint('department', __name__)


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
    return controller.list_departments()


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
    return controller.get_department(department_id)


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
    return controller.create_department()


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
    return controller.update_department(department_id)
