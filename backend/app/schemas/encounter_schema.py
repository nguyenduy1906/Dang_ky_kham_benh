import re

from backend.app.core.errors import bad_request
from backend.app.utils.validation import (
    ensure_object, text_field, int_field, optional_int_arg, page_params, parse_date, parse_time
)

STATUSES = ('HOLDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED',
            'CANCELLED', 'NO_SHOW', 'EXPIRED')


def validate_registration_details(data):
    from backend.app.schemas.patient_schema import validate_create
    from backend.app.utils.database_helpers import jsonable
    data = ensure_object(data)
    if set(data) - {'full_name', 'phone', 'id_card', 'dob', 'gender', 'address', 'health_insurance'}:
        raise bad_request('Thông tin đăng ký chứa trường không được phép')
    fields = validate_create(data)
    fields.pop('confirm_shared_phone')
    return jsonable(fields)


def validate_registration(data):
    data = ensure_object(data)
    if set(data) != {'registration_details', 'symptoms'}:
        raise bad_request('Chỉ nhận registration_details và symptoms')
    return {'registration_details': validate_registration_details(data['registration_details']),
            'symptoms': text_field(data, 'symptoms', required=True, max_len=5000)}


def validate_online(data):
    data = ensure_object(data)
    if set(data) - {'patient_id', 'schedule_id', 'appointment_time', 'symptoms', 'registration_details'}:
        raise bad_request('Chỉ nhận patient_id, schedule_id, appointment_time, symptoms, registration_details; giá/trạng thái do server chốt')
    fields = {'patient_id': int_field(data, 'patient_id', required=True, minimum=1),
            'schedule_id': int_field(data, 'schedule_id', required=True, minimum=1),
            'appointment_time': appointment_time(data.get('appointment_time')),
            'symptoms': text_field(data, 'symptoms', max_len=5000)}
    if 'registration_details' in data:
        fields['registration_details'] = validate_registration_details(data['registration_details'])
    return fields


def validate_reason(data, *, required=False):
    data = ensure_object(data)
    if set(data) - {'reason'}:
        raise bad_request('Chỉ nhận reason')
    return text_field(data, 'reason', required=required, max_len=1000)


def validate_cancel(data):
    data = ensure_object(data)
    if set(data) - {'reason', 'cancel_origin'}:
        raise bad_request('Chỉ nhận reason và cancel_origin')
    origin = data.get('cancel_origin', 'PATIENT')
    if origin not in ('PATIENT', 'HOSPITAL'):
        raise bad_request('cancel_origin phải là PATIENT hoặc HOSPITAL')
    return {'reason': text_field(data, 'reason', required=origin == 'HOSPITAL', max_len=1000),
            'cancel_origin': origin}


def parse_list_query(args):
    page, page_size = page_params(args)
    filters = {key: optional_int_arg(args, key) for key in ('patient_id', 'schedule_id', 'doctor_profile_id')}
    if any(value is not None and value < 1 for value in filters.values()):
        raise bad_request('ID phải là số nguyên dương')
    status = args.get('encounter_status') or None
    kind = args.get('encounter_type') or None
    if status and status not in STATUSES:
        raise bad_request('encounter_status không hợp lệ')
    if kind and kind not in ('ONLINE', 'WALK_IN'):
        raise bad_request('encounter_type không hợp lệ')
    work_date = parse_date(args['work_date'], 'work_date') if args.get('work_date') else None
    return {**filters, 'encounter_status': status, 'encounter_type': kind,
            'work_date': work_date, 'page': page, 'page_size': page_size}


def validate_walk_in(data):
    data = ensure_object(data)
    if set(data) - {'patient_id', 'doctor_profile_id', 'symptoms'}:
        raise bad_request('Walk-in chỉ nhận patient_id, doctor_profile_id, symptoms; hệ thống chọn ca')
    return {'patient_id': int_field(data, 'patient_id', required=True, minimum=1),
            'doctor_profile_id': int_field(data, 'doctor_profile_id', required=True, minimum=1),
            'symptoms': text_field(data, 'symptoms', max_len=5000)}


def validate_transfer(data):
    data = ensure_object(data)
    if set(data) - {'schedule_id', 'appointment_time', 'reason'}:
        raise bad_request('Chỉ nhận schedule_id, appointment_time và reason')
    return {'appointment_time': appointment_time(data.get('appointment_time')),
            'schedule_id': int_field(data, 'schedule_id', required=True, minimum=1),
            'reason': text_field(data, 'reason', required=True, max_len=1000)}


def appointment_time(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{2}:\d{2}', value):
        raise bad_request('appointment_time phải có dạng HH:MM')
    return parse_time(value, 'appointment_time')
