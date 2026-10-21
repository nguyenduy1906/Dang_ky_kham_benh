"""Shared personal fields; account identity is separate from examined patients."""
import re
from datetime import date

from backend.app.core.errors import bad_request
from backend.app.utils.date import today_vn
from backend.app.utils.validation import text_field, normalize_phone

PROFILE_FIELDS = ('dob', 'gender', 'id_card', 'address', 'emergency_contact_name',
                  'emergency_contact_phone', 'emergency_contact_relationship')


def personal_fields(data, *, patient=False):
    fields = {}
    if 'dob' in data:
        raw = data['dob']
        if raw is None:
            fields['dob'] = None
        else:
            if not isinstance(raw, str) or not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}', raw):
                raise bad_request('dob phải có dạng YYYY-MM-DD')
            try:
                fields['dob'] = date.fromisoformat(raw)
            except ValueError:
                raise bad_request('dob không hợp lệ') from None
            if not date(1900, 1, 1) <= fields['dob'] <= today_vn():
                raise bad_request('dob phải từ 1900-01-01 đến ngày hiện tại')
    if 'gender' in data:
        fields['gender'] = text_field(data, 'gender', max_len=20)
        if fields['gender'] is not None and fields['gender'] not in ('Nam', 'Nữ', 'Khác'):
            raise bad_request('gender phải là Nam, Nữ hoặc Khác')
    if 'id_card' in data:
        value = text_field(data, 'id_card', max_len=12)
        pattern = r'([0-9]{9}|[0-9]{12})' if patient else r'[0-9]{12}'
        if value and not re.fullmatch(pattern, value):
            raise bad_request('id_card gồm 9 hoặc 12 chữ số' if patient else 'CCCD phải gồm 12 chữ số')
        fields['id_card'] = value
    for key, maximum in (('address', 255), ('emergency_contact_name', 150),
                         ('emergency_contact_relationship', 50)):
        if key in data:
            fields[key] = text_field(data, key, max_len=maximum)
    if 'emergency_contact_phone' in data:
        phone = text_field(data, 'emergency_contact_phone', max_len=30)
        fields['emergency_contact_phone'] = normalize_phone(phone, 'emergency_contact_phone') if phone else None
    return fields
