"""Bảo mật dùng chung: hash mật khẩu, token truy cập, kiểm tra đăng nhập và vai trò.

Cơ chế đăng nhập: token ký (itsdangerous) gửi qua header "Authorization: Bearer <token>".
Mỗi request đều đọc lại user từ database nên tài khoản bị khóa/xóa/chưa duyệt bị chặn
ngay. Token chứa "dấu vân tay" của password_hash nên đổi/đặt lại mật khẩu sẽ làm mọi
token cũ mất hiệu lực.
"""
import hashlib
import hmac
import os
import secrets
from functools import wraps

from flask import g, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

from backend.app.core import constants
from backend.app.core.errors import AppError, forbidden, unauthorized
from backend.app.db.database import get_db_connection
from backend.app.models import user_model


def get_secret_key():
    key = os.environ.get('SECRET_KEY')
    if key:
        return key
    # Dự phòng cho môi trường dev: suy ra từ mật khẩu DB. Nên đặt SECRET_KEY riêng trong .env.
    seed = os.environ.get('DB_PASSWORD') or os.environ.get('POSTGRES_PASSWORD')
    if not seed:
        raise RuntimeError('Thiếu SECRET_KEY trong backend/.env')
    return hashlib.sha256(f'medical-booking:{seed}'.encode()).hexdigest()


def hash_password(password):
    return generate_password_hash(password)


def verify_password(password_hash, password):
    return check_password_hash(password_hash, password)


def generate_otp():
    return f'{secrets.randbelow(10 ** 6):06d}'


def generate_token():
    return secrets.token_urlsafe(32)


def hash_token(value, user_id=None):
    """HMAC của OTP/token để lưu vào auth_token (không lưu giá trị gốc)."""
    message = f'{user_id}:{value}' if user_id is not None else str(value)
    return hmac.new(get_secret_key().encode(), message.encode(), hashlib.sha256).hexdigest()


def _fingerprint(password_hash):
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def _serializer():
    return URLSafeTimedSerializer(get_secret_key(), salt='medical-booking-access')


def create_access_token(user):
    return _serializer().dumps({'uid': user['user_id'], 'pf': _fingerprint(user['password_hash'])})


def _authenticate():
    header = request.headers.get('Authorization', '')
    scheme, _, token = header.partition(' ')
    if scheme.lower() != 'bearer' or not token.strip():
        raise unauthorized()
    try:
        payload = _serializer().loads(token.strip(), max_age=constants.ACCESS_TOKEN_TTL_SECONDS)
    except SignatureExpired:
        raise unauthorized('Phiên đăng nhập đã hết hạn', 'TOKEN_EXPIRED') from None
    except BadSignature:
        raise unauthorized('Token không hợp lệ', 'TOKEN_INVALID') from None

    with get_db_connection() as db:
        user = user_model.get_user_by_id(db, payload.get('uid'))
    if (user is None or user['deleted_at'] is not None
            or user.get('email') == constants.SYSTEM_WORKER_EMAIL
            or user['account_status'] != constants.ACCOUNT_ACTIVE
            or user['approval_status'] != constants.APPROVAL_APPROVED
            or not hmac.compare_digest(str(payload.get('pf')), _fingerprint(user['password_hash']))):
        raise unauthorized()
    g.current_user = user
    return user


def current_user():
    return g.current_user


def login_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        _authenticate()
        return view(*args, **kwargs)
    return wrapper


def roles_required(*roles):
    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            user = _authenticate()
            if user['role_name'] not in roles:
                raise forbidden()
            return view(*args, **kwargs)
        return wrapper
    return decorator


def optional_user():
    """Trả về user nếu request có token hợp lệ, ngược lại None (không báo lỗi)."""
    if not request.headers.get('Authorization'):
        return None
    try:
        return _authenticate()
    except AppError:
        return None


def is_admin(user):
    return user is not None and user['role_name'] == constants.ROLE_ADMIN
