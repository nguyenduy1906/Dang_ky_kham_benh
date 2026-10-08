from backend.app.core.errors import bad_request
from backend.app.schemas.auth_schema import ensure_object, text_field
from backend.app.schemas.common_schema import flag_field


def validate_create(data):
    data = ensure_object(data)
    return {'name': text_field(data, 'name', required=True, max_len=150),
            'description': text_field(data, 'description', max_len=1000),
            'is_active': flag_field(data, 'is_active') if 'is_active' in data else 1}


def validate_update(data):
    data = ensure_object(data)
    fields = {}
    if 'name' in data:
        fields['name'] = text_field(data, 'name', required=True, max_len=150)
    if 'description' in data:
        fields['description'] = text_field(data, 'description', max_len=1000)
    if 'is_active' in data:
        fields['is_active'] = flag_field(data, 'is_active')
    if not fields:
        raise bad_request('Không có trường nào để cập nhật')
    return fields
