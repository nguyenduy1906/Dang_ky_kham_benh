"""Business exceptions independent of Flask request/response."""


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
