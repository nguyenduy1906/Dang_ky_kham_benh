from backend.app.core.errors import bad_request
from backend.app.utils.validation import (
    ensure_object, text_field, bool_arg, date_range,
    int_field, optional_int_arg, page_params, parse_date,
    parse_time,
)

SCHEDULE_STATUSES = ('OPEN', 'FULL', 'CLOSED', 'UNAVAILABLE')
MANUAL_STATUSES = ('OPEN', 'CLOSED')
MAX_QUOTA = 1000


def validate_create(data):
    data = ensure_object(data)
    start = parse_time(data.get('start_time'), 'start_time')
    end = parse_time(data.get('end_time'), 'end_time')
    if end <= start:
        raise bad_request('end_time phải sau start_time')
    return {'doctor_profile_id': int_field(data, 'doctor_profile_id', required=True, minimum=1),
            'room_id': int_field(data, 'room_id', required=True, minimum=1),
            'work_date': parse_date(data.get('work_date'), 'work_date'),
            'start_time': start, 'end_time': end,
            'slot_minutes': validate_slot_minutes(data['slot_minutes']) if 'slot_minutes' in data else None,
            'max_quota': int_field(data, 'max_quota', required=True, minimum=1, maximum=MAX_QUOTA)}


def validate_update(data):
    data = ensure_object(data)
    fields = {}
    if 'room_id' in data:
        fields['room_id'] = int_field(data, 'room_id', required=True, minimum=1)
    if 'work_date' in data:
        fields['work_date'] = parse_date(data['work_date'], 'work_date')
    if 'start_time' in data:
        fields['start_time'] = parse_time(data['start_time'], 'start_time')
    if 'end_time' in data:
        fields['end_time'] = parse_time(data['end_time'], 'end_time')
    if 'slot_minutes' in data:
        fields['slot_minutes'] = validate_slot_minutes(data['slot_minutes'])
    if 'max_quota' in data:
        fields['max_quota'] = int_field(data, 'max_quota', required=True, minimum=1,
                                        maximum=MAX_QUOTA)
    if 'schedule_status' in data:
        if data['schedule_status'] not in MANUAL_STATUSES:
            raise bad_request('schedule_status chỉ được đặt OPEN hoặc CLOSED')
        fields['schedule_status'] = data['schedule_status']
    if not fields:
        raise bad_request('Không có trường nào để cập nhật')
    return fields


def validate_unavailability(data):
    data = ensure_object(data)
    return {'reason': text_field(data, 'reason', required=True, max_len=500)}


def parse_list_query(args):
    start, end = date_range(args)
    status = args.get('status')
    if status and status not in SCHEDULE_STATUSES:
        raise bad_request(f'status phải là một trong: {", ".join(SCHEDULE_STATUSES)}')
    page, page_size = page_params(args)
    return {'doctor_profile_id': optional_int_arg(args, 'doctor_profile_id'),
            'room_id': optional_int_arg(args, 'room_id'),
            'department_id': optional_int_arg(args, 'department_id'),
            'from_date': start, 'to_date': end, 'status': status or None,
            'page': page, 'page_size': page_size}


def validate_assignment_create(data):
    data = ensure_object(data)
    if set(data) - {'nurse_id', 'schedule_id', 'note'}:
        raise bad_request('Chỉ chấp nhận nurse_id, schedule_id và note')
    return {'nurse_id': int_field(data, 'nurse_id', required=True, minimum=1),
            'schedule_id': int_field(data, 'schedule_id', required=True, minimum=1),
            'note': text_field(data, 'note', max_len=1000)}


def parse_assignment_query(args):
    page, page_size = page_params(args)
    filters = {key: optional_int_arg(args, key) for key in ('nurse_id', 'schedule_id')}
    if any(value is not None and value < 1 for value in filters.values()):
        raise bad_request('nurse_id và schedule_id phải là số nguyên dương')
    return {**filters, 'include_revoked': bool_arg(args, 'include_revoked'),
            'page': page, 'page_size': page_size}


def validate_slot_minutes(value):
    if type(value) is not int or value not in (15, 30):
        raise bad_request('slot_minutes phải là 15 hoặc 30')
    return value


def validate_move(data):
    data = ensure_object(data)
    if set(data) - {'target_schedule_id','reason'}:
        raise bad_request('Chỉ chấp nhận target_schedule_id và reason')
    return {'target_schedule_id':int_field(data,'target_schedule_id',required=True,minimum=1),
            'reason':text_field(data,'reason',required=True,max_len=500)}


def validate_assignment_update(data):
    data = ensure_object(data)
    if set(data)-{'nurse_id','schedule_id','note','assignment_status','expected_version'}:
        raise bad_request('Phân công chứa trường không được phép cập nhật')
    fields=validate_assignment_create({k:data[k] for k in ('nurse_id','schedule_id','note') if k in data})
    if data.get('assignment_status') not in ('ACTIVE','REVOKED'):
        raise bad_request('assignment_status phải là ACTIVE hoặc REVOKED')
    version=text_field(data,'expected_version',required=True,max_len=64)
    if len(version)!=64:raise bad_request('expected_version không hợp lệ')
    return {**fields,'assignment_status':data['assignment_status'],'expected_version':version}
