from backend.app.core.errors import bad_request, conflict
from backend.app.schemas.auth_schema import ensure_object, text_field

# Các quy tắc đã chốt với chủ đồ án không bị đổi qua API cấu hình tổng quát.
FIXED = {'APPOINTMENT_HOLD_MINUTES': '10', 'DEFAULT_DEPOSIT_PERCENT': '100',
         'NO_SHOW_FORFEIT_DEPOSIT': 'true', 'CHECKIN_EARLY_MINUTES': '30',
         'CHECKIN_LATE_MINUTES': '0', 'MAX_REVIEW_RATING': '5',
         'CANCEL_HOURS_LIMIT': '12', 'CANCEL_REFUND_PERCENT': '50', 'NO_SHOW_GRACE_MINUTES': '15'}
EDITABLE = {'HOSPITAL_NAME', 'SUPPORT_PHONE', 'REMINDER_BEFORE_HOURS', 'ALLOW_WALK_IN'}


def validate_configuration(key, data):
    if key in FIXED:
        raise conflict('Quy tắc nghiệp vụ đã chốt; không đổi qua cấu hình tổng quát', 'CONFIGURATION_POLICY_FIXED')
    if key not in EDITABLE:
        raise bad_request('Khóa cấu hình chưa được hỗ trợ cập nhật', 'CONFIGURATION_KEY_UNSUPPORTED')
    data = ensure_object(data)
    if set(data) - {'config_value'}:
        raise bad_request('Chỉ nhận config_value')
    value = text_field(data, 'config_value', required=True, max_len=255)
    if key == 'ALLOW_WALK_IN' and value not in ('true', 'false'):
        raise bad_request('ALLOW_WALK_IN phải là chuỗi true/false')
    if key == 'REMINDER_BEFORE_HOURS':
        if not value.isascii() or not value.isdecimal() or not 1 <= int(value) <= 168:
            raise bad_request('REMINDER_BEFORE_HOURS phải là số giờ từ 1 đến 168')
        value = str(int(value))
    if key == 'SUPPORT_PHONE' and len(value) > 30:
        raise bad_request('SUPPORT_PHONE tối đa 30 ký tự')
    return value
