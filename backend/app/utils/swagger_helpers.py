"""Mô tả Swagger dùng chung cho gói 5."""
SECURITY = [{'Bearer': []}]
ACCOUNT_PROPERTIES = {
    'user_id': {'type': 'integer'}, 'user_code': {'type': 'string'},
    'role_id': {'type': 'integer'}, 'role_code': {'type': 'string'},
    'role_name': {'type': 'string', 'enum': ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'USER']},
    'full_name': {'type': 'string'}, 'phone': {'type': 'string', 'x-nullable': True},
    'email': {'type': 'string', 'x-nullable': True},
    'dob': {'type': 'string', 'format': 'date', 'x-nullable': True},
    'gender': {'type': 'string', 'enum': ['Nam', 'Nữ', 'Khác'], 'x-nullable': True},
    'id_card': {'type': 'string', 'pattern': '^[0-9]{12}$', 'x-nullable': True},
    **{key: {'type': 'string', 'x-nullable': True} for key in
       ('address', 'emergency_contact_name', 'emergency_contact_phone',
        'emergency_contact_relationship', 'avatar_url')},
    'approval_status': {'type': 'string'}, 'account_status': {'type': 'string'},
    'email_verified': {'type': 'boolean'}, 'is_deleted': {'type': 'boolean'},
    'created_at': {'type': 'string', 'format': 'date-time'},
    'updated_at': {'type': 'string', 'format': 'date-time'},
}
PROFILE_DEFINITIONS = {
    'AccountProfile': {'type': 'object', 'properties': ACCOUNT_PROPERTIES},
    'AccountProfileResponse': {'type': 'object', 'properties': {
        'user': {'$ref': '#/definitions/AccountProfile'}}},
    'PatientProfile': {'type': 'object', 'description':
        'Người thực tế được khám. USER đặt hộ chỉ nhận tập trường tối thiểu khi không sở hữu hồ sơ.',
        'properties': {
            **{key: ACCOUNT_PROPERTIES[key] for key in
               ('full_name', 'phone', 'email', 'dob', 'gender', 'address',
                'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship',
                'created_at', 'updated_at')},
            'patient_id': {'type': 'integer'}, 'patient_code': {'type': 'string'},
            'user_id': {'type': 'integer', 'x-nullable': True},
            'user_code': {'type': 'string', 'x-nullable': True},
            'id_card': {'type': 'string', 'pattern': '^([0-9]{9}|[0-9]{12})$', 'x-nullable': True},
            'health_insurance': {'type': 'string', 'x-nullable': True},
            'relationship': {'type': 'string', 'x-nullable': True},
            'archived_at': {'type': 'string', 'format': 'date-time', 'x-nullable': True},
            'is_archived': {'type': 'boolean'},
        }},
    'PatientProfileResponse': {'type': 'object', 'properties': {
        'patient': {'$ref': '#/definitions/PatientProfile'}}},
}
PAGE = [{'in': 'query', 'name': 'page', 'type': 'integer', 'default': 1},
        {'in': 'query', 'name': 'page_size', 'type': 'integer', 'default': 20}]


def path(name, *, type_name='integer'):
    return {'in': 'path', 'name': name, 'type': type_name, 'required': True}


def body(properties, required=()):
    return {'in': 'body', 'name': 'body', 'required': True, 'schema': {
        'type': 'object', 'required': list(required), 'properties': properties}}


def spec(tag, summary, parameters=(), *, public=False):
    result = {'tags': [tag], 'summary': summary, 'parameters': list(parameters), 'responses': {
        200: {'description': 'Thành công'}, 201: {'description': 'Đã tạo bản ghi'},
        400: {'description': 'Dữ liệu không hợp lệ'}, 401: {'description': 'Chưa đăng nhập'},
        403: {'description': 'Không có quyền thao tác'}, 404: {'description': 'Không tìm thấy trong phạm vi quyền'},
        409: {'description': 'Trạng thái, version hoặc dữ liệu hiện tại không cho phép'}}}
    if not public: result['security'] = SECURITY
    return result
