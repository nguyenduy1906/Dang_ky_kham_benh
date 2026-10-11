"""HTTP input validation and response handling."""
from flask import jsonify, request


from backend.app.middlewares.auth_middleware import is_admin, optional_user

from backend.app.validators import department_validator

from backend.app.validators.common_validator import bool_arg

from backend.app.services import department_service

def _admin_view():
    return is_admin(optional_user())

def list_departments():
    include = bool_arg(request.args, 'include_inactive') and _admin_view()
    return jsonify(department_service.list_departments(include))

def get_department(department_id):
    return jsonify(department_service.get_department(department_id, _admin_view()))

def create_department():
    fields = department_validator.validate_create(request.get_json(silent=True))
    return jsonify(department_service.create_department(fields)), 201

def update_department(department_id):
    fields = department_validator.validate_update(request.get_json(silent=True))
    return jsonify(department_service.update_department(department_id, fields))
