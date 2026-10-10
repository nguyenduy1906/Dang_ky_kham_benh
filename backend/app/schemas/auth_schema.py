"""Kiểm tra dữ liệu đầu vào cho nhóm API xác thực và hồ sơ cá nhân."""
import re

from backend.app.core import constants
from backend.app.core.errors import bad_request

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
PHONE_RE = re.compile(r'^\+?\d{9,15}$')
OTP_RE = re.compile(r'^\d{6}$')


def ensure_object(data):
    if not isinstance(data, dict):
        raise bad_request('Body phải là JSON object hợp lệ')
    return data


def text_field(data, key, *, required=False, max_len=255):
    value = data.get(key)
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise bad_request(f'Thiếu trường {key}')
        return None
    if not isinstance(value, str):
        raise bad_request(f'Trường {key} phải là chuỗi')
    value = value.strip()
    if len(value) > max_len:
        raise bad_request(f'Trường {key} tối đa {max_len} ký tự')
    return value


def normalize_email(value, key='email'):
    value = value.strip().lower()
    if len(value) > 254 or not EMAIL_RE.match(value):
        raise bad_request(f'{key} không hợp lệ')
    return value


def normalize_phone(value, key='phone'):
    value = re.sub(r'[\s.\-]', '', value)
    if not PHONE_RE.match(value):
        raise bad_request(f'{key} không hợp lệ (9-15 chữ số)')
    return value


def check_password(password, key='password'):
    if not isinstance(password, str):
        raise bad_request(f'Thiếu trường {key}')
    if not (constants.MIN_PASSWORD_LENGTH <= len(password) <= constants.MAX_PASSWORD_LENGTH):
        raise bad_request(f'{key} phải dài {constants.MIN_PASSWORD_LENGTH}-'
                          f'{constants.MAX_PASSWORD_LENGTH} ký tự')
    if not (re.search(r'[A-Za-z]', password) and re.search(r'\d', password)):
        raise bad_request(f'{key} phải có cả chữ và số')
    return password


def identity_fields(data):
    email = text_field(data, 'email')
    phone = text_field(data, 'phone')
    return (normalize_email(email) if email else None,
            normalize_phone(phone) if phone else None)


def validate_register(data):
    data = ensure_object(data)
    email, phone = identity_fields(data)
    if not email and not phone:
        raise bad_request('Cần có email hoặc số điện thoại')
    # Cố ý bỏ qua role/approval_status do client gửi để không thể tự nâng quyền.
    return {
        'full_name': text_field(data, 'full_name', required=True, max_len=150),
        'email': email,
        'phone': phone,
        'password': check_password(data.get('password')),
    }


def validate_login(data):
    data = ensure_object(data)
    identifier = text_field(data, 'identifier') or text_field(data, 'email') \
        or text_field(data, 'phone')
    if not identifier:
        raise bad_request('Thiếu email hoặc số điện thoại')
    password = data.get('password')
    if not isinstance(password, str) or not password or len(password) > constants.MAX_PASSWORD_LENGTH:
        raise bad_request('Thiếu hoặc sai định dạng mật khẩu')
    if '@' in identifier:
        return {'email': identifier.lower(), 'phone': None, 'password': password}
    return {'email': None, 'phone': re.sub(r'[\s.\-]', '', identifier), 'password': password}


def validate_forgot_password(data):
    data = ensure_object(data)
    return {'email': normalize_email(text_field(data, 'email', required=True))}


def validate_verify_otp(data):
    data = ensure_object(data)
    otp = text_field(data, 'otp', required=True, max_len=6)
    if not OTP_RE.match(otp):
        raise bad_request('OTP gồm 6 chữ số')
    return {'email': normalize_email(text_field(data, 'email', required=True)), 'otp': otp}


def validate_reset_password(data):
    data = ensure_object(data)
    return {'reset_token': text_field(data, 'reset_token', required=True, max_len=200),
            'new_password': check_password(data.get('new_password'), 'new_password')}


def validate_email_confirm(data):
    data = ensure_object(data)
    return {'token': text_field(data, 'token', required=True, max_len=200)}


def validate_change_password(data):
    data = ensure_object(data)
    current = data.get('current_password')
    if not isinstance(current, str) or not current:
        raise bad_request('Thiếu current_password')
    new = check_password(data.get('new_password'), 'new_password')
    if new == current:
        raise bad_request('Mật khẩu mới phải khác mật khẩu hiện tại')
    return {'current_password': current, 'new_password': new}


def validate_update_me(data):
    data = ensure_object(data)
    fields = {}
    if 'full_name' in data:
        fields['full_name'] = text_field(data, 'full_name', required=True, max_len=150)
    if 'email' in data:
        fields['email'] = normalize_email(text_field(data, 'email', required=True))
    if 'phone' in data:
        fields['phone'] = normalize_phone(text_field(data, 'phone', required=True))
    if not fields:
        raise bad_request('Không có trường nào để cập nhật (full_name, email, phone)')
    return fields


def _choice(value, allowed, key):
    if value not in allowed:
        raise bad_request(f'{key} phải là một trong: {", ".join(allowed)}')
    return value


def validate_admin_create(data):
    data = ensure_object(data)
    email, phone = identity_fields(data)
    if not email and not phone:
        raise bad_request('Cần có email hoặc số điện thoại')
    verified = data.get('email_verified', False)
    if not isinstance(verified, bool):
        raise bad_request('email_verified phải là true/false')
    return {
        'full_name': text_field(data, 'full_name', required=True, max_len=150),
        'email': email,
        'phone': phone,
        'password': check_password(data.get('password')),
        'role': _choice(data.get('role', constants.ROLE_USER), constants.ALL_ROLES, 'role'),
        'approval_status': _choice(data.get('approval_status', constants.APPROVAL_APPROVED),
                                   constants.APPROVAL_STATUSES, 'approval_status'),
        'email_verified': verified,
    }


def validate_admin_update(data):
    data = ensure_object(data)
    fields = {}
    if 'full_name' in data:
        fields['full_name'] = text_field(data, 'full_name', required=True, max_len=150)
    email, phone = identity_fields({k: data[k] for k in ('email', 'phone') if k in data})
    if 'email' in data:
        if not email:
            raise bad_request('email không được để trống')
        fields['email'] = email
    if 'phone' in data:
        if not phone:
            raise bad_request('phone không được để trống')
        fields['phone'] = phone
    if 'role' in data:
        fields['role'] = _choice(data['role'], constants.ALL_ROLES, 'role')
    if 'approval_status' in data:
        fields['approval_status'] = _choice(data['approval_status'],
                                            constants.APPROVAL_STATUSES, 'approval_status')
    if not fields:
        raise bad_request('Không có trường nào để cập nhật')
    return fields


def validate_account_status(data):
    data = ensure_object(data)
    return _choice(data.get('account_status'), constants.ACCOUNT_STATUSES, 'account_status')


def _int_arg(args, key, default, minimum, maximum):
    raw = args.get(key)
    if raw is None or raw == '':
        return default
    try:
        value = int(raw)
    except ValueError:
        raise bad_request(f'{key} phải là số nguyên') from None
    return max(minimum, min(maximum, value))


def parse_list_query(args):
    role = args.get('role')
    account_status = args.get('account_status')
    approval_status = args.get('approval_status')
    if role:
        _choice(role, constants.ALL_ROLES, 'role')
    if account_status:
        _choice(account_status, constants.ACCOUNT_STATUSES, 'account_status')
    if approval_status:
        _choice(approval_status, constants.APPROVAL_STATUSES, 'approval_status')
    return {
        'role': role or None,
        'account_status': account_status or None,
        'approval_status': approval_status or None,
        'q': (args.get('q') or '').strip()[:100] or None,
        'include_deleted': args.get('include_deleted', '').lower() in ('1', 'true'),
        'page': _int_arg(args, 'page', 1, 1, 100000),
        'page_size': _int_arg(args, 'page_size', constants.DEFAULT_PAGE_SIZE,
                              1, constants.MAX_PAGE_SIZE),
    }
