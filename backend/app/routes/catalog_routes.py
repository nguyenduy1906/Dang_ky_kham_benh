"""Route danh mục chuyên khoa và phòng khám."""
from flask import Blueprint, jsonify, request

from backend.app.core import constants
from backend.app.core.security import is_admin, optional_user, roles_required, current_user
from flasgger import swag_from
from backend.app.utils.swagger_helpers import spec, path, body
from backend.app.schemas import catalog_schema
from backend.app.utils.validation import bool_arg, optional_int_arg
from backend.app.services import catalog_service

department_bp = Blueprint('department', __name__)


def _admin_view():
    return is_admin(optional_user())


@department_bp.get('/departments')
def list_departments():
    """Danh sách chuyên khoa (công khai, chỉ chuyên khoa đang hoạt động)
    ---
    tags:
      - Departments
    parameters:
      - {in: query, name: include_inactive, type: boolean, description: Chỉ ADMIN có hiệu lực}
    responses:
      200:
        description: Danh sách chuyên khoa
    """
    include = bool_arg(request.args, 'include_inactive') and _admin_view()
    return jsonify(catalog_service.list_departments(include))


@department_bp.get('/departments/<int:department_id>')
def get_department(department_id):
    """Chi tiết chuyên khoa
    ---
    tags:
      - Departments
    parameters:
      - {in: path, name: department_id, type: integer, required: true}
    responses:
      200:
        description: Chuyên khoa
      404:
        description: Không tìm thấy
    """
    return jsonify(catalog_service.get_department(department_id, _admin_view()))


@department_bp.post('/admin/departments')
@roles_required(constants.ROLE_ADMIN)
def create_department():
    """Tạo chuyên khoa
    ---
    tags:
      - Departments
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [name]
          properties:
            name: {type: string, example: Nội tổng quát}
            description: {type: string}
            overview: {type: string, maxLength: 12000}
            mission: {type: string, maxLength: 4000}
            cover_image_url: {type: string}
            group_type: {type: string, enum: [CLINICAL, PARACLINICAL]}
            content_is_demo: {type: boolean}
            specialties: {type: array, items: {type: string}}
            clinical_services: {type: array, items: {type: string}}
            equipment: {type: array, items: {type: string}}
            achievements: {type: array, items: {type: string}}
            patient_guide: {type: array, items: {type: string}}
            gallery: {type: array, items: {type: object, properties: {url: {type: string}, caption: {type: string}}}}
            extra_sections: {type: array, items: {type: object, properties: {title: {type: string}, content: {type: string}}}}
            is_active: {type: boolean}
    responses:
      201:
        description: Đã tạo
      409:
        description: Trùng tên
    """
    fields = catalog_schema.validate_department_create(request.get_json(silent=True))
    return jsonify(catalog_service.create_department(fields)), 201


@department_bp.patch('/admin/departments/<int:department_id>')
@roles_required(constants.ROLE_ADMIN)
def update_department(department_id):
    """Sửa chuyên khoa
    ---
    tags:
      - Departments
    security:
      - Bearer: []
    parameters:
      - {in: path, name: department_id, type: integer, required: true}
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            name: {type: string}
            expected_version: {type: integer, minimum: 1, description: 'Phiên bản từ GET; PATCH trả 409 khi phiên bản đã đổi'}
            description: {type: string}
            overview: {type: string, maxLength: 12000}
            mission: {type: string, maxLength: 4000}
            cover_image_url: {type: string}
            group_type: {type: string, enum: [CLINICAL, PARACLINICAL]}
            content_is_demo: {type: boolean}
            specialties: {type: array, items: {type: string}}
            clinical_services: {type: array, items: {type: string}}
            equipment: {type: array, items: {type: string}}
            achievements: {type: array, items: {type: string}}
            patient_guide: {type: array, items: {type: string}}
            gallery: {type: array, items: {type: object, properties: {url: {type: string}, caption: {type: string}}}}
            extra_sections: {type: array, items: {type: object, properties: {title: {type: string}, content: {type: string}}}}
            is_active: {type: boolean}
    responses:
      200:
        description: Đã cập nhật
    """
    fields = catalog_schema.validate_department_update(request.get_json(silent=True))
    return jsonify(catalog_service.update_department(department_id, fields))


@department_bp.get('/admin/departments/<int:department_id>/leadership')
@roles_required(constants.ROLE_ADMIN)
@swag_from(spec('Departments', 'Xem lịch sử phân công trưởng/phó khoa và phiên bản hiện tại', [path('department_id')]))
def department_leadership_history(department_id):
    return jsonify(catalog_service.leadership_history(department_id))


@department_bp.put('/admin/departments/<int:department_id>/leadership')
@roles_required(constants.ROLE_ADMIN)
@swag_from(spec('Departments', 'Thay danh sách lãnh đạo khoa trong một transaction; null/[] để gỡ phân công', [path('department_id'),body({
    'head_doctor_id': {'type':'integer','description':'doctor_profile_id của trưởng khoa hoặc null'},
    'deputy_doctor_ids': {'type':'array','items':{'type':'integer'}},
    'expected_version': {'type':'integer','minimum':1},
}, ('head_doctor_id','deputy_doctor_ids','expected_version'))]))
def department_replace_leadership(department_id):
    return jsonify(catalog_service.replace_leadership(current_user(),department_id,catalog_schema.validate_leadership(request.get_json(silent=True))))


@department_bp.post('/admin/departments/<int:department_id>/images')
@roles_required(constants.ROLE_ADMIN)
@swag_from({'tags':['Departments'],'summary':'Tải ảnh khoa JPEG/PNG/WebP tối đa 5MB; dùng URL trả về cho cover_image_url/gallery',
    'security':[{'Bearer':[]}],'consumes':['multipart/form-data'],'parameters':[path('department_id'),{'in':'formData','name':'file','type':'file','required':True}],
    'responses':{201:{'description':'URL ảnh'},400:{'description':'Ảnh không hợp lệ'},403:{'description':'Chỉ ADMIN'}}})
def department_upload_image(department_id):
    return jsonify(catalog_service.upload_department_image(department_id,request.files.get('file'))),201


room_bp = Blueprint('room', __name__)


@room_bp.get('/rooms')
def list_rooms():
    """Danh sách phòng (công khai, chỉ phòng đang hoạt động)
    ---
    tags:
      - Rooms
    parameters:
      - {in: query, name: department_id, type: integer}
      - {in: query, name: include_inactive, type: boolean, description: Chỉ ADMIN có hiệu lực}
    responses:
      200:
        description: Danh sách phòng
    """
    include = bool_arg(request.args, 'include_inactive') and is_admin(optional_user())
    return jsonify(catalog_service.list_rooms(optional_int_arg(request.args, 'department_id'), include))


@room_bp.post('/admin/rooms')
@roles_required(constants.ROLE_ADMIN)
def create_room():
    """Tạo phòng
    ---
    tags:
      - Rooms
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [department_id, room_name]
          properties:
            department_id: {type: integer}
            room_name: {type: string, example: Phòng 101}
            description: {type: string}
            is_active: {type: boolean}
    responses:
      201:
        description: Đã tạo
      409:
        description: Trùng tên phòng trong chuyên khoa
    """
    fields = catalog_schema.validate_room_create(request.get_json(silent=True))
    return jsonify(catalog_service.create_room(fields)), 201


@room_bp.patch('/admin/rooms/<int:room_id>')
@roles_required(constants.ROLE_ADMIN)
def update_room(room_id):
    """Sửa phòng
    ---
    tags:
      - Rooms
    security:
      - Bearer: []
    parameters:
      - {in: path, name: room_id, type: integer, required: true}
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            department_id: {type: integer}
            room_name: {type: string}
            description: {type: string}
            is_active: {type: boolean}
    responses:
      200:
        description: Đã cập nhật
    """
    fields = catalog_schema.validate_room_update(request.get_json(silent=True))
    return jsonify(catalog_service.update_room(room_id, fields))


@department_bp.get('/admin/departments/<int:department_id>/members')
@roles_required(constants.ROLE_ADMIN)
def department_members(department_id):
    return jsonify(catalog_service.get_members(department_id))


@department_bp.post('/admin/departments/<int:department_id>/members')
@roles_required(constants.ROLE_ADMIN)
def department_add_member(department_id):
    return jsonify(catalog_service.add_member(current_user(),department_id,
                   catalog_schema.validate_member(request.get_json(silent=True))))


@department_bp.post('/admin/departments/<int:department_id>/members/<int:doctor_id>/revoke-role')
@roles_required(constants.ROLE_ADMIN)
def department_revoke_role(department_id,doctor_id):
    return jsonify(catalog_service.revoke_member_role(current_user(),department_id,doctor_id,
                   catalog_schema.validate_member_revoke(request.get_json(silent=True))))
