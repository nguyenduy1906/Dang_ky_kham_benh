from backend.app.core.errors import bad_request
from backend.app.schemas.auth_schema import ensure_object, text_field
from backend.app.schemas.common_schema import bool_arg, int_field, optional_int_arg, page_params


def validate_create(data):
    data = ensure_object(data)
    if set(data) - {'nurse_id', 'schedule_id', 'note'}:
        raise bad_request('Chỉ chấp nhận nurse_id, schedule_id và note')
    return {'nurse_id': int_field(data, 'nurse_id', required=True, minimum=1),
            'schedule_id': int_field(data, 'schedule_id', required=True, minimum=1),
            'note': text_field(data, 'note', max_len=1000)}


def parse_list_query(args):
    page, page_size = page_params(args)
    filters = {key: optional_int_arg(args, key) for key in ('nurse_id', 'schedule_id')}
    if any(value is not None and value < 1 for value in filters.values()):
        raise bad_request('nurse_id và schedule_id phải là số nguyên dương')
    return {**filters, 'include_revoked': bool_arg(args, 'include_revoked'),
            'page': page, 'page_size': page_size}
