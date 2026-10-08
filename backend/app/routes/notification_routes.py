from flask import Blueprint, jsonify, request
from flasgger import swag_from
from backend.app.core.security import current_user, login_required
from backend.app.schemas.notification_schema import parse_query
from backend.app.services import notification_service as service

notification_bp = Blueprint('notification', __name__)
SECURITY = [{'Bearer': []}]
RESPONSES = {200: {'description': 'Thông báo của tài khoản đang đăng nhập'},
             401: {'description': 'Chưa đăng nhập'}, 404: {'description': 'Không tìm thấy thông báo của mình'}}


@notification_bp.get('/notifications')
@login_required
@swag_from({'tags': ['Notifications'], 'summary': 'Thông báo của tôi, phân trang và lọc chưa đọc', 'security': SECURITY,
            'parameters': [{'in': 'query', 'name': 'page', 'type': 'integer', 'default': 1},
                {'in': 'query', 'name': 'page_size', 'type': 'integer', 'default': 20},
                {'in': 'query', 'name': 'unread_only', 'type': 'boolean', 'default': False}], 'responses': RESPONSES})
def listing():
    return jsonify(service.listing(current_user(), *parse_query(request.args)))


@notification_bp.get('/notifications/unread-count')
@login_required
@swag_from({'tags': ['Notifications'], 'summary': 'Đếm thông báo chưa đọc của tôi', 'security': SECURITY, 'responses': RESPONSES})
def unread_count():
    return jsonify(service.unread_count(current_user()))


@notification_bp.patch('/notifications/<int:notification_id>/read')
@login_required
@swag_from({'tags': ['Notifications'], 'summary': 'Đánh dấu thông báo của tôi đã đọc (lặp an toàn)', 'security': SECURITY,
            'parameters': [{'in': 'path', 'name': 'notification_id', 'type': 'integer', 'required': True}], 'responses': RESPONSES})
def read(notification_id):
    return jsonify(service.mark_read(current_user(), notification_id))


@notification_bp.post('/notifications/read-all')
@login_required
@swag_from({'tags': ['Notifications'], 'summary': 'Đánh dấu tất cả thông báo của tôi đã đọc', 'security': SECURITY, 'responses': RESPONSES})
def read_all():
    return jsonify(service.read_all(current_user()))
