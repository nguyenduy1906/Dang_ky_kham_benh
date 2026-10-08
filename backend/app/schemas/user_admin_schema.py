"""Kiểm tra dữ liệu đầu vào cho nhóm API quản trị người dùng."""
from backend.app.core import constants
from backend.app.core.errors import bad_request
from backend.app.schemas.auth_schema import (check_password, ensure_object, identity_fields,
                                             text_field)


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
