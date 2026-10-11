"""HTTP input validation and response handling."""
from flask import jsonify, request

from backend.app.middlewares.auth_middleware import current_user

from backend.app.validators.common_validator import page_params

from backend.app.validators.configuration_validator import validate_configuration

from backend.app.services import configuration_service as service

def listing():
    return jsonify(service.listing(current_user(), *page_params(request.args)))

def update(key):
    return jsonify(service.update(current_user(), key, validate_configuration(key, request.get_json(silent=True))))
