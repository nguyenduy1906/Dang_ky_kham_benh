from backend.app.controllers import payment_controller as controller

from flask import Blueprint
from flasgger import swag_from
from backend.app.middlewares.auth_middleware import login_required

from backend.app.validators import payment_validator


payment_bp = Blueprint('payment', __name__)
SECURITY = [{'Bearer': []}]
PAGE = [{'in': 'query', 'name': 'page', 'type': 'integer', 'default': 1},
        {'in': 'query', 'name': 'page_size', 'type': 'integer', 'default': 20}]
RESPONSES = {200: {'description': 'Thành công hoặc trả lại kết quả cũ'},
             201: {'description': 'Đã tạo giao dịch giả lập'}, 400: {'description': 'Body không hợp lệ'},
             401: {'description': 'Chưa đăng nhập'}, 403: {'description': 'Sai vai trò'},
             404: {'description': 'Không tìm thấy trong phạm vi quyền hoặc demo tắt'},
             409: {'description': 'Trạng thái, số tiền hoặc chính sách không cho phép'}}


def path_id(name):
    return {'in': 'path', 'name': name, 'type': 'integer', 'required': True}


def body_field(name, enum=None):
    prop = {'type': 'string'}
    if enum: prop['enum'] = list(enum)
    return {'in': 'body', 'name': 'body', 'required': True, 'schema': {
        'type': 'object', 'required': [name], 'properties': {name: prop}}}


@payment_bp.get('/encounters/<int:encounter_id>/payments')
@login_required
@swag_from({'tags': ['Payments'], 'summary': 'USER sở hữu, ADMIN/RECEPTIONIST xem giao dịch lượt khám',
            'security': SECURITY, 'parameters': [path_id('encounter_id')] + PAGE, 'responses': RESPONSES})
def list_payments(encounter_id):
    return controller.list_payments(encounter_id)


@payment_bp.get('/payments/<int:payment_id>')
@login_required
@swag_from({'tags': ['Payments'], 'summary': 'Chi tiết giao dịch theo quyền tài nguyên',
            'security': SECURITY, 'parameters': [path_id('payment_id')], 'responses': RESPONSES})
def get_payment(payment_id):
    return controller.get_payment(payment_id)


@payment_bp.post('/encounters/<int:encounter_id>/payment-intents')
@login_required
@swag_from({'tags': ['Payments'], 'summary': 'USER tạo phiên cọc mô phỏng, server chốt tiền từ snapshot',
            'security': SECURITY, 'parameters': [path_id('encounter_id'), body_field('payment_method', payment_validator.METHODS)],
            'responses': RESPONSES})
def intent(encounter_id):
    return controller.intent(encounter_id)


@payment_bp.post('/demo/payments/<int:payment_id>/result')
@login_required
@swag_from({'tags': ['Payments'], 'summary': 'DEMO_MODE=1: mô phỏng SUCCESS/FAILED cho phiên cọc của mình (ADMIN hỗ trợ)',
            'security': SECURITY, 'parameters': [path_id('payment_id'), body_field('result', ('SUCCESS', 'FAILED'))],
            'responses': RESPONSES})
def demo_result(payment_id):
    return controller.demo_result(payment_id)


@payment_bp.post('/staff/encounters/<int:encounter_id>/exam-fees')
@login_required
@swag_from({'tags': ['Payments'], 'summary': 'ADMIN/RECEPTIONIST thu giả lập phần còn lại; không thu lại giá sau cọc 100%',
            'security': SECURITY, 'parameters': [path_id('encounter_id'), body_field('payment_method', payment_validator.METHODS)],
            'responses': RESPONSES})
def exam_fee(encounter_id):
    return controller.exam_fee(encounter_id)


@payment_bp.post('/admin/payments/<int:payment_id>/refund')
@login_required
@swag_from({'tags': ['Payments'], 'summary': 'ADMIN hoàn tiền giả lập theo chính sách, có giao dịch REFUND và lý do',
            'security': SECURITY, 'parameters': [path_id('payment_id'), body_field('reason')], 'responses': RESPONSES})
def refund(payment_id):
    return controller.refund(payment_id)
