from flask import Blueprint, jsonify, request
from flasgger import swag_from
from backend.app.core.security import current_user, login_required, roles_required
from backend.app.schemas import medical_record_schema
from backend.app.utils.validation import page_params
from backend.app.utils.validation import optional_int_arg, ensure_object
from backend.app.core.errors import bad_request
from backend.app.services import medical_record_service as service
from backend.app.utils.swagger_helpers import spec, path, body, PAGE

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
    return jsonify(service.put_items(current_user(), record_id, medical_record_schema.validate_items(request.get_json(silent=True))))


@medical_record_bp.post('/doctor/encounters/<int:encounter_id>/complete')
@roles_required('DOCTOR')
@swag_from(spec('Medical records', 'Hoàn tất lượt đang khám có bệnh án/chẩn đoán, qua service gói 3; lặp an toàn', [path('encounter_id')]))
def complete(encounter_id):
    return jsonify(service.complete(current_user(), encounter_id))


review_bp = Blueprint('review', __name__)


@review_bp.post('/encounters/<int:encounter_id>/review')
@roles_required('USER')
@swag_from(spec('Reviews', 'USER đánh giá lượt COMPLETED trong phạm vi được phép; mỗi lần gửi tạo một đánh giá mới', [path('encounter_id'), body({
    'rating': {'type': 'integer', 'minimum': 1, 'maximum': 5}, 'comment': {'type': 'string'}}, ('rating',))]))
def create(encounter_id):
    result, created = service.create_review(current_user(), encounter_id, medical_record_schema.validate_review(request.get_json(silent=True)))
    return jsonify(result), 201 if created else 200


@review_bp.get('/doctors/<int:doctor_profile_id>/reviews')
@swag_from(spec('Reviews', 'Đánh giá công khai và điểm trung bình; không trả hồ sơ/bệnh án/danh tính bệnh nhân',
                [path('doctor_profile_id')] + PAGE, public=True))
def listing(doctor_profile_id):
    return jsonify(service.list_public_reviews(doctor_profile_id, *page_params(request.args)))


@review_bp.get('/admin/reviews')
@roles_required('ADMIN')
@swag_from(spec('Reviews Admin', 'Danh sách và chi tiết đánh giá, bao gồm đánh giá đang ẩn', PAGE + [{'in': 'query', 'name': 'review_id', 'type': 'integer'}]))
def admin_review_list():
    review_id = optional_int_arg(request.args, 'review_id')
    if review_id is not None and review_id < 1:
        raise bad_request('review_id phải là số nguyên dương')
    return jsonify(service.admin_reviews(current_user(), *page_params(request.args), review_id=review_id))


@review_bp.patch('/admin/reviews/<int:review_id>/visibility')
@roles_required('ADMIN')
@swag_from(spec('Reviews Admin', 'Ẩn/hiện đánh giá, giữ nguyên nội dung và dữ liệu', [path('review_id'), body({'is_hidden': {'type': 'boolean'}}, ('is_hidden',))]))
def admin_review_visibility(review_id):
    data = ensure_object(request.get_json(silent=True))
    if set(data) != {'is_hidden'} or type(data['is_hidden']) is not bool:
        raise bad_request('Chỉ nhận is_hidden kiểu boolean')
    return jsonify(service.set_review_visibility(current_user(), review_id, data['is_hidden']))
