from backend.app.core.errors import bad_request
from backend.app.schemas.common_schema import page_params


def parse_query(args):
    raw = args.get('unread_only', 'false').lower()
    if raw not in ('true', 'false', '1', '0'):
        raise bad_request('unread_only phải là true/false')
    page, size = page_params(args)
    return page, size, raw in ('true', '1')
