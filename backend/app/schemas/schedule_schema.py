from backend.app.core.errors import bad_request
from backend.app.schemas.auth_schema import ensure_object, text_field
from backend.app.schemas.common_schema import (date_range, int_field, optional_int_arg,
                                               page_params, parse_date, parse_time)

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
