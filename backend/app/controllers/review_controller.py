"""HTTP input validation and response handling."""
from flask import jsonify, request

from backend.app.middlewares.auth_middleware import current_user

from backend.app.validators.review_validator import validate_review

from backend.app.validators.common_validator import page_params

from backend.app.services import review_service as service

def create(encounter_id):
    result, created = service.create(current_user(), encounter_id, validate_review(request.get_json(silent=True)))
    return jsonify(result), 201 if created else 200

def listing(doctor_profile_id):
    return jsonify(service.list_public(doctor_profile_id, *page_params(request.args)))
