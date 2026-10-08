from backend.app.core.errors import bad_request
from backend.app.schemas.auth_schema import ensure_object, text_field
from backend.app.schemas.common_schema import int_field


def validate_walk_in(data):
    data = ensure_object(data)
    if set(data) - {'patient_id', 'doctor_profile_id', 'symptoms'}:
        raise bad_request('Walk-in chỉ nhận patient_id, doctor_profile_id, symptoms; hệ thống chọn ca')
    return {'patient_id': int_field(data, 'patient_id', required=True, minimum=1),
            'doctor_profile_id': int_field(data, 'doctor_profile_id', required=True, minimum=1),
            'symptoms': text_field(data, 'symptoms', max_len=5000)}


def validate_transfer(data):
    data = ensure_object(data)
    if set(data) - {'schedule_id', 'reason'}:
        raise bad_request('Chỉ nhận schedule_id và reason')
    return {'schedule_id': int_field(data, 'schedule_id', required=True, minimum=1),
            'reason': text_field(data, 'reason', required=True, max_len=1000)}
