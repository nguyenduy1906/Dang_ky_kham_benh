import re

from backend.app.core.errors import bad_request
from backend.app.core.utils import today_vn
from backend.app.schemas.auth_schema import ensure_object, normalize_phone, text_field
from backend.app.schemas.common_schema import (bool_arg, int_field, page_params, parse_date)

ID_CARD_RE = re.compile(r'^(\d{9}|\d{12})$')
INSURANCE_RE = re.compile(r'^[A-Za-z0-9]{10,15}$')
RELATIONSHIPS = ('SELF', 'PARENT', 'CHILD', 'SPOUSE', 'OTHER')


def _fields(data, partial):
    fields = {}
    if not partial or 'full_name' in data:
        fields['full_name'] = text_field(data, 'full_name', required=True, max_len=150)
    if 'dob' in data:
        value = data['dob']
        dob = None if value is None else parse_date(value, 'dob')
        if dob and dob > today_vn():
            raise bad_request('dob không được ở tương lai')
        fields['dob'] = dob
    if 'gender' in data:
        fields['gender'] = text_field(data, 'gender', max_len=20)
    if 'id_card' in data:
        value = text_field(data, 'id_card', max_len=20)
        if value and not ID_CARD_RE.match(value):
            raise bad_request('id_card gồm 9 hoặc 12 chữ số')
        fields['id_card'] = value
    if 'address' in data:
        fields['address'] = text_field(data, 'address', max_len=255)
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
    return {'q': (args.get('q') or '').strip()[:100] or None,
            'include_archived': bool_arg(args, 'include_archived'),
            'page': page, 'page_size': page_size}
