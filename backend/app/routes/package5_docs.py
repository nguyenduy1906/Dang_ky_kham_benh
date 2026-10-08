"""Mô tả Swagger dùng chung cho gói 5."""
SECURITY = [{'Bearer': []}]
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
