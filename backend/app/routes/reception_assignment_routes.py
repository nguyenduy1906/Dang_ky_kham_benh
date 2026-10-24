from flask import Blueprint, jsonify, request
from flasgger import swag_from
from backend.app.core.security import roles_required, current_user
from backend.app.schemas import reception_assignment_schema as schema
from backend.app.services import reception_assignment_service as service
from backend.app.utils.swagger_helpers import spec

reception_assignment_bp = Blueprint('reception_assignment', __name__)


@reception_assignment_bp.get('/admin/reception-workstations')
@roles_required('ADMIN')
@swag_from(spec('Reception assignments', 'Danh sách khu vực sảnh lễ tân'))
def workstations():
    return jsonify(service.workstations(current_user(), request.args.get('include_inactive') == 'true'))


@reception_assignment_bp.post('/admin/reception-workstations')
@roles_required('ADMIN')
@swag_from(spec('Reception assignments', 'Tạo khu vực sảnh làm việc lễ tân'))
def create_workstation():
    return jsonify(service.save_workstation(current_user(), schema.workstation(request.get_json(silent=True)))), 201


@reception_assignment_bp.patch('/admin/reception-workstations/<int:identifier>')
@roles_required('ADMIN')
@swag_from(spec('Reception assignments', 'Sửa khu vực chưa có ca làm việc chưa kết thúc'))
def update_workstation(identifier):
    return jsonify(service.save_workstation(current_user(), schema.workstation(request.get_json(silent=True), True), identifier))


@reception_assignment_bp.get('/admin/reception-assignments')
@roles_required('ADMIN')
@swag_from(spec('Reception assignments', 'Danh sách phân công lễ tân, lọc ngày và phân trang'))
def assignments():
    return jsonify(service.listing(current_user(), schema.query(request.args)))


@reception_assignment_bp.post('/admin/reception-assignments')
@roles_required('ADMIN')
@swag_from(spec('Reception assignments', 'Phân công lễ tân theo ca; toàn bộ danh sách cùng transaction'))
def create():
    return jsonify(service.create(current_user(), schema.create(request.get_json(silent=True)))), 201


@reception_assignment_bp.get('/admin/reception-assignments/<int:identifier>')
@roles_required('ADMIN')
@swag_from(spec('Reception assignments', 'Chi tiết và lịch sử phân công lễ tân'))
def detail(identifier):
    return jsonify(service.detail(current_user(), identifier))


@reception_assignment_bp.patch('/admin/reception-assignments/<int:identifier>')
@roles_required('ADMIN')
@swag_from(spec('Reception assignments', 'Sửa phân công lễ tân chưa bắt đầu, kiểm tra version/trùng ca/nghỉ'))
def update(identifier):
    return jsonify(service.update(current_user(), identifier, schema.update(request.get_json(silent=True))))


@reception_assignment_bp.post('/admin/reception-assignments/<int:identifier>/revoke')
@roles_required('ADMIN')
@swag_from(spec('Reception assignments', 'Thu hồi phân công lễ tân chưa bắt đầu, giữ lịch sử'))
def revoke(identifier):
    return jsonify(service.update(current_user(), identifier, schema.revoke(request.get_json(silent=True)), True))


@reception_assignment_bp.get('/reception/assignments')
@roles_required('RECEPTIONIST')
@swag_from(spec('Reception assignments', 'Lễ tân chỉ xem phân công của chính mình'))
def own_assignments():
    return jsonify(service.listing(current_user(), schema.query(request.args), True))
