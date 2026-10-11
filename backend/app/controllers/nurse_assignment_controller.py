"""HTTP input validation and response handling."""
from flask import jsonify, request


from backend.app.middlewares.auth_middleware import current_user

from backend.app.validators import nurse_assignment_validator as schema

from backend.app.services import nurse_assignment_service as service

def list_assignments():
    return jsonify(service.list_assignments(schema.parse_list_query(request.args)))

def create_assignment():
    return jsonify(service.create_assignment(current_user(), schema.validate_create(request.get_json(silent=True)))), 201

def revoke_assignment(assignment_id):
    return jsonify(service.revoke_assignment(current_user(), assignment_id))

def list_own_assignments():
    return jsonify(service.list_assignments(schema.parse_list_query(request.args), current_user()['user_id']))
