"""HTTP input validation and response handling."""
from flask import jsonify, request

from backend.app.middlewares.auth_middleware import current_user

from backend.app.validators.statistics_validator import parse_query

from backend.app.services.statistics_service import report

def encounters():
    return jsonify(report(current_user(), 'encounters', parse_query(request.args)))

def payments():
    return jsonify(report(current_user(), 'payments', parse_query(request.args)))

def reviews():
    return jsonify(report(current_user(), 'reviews', parse_query(request.args)))

def audit():
    return jsonify(report(current_user(), 'audit', parse_query(request.args)))
