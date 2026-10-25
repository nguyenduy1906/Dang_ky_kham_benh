from backend.app.core.errors import bad_request
from backend.app.utils.validation import (ensure_object, text_field, int_field, parse_date,
                                          parse_time, page_params, optional_int_arg, date_range)


def known(data, names):
    ensure_object(data)
    if set(data) - set(names):
        raise bad_request('Body có trường không được phép')


def shift(data):
    known(data, ('work_date', 'start_time', 'end_time'))
    result = {'work_date': parse_date(data.get('work_date'), 'work_date'),
              'start_time': parse_time(data.get('start_time'), 'start_time'),
              'end_time': parse_time(data.get('end_time'), 'end_time')}
    if result['start_time'] >= result['end_time']:
        raise bad_request('Giờ kết thúc phải sau giờ bắt đầu')
    # Keep the shared morning/afternoon work-calendar contract.
    if (str(result['start_time']), str(result['end_time'])) not in (
            ('08:00:00', '11:30:00'), ('13:30:00', '17:00:00')):
        raise bad_request('Ca phải là 08:00–11:30 hoặc 13:30–17:00')
    return result


def location(data):
    station = int_field(data, 'workstation_id', minimum=1)
    area = text_field(data, 'area_name', max_len=100)
    if (station is None) == (area is None):
        raise bad_request('Chọn hoặc nhập một khu vực làm việc')
    return {'workstation_id': station, 'area_name': area}


def create(data):
    known(data, ('receptionist_id', 'workstation_id', 'area_name', 'shifts', 'note'))
    shifts = data.get('shifts')
    if not isinstance(shifts, list) or not 1 <= len(shifts) <= 62:
        raise bad_request('Chọn từ 1 đến 62 ca làm việc')
    rows = [shift(row) for row in shifts]
    if len({tuple(row.values()) for row in rows}) != len(rows):
        raise bad_request('Danh sách có ca bị lặp')
    if (max(r['work_date'] for r in rows) - min(r['work_date'] for r in rows)).days > 30:
        raise bad_request('Phân công tối đa trong 31 ngày')
    return {'receptionist_id': int_field(data, 'receptionist_id', required=True, minimum=1),
            **location(data),
            'shifts': rows, 'note': text_field(data, 'note', max_len=1000)}


def update(data):
    known(data, ('receptionist_id', 'workstation_id', 'area_name', 'work_date', 'start_time', 'end_time', 'note', 'expected_version'))
    return {**shift({key: data.get(key) for key in ('work_date', 'start_time', 'end_time')}),
            'receptionist_id': int_field(data, 'receptionist_id', required=True, minimum=1),
            **location(data),
            'note': text_field(data, 'note', max_len=1000),
            'expected_version': int_field(data, 'expected_version', required=True, minimum=1)}


def revoke(data):
    known(data, ('expected_version', 'reason'))
    return {'expected_version': int_field(data, 'expected_version', required=True, minimum=1),
            'reason': text_field(data, 'reason', required=True, max_len=1000)}


def workstation(data, edit=False):
    known(data, ('name', 'area', 'is_active', 'expected_version') if edit else ('name', 'area'))
    result = {key: text_field(data, key, required=True, max_len=100 if key == 'name' else 150)
              for key in ('name', 'area')}
    if edit:
        if not isinstance(data.get('is_active'), bool):
            raise bad_request('is_active phải là true/false')
        result.update(is_active=data['is_active'], expected_version=int_field(data, 'expected_version', required=True, minimum=1))
    return result


def query(args):
    page, size = page_params(args)
    start, end = date_range(args)
    day = parse_date(args['work_date'], 'work_date') if args.get('work_date') else None
    staff = optional_int_arg(args, 'receptionist_id')
    if staff is not None and staff < 1:
        raise bad_request('receptionist_id không hợp lệ')
    return {'page': page, 'page_size': size, 'from_date': day or start, 'to_date': day or end,
            'q': str(args.get('q') or '').strip()[:150], 'receptionist_id': staff,
            'include_revoked': str(args.get('include_revoked', '')).lower() in ('1', 'true')}
