"""Password hashing and signed token helpers."""
import hashlib
import hmac
import os
import secrets
from itsdangerous import URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash


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
