"""HTTP input validation and response handling."""
from flask import jsonify, make_response, request, send_from_directory


from backend.app.utils import uploads

from backend.app.utils.errors import not_found

from backend.app.middlewares.auth_middleware import current_user, is_admin, optional_user

from backend.app.validators import doctor_validator

from backend.app.validators.common_validator import bool_arg, optional_int_arg, page_params

from backend.app.services import doctor_service

def list_doctors():
    page, page_size = page_params(request.args)
    query = {'department_id': optional_int_arg(request.args, 'department_id'),
             'q': (request.args.get('q') or '').strip()[:100] or None,
             'page': page, 'page_size': page_size}
    include = bool_arg(request.args, 'include_inactive') and is_admin(optional_user())
    return jsonify(doctor_service.list_doctors(query, include))

def get_doctor(doctor_profile_id):
    return jsonify(doctor_service.get_doctor(doctor_profile_id, is_admin(optional_user())))

def create_doctor():
    fields = doctor_validator.validate_admin_create(request.get_json(silent=True))
    return jsonify(doctor_service.create_doctor(fields)), 201

def update_doctor(doctor_profile_id):
    fields = doctor_validator.validate_admin_update(request.get_json(silent=True))
    return jsonify(doctor_service.update_doctor(doctor_profile_id, fields))

def get_own_profile():
    return jsonify(doctor_service.get_own_profile(current_user()))

def update_own_profile():
    fields = doctor_validator.validate_self_update(request.get_json(silent=True))
    return jsonify(doctor_service.update_own_profile(current_user(), fields))

def upload_avatar():
    return jsonify(doctor_service.upload_avatar(current_user(), request.files.get('file')))

def get_avatar(filename):
    if not uploads.FILENAME_RE.match(filename):
        raise not_found('Không tìm thấy ảnh')
    response = make_response(send_from_directory(uploads.avatar_dir(), filename))
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Cache-Control'] = 'public, max-age=86400'
    return response
