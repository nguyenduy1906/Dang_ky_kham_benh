"""Route xác thực: đăng ký, đăng nhập, quên mật khẩu/OTP, xác minh email."""
from flask import Blueprint, jsonify, request

from backend.app.core import constants
from backend.app.core.security import current_user, login_required, roles_required
from backend.app.schemas import auth_schema
from backend.app.services import auth_service

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')


def _body():
    return request.get_json(silent=True)


@auth_bp.post('/register')
def register():
    """Đăng ký tài khoản (luôn tạo vai trò USER)
    ---
    tags:
      - Auth
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [full_name, password]
          properties:
            full_name: {type: string, example: Nguyen Van A}
            email: {type: string, example: a@example.com}
            phone: {type: string, example: "0901234567"}
            password: {type: string, example: Medical12345}
            dob: {type: string, format: date, x-nullable: true, description: Từ 1900-01-01 đến hôm nay}
            gender: {type: string, enum: [Nam, Nữ, Khác], x-nullable: true}
            id_card: {type: string, pattern: '^[0-9]{12}$', x-nullable: true, description: CCCD duy nhất trong tài khoản}
            address: {type: string, maxLength: 255, x-nullable: true}
            emergency_contact_name: {type: string, maxLength: 150, x-nullable: true}
            emergency_contact_phone: {type: string, x-nullable: true}
            emergency_contact_relationship: {type: string, maxLength: 50, x-nullable: true}
    responses:
      201:
        schema: {$ref: '#/definitions/AccountProfileResponse'}
        description: Đăng ký thành công
      400:
        description: Dữ liệu không hợp lệ
      409:
        description: Email hoặc số điện thoại đã tồn tại
    """
    data = auth_schema.validate_register(_body())
    return jsonify(auth_service.register(data)), 201


@auth_bp.post('/login')
def login():
    """Đăng nhập bằng email hoặc số điện thoại
    ---
    tags:
      - Auth
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [identifier, password]
          properties:
            identifier: {type: string, example: a@example.com}
            password: {type: string, example: Medical12345}
    responses:
      200:
        description: Trả về access_token (dùng nút Authorize với giá trị Bearer token)
      401:
        description: Sai thông tin đăng nhập
      403:
        description: Tài khoản bị khóa hoặc chưa được duyệt
    """
    data = auth_schema.validate_login(_body())
    return jsonify(auth_service.login(data))


@auth_bp.post('/logout')
@login_required
def logout():
    """Đăng xuất
    ---
    tags:
      - Auth
    security:
      - Bearer: []
    responses:
      200:
        description: Đã đăng xuất (client xóa token)
      401:
        description: Chưa đăng nhập
    """
    return jsonify(auth_service.logout())


@auth_bp.post('/forgot-password')
def forgot_password():
    """Yêu cầu mã OTP đặt lại mật khẩu
    ---
    tags:
      - Auth
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            identifier: {type: string, description: Email hoặc số điện thoại, example: "0901234567"}
            email: {type: string, example: a@example.com}
            phone: {type: string, example: "0901234567"}
    responses:
      200:
        description: Cung cấp một identifier/email/phone. OTP giả lập trong log khi SEND_EMAIL=1 hoặc SEND_SMS=1; không trả OTP qua API.
    """
    data = auth_schema.validate_forgot_password(_body())
    return jsonify(auth_service.forgot_password(data))


@auth_bp.post('/verify-otp')
def verify_otp():
    """Xác minh OTP, nhận reset_token
    ---
    tags:
      - Auth
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [otp]
          properties:
            identifier: {type: string, description: Email hoặc số điện thoại đã yêu cầu OTP}
            email: {type: string, example: a@example.com}
            phone: {type: string, example: "0901234567"}
            otp: {type: string, example: "123456"}
    responses:
      200:
        description: Trả về reset_token dùng một lần
      400:
        description: OTP sai, hết hạn hoặc đã dùng
    """
    data = auth_schema.validate_verify_otp(_body())
    return jsonify(auth_service.verify_otp(data))


@auth_bp.post('/reset-password')
def reset_password():
    """Đặt lại mật khẩu bằng reset_token
    ---
    tags:
      - Auth
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [reset_token, new_password]
          properties:
            reset_token: {type: string}
            new_password: {type: string, example: NewPass12345}
    responses:
      200:
        description: Đã đặt lại mật khẩu
      400:
        description: Token không hợp lệ hoặc đã hết hạn
    """
    data = auth_schema.validate_reset_password(_body())
    return jsonify(auth_service.reset_password(data))


@auth_bp.post('/email-verification/request')
@login_required
def email_verification_request():
    """Yêu cầu gửi mã xác minh email của tài khoản đang đăng nhập
    ---
    tags:
      - Auth
    security:
      - Bearer: []
    responses:
      200:
        description: Đã gửi mã (nằm trong log khi SEND_EMAIL=1)
      409:
        description: Email đã được xác minh
    """
    return jsonify(auth_service.request_email_verification(current_user()))


@auth_bp.post('/email-verification/confirm')
def email_verification_confirm():
    """Xác nhận email bằng mã
    ---
    tags:
      - Auth
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [token]
          properties:
            token: {type: string}
    responses:
      200:
        description: Đã xác minh email
      400:
        description: Mã không hợp lệ hoặc đã hết hạn
    """
    data = auth_schema.validate_email_confirm(_body())
    return jsonify(auth_service.confirm_email_verification(data))


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
        schema: {$ref: '#/definitions/AccountProfileResponse'}
        description: Thông tin tài khoản hiện tại
      401:
        description: Chưa đăng nhập
    """
    return jsonify(auth_service.get_me(current_user()))


@user_admin_bp.patch('/me')
@login_required
def update_me():
    """Cập nhật hồ sơ cá nhân của tôi; null xóa trường tùy chọn, avatar dùng /me/avatar
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
            dob: {type: string, format: date, x-nullable: true, description: Từ 1900-01-01 đến hôm nay}
            gender: {type: string, enum: [Nam, Nữ, Khác], x-nullable: true}
            id_card: {type: string, pattern: '^[0-9]{12}$', x-nullable: true, description: CCCD duy nhất trong tài khoản}
            address: {type: string, maxLength: 255, x-nullable: true}
            emergency_contact_name: {type: string, maxLength: 150, x-nullable: true}
            emergency_contact_phone: {type: string, x-nullable: true}
            emergency_contact_relationship: {type: string, maxLength: 50, x-nullable: true}
    responses:
      200:
        schema: {$ref: '#/definitions/AccountProfileResponse'}
        description: Đã cập nhật (đổi email sẽ hủy trạng thái đã xác minh)
      409:
        description: Email hoặc số điện thoại đã tồn tại
    """
    fields = auth_schema.validate_update_me(_body())
    return jsonify(auth_service.update_me(current_user(), fields))


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
    data = auth_schema.validate_change_password(_body())
    return jsonify(auth_service.change_password(current_user(), data))


@user_admin_bp.post('/me/avatar')
@login_required
def upload_own_avatar():
    """Tải hoặc thay avatar của tài khoản đang đăng nhập, mọi vai trò
    ---
    tags: [Me]
    security: [{Bearer: []}]
    consumes: [multipart/form-data]
    parameters:
      - {in: formData, name: file, type: file, required: true, description: JPEG/PNG/WebP tối đa 2 MB}
    responses:
      200:
        description: Hồ sơ sau khi thay ảnh
        schema: {$ref: '#/definitions/AccountProfileResponse'}
      400: {description: Thiếu file hoặc ảnh không hợp lệ}
      401: {description: Chưa đăng nhập}
    """
    return jsonify(auth_service.replace_avatar(current_user()['user_id'], request.files.get('file')))


@user_admin_bp.delete('/me/avatar')
@login_required
def delete_own_avatar():
    """Xóa avatar của tôi; avatar_url trả về null, gọi lặp vẫn thành công
    ---
    tags: [Me]
    security: [{Bearer: []}]
    responses:
      200:
        description: Hồ sơ với avatar_url null
        schema: {$ref: '#/definitions/AccountProfileResponse'}
      401: {description: Chưa đăng nhập}
    """
    return jsonify(auth_service.replace_avatar(current_user()['user_id'], remove=True))


@user_admin_bp.post('/admin/users/<int:user_id>/avatar')
@roles_required(constants.ROLE_ADMIN)
def upload_user_avatar(user_id):
    """ADMIN tải hoặc thay ảnh của một tài khoản
    ---
    tags: [Admin Users]
    security: [{Bearer: []}]
    consumes: [multipart/form-data]
    parameters:
      - {in: path, name: user_id, type: integer, required: true}
      - {in: formData, name: file, type: file, required: true, description: JPEG/PNG/WebP tối đa 2 MB}
    responses:
      200:
        description: Hồ sơ sau khi thay ảnh
        schema: {$ref: '#/definitions/AccountProfileResponse'}
      400: {description: File không hợp lệ}
      403: {description: Chỉ ADMIN được phép}
      404: {description: Không tìm thấy tài khoản}
    """
    return jsonify(auth_service.replace_avatar(user_id, request.files.get('file')))


@user_admin_bp.delete('/admin/users/<int:user_id>/avatar')
@roles_required(constants.ROLE_ADMIN)
def delete_user_avatar(user_id):
    """ADMIN xóa ảnh của một tài khoản
    ---
    tags: [Admin Users]
    security: [{Bearer: []}]
    parameters:
      - {in: path, name: user_id, type: integer, required: true}
    responses:
      200:
        description: Hồ sơ với avatar_url null
        schema: {$ref: '#/definitions/AccountProfileResponse'}
      403: {description: Chỉ ADMIN được phép}
      404: {description: Không tìm thấy tài khoản}
    """
    return jsonify(auth_service.replace_avatar(user_id, remove=True))


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
    return jsonify(auth_service.list_roles())


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
    return jsonify(auth_service.list_users(
        auth_schema.parse_list_query(request.args)))


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
            dob: {type: string, format: date, x-nullable: true, description: Từ 1900-01-01 đến hôm nay}
            gender: {type: string, enum: [Nam, Nữ, Khác], x-nullable: true}
            id_card: {type: string, pattern: '^[0-9]{12}$', x-nullable: true, description: CCCD duy nhất trong tài khoản}
            address: {type: string, maxLength: 255, x-nullable: true}
            emergency_contact_name: {type: string, maxLength: 150, x-nullable: true}
            emergency_contact_phone: {type: string, x-nullable: true}
            emergency_contact_relationship: {type: string, maxLength: 50, x-nullable: true}
    responses:
      201:
        schema: {$ref: '#/definitions/AccountProfileResponse'}
        description: Đã tạo
      409:
        description: Trùng email hoặc số điện thoại
    """
    data = auth_schema.validate_admin_create(_body())
    return jsonify(auth_service.create_user(data)), 201


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
        schema: {$ref: '#/definitions/AccountProfileResponse'}
        description: Thông tin người dùng
      404:
        description: Không tìm thấy
    """
    return jsonify(auth_service.get_user(user_id))


@user_admin_bp.patch('/admin/users/<int:user_id>')
@roles_required(constants.ROLE_ADMIN)
def admin_update_user(user_id):
    """Sửa hồ sơ cá nhân và phân quyền người dùng
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
            dob: {type: string, format: date, x-nullable: true, description: Từ 1900-01-01 đến hôm nay}
            gender: {type: string, enum: [Nam, Nữ, Khác], x-nullable: true}
            id_card: {type: string, pattern: '^[0-9]{12}$', x-nullable: true, description: CCCD duy nhất trong tài khoản}
            address: {type: string, maxLength: 255, x-nullable: true}
            emergency_contact_name: {type: string, maxLength: 150, x-nullable: true}
            emergency_contact_phone: {type: string, x-nullable: true}
            emergency_contact_relationship: {type: string, maxLength: 50, x-nullable: true}
    responses:
      200:
        schema: {$ref: '#/definitions/AccountProfileResponse'}
        description: Đã cập nhật
      403:
        description: Không được tự đổi vai trò hoặc trạng thái duyệt của mình
    """
    fields = auth_schema.validate_admin_update(_body())
    return jsonify(auth_service.update_user(current_user(), user_id, fields))


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
    status = auth_schema.validate_account_status(_body())
    return jsonify(auth_service.set_account_status(current_user(), user_id, status))


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
    return jsonify(auth_service.delete_user(current_user(), user_id))
