from flask import Blueprint, jsonify, request
from flasgger import swag_from
from backend.app.core.security import current_user, roles_required
from backend.app.utils.validation import page_params
from backend.app.schemas.configuration_schema import validate_configuration
from backend.app.services import configuration_service as service
from backend.app.utils.swagger_helpers import spec, path, body, PAGE

configuration_bp = Blueprint('configuration', __name__)


@configuration_bp.get('/contact-info')
@swag_from(spec('Configurations', 'Thông tin liên hệ công khai: tên cơ sở, số hỗ trợ, email và giờ khám', public=True))
def contact_info():
    return jsonify(service.public_contact())


@configuration_bp.get('/admin/configurations')
@roles_required('ADMIN')
@swag_from(spec('Configurations', 'Danh sách cấu hình; read_only và effective_value chỉ rõ chính sách đang áp dụng', PAGE))
def listing():
    return jsonify(service.listing(current_user(), *page_params(request.args)))


@configuration_bp.patch('/admin/configurations/<string:key>')
@roles_required('ADMIN')
@swag_from(spec('Configurations', 'Cập nhật HOSPITAL_NAME, SUPPORT_PHONE, SUPPORT_EMAIL, EXAM_HOURS, REMINDER_BEFORE_HOURS hoặc ALLOW_WALK_IN',
                [path('key', type_name='string'), body({'config_value': {'type': 'string'}}, ('config_value',))]))
def update(key):
    return jsonify(service.update(current_user(), key, validate_configuration(key, request.get_json(silent=True))))
