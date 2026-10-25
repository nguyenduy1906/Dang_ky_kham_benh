from backend.app.core.errors import bad_request
from backend.app.utils.validation import ensure_object, text_field

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


def parse_staff_list(args):
    from backend.app.utils.validation import page_params,parse_date
    from backend.app.utils.date import today_vn
    page,size=page_params(args)
    start=parse_date(args['from_date'],'from_date') if args.get('from_date') else today_vn()
    end=parse_date(args['to_date'],'to_date') if args.get('to_date') else today_vn()
    if end<start:raise bad_request('Từ ngày phải trước hoặc bằng Đến ngày')
    status=args.get('status') or None
    if status not in (None,'PENDING','SUCCESS','FAILED','REFUNDED'):raise bad_request('Trạng thái thanh toán không hợp lệ')
    return {'page':page,'page_size':size,'from_date':start,'to_date':end,'status':status,'q':(args.get('q') or '').strip()[:200]}


def validate_staff_result(data):
    data=_object(data,('result','note'))
    result={'result':validate_result({'result':data.get('result')})}
    result['note']=text_field(data,'note',max_len=1000)
    return result
