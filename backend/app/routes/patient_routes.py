"""Route hồ sơ bệnh nhân."""
from flask import Blueprint, jsonify, request

from backend.app.core.security import current_user, login_required
from backend.app.schemas import patient_schema
from backend.app.utils.validation import page_params
from backend.app.services import patient_service

patient_bp = Blueprint('patient', __name__, url_prefix='/patients')



@patient_bp.get('')
@login_required
def list_patients():
    """Danh sách hồ sơ (USER chỉ thấy hồ sơ của mình)
    ---
    tags:
      - Patients
    security:
      - Bearer: []
    parameters:
      - {in: query, name: q, type: string}
      - {in: query, name: include_archived, type: boolean}
      - {in: query, name: page, type: integer}
      - {in: query, name: page_size, type: integer}
    responses:
      200:
        description: Danh sách hồ sơ
    """
    return jsonify(patient_service.list_patients(current_user(),
                                                 patient_schema.parse_list_query(request.args)))


@patient_bp.post('')
@login_required
def create_patient():
    """Tạo/tìm hồ sơ theo thông tin người khám; tự tạo hoặc dùng lại tài khoản theo số điện thoại
    ---
    tags:
      - Patients
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [full_name, phone]
          properties:
            full_name: {type: string, example: Nguyen Van B}
            dob: {type: string, example: "1990-05-20"}
            gender: {type: string, example: Nam}
            id_card: {type: string}
            address: {type: string}
            phone: {type: string}
            health_insurance: {type: string}
            relationship: {type: string, example: SELF}
            confirm_shared_phone: {type: boolean, description: Xác nhận lưu hồ sơ người thân vào tài khoản người đặt khi trùng số điện thoại}
            user_id: {type: integer, description: Chỉ ADMIN hoặc RECEPTIONIST; nếu gửi phải khớp tài khoản của số điện thoại}
    responses:
      201:
        description: Đã tạo
      200:
        description: Dùng lại hồ sơ đúng người bệnh; account_exists báo tài khoản đã tồn tại
      409:
        description: CONFIRM_SHARED_PHONE yêu cầu xác nhận hoặc thông tin hồ sơ mâu thuẫn
    """
    actor = current_user()
    allow_user_id = actor['role_name'] in patient_service.STAFF_WRITE
    fields = patient_schema.validate_create(request.get_json(silent=True), allow_user_id)
    result = patient_service.create_patient(actor, fields)
    return jsonify(result), 200 if result['patient_reused'] else 201


@patient_bp.get('/<int:patient_id>')
@login_required
def get_patient(patient_id):
    """Chi tiết hồ sơ
    ---
    tags:
      - Patients
    security:
      - Bearer: []
    parameters:
      - {in: path, name: patient_id, type: integer, required: true}
    responses:
      200:
        description: Hồ sơ
      404:
        description: Không tìm thấy hoặc không có quyền xem
    """
    return jsonify(patient_service.get_patient(current_user(), patient_id))


@patient_bp.patch('/<int:patient_id>')
@login_required
def update_patient(patient_id):
    """Sửa hồ sơ, gồm cả thẻ BHYT
    ---
    tags:
      - Patients
    security:
      - Bearer: []
    parameters:
      - {in: path, name: patient_id, type: integer, required: true}
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            full_name: {type: string}
            dob: {type: string}
            gender: {type: string}
            id_card: {type: string}
            address: {type: string}
            phone: {type: string}
            health_insurance: {type: string}
            relationship: {type: string}
    responses:
      200:
        description: Đã cập nhật
      409:
        description: Hồ sơ đã lưu trữ
    """
    fields = patient_schema.validate_update(request.get_json(silent=True))
    return jsonify(patient_service.update_patient(current_user(), patient_id, fields))


@patient_bp.post('/<int:patient_id>/archive')
@login_required
def archive_patient(patient_id):
    """Lưu trữ hồ sơ (không xóa bệnh án)
    ---
    tags:
      - Patients
    security:
      - Bearer: []
    parameters:
      - {in: path, name: patient_id, type: integer, required: true}
    responses:
      200:
        description: Đã lưu trữ
      409:
        description: Đã lưu trữ trước đó
    """
    return jsonify(patient_service.archive_patient(current_user(), patient_id))


@patient_bp.get('/<int:patient_id>/encounters')
@login_required
def list_encounters(patient_id):
    """Lịch sử lượt khám của hồ sơ
    ---
    tags:
      - Patients
    security:
      - Bearer: []
    parameters:
      - {in: path, name: patient_id, type: integer, required: true}
      - {in: query, name: page, type: integer}
      - {in: query, name: page_size, type: integer}
    responses:
      200:
        description: Danh sách lượt khám
    """
    page, page_size = page_params(request.args)
    return jsonify(patient_service.list_encounters(current_user(), patient_id, page, page_size))
