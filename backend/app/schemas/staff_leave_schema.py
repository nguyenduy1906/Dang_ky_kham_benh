from datetime import timedelta

from backend.app.core.errors import bad_request
from backend.app.utils.validation import (
    ensure_object, text_field, parse_date, page_params, optional_int_arg
)
from backend.app.utils.date import today_vn

PERIODS = ('FULL_DAY', 'MORNING', 'AFTERNOON')
STATUSES = ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')


def _known(data, allowed):
    ensure_object(data)
    if set(data) - set(allowed):
        raise bad_request('Body có trường không được phép')


def validate_create(data):
    _known(data, ('from_date', 'to_date', 'period', 'reason'))
    start = parse_date(data.get('from_date'), 'from_date')
    end = parse_date(data.get('to_date', data.get('from_date')), 'to_date')
    if start < today_vn() or end < start or (end - start).days > 30:
        raise bad_request('Đơn nghỉ phải từ hôm nay trở đi, tối đa 31 ngày và from_date <= to_date')
    period = data.get('period', 'FULL_DAY')
    if period not in PERIODS:
        raise bad_request('period phải là FULL_DAY, MORNING hoặc AFTERNOON')
    return {'from_date': start, 'to_date': end, 'period': period,
            'reason': text_field(data, 'reason', required=True, max_len=1000)}


def validate_review(data):
    _known(data, ('decision', 'note'))
    decision = data.get('decision')
    if decision not in ('APPROVED', 'REJECTED'):
        raise bad_request('decision phải là APPROVED hoặc REJECTED')
    return {'decision': decision, 'note': text_field(data, 'note', required=True, max_len=1000)}


def calendar_query(args):
    today = today_vn()
    start = parse_date(args['from_date'], 'from_date') if args.get('from_date') else today - timedelta(days=today.weekday())
    end = parse_date(args['to_date'], 'to_date') if args.get('to_date') else start + timedelta(days=6)
    if end < start or (end - start).days > 30:
        raise bad_request('Khoảng xem lịch tối đa 31 ngày và from_date <= to_date')
    return {'from_date': start, 'to_date': end}


def list_query(args, *, admin=False):
    page, size = page_params(args)
    status = args.get('status') or None
    if status and status not in STATUSES:
        raise bad_request('status không hợp lệ')
    user_id = optional_int_arg(args, 'user_id') if admin else None
    if user_id is not None and user_id < 1:
        raise bad_request('user_id phải là số nguyên dương')
    return {'page': page, 'page_size': size, 'status': status, 'user_id': user_id}
