"""Route xác thực: đăng ký, đăng nhập, quên mật khẩu/OTP, xác minh email."""
from backend.app.controllers import auth_controller as controller
from flask import Blueprint

from backend.app.middlewares.auth_middleware import login_required


auth_bp = Blueprint('auth', __name__, url_prefix='/auth')


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
    responses:
      201:
        description: Đăng ký thành công
      400:
        description: Dữ liệu không hợp lệ
      409:
        description: Email hoặc số điện thoại đã tồn tại
    """
    return controller.register()


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
    return controller.login()


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
    return controller.logout()


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
          required: [email]
          properties:
            email: {type: string, example: a@example.com}
    responses:
      200:
        description: Luôn trả cùng một thông báo (OTP nằm trong log khi DEMO_MODE=1)
    """
    return controller.forgot_password()


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
          required: [email, otp]
          properties:
            email: {type: string, example: a@example.com}
            otp: {type: string, example: "123456"}
    responses:
      200:
        description: Trả về reset_token dùng một lần
      400:
        description: OTP sai, hết hạn hoặc đã dùng
    """
    return controller.verify_otp()


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
    return controller.reset_password()


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
        description: Đã gửi mã (nằm trong log khi DEMO_MODE=1)
      409:
        description: Email đã được xác minh
    """
    return controller.email_verification_request()


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
    return controller.email_verification_confirm()
