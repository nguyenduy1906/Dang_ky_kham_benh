from backend.app.core.errors import bad_request
from backend.app.utils.validation import ensure_object, text_field, normalize_email

# Defaults also describe the policy of visits created before policy snapshots.
POLICY_DEFAULTS = {'APPOINTMENT_HOLD_MINUTES': 10, 'DEFAULT_DEPOSIT_PERCENT': 100,
    'NO_SHOW_FORFEIT_DEPOSIT': True, 'CHECKIN_EARLY_MINUTES': 30,
    'CHECKIN_LATE_MINUTES': 0, 'MAX_REVIEW_RATING': 5,
    'CANCEL_HOURS_LIMIT': 12, 'CANCEL_REFUND_PERCENT': 50, 'NO_SHOW_GRACE_MINUTES': 15}
NUMERIC_LIMITS = {'APPOINTMENT_HOLD_MINUTES': (1, 1440), 'DEFAULT_DEPOSIT_PERCENT': (1, 100),
    'CHECKIN_EARLY_MINUTES': (0, 1440), 'CHECKIN_LATE_MINUTES': (0, 1440),
    'MAX_REVIEW_RATING': (1, 5), 'CANCEL_HOURS_LIMIT': (0, 8760),
    'CANCEL_REFUND_PERCENT': (0, 100), 'NO_SHOW_GRACE_MINUTES': (0, 1440),
    'REMINDER_BEFORE_HOURS': (1, 168)}
EDITABLE = set(POLICY_DEFAULTS) | {'HOSPITAL_NAME', 'SUPPORT_PHONE', 'SUPPORT_EMAIL',
    'EXAM_HOURS', 'REMINDER_BEFORE_HOURS', 'ALLOW_WALK_IN'}


def validate_configuration(key, data):
    if key not in EDITABLE:
        raise bad_request('Khóa cấu hình chưa được hỗ trợ cập nhật', 'CONFIGURATION_KEY_UNSUPPORTED')
    data = ensure_object(data)
    if set(data) - {'config_value'}:
        raise bad_request('Chỉ nhận config_value')
    value = text_field(data, 'config_value', required=True, max_len=255)
    if key in ('ALLOW_WALK_IN', 'NO_SHOW_FORFEIT_DEPOSIT') and value not in ('true', 'false'):
        raise bad_request('Chọn giá trị true hoặc false', 'INVALID_CONFIGURATION_VALUE')
    if key in NUMERIC_LIMITS:
        minimum, maximum = NUMERIC_LIMITS[key]
        if not value.isascii() or not value.isdecimal() or not minimum <= int(value) <= maximum:
            raise bad_request(f'Giá trị phải là số nguyên từ {minimum} đến {maximum}', 'INVALID_CONFIGURATION_VALUE')
        value = str(int(value))
    if key == 'SUPPORT_PHONE' and len(value) > 30:
        raise bad_request('SUPPORT_PHONE tối đa 30 ký tự')
    if key == 'SUPPORT_EMAIL':
        value = normalize_email(value, key)
    return value
