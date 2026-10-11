"""Request authentication and endpoint role decorators."""
import hmac
from functools import wraps
from flask import g, request
from itsdangerous import BadSignature, SignatureExpired
from backend.app.config import constants
from backend.app.config.database import get_db_connection
from backend.app.repositories import user_repository
from backend.app.utils.errors import AppError, forbidden, unauthorized
from backend.app.utils.security import _serializer, _fingerprint


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
        user = user_repository.get_user_by_id(db, payload.get('uid'))
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
