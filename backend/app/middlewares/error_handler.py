"""Translate exceptions into consistent HTTP responses."""
import logging
from flask import jsonify
from werkzeug.exceptions import HTTPException
from backend.app.utils.errors import AppError

logger = logging.getLogger(__name__)


def error_response(status_code, code, message):
    return jsonify({'error': {'code': code, 'message': message}}), status_code


def register_error_handlers(app):
    @app.errorhandler(AppError)
    def handle_app_error(err):
        return error_response(err.status_code, err.code, err.message)

    @app.errorhandler(HTTPException)
    def handle_http_error(err):
        code = (err.name or 'HTTP_ERROR').upper().replace(' ', '_')
        return error_response(err.code or 500, code, err.description)

    @app.errorhandler(Exception)
    def handle_unexpected(err):
        logger.exception('Lỗi không xác định')
        return error_response(500, 'INTERNAL_ERROR', 'Lỗi hệ thống')
