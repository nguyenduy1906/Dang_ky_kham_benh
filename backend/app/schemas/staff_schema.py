from backend.app.core.errors import bad_request
from backend.app.schemas.auth_schema import ensure_object, text_field
from backend.app.schemas.common_schema import bool_arg, flag_field, int_field, optional_int_arg, page_params


def _profile_fields(data, fields):
    if 'academic_degree' in data:
        fields['academic_degree'] = text_field(data, 'academic_degree', max_len=100)
    if 'specialization' in data:
        fields['specialization'] = text_field(data, 'specialization', max_len=200)
    if 'experience_years' in data:
        fields['experience_years'] = int_field(data, 'experience_years', required=True,
                                               minimum=0, maximum=80)
    if 'introduction' in data:
        fields['introduction'] = text_field(data, 'introduction', max_len=5000)
    return fields


def validate_admin_create(data):
    data = ensure_object(data)
    fields = _profile_fields(data, {
        'user_id': int_field(data, 'user_id', required=True, minimum=1),
        'department_id': int_field(data, 'department_id', required=True, minimum=1)})
    fields['consultation_fee'] = int_field(data, 'consultation_fee', minimum=0) or 0
    fields['is_active'] = flag_field(data, 'is_active') if 'is_active' in data else 1
    return fields


def validate_admin_update(data):
    data = ensure_object(data)
    fields = _profile_fields(data, {})
    if 'department_id' in data:
        fields['department_id'] = int_field(data, 'department_id', required=True, minimum=1)
    if 'consultation_fee' in data:
        fields['consultation_fee'] = int_field(data, 'consultation_fee', required=True, minimum=0)
    if 'is_active' in data:
        fields['is_active'] = flag_field(data, 'is_active')
    if not fields:
        raise bad_request('Không có trường nào để cập nhật')
    return fields


def validate_self_update(data):
    """Bác sĩ chỉ được sửa thông tin giới thiệu, không sửa khoa, phí, trạng thái."""
    data = ensure_object(data)
    fields = _profile_fields(data, {})
    if not fields:
        raise bad_request('Chỉ được sửa academic_degree, specialization, experience_years, introduction')
    return fields


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
