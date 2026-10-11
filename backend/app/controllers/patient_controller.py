"""HTTP input validation and response handling."""
from flask import jsonify, request

from backend.app.middlewares.auth_middleware import current_user

from backend.app.validators import patient_validator

from backend.app.validators.common_validator import page_params

from backend.app.services import patient_service

def list_patients():
    return jsonify(patient_service.list_patients(current_user(),
                                                 patient_validator.parse_list_query(request.args)))

def create_patient():
    actor = current_user()
    allow_user_id = actor['role_name'] in patient_service.STAFF_WRITE
    fields = patient_validator.validate_create(request.get_json(silent=True), allow_user_id)
    return jsonify(patient_service.create_patient(actor, fields)), 201

def get_patient(patient_id):
    return jsonify(patient_service.get_patient(current_user(), patient_id))

def update_patient(patient_id):
    fields = patient_validator.validate_update(request.get_json(silent=True))
    return jsonify(patient_service.update_patient(current_user(), patient_id, fields))

def archive_patient(patient_id):
    return jsonify(patient_service.archive_patient(current_user(), patient_id))

def list_encounters(patient_id):
    page, page_size = page_params(request.args)
    return jsonify(patient_service.list_encounters(current_user(), patient_id, page, page_size))
