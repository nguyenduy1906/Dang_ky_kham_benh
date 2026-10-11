"""Route hồ sơ cá nhân (/me) và quản trị người dùng (/admin)."""
from backend.app.controllers import user_admin_controller as controller
from flask import Blueprint

from backend.app.config import constants
from backend.app.middlewares.auth_middleware import login_required, roles_required


user_admin_bp = Blueprint('user_admin', __name__)


@user_admin_bp.get('/me')
@login_required
def get_me():
    """Xem hồ sơ của tôi
    ---
    tags:
      - Me
    security:
      - Bearer: []
    responses:
      200:
        description: Thông tin tài khoản hiện tại
      401:
        description: Chưa đăng nhập
    """
    return controller.get_me()


@user_admin_bp.patch('/me')
@login_required
def update_me():
    """Cập nhật hồ sơ của tôi (full_name, email, phone)
    ---
    tags:
      - Me
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            full_name: {type: string}
            email: {type: string}
            phone: {type: string}
    responses:
      200:
        description: Đã cập nhật (đổi email sẽ hủy trạng thái đã xác minh)
      409:
        description: Email hoặc số điện thoại đã tồn tại
    """
    return controller.update_me()


@user_admin_bp.post('/me/change-password')
@login_required
def change_password():
    """Đổi mật khẩu
    ---
    tags:
      - Me
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [current_password, new_password]
          properties:
            current_password: {type: string}
            new_password: {type: string}
    responses:
      200:
        description: Đã đổi, trả về access_token mới (token cũ mất hiệu lực)
      400:
        description: Mật khẩu hiện tại sai hoặc mật khẩu mới không hợp lệ
    """
    return controller.change_password()


@user_admin_bp.get('/admin/roles')
@roles_required(constants.ROLE_ADMIN)
def admin_roles():
    """Danh sách vai trò
    ---
    tags:
      - Admin Users
    security:
      - Bearer: []
    responses:
      200:
        description: Danh sách vai trò
      403:
        description: Không phải ADMIN
    """
    return controller.admin_roles()


@user_admin_bp.get('/admin/users')
@roles_required(constants.ROLE_ADMIN)
def admin_list_users():
    """Danh sách người dùng (lọc và phân trang)
    ---
    tags:
      - Admin Users
    security:
      - Bearer: []
    parameters:
      - {in: query, name: role, type: string}
      - {in: query, name: account_status, type: string}
      - {in: query, name: approval_status, type: string}
      - {in: query, name: q, type: string}
      - {in: query, name: include_deleted, type: boolean}
      - {in: query, name: page, type: integer}
      - {in: query, name: page_size, type: integer}
    responses:
      200:
        description: Danh sách người dùng
    """
    return controller.admin_list_users()


@user_admin_bp.post('/admin/users')
@roles_required(constants.ROLE_ADMIN)
def admin_create_user():
    """Tạo người dùng (mọi vai trò)
    ---
    tags:
      - Admin Users
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [full_name, password]
          properties:
            full_name: {type: string}
            email: {type: string}
            phone: {type: string}
            password: {type: string}
            role: {type: string, example: DOCTOR}
            approval_status: {type: string, example: APPROVED}
            email_verified: {type: boolean}
    responses:
      201:
        description: Đã tạo
      409:
        description: Trùng email hoặc số điện thoại
    """
    return controller.admin_create_user()


@user_admin_bp.get('/admin/users/<int:user_id>')
@roles_required(constants.ROLE_ADMIN)
def admin_get_user(user_id):
    """Xem một người dùng
    ---
    tags:
      - Admin Users
    security:
      - Bearer: []
    parameters:
      - {in: path, name: user_id, type: integer, required: true}
    responses:
      200:
        description: Thông tin người dùng
      404:
        description: Không tìm thấy
    """
    return controller.admin_get_user(user_id)


@user_admin_bp.patch('/admin/users/<int:user_id>')
@roles_required(constants.ROLE_ADMIN)
def admin_update_user(user_id):
    """Sửa người dùng (full_name, email, phone, role, approval_status)
    ---
    tags:
      - Admin Users
    security:
      - Bearer: []
    parameters:
      - {in: path, name: user_id, type: integer, required: true}
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            full_name: {type: string}
            email: {type: string}
            phone: {type: string}
            role: {type: string}
            approval_status: {type: string}
    responses:
      200:
        description: Đã cập nhật
      403:
        description: Không được tự đổi vai trò hoặc trạng thái duyệt của mình
    """
    return controller.admin_update_user(user_id)


@user_admin_bp.patch('/admin/users/<int:user_id>/account-status')
@roles_required(constants.ROLE_ADMIN)
def admin_account_status(user_id):
    """Khóa hoặc mở khóa tài khoản
    ---
    tags:
      - Admin Users
    security:
      - Bearer: []
    parameters:
      - {in: path, name: user_id, type: integer, required: true}
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [account_status]
          properties:
            account_status: {type: string, example: LOCKED}
    responses:
      200:
        description: Đã cập nhật
    """
    return controller.admin_account_status(user_id)


@user_admin_bp.delete('/admin/users/<int:user_id>')
@roles_required(constants.ROLE_ADMIN)
def admin_delete_user(user_id):
    """Xóa mềm người dùng
    ---
    tags:
      - Admin Users
    security:
      - Bearer: []
    parameters:
      - {in: path, name: user_id, type: integer, required: true}
    responses:
      200:
        description: Đã xóa mềm
      404:
        description: Không tìm thấy
    """
    return controller.admin_delete_user(user_id)
