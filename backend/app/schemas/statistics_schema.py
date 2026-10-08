from backend.app.core.errors import bad_request
from backend.app.schemas.common_schema import date_range, optional_int_arg, page_params
from backend.app.schemas.encounter_schema import STATUSES


def parse_query(args):
    start, end = date_range(args)
    page, size = page_params(args)
    fields = {key: optional_int_arg(args, key) for key in ('doctor_profile_id', 'department_id', 'encounter_id')}
    if any(v is not None and v < 1 for v in fields.values()):
        raise bad_request('ID phải là số nguyên dương')
    status, kind = args.get('encounter_status') or None, args.get('encounter_type') or None
    if status and status not in STATUSES: raise bad_request('encounter_status không hợp lệ')
    if kind and kind not in ('ONLINE', 'WALK_IN'): raise bad_request('encounter_type không hợp lệ')
    group = args.get('group_by', 'day')
    if group not in ('day', 'doctor', 'department'): raise bad_request('group_by phải là day, doctor hoặc department')
    return {**fields, 'from_date': start, 'to_date': end, 'page': page, 'page_size': size,
            'encounter_status': status, 'encounter_type': kind, 'group_by': group}
