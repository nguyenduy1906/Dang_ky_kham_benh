"""HTTP input validation and response handling."""
from flask import jsonify, request


from backend.app.middlewares.auth_middleware import is_admin, optional_user

from backend.app.validators import room_validator

from backend.app.validators.common_validator import bool_arg, optional_int_arg

from backend.app.services import room_service

def list_rooms():
    include = bool_arg(request.args, 'include_inactive') and is_admin(optional_user())
    return jsonify(room_service.list_rooms(optional_int_arg(request.args, 'department_id'), include))

def create_room():
    fields = room_validator.validate_create(request.get_json(silent=True))
    return jsonify(room_service.create_room(fields)), 201

def update_room(room_id):
    fields = room_validator.validate_update(request.get_json(silent=True))
    return jsonify(room_service.update_room(room_id, fields))
