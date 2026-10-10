"""Nghiệp vụ xác thực: đăng ký, đăng nhập, quên mật khẩu/OTP, xác minh email."""
from psycopg import errors as pg_errors
from werkzeug.security import check_password_hash, generate_password_hash

from backend.app.core import constants, mail_adapter
from backend.app.core.errors import AppError, bad_request, conflict, forbidden, not_found, unauthorized
from backend.app.core.security import (create_access_token, generate_otp, generate_token,
                                       hash_password, hash_token, verify_password)
from backend.app.db.database import get_db_connection
from backend.app.models import user_model, user_model as auth_token_model

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
    if (user.get('email') == constants.SYSTEM_WORKER_EMAIL
            or not verify_password(user['password_hash'], data['password']) or user['deleted_at'] is not None):
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
            and user.get('email') != constants.SYSTEM_WORKER_EMAIL
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


def _duplicate():
    return conflict('Email hoặc số điện thoại đã được sử dụng', 'DUPLICATE_IDENTITY')


def _check_identity(db, fields, exclude_user_id=None):
    taken = user_model.find_identity_conflict(db, fields.get('email'), fields.get('phone'),
                                              exclude_user_id)
    if taken:
        raise conflict(_IDENTITY_MESSAGES[taken], 'DUPLICATE_IDENTITY')


# ---------- /me ----------

def get_me(user):
    return {'user': user_model.to_public(user)}


def update_me(user, fields):
    uid = user['user_id']
    updates = dict(fields)
    email_changed = 'email' in updates and updates['email'] != user['email']
    if email_changed:
        updates['email_verified'] = 0
    with get_db_connection() as db:
        _check_identity(db, updates, uid)
        try:
            user_model.update_user(db, uid, updates)
        except pg_errors.UniqueViolation:
            raise _duplicate() from None
        if email_changed:
            auth_token_model.invalidate_unused(db, uid, constants.TOKEN_VERIFY_EMAIL)
        fresh = user_model.get_user_by_id(db, uid)
    return {'user': user_model.to_public(fresh)}


def change_password(user, data):
    if not verify_password(user['password_hash'], data['current_password']):
        raise bad_request('Mật khẩu hiện tại không đúng', 'WRONG_PASSWORD')
    with get_db_connection() as db:
        user_model.update_user(db, user['user_id'],
                               {'password_hash': hash_password(data['new_password'])})
        fresh = user_model.get_user_by_id(db, user['user_id'])
    # Mọi token cũ mất hiệu lực; trả token mới để phiên hiện tại tiếp tục dùng.
    return {'message': 'Đã đổi mật khẩu', 'access_token': create_access_token(fresh),
            'token_type': 'Bearer', 'expires_in': constants.ACCESS_TOKEN_TTL_SECONDS}


# ---------- /admin ----------

def list_roles():
    with get_db_connection() as db:
        rows = user_model.list_roles(db)
    return {'items': [{'role_id': r['role_id'], 'role_name': r['role_name'],
                       'description': r['description'],
                       'requires_approval': bool(r['requires_approval'])} for r in rows]}


def list_users(query):
    with get_db_connection() as db:
        rows, total = user_model.list_users(
            db, role=query['role'], account_status=query['account_status'],
            approval_status=query['approval_status'], q=query['q'],
            include_deleted=query['include_deleted'], limit=query['page_size'],
            offset=(query['page'] - 1) * query['page_size'])
    return {'items': [user_model.to_public(r) for r in rows], 'total': total,
            'page': query['page'], 'page_size': query['page_size']}


def _get_or_404(db, user_id):
    user = user_model.get_user_by_id(db, user_id)
    if user is None:
        raise not_found('Không tìm thấy người dùng', 'USER_NOT_FOUND')
    return user


def get_user(user_id):
    with get_db_connection() as db:
        return {'user': user_model.to_public(_get_or_404(db, user_id))}


def _role_id(db, role_name):
    role = user_model.get_role_by_name(db, role_name)
    if role is None:
        raise bad_request(f'Vai trò {role_name} chưa có trong database', 'ROLE_NOT_FOUND')
    return role['role_id']


def create_user(data):
    with get_db_connection() as db:
        _check_identity(db, data)
        try:
            user_id = user_model.create_user(
                db, role_id=_role_id(db, data['role']), full_name=data['full_name'],
                email=data['email'], phone=data['phone'],
                password_hash=hash_password(data['password']),
                approval_status=data['approval_status'],
                email_verified=1 if data['email_verified'] else 0)
        except pg_errors.UniqueViolation:
            raise _duplicate() from None
        user = user_model.get_user_by_id(db, user_id)
    return {'user': user_model.to_public(user)}


def update_user(admin, user_id, fields):
    with get_db_connection() as db:
        target = _get_or_404(db, user_id)
        if target['deleted_at'] is not None:
            raise conflict('Người dùng đã bị xóa', 'USER_DELETED')
        if target['user_id'] == admin['user_id'] and ('role' in fields or 'approval_status' in fields):
            raise forbidden('Không thể tự đổi vai trò hoặc trạng thái duyệt của chính mình',
                            'SELF_CHANGE_FORBIDDEN')
        updates = {k: v for k, v in fields.items() if k != 'role'}
        if 'role' in fields:
            updates['role_id'] = _role_id(db, fields['role'])
        if 'email' in updates and updates['email'] != target['email']:
            updates['email_verified'] = 0
        _check_identity(db, updates, user_id)
        try:
            user_model.update_user(db, user_id, updates)
        except pg_errors.UniqueViolation:
            raise _duplicate() from None
        user = user_model.get_user_by_id(db, user_id)
    return {'user': user_model.to_public(user)}


def set_account_status(admin, user_id, account_status):
    if user_id == admin['user_id']:
        raise forbidden('Không thể tự khóa tài khoản của chính mình', 'SELF_CHANGE_FORBIDDEN')
    with get_db_connection() as db:
        target = _get_or_404(db, user_id)
        if target['deleted_at'] is not None:
            raise conflict('Người dùng đã bị xóa', 'USER_DELETED')
        user_model.update_user(db, user_id, {'account_status': account_status})
        user = user_model.get_user_by_id(db, user_id)
    return {'user': user_model.to_public(user)}


def delete_user(admin, user_id):
    if user_id == admin['user_id']:
        raise forbidden('Không thể tự xóa tài khoản của chính mình', 'SELF_CHANGE_FORBIDDEN')
    with get_db_connection() as db:
        _get_or_404(db, user_id)
        if not user_model.soft_delete_user(db, user_id):
            raise conflict('Người dùng đã bị xóa trước đó', 'USER_DELETED')
    return {'message': 'Đã xóa người dùng (xóa mềm)'}
