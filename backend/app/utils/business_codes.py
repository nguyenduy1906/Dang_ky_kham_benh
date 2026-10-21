"""Human-readable business references; numeric primary/foreign keys stay internal."""

IDENTIFIERS = {
    'role_id': ('role_code', 'VT'),
    'user_id': ('user_code', 'TK'),
    'patient_id': ('patient_code', 'BN'),
    'department_id': ('department_code', 'CK'),
    'doctor_profile_id': ('doctor_code', 'BS'),
    'room_id': ('room_code', 'PH'),
    'schedule_id': ('schedule_code', 'CA'),
    'encounter_id': ('encounter_code', 'LK'),
    'payment_id': ('payment_code', 'TT'),
    'record_id': ('record_code', 'BA'),
    'item_id': ('item_code', 'DT'),
    'review_id': ('review_code', 'DG'),
    'notification_id': ('notification_code', 'TB'),
    'article_id': ('article_code', 'BV'),
    'assignment_id': ('assignment_code', 'PC'),
    'leadership_id': ('leadership_code', 'LDK'),
}


def business_code(prefix, identifier):
    if isinstance(identifier, bool) or not isinstance(identifier, int) or identifier <= 0:
        return None
    return f'{prefix}_{identifier:03d}'


def with_business_codes(row):
    """Also cover SQL projections and whitelisted response objects without changing IDs."""
    out = dict(row)
    for key, (field, prefix) in IDENTIFIERS.items():
        code = business_code(prefix, row.get(key))
        if code:
            out.setdefault(field, code)
    if 'request_id' in row:
        prefix = 'YCVT' if 'requested_role_id' in row or 'request_status' in row else 'NP'
        code = business_code(prefix, row['request_id'])
        if code:
            out.setdefault('request_code', code)
    if 'log_id' in row:
        code = business_code('NKCD' if 'old_doctor_id' in row else 'NKTT', row['log_id'])
        if code:
            out.setdefault('log_code', code)
    return out
