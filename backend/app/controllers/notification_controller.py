"""HTTP input validation and response handling."""
from flask import jsonify, request

from backend.app.middlewares.auth_middleware import current_user

from backend.app.validators.notification_validator import parse_query

from backend.app.services import notification_service as service

def listing():
    return jsonify(service.listing(current_user(), *parse_query(request.args)))

def unread_count():
    return jsonify(service.unread_count(current_user()))

def read(notification_id):
    return jsonify(service.mark_read(current_user(), notification_id))

def read_all():
    return jsonify(service.read_all(current_user()))
