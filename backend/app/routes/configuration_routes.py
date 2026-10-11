from backend.app.controllers import configuration_controller as controller
from flask import Blueprint
from flasgger import swag_from
from backend.app.middlewares.auth_middleware import roles_required


from backend.app.utils.swagger import spec, path, body, PAGE

configuration_bp = Blueprint('configuration', __name__)


@configuration_bp.get('/admin/configurations')
@roles_required('ADMIN')
@swag_from(spec('Configurations', 'Danh sách cấu hình; read_only và effective_value chỉ rõ chính sách đang áp dụng', PAGE))
def listing():
    return controller.listing()


@configuration_bp.patch('/admin/configurations/<string:key>')
@roles_required('ADMIN')
@swag_from(spec('Configurations', 'Cập nhật HOSPITAL_NAME, SUPPORT_PHONE, REMINDER_BEFORE_HOURS hoặc ALLOW_WALK_IN',
                [path('key', type_name='string'), body({'config_value': {'type': 'string'}}, ('config_value',))]))
def update(key):
    return controller.update(key)
