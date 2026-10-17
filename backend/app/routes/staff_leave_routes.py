from flask import Blueprint, jsonify, request
from flasgger import swag_from

from backend.app.core.security import current_user, roles_required
from backend.app.schemas import staff_leave_schema as schema
from backend.app.services import staff_leave_service as service
from backend.app.utils.swagger_helpers import spec, path, body, PAGE

staff_leave_bp = Blueprint('staff_leave', __name__)
STAFF = service.STAFF_ROLES
DATES = [{'in': 'query', 'name': name, 'type': 'string', 'format': 'date'} for name in ('from_date', 'to_date')]
FILTERS = PAGE + [{'in': 'query', 'name': 'status', 'type': 'string', 'enum': list(schema.STATUSES)}]
CREATE = body({'from_date': {'type': 'string', 'format': 'date'}, 'to_date': {'type': 'string', 'format': 'date'},
               'period': {'type': 'string', 'enum': list(schema.PERIODS), 'default': 'FULL_DAY'},
               'reason': {'type': 'string', 'maxLength': 1000}}, ('from_date', 'reason'))


@staff_leave_bp.get('/staff/work-schedules')
@roles_required(*STAFF)
@swag_from(spec('Staff schedules', 'Lịch đi làm của tôi: mặc định T2–T6, 08:00–11:30 và 13:30–17:00. Chờ duyệt vẫn làm việc; lịch khám riêng không tự sinh. Khoảng xem tối đa 31 ngày, mặc định tuần hiện tại.', DATES))
def own_calendar():
    return jsonify(service.calendar(current_user(), schema.calendar_query(request.args)))


@staff_leave_bp.get('/admin/staff/<int:user_id>/work-schedules')
@roles_required('ADMIN')
@swag_from(spec('Staff schedules', 'Admin xem lịch đi làm và đơn nghỉ của một nhân viên', [path('user_id')] + DATES))
def staff_calendar(user_id):
    return jsonify(service.calendar(current_user(), schema.calendar_query(request.args), user_id))


@staff_leave_bp.get('/staff/leave-requests')
@roles_required(*STAFF)
@swag_from(spec('Staff leave', 'Đơn nghỉ của tôi, không nhận user_id để xem người khác', FILTERS))
def own_requests():
    return jsonify(service.listing(current_user(), schema.list_query(request.args)))


@staff_leave_bp.post('/staff/leave-requests')
@roles_required(*STAFF)
@swag_from(spec('Staff leave', 'Gửi đơn nghỉ PENDING và thông báo admin; chưa thay đổi lịch. Tối đa 31 ngày, chỉ tính T2–T6; không hồi tố, không trùng ca của đơn PENDING/APPROVED.', [CREATE]))
def create_request():
    return jsonify(service.create(current_user(), schema.validate_create(request.get_json(silent=True)))), 201


@staff_leave_bp.get('/staff/leave-requests/<int:request_id>')
@roles_required(*STAFF)
@swag_from(spec('Staff leave', 'Xem đơn nghỉ của tôi và số lượt khám cần điều phối', [path('request_id')]))
def own_request(request_id):
    return jsonify(service.detail(current_user(), request_id))


@staff_leave_bp.post('/staff/leave-requests/<int:request_id>/cancel')
@roles_required(*STAFF)
@swag_from(spec('Staff leave', 'Rút đơn PENDING của tôi; lặp an toàn. Không rút đơn đã duyệt/từ chối.', [path('request_id')]))
def cancel_request(request_id):
    return jsonify(service.cancel(current_user(), request_id))


@staff_leave_bp.get('/admin/leave-requests')
@roles_required('ADMIN')
@swag_from(spec('Staff leave', 'Admin xem danh sách đơn nghỉ của nhân viên', FILTERS + [{'in': 'query', 'name': 'user_id', 'type': 'integer'}]))
def admin_requests():
    return jsonify(service.listing(current_user(), schema.list_query(request.args, admin=True), admin=True))


@staff_leave_bp.get('/admin/leave-requests/<int:request_id>')
@roles_required('ADMIN')
@swag_from(spec('Staff leave', 'Admin xem đơn và các ca/lượt bị ảnh hưởng trước khi duyệt', [path('request_id')]))
def admin_request(request_id):
    return jsonify(service.detail(current_user(), request_id, admin=True))


@staff_leave_bp.post('/admin/leave-requests/<int:request_id>/review')
@roles_required('ADMIN')
@swag_from(spec('Staff leave', 'Duyệt/từ chối đơn PENDING, lưu người/thời điểm/ý kiến. Duyệt bác sĩ đóng nhận lịch mới ở ca ảnh hưởng, duyệt y tá thu hồi phân công trùng ca; không tự hủy/chuyển lượt, không sửa quota hoặc tiền. Thông báo nhân viên, lặp cùng quyết định không tạo lại hiệu ứng.',
    [path('request_id'), body({'decision': {'type': 'string', 'enum': ['APPROVED', 'REJECTED']},
                               'note': {'type': 'string', 'maxLength': 1000}}, ('decision', 'note'))]))
def review_request(request_id):
    return jsonify(service.review(current_user(), request_id, schema.validate_review(request.get_json(silent=True))))
