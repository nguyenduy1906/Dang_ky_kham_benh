"""Lỗi nghiệp vụ và định dạng phản hồi lỗi thống nhất: {"error": {"code", "message"}}."""
import logging

from flask import jsonify
from werkzeug.exceptions import HTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    def __init__(self, status_code, code, message):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def bad_request(message, code='VALIDATION_ERROR'):
    return AppError(400, code, message)


def unauthorized(message='Chưa đăng nhập hoặc phiên đã hết hạn', code='UNAUTHORIZED'):
    return AppError(401, code, message)


def forbidden(message='Bạn không có quyền thực hiện thao tác này', code='FORBIDDEN'):
    return AppError(403, code, message)


def not_found(message='Không tìm thấy dữ liệu', code='NOT_FOUND'):
    return AppError(404, code, message)


def conflict(message, code='CONFLICT'):
    return AppError(409, code, message)


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
