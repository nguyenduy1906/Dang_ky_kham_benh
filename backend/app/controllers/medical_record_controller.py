"""HTTP input validation and response handling."""
from flask import jsonify, request

from backend.app.middlewares.auth_middleware import current_user

from backend.app.validators import medical_record_validator, prescription_validator

from backend.app.validators.common_validator import page_params

from backend.app.services import medical_record_service as service

def get_record(encounter_id):
    return jsonify(service.get_record(current_user(), encounter_id))

def put_record(encounter_id):
    return jsonify(service.put_record(current_user(), encounter_id, medical_record_validator.validate_record(request.get_json(silent=True))))

def get_items(record_id):
    return jsonify(service.get_items(current_user(), record_id, *page_params(request.args)))

def put_items(record_id):
    return jsonify(service.put_items(current_user(), record_id, prescription_validator.validate_items(request.get_json(silent=True))))

def complete(encounter_id):
    return jsonify(service.complete(current_user(), encounter_id))
