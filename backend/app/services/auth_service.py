"""Nghiệp vụ xác thực: đăng ký, đăng nhập, quên mật khẩu/OTP, xác minh email."""
from psycopg import errors as pg_errors
from werkzeug.security import check_password_hash, generate_password_hash

from backend.app.core import constants, mail_adapter
from backend.app.core.errors import AppError, bad_request, conflict, forbidden, unauthorized
from backend.app.core.security import (create_access_token, generate_otp, generate_token,
                                       hash_password, hash_token, verify_password)
from backend.app.db.database import get_db_connection
from backend.app.models import auth_token_model, user_model

_DUMMY_HASH = generate_password_hash('dummy-password-to-equalize-timing')
_IDENTITY_MESSAGES = {'email': 'Email đã được sử dụng',
                      'phone': 'Số điện thoại đã được sử dụng'}
_BAD_CREDENTIALS = 'Thông tin đăng nhập không đúng'
_BAD_OTP = 'OTP không hợp lệ hoặc đã hết hạn'
_BAD_RESET = 'Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn'


def register(data):
    with get_db_connection() as db:
        role = user_model.get_role_by_name(db, constants.ROLE_USER)
        if role is None:
            raise AppError(500, 'ROLE_NOT_SEEDED', 'Chưa có vai trò USER, hãy chạy seed_db')
        taken = user_model.find_identity_conflict(db, data['email'], data['phone'])
        if taken:
            raise conflict(_IDENTITY_MESSAGES[taken], 'DUPLICATE_IDENTITY')
        approval = (constants.APPROVAL_PENDING if role['requires_approval']
                    else constants.APPROVAL_APPROVED)
        try:
            user_id = user_model.create_user(
                db, role_id=role['role_id'], full_name=data['full_name'],
                email=data['email'], phone=data['phone'],
                password_hash=hash_password(data['password']), approval_status=approval)
        except pg_errors.UniqueViolation:
            raise conflict('Email hoặc số điện thoại đã được sử dụng', 'DUPLICATE_IDENTITY') from None
        user = user_model.get_user_by_id(db, user_id)
    return {'user': user_model.to_public(user)}


def login(data):
    with get_db_connection() as db:
        user = (user_model.get_user_by_email(db, data['email']) if data['email']
                else user_model.get_user_by_phone(db, data['phone']))
    if user is None:
        check_password_hash(_DUMMY_HASH, data['password'])
        raise unauthorized(_BAD_CREDENTIALS, 'INVALID_CREDENTIALS')
    if not verify_password(user['password_hash'], data['password']) or user['deleted_at'] is not None:
        raise unauthorized(_BAD_CREDENTIALS, 'INVALID_CREDENTIALS')
    if user['account_status'] != constants.ACCOUNT_ACTIVE:
        raise forbidden('Tài khoản đã bị khóa', 'ACCOUNT_LOCKED')
    if user['approval_status'] != constants.APPROVAL_APPROVED:
        raise forbidden('Tài khoản chưa được duyệt', 'ACCOUNT_NOT_APPROVED')
    return {'access_token': create_access_token(user), 'token_type': 'Bearer',
            'expires_in': constants.ACCESS_TOKEN_TTL_SECONDS,
            'user': user_model.to_public(user)}


def logout():
    # Token không lưu trong database nên không thu hồi được từng token riêng lẻ;
    # client xóa token. Đổi mật khẩu sẽ vô hiệu hóa mọi token cũ.
    return {'message': 'Đã đăng xuất'}


def _usable(user):
    return (user is not None and user['deleted_at'] is None
            and user['account_status'] == constants.ACCOUNT_ACTIVE)


def forgot_password(data):
    outbox = None
    with get_db_connection() as db:
        user = user_model.get_user_by_email(db, data['email'])
        if _usable(user):
            uid = user['user_id']
            auth_token_model.invalidate_unused(db, uid, constants.TOKEN_OTP)
            auth_token_model.invalidate_unused(db, uid, constants.TOKEN_RESET_PASSWORD)
            otp = generate_otp()
            auth_token_model.create_token(db, uid, constants.TOKEN_OTP,
                                          hash_token(otp, uid), constants.OTP_TTL_MINUTES)
            outbox = (user['email'], otp)
    if outbox:
        mail_adapter.send_otp(*outbox)
    # Luôn trả cùng một thông báo để không lộ email nào đã đăng ký.
    return {'message': 'Nếu email tồn tại, mã OTP đã được gửi'}


def verify_otp(data):
    with get_db_connection() as db:
        user = user_model.get_user_by_email(db, data['email'])
        if not _usable(user):
            raise bad_request(_BAD_OTP, 'INVALID_OTP')
        uid = user['user_id']
        if not auth_token_model.consume_otp(db, uid, hash_token(data['otp'], uid)):
            raise bad_request(_BAD_OTP, 'INVALID_OTP')
        auth_token_model.invalidate_unused(db, uid, constants.TOKEN_RESET_PASSWORD)
        reset_token = generate_token()
        auth_token_model.create_token(db, uid, constants.TOKEN_RESET_PASSWORD,
                                      hash_token(reset_token),
                                      constants.RESET_TOKEN_TTL_MINUTES)
    return {'reset_token': reset_token, 'expires_in': constants.RESET_TOKEN_TTL_MINUTES * 60}


def reset_password(data):
    with get_db_connection() as db:
        uid = auth_token_model.consume_by_hash(db, constants.TOKEN_RESET_PASSWORD,
                                               hash_token(data['reset_token']))
        user = user_model.get_user_by_id(db, uid) if uid else None
        if not _usable(user):
            raise bad_request(_BAD_RESET, 'INVALID_RESET_TOKEN')
        user_model.update_user(db, uid, {'password_hash': hash_password(data['new_password'])})
        auth_token_model.invalidate_unused(db, uid, constants.TOKEN_OTP)
        auth_token_model.invalidate_unused(db, uid, constants.TOKEN_RESET_PASSWORD)
    return {'message': 'Đã đặt lại mật khẩu, hãy đăng nhập lại'}


def request_email_verification(user):
    if not user['email']:
        raise bad_request('Tài khoản chưa có email', 'NO_EMAIL')
    if user['email_verified']:
        raise conflict('Email đã được xác minh', 'ALREADY_VERIFIED')
    token = generate_token()
    with get_db_connection() as db:
        auth_token_model.invalidate_unused(db, user['user_id'], constants.TOKEN_VERIFY_EMAIL)
        auth_token_model.create_token(db, user['user_id'], constants.TOKEN_VERIFY_EMAIL,
                                      hash_token(token), constants.EMAIL_VERIFY_TTL_MINUTES)
    mail_adapter.send_email_verification(user['email'], token)
    return {'message': 'Đã gửi mã xác minh tới email của bạn'}


def confirm_email_verification(data):
    with get_db_connection() as db:
        uid = auth_token_model.consume_by_hash(db, constants.TOKEN_VERIFY_EMAIL,
                                               hash_token(data['token']))
        if not uid or not user_model.update_user(db, uid, {'email_verified': 1}):
            raise bad_request('Mã xác minh không hợp lệ hoặc đã hết hạn', 'INVALID_VERIFY_TOKEN')
    return {'message': 'Đã xác minh email'}
