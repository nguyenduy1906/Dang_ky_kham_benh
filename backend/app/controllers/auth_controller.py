"""HTTP input validation and response handling."""
from flask import jsonify, request

from backend.app.middlewares.auth_middleware import current_user

from backend.app.validators import auth_validator

from backend.app.services import auth_service

def _body():
    return request.get_json(silent=True)

def register():
    data = auth_validator.validate_register(_body())
    return jsonify(auth_service.register(data)), 201

def login():
    data = auth_validator.validate_login(_body())
    return jsonify(auth_service.login(data))

def logout():
    return jsonify(auth_service.logout())

def forgot_password():
    data = auth_validator.validate_forgot_password(_body())
    return jsonify(auth_service.forgot_password(data))

def verify_otp():
    data = auth_validator.validate_verify_otp(_body())
    return jsonify(auth_service.verify_otp(data))

def reset_password():
    data = auth_validator.validate_reset_password(_body())
    return jsonify(auth_service.reset_password(data))

def email_verification_request():
    return jsonify(auth_service.request_email_verification(current_user()))

def email_verification_confirm():
    data = auth_validator.validate_email_confirm(_body())
    return jsonify(auth_service.confirm_email_verification(data))
