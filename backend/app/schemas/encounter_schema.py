from backend.app.core.errors import bad_request
from backend.app.schemas.auth_schema import ensure_object, text_field
from backend.app.schemas.common_schema import int_field, optional_int_arg, page_params, parse_date

STATUSES = ('HOLDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED',
            'CANCELLED', 'NO_SHOW', 'EXPIRED')


def validate_online(data):
    data = ensure_object(data)
    if set(data) - {'patient_id', 'schedule_id', 'symptoms'}:
        raise bad_request('Chỉ nhận patient_id, schedule_id, symptoms; giá/trạng thái do server chốt')
    return {'patient_id': int_field(data, 'patient_id', required=True, minimum=1),
            'schedule_id': int_field(data, 'schedule_id', required=True, minimum=1),
            'symptoms': text_field(data, 'symptoms', max_len=5000)}


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
    if set(data) - {'schedule_id', 'reason'}:
        raise bad_request('Chỉ nhận schedule_id và reason')
    return {'schedule_id': int_field(data, 'schedule_id', required=True, minimum=1),
            'reason': text_field(data, 'reason', required=True, max_len=1000)}


METHODS = ('CASH', 'BANK', 'EWALLET', 'CARD')


def _object(data, allowed):
    data = ensure_object(data)
    if set(data) - set(allowed):
        raise bad_request('Body chứa trường không được phép; số tiền/trạng thái do server xác định')
    return data


def validate_method(data):
    data = _object(data, ('payment_method',))
    method = text_field(data, 'payment_method', required=True)
    if method not in METHODS:
        raise bad_request('payment_method phải là CASH, BANK, EWALLET hoặc CARD')
    return {'payment_method': method}


def validate_result(data):
    data = _object(data, ('result',))
    result = text_field(data, 'result', required=True)
    if result not in ('SUCCESS', 'FAILED'):
        raise bad_request('result phải là SUCCESS hoặc FAILED')
    return result


def validate_refund(data):
    return text_field(_object(data, ('reason',)), 'reason', required=True, max_len=1000)
