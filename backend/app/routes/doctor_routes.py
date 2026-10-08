"""Route bác sĩ, hồ sơ bác sĩ và ảnh đại diện."""

from flask import Blueprint, jsonify, make_response, request, send_from_directory

from backend.app.core import constants, uploads
from backend.app.core.errors import not_found
from backend.app.core.security import current_user, is_admin, optional_user, roles_required
from backend.app.schemas import doctor_schema
from backend.app.schemas.common_schema import bool_arg, optional_int_arg, page_params
from backend.app.services import doctor_service

doctor_bp = Blueprint('doctor', __name__)


@doctor_bp.get('/doctors')
def list_doctors():
    """Danh sách bác sĩ (công khai, không lộ email/số điện thoại)
    ---
    tags:
      - Doctors
    parameters:
      - {in: query, name: department_id, type: integer}
      - {in: query, name: q, type: string}
      - {in: query, name: include_inactive, type: boolean, description: Chỉ ADMIN có hiệu lực}
      - {in: query, name: page, type: integer}
      - {in: query, name: page_size, type: integer}
    responses:
      200:
        description: Danh sách bác sĩ
    """
    page, page_size = page_params(request.args)
    query = {'department_id': optional_int_arg(request.args, 'department_id'),
             'q': (request.args.get('q') or '').strip()[:100] or None,
             'page': page, 'page_size': page_size}
    include = bool_arg(request.args, 'include_inactive') and is_admin(optional_user())
    return jsonify(doctor_service.list_doctors(query, include))


@doctor_bp.get('/doctors/<int:doctor_profile_id>')
def get_doctor(doctor_profile_id):
    """Chi tiết bác sĩ
    ---
    tags:
      - Doctors
    parameters:
      - {in: path, name: doctor_profile_id, type: integer, required: true}
    responses:
      200:
        description: Hồ sơ bác sĩ
      404:
        description: Không tìm thấy
    """
    return jsonify(doctor_service.get_doctor(doctor_profile_id, is_admin(optional_user())))


@doctor_bp.post('/admin/doctors')
@roles_required(constants.ROLE_ADMIN)
def create_doctor():
    """Tạo hồ sơ bác sĩ cho tài khoản có vai trò DOCTOR
    ---
    tags:
      - Doctors
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [user_id, department_id]
          properties:
            user_id: {type: integer}
            department_id: {type: integer}
            academic_degree: {type: string, example: Thạc sĩ}
            specialization: {type: string}
            experience_years: {type: integer}
            introduction: {type: string}
            consultation_fee: {type: integer, example: 200000}
            is_active: {type: boolean}
    responses:
      201:
        description: Đã tạo
      409:
        description: Tài khoản đã có hồ sơ
    """
    fields = doctor_schema.validate_admin_create(request.get_json(silent=True))
    return jsonify(doctor_service.create_doctor(fields)), 201


@doctor_bp.patch('/admin/doctors/<int:doctor_profile_id>')
@roles_required(constants.ROLE_ADMIN)
def update_doctor(doctor_profile_id):
    """Sửa hồ sơ bác sĩ (kể cả khoa, phí khám, trạng thái)
    ---
    tags:
      - Doctors
    security:
      - Bearer: []
    parameters:
      - {in: path, name: doctor_profile_id, type: integer, required: true}
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            department_id: {type: integer}
            academic_degree: {type: string}
            specialization: {type: string}
            experience_years: {type: integer}
            introduction: {type: string}
            consultation_fee: {type: integer}
            is_active: {type: boolean}
    responses:
      200:
        description: Đã cập nhật
    """
    fields = doctor_schema.validate_admin_update(request.get_json(silent=True))
    return jsonify(doctor_service.update_doctor(doctor_profile_id, fields))


@doctor_bp.get('/doctor/profile')
@roles_required(constants.ROLE_DOCTOR)
def get_own_profile():
    """Xem hồ sơ của tôi (bác sĩ)
    ---
    tags:
      - Doctor Self
    security:
      - Bearer: []
    responses:
      200:
        description: Hồ sơ bác sĩ
      404:
        description: Chưa có hồ sơ
    """
    return jsonify(doctor_service.get_own_profile(current_user()))


@doctor_bp.patch('/doctor/profile')
@roles_required(constants.ROLE_DOCTOR)
def update_own_profile():
    """Sửa hồ sơ của tôi (chỉ thông tin giới thiệu)
    ---
    tags:
      - Doctor Self
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            academic_degree: {type: string}
            specialization: {type: string}
            experience_years: {type: integer}
            introduction: {type: string}
    responses:
      200:
        description: Đã cập nhật
    """
    fields = doctor_schema.validate_self_update(request.get_json(silent=True))
    return jsonify(doctor_service.update_own_profile(current_user(), fields))


@doctor_bp.post('/doctor/profile/avatar')
@roles_required(constants.ROLE_DOCTOR)
def upload_avatar():
    """Tải ảnh đại diện (JPEG, PNG hoặc WebP, tối đa 2 MB)
    ---
    tags:
      - Doctor Self
    security:
      - Bearer: []
    consumes:
      - multipart/form-data
    parameters:
      - {in: formData, name: file, type: file, required: true}
    responses:
      200:
        description: Đã cập nhật avatar_url
      400:
        description: File không hợp lệ hoặc quá lớn
    """
    return jsonify(doctor_service.upload_avatar(current_user(), request.files.get('file')))


@doctor_bp.get('/uploads/avatars/<filename>')
def get_avatar(filename):
    """Xem ảnh đại diện
    ---
    tags:
      - Doctors
    parameters:
      - {in: path, name: filename, type: string, required: true}
    responses:
      200:
        description: Ảnh
      404:
        description: Không có ảnh
    """
    if not uploads.FILENAME_RE.match(filename):
        raise not_found('Không tìm thấy ảnh')
    response = make_response(send_from_directory(uploads.avatar_dir(), filename))
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Cache-Control'] = 'public, max-age=86400'
    return response
