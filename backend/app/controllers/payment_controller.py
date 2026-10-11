"""HTTP input validation and response handling."""
import os

from flask import jsonify, request

from backend.app.middlewares.auth_middleware import current_user

from backend.app.utils.errors import not_found

from backend.app.validators import payment_validator

from backend.app.validators.common_validator import page_params

from backend.app.services import payment_service


def list_payments(encounter_id):
    return jsonify(payment_service.list_payments(current_user(), encounter_id, *page_params(request.args)))

def get_payment(payment_id):
    return jsonify(payment_service.get_payment(current_user(), payment_id))

def intent(encounter_id):
    result, created = payment_service.create_intent(current_user(), encounter_id, payment_validator.validate_method(request.get_json(silent=True)))
    return jsonify(result), 201 if created else 200

def demo_result(payment_id):
    if os.environ.get('DEMO_MODE', '0') != '1':
        raise not_found('Không tìm thấy API', 'NOT_FOUND')
    return jsonify(payment_service.demo_result(current_user(), payment_id, payment_validator.validate_result(request.get_json(silent=True))))

def exam_fee(encounter_id):
    result, created = payment_service.collect_exam_fee(current_user(), encounter_id, payment_validator.validate_method(request.get_json(silent=True)))
    return jsonify(result), 201 if created else 200

def refund(payment_id):
    return jsonify(payment_service.refund(current_user(), payment_id, payment_validator.validate_refund(request.get_json(silent=True))))
