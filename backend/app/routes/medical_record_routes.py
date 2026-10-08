from flask import Blueprint, jsonify, request
from flasgger import swag_from
from backend.app.core.security import current_user, login_required, roles_required
from backend.app.schemas import medical_record_schema, prescription_schema
from backend.app.schemas.common_schema import page_params
from backend.app.services import medical_record_service as service
from backend.app.routes.package5_docs import spec, path, body, PAGE

medical_record_bp = Blueprint('medical_record', __name__)
RECORD = {'diagnosis': {'type': 'string'}, 'treatment': {'type': 'string'}, 'doctor_notes': {'type': 'string'},
          'reason': {'type': 'string', 'description': 'Bắt buộc khi bổ sung/sửa sau COMPLETED'},
          'expected_version': {'type': 'integer', 'minimum': 0, 'description': 'Version đọc gần nhất; bắt buộc sửa sau COMPLETED'}}
ITEM = {'type': 'object', 'required': ['medication_name', 'quantity'], 'properties': {
    'medication_name': {'type': 'string'}, 'dosage': {'type': 'string'},
    'quantity': {'type': 'integer', 'minimum': 1}, 'instructions': {'type': 'string'}}}


@medical_record_bp.get('/encounters/<int:encounter_id>/medical-record')
@login_required
@swag_from(spec('Medical records', 'Xem bệnh án theo quyền USER/DOCTOR/NURSE/ADMIN, NURSE cần phân công còn hiệu lực', [path('encounter_id')]))
def get_record(encounter_id):
    return jsonify(service.get_record(current_user(), encounter_id))


@medical_record_bp.put('/doctor/encounters/<int:encounter_id>/medical-record')
@roles_required('DOCTOR')
@swag_from(spec('Medical records', 'Bác sĩ phụ trách lưu bệnh án hoặc bổ sung sau hoàn tất, lưu lịch sử trước/sau',
                [path('encounter_id'), body(RECORD, ('diagnosis',))]))
def put_record(encounter_id):
    return jsonify(service.put_record(current_user(), encounter_id, medical_record_schema.validate_record(request.get_json(silent=True))))


@medical_record_bp.get('/medical-records/<int:record_id>/prescription-items')
@login_required
@swag_from(spec('Medical records', 'Xem đơn thuốc theo cùng quyền bệnh án', [path('record_id')] + PAGE))
def get_items(record_id):
    return jsonify(service.get_items(current_user(), record_id, *page_params(request.args)))


@medical_record_bp.put('/doctor/medical-records/<int:record_id>/prescription-items')
@roles_required('DOCTOR')
@swag_from(spec('Medical records', 'Thay toàn bộ đơn thuốc; items=[] là không kê thuốc; lưu lịch sử', [path('record_id'), body({
    'items': {'type': 'array', 'items': ITEM}, 'reason': RECORD['reason'], 'expected_version': RECORD['expected_version']}, ('items',))]))
def put_items(record_id):
    return jsonify(service.put_items(current_user(), record_id, prescription_schema.validate_items(request.get_json(silent=True))))


@medical_record_bp.post('/doctor/encounters/<int:encounter_id>/complete')
@roles_required('DOCTOR')
@swag_from(spec('Medical records', 'Hoàn tất lượt đang khám có bệnh án/chẩn đoán, qua service gói 3; lặp an toàn', [path('encounter_id')]))
def complete(encounter_id):
    return jsonify(service.complete(current_user(), encounter_id))
