from backend.app.core.errors import bad_request
from backend.app.schemas.auth_schema import ensure_object, text_field
from backend.app.schemas.common_schema import int_field


def validate_items(data):
    data = ensure_object(data)
    if set(data) - {'items', 'reason', 'expected_version'}:
        raise bad_request('Chỉ nhận items, reason, expected_version')
    items = data.get('items')
    if not isinstance(items, list) or len(items) > 100:
        raise bad_request('items phải là danh sách tối đa 100 thuốc; [] nghĩa là không kê thuốc')
    fields = []
    for item in items:
        item = ensure_object(item)
        if set(item) - {'medication_name', 'dosage', 'quantity', 'instructions'}:
            raise bad_request('Thuốc chỉ nhận medication_name, dosage, quantity, instructions')
        fields.append({'medication_name': text_field(item, 'medication_name', required=True, max_len=255),
                       'dosage': text_field(item, 'dosage', max_len=1000),
                       'quantity': int_field(item, 'quantity', required=True, minimum=1, maximum=100000),
                       'instructions': text_field(item, 'instructions', max_len=3000)})
    return {'items': fields, 'reason': text_field(data, 'reason', max_len=1000),
            'expected_version': int_field(data, 'expected_version', minimum=0)}
