from backend.app.core.errors import bad_request
from backend.app.schemas.auth_schema import ensure_object, text_field

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
