import re

from backend.app.core.errors import bad_request
from backend.app.utils.validation import (
    ensure_object, normalize_phone, normalize_email, text_field, bool_arg, int_field, page_params
)
from backend.app.schemas.profile_schema import personal_fields

INSURANCE_RE = re.compile(r'^[A-Za-z0-9]{10,15}$')
RELATIONSHIPS = ('SELF', 'PARENT', 'CHILD', 'SPOUSE', 'OTHER')


def _fields(data, partial):
    fields = personal_fields(data, patient=True)
    if not partial or 'full_name' in data:
        fields['full_name'] = text_field(data, 'full_name', required=True, max_len=150)
    if 'email' in data:
        value = text_field(data, 'email', max_len=254)
        fields['email'] = normalize_email(value) if value else None
    if 'phone' in data:
        value = text_field(data, 'phone', max_len=20)
        fields['phone'] = normalize_phone(value) if value else None
    if 'health_insurance' in data:
        value = text_field(data, 'health_insurance', max_len=20)
        if value and not INSURANCE_RE.match(value):
            raise bad_request('health_insurance gồm 10-15 chữ hoặc số')
        fields['health_insurance'] = value.upper() if value else None
    if 'relationship' in data:
        value = data['relationship']
        if value is not None and value not in RELATIONSHIPS:
            raise bad_request(f'relationship phải là một trong: {", ".join(RELATIONSHIPS)}')
        fields['relationship'] = value
    return fields


def validate_create(data, allow_user_id=False):
    data = ensure_object(data)
    fields = _fields(data, partial=False)
    fields['phone'] = normalize_phone(text_field(data, 'phone', required=True, max_len=20))
    if not fields.get('id_card') and not fields.get('dob'):
        raise bad_request('Cần CCCD/mã định danh hoặc ngày sinh để phân biệt hồ sơ bệnh nhân')
    confirmed = data.get('confirm_shared_phone', False)
    if not isinstance(confirmed, bool):
        raise bad_request('confirm_shared_phone phải là true/false')
    fields['confirm_shared_phone'] = confirmed
    if allow_user_id and data.get('user_id') is not None:
        fields['user_id'] = int_field(data, 'user_id', minimum=1)
    return fields


def validate_update(data):
    data = ensure_object(data)
    fields = _fields(data, partial=True)
    if not fields:
        raise bad_request('Không có trường nào để cập nhật')
    return fields


def parse_list_query(args):
    page, page_size = page_params(args)
    phone = (args.get('phone') or '').strip()
    return {'q': (args.get('q') or '').strip()[:100] or None,
            'phone': normalize_phone(phone) if phone else None,
            'booked_by_me': bool_arg(args, 'booked_by_me'),
            'include_archived': bool_arg(args, 'include_archived'),
            'page': page, 'page_size': page_size}
