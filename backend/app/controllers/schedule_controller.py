"""HTTP input validation and response handling."""
from flask import jsonify, request


from backend.app.middlewares.auth_middleware import current_user

from backend.app.validators import schedule_validator

from backend.app.services import schedule_service

def doctor_schedules(doctor_profile_id):
    query = schedule_validator.parse_list_query(request.args)
    return jsonify(schedule_service.list_doctor_public(doctor_profile_id, query))

def own_schedules():
    return jsonify(schedule_service.list_own(
        current_user(), schedule_validator.parse_list_query(request.args)))

def admin_schedules():
    return jsonify(schedule_service.list_schedules(schedule_validator.parse_list_query(request.args)))

def create_schedule():
    fields = schedule_validator.validate_create(request.get_json(silent=True))
    return jsonify(schedule_service.create_schedule(fields)), 201

def update_schedule(schedule_id):
    fields = schedule_validator.validate_update(request.get_json(silent=True))
    return jsonify(schedule_service.update_schedule(schedule_id, fields))

def report_unavailable(schedule_id):
    data = schedule_validator.validate_unavailability(request.get_json(silent=True))
    return jsonify(schedule_service.report_unavailable(current_user(), schedule_id, data['reason']))
