"""HTTP input validation and response handling."""
from flask import jsonify, request

from backend.app.middlewares.auth_middleware import current_user

from backend.app.validators import encounter_validator, reception_validator

from backend.app.validators.common_validator import page_params

from backend.app.services import encounter_service, reception_service

def list_encounters():
    return jsonify(encounter_service.list_encounters(current_user(), encounter_validator.parse_list_query(request.args)))

def get_encounter(encounter_id):
    return jsonify(encounter_service.get_encounter(current_user(), encounter_id))

def status_history(encounter_id):
    return jsonify(encounter_service.history(current_user(), encounter_id, 'status', *page_params(request.args)))

def transfer_history(encounter_id):
    return jsonify(encounter_service.history(current_user(), encounter_id, 'transfer', *page_params(request.args)))


def online():
    return jsonify(encounter_service.create_online(current_user(), encounter_validator.validate_online(request.get_json(silent=True)))), 201

def cancel(encounter_id):
    data = request.get_json(silent=True)
    fields = encounter_validator.validate_cancel({} if data is None else data)
    return jsonify(encounter_service.action(current_user(), encounter_id, 'cancel', fields['reason'],
                                           cancel_origin=fields['cancel_origin']))

def walk_in():
    return jsonify(reception_service.create_walk_in(current_user(), reception_validator.validate_walk_in(request.get_json(silent=True)))), 201

def check_in(encounter_id):
    return jsonify(encounter_service.action(current_user(), encounter_id, 'check-in'))

def queues():
    return jsonify(reception_service.queues(current_user(), encounter_validator.parse_list_query(request.args)))

def transfer_options(encounter_id):
    return jsonify(reception_service.transfer_options(current_user(), encounter_id, *page_params(request.args)))

def transfer(encounter_id):
    return jsonify(reception_service.transfer(current_user(), encounter_id, reception_validator.validate_transfer(request.get_json(silent=True))))

def no_show(encounter_id):
    fields = encounter_validator.validate_reason(request.get_json(silent=True) or {})
    return jsonify(encounter_service.action(current_user(), encounter_id, 'no-show', fields))

def affected(schedule_id):
    page, size = page_params(request.args)
    return jsonify(reception_service.affected_encounters(current_user(), schedule_id, {'page': page, 'page_size': size}))

def start(encounter_id):
    return jsonify(encounter_service.action(current_user(), encounter_id, 'start'))
