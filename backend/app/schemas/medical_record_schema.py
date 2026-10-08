from backend.app.core.errors import bad_request
from backend.app.schemas.auth_schema import ensure_object, text_field
from backend.app.schemas.common_schema import int_field


def validate_record(data):
    data = ensure_object(data)
    if set(data) - {'diagnosis', 'treatment', 'doctor_notes', 'reason', 'expected_version'}:
        raise bad_request('Body bệnh án chứa trường không được phép')
    return {'diagnosis': text_field(data, 'diagnosis', required=True, max_len=10000),
            'treatment': text_field(data, 'treatment', max_len=10000),
            'doctor_notes': text_field(data, 'doctor_notes', max_len=10000),
            'reason': text_field(data, 'reason', max_len=1000),
            'expected_version': int_field(data, 'expected_version', minimum=0)}
