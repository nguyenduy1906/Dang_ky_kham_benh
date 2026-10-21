"""Hàm kiểm tra dữ liệu dùng chung cho các schema."""
import re
from datetime import date, time

from backend.app.core import constants
from backend.app.core.errors import bad_request

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
PHONE_RE = re.compile(r'^\+?[0-9]{9,15}$')


def ensure_object(data):
    if not isinstance(data, dict):
        raise bad_request('Body phải là JSON object hợp lệ')
    return data


def text_field(data, key, *, required=False, max_len=255):
    value = data.get(key)
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise bad_request(f'Thiếu trường {key}')
        return None
    if not isinstance(value, str):
        raise bad_request(f'Trường {key} phải là chuỗi')
    value = value.strip()
    if len(value) > max_len:
        raise bad_request(f'Trường {key} tối đa {max_len} ký tự')
    return value


def normalize_email(value, key='email'):
    value = value.strip().lower()
    if len(value) > 254 or not EMAIL_RE.match(value):
        raise bad_request(f'{key} không hợp lệ')
    return value


def normalize_phone(value, key='phone'):
    value = re.sub(r'[\s.\-]', '', value)
    if re.fullmatch(r'\+?84[35789]\d{8}', value):
        value = '0' + value.lstrip('+')[2:]
    if not PHONE_RE.match(value):
        raise bad_request(f'{key} không hợp lệ (9-15 chữ số)')
    return value


def int_arg(args, key, default, lo, hi):
    raw = args.get(key)
    if raw is None or raw == '':
        return default
    try:
        return max(lo, min(hi, int(raw)))
    except ValueError:
        raise bad_request(f'{key} phải là số nguyên') from None


def page_params(args):
    return (int_arg(args, 'page', 1, 1, 100000),
            int_arg(args, 'page_size', constants.DEFAULT_PAGE_SIZE, 1, constants.MAX_PAGE_SIZE))


def bool_arg(args, key):
    return str(args.get(key, '')).lower() in ('1', 'true')


def optional_int_arg(args, key):
    raw = args.get(key)
    if raw is None or raw == '':
        return None
    try:
        return int(raw)
    except ValueError:
        raise bad_request(f'{key} phải là số nguyên') from None


def parse_date(value, key):
    if not isinstance(value, str):
        raise bad_request(f'{key} phải có dạng YYYY-MM-DD')
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise bad_request(f'{key} phải có dạng YYYY-MM-DD') from None


def parse_time(value, key):
    if not isinstance(value, str):
        raise bad_request(f'{key} phải có dạng HH:MM')
    try:
        parsed = time.fromisoformat(value)
    except ValueError:
        raise bad_request(f'{key} phải có dạng HH:MM') from None
    if parsed.tzinfo is not None:
        raise bad_request(f'{key} không được kèm múi giờ')
    return parsed.replace(second=0, microsecond=0)


def int_field(data, key, *, required=False, minimum=None, maximum=None):
    value = data.get(key)
    if value is None:
        if required:
            raise bad_request(f'Thiếu trường {key}')
        return None
    if isinstance(value, bool) or not isinstance(value, int):
        raise bad_request(f'{key} phải là số nguyên')
    if minimum is not None and value < minimum:
        raise bad_request(f'{key} phải >= {minimum}')
    if maximum is not None and value > maximum:
        raise bad_request(f'{key} phải <= {maximum}')
    return value


def flag_field(data, key):
    value = data.get(key)
    if not isinstance(value, bool):
        raise bad_request(f'{key} phải là true/false')
    return 1 if value else 0


def date_range(args):
    start = args.get('from_date')
    end = args.get('to_date')
    start = parse_date(start, 'from_date') if start else None
    end = parse_date(end, 'to_date') if end else None
    if start and end and start > end:
        raise bad_request('from_date phải <= to_date')
    return start, end
