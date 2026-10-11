"""HTTP input validation and response handling."""
from flask import jsonify, request


from backend.app.middlewares.auth_middleware import current_user

from backend.app.validators import auth_validator, user_admin_validator

from backend.app.services import user_admin_service

def _body():
    return request.get_json(silent=True)

def get_me():
    return jsonify(user_admin_service.get_me(current_user()))

def update_me():
    fields = auth_validator.validate_update_me(_body())
    return jsonify(user_admin_service.update_me(current_user(), fields))

def change_password():
    data = auth_validator.validate_change_password(_body())
    return jsonify(user_admin_service.change_password(current_user(), data))

def admin_roles():
    return jsonify(user_admin_service.list_roles())

def admin_list_users():
    return jsonify(user_admin_service.list_users(
        user_admin_validator.parse_list_query(request.args)))

def admin_create_user():
    data = user_admin_validator.validate_admin_create(_body())
    return jsonify(user_admin_service.create_user(data)), 201

def admin_get_user(user_id):
    return jsonify(user_admin_service.get_user(user_id))

def admin_update_user(user_id):
    fields = user_admin_validator.validate_admin_update(_body())
    return jsonify(user_admin_service.update_user(current_user(), user_id, fields))

def admin_account_status(user_id):
    status = user_admin_validator.validate_account_status(_body())
    return jsonify(user_admin_service.set_account_status(current_user(), user_id, status))

def admin_delete_user(user_id):
    return jsonify(user_admin_service.delete_user(current_user(), user_id))
