"""Route lịch làm việc."""
from flask import Blueprint, jsonify, request

from backend.app.core import constants
from backend.app.core.security import current_user, roles_required
from backend.app.schemas import schedule_schema
from backend.app.schemas import staff_schema as schema
from backend.app.services import schedule_service
from backend.app.services import schedule_service as service

schedule_bp = Blueprint('schedule', __name__)


@schedule_bp.get('/doctors/<int:doctor_profile_id>/schedules')
def doctor_schedules(doctor_profile_id):
    """Lịch của một bác sĩ (công khai, chỉ ca từ hôm nay, không gồm ca đã đóng)
    ---
    tags:
      - Schedules
    parameters:
      - {in: path, name: doctor_profile_id, type: integer, required: true}
      - {in: query, name: from_date, type: string}
      - {in: query, name: to_date, type: string}
      - {in: query, name: status, type: string}
    responses:
      200:
        description: Danh sách ca
      404:
        description: Không tìm thấy bác sĩ
    """
    query = schedule_schema.parse_list_query(request.args)
    return jsonify(schedule_service.list_doctor_public(doctor_profile_id, query))


@schedule_bp.get('/doctor/schedules')
@roles_required(constants.ROLE_DOCTOR)
def own_schedules():
    """Lịch của tôi (bác sĩ)
    ---
    tags:
      - Schedules
    security:
      - Bearer: []
    parameters:
      - {in: query, name: from_date, type: string}
      - {in: query, name: to_date, type: string}
      - {in: query, name: status, type: string}
    responses:
      200:
        description: Danh sách ca
    """
    return jsonify(schedule_service.list_own(
        current_user(), schedule_schema.parse_list_query(request.args)))


@schedule_bp.get('/admin/schedules')
@roles_required(constants.ROLE_ADMIN)
def admin_schedules():
    """Danh sách mọi ca (lọc theo bác sĩ, phòng, khoa, ngày, trạng thái)
    ---
    tags:
      - Schedules
    security:
      - Bearer: []
    parameters:
      - {in: query, name: doctor_profile_id, type: integer}
      - {in: query, name: room_id, type: integer}
      - {in: query, name: department_id, type: integer}
      - {in: query, name: from_date, type: string}
      - {in: query, name: to_date, type: string}
      - {in: query, name: status, type: string}
      - {in: query, name: page, type: integer}
      - {in: query, name: page_size, type: integer}
    responses:
      200:
        description: Danh sách ca
    """
    return jsonify(schedule_service.list_schedules(schedule_schema.parse_list_query(request.args)))


@schedule_bp.post('/admin/schedules')
@roles_required(constants.ROLE_ADMIN)
def create_schedule():
    """Tạo ca làm việc (không chồng ca bác sĩ hoặc phòng)
    ---
    tags:
      - Schedules
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [doctor_profile_id, room_id, work_date, start_time, end_time, max_quota]
          properties:
            doctor_profile_id: {type: integer}
            room_id: {type: integer}
            work_date: {type: string, example: "2026-10-20"}
            start_time: {type: string, example: "08:00"}
            end_time: {type: string, example: "11:30"}
            max_quota: {type: integer, example: 20}
    responses:
      201:
        description: Đã tạo
      409:
        description: Trùng ca bác sĩ hoặc phòng
    """
    fields = schedule_schema.validate_create(request.get_json(silent=True))
    return jsonify(schedule_service.create_schedule(fields)), 201


@schedule_bp.patch('/admin/schedules/<int:schedule_id>')
@roles_required(constants.ROLE_ADMIN)
def update_schedule(schedule_id):
    """Sửa ca (quota không thấp hơn số đã đặt, ca đã có lượt khám không đổi phòng, ngày, giờ)
    ---
    tags:
      - Schedules
    security:
      - Bearer: []
    parameters:
      - {in: path, name: schedule_id, type: integer, required: true}
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            room_id: {type: integer}
            work_date: {type: string}
            start_time: {type: string}
            end_time: {type: string}
            max_quota: {type: integer}
            schedule_status: {type: string, example: CLOSED}
    responses:
      200:
        description: Đã cập nhật
      409:
        description: Vi phạm ràng buộc ca
    """
    fields = schedule_schema.validate_update(request.get_json(silent=True))
    return jsonify(schedule_service.update_schedule(schedule_id, fields))


@schedule_bp.post('/doctor/schedules/<int:schedule_id>/unavailability')
@roles_required(constants.ROLE_DOCTOR)
def report_unavailable(schedule_id):
    """Bác sĩ báo nghỉ ca (xử lý lượt khám bị ảnh hưởng do Gói 3 đảm nhận)
    ---
    tags:
      - Schedules
    security:
      - Bearer: []
    parameters:
      - {in: path, name: schedule_id, type: integer, required: true}
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [reason]
          properties:
            reason: {type: string, example: Bận việc đột xuất}
    responses:
      200:
        description: Đã báo nghỉ, trả về số lượt khám bị ảnh hưởng
      404:
        description: Không phải ca của bạn
    """
    data = schedule_schema.validate_unavailability(request.get_json(silent=True))
    return jsonify(schedule_service.report_unavailable(current_user(), schedule_id, data['reason']))


nurse_assignment_bp = Blueprint('nurse_assignment', __name__)


@nurse_assignment_bp.get('/admin/nurse-assignments')
@roles_required(constants.ROLE_ADMIN)
def list_assignments():
    """Danh sách phân công y tá (ADMIN)
    ---
    tags: [Nurse assignments]
    security: [{Bearer: []}]
    parameters:
      - {in: query, name: nurse_id, type: integer}
      - {in: query, name: schedule_id, type: integer}
      - {in: query, name: include_revoked, type: boolean}
      - {in: query, name: page, type: integer}
      - {in: query, name: page_size, type: integer}
    responses:
      200: {description: Danh sách phân trang, mặc định chưa thu hồi}
      403: {description: Chỉ ADMIN được truy cập}
    """
    return jsonify(service.list_assignments(schema.parse_list_query(request.args)))


@nurse_assignment_bp.post('/admin/nurse-assignments')
@roles_required(constants.ROLE_ADMIN)
def create_assignment():
    """Phân công tài khoản NURSE vào ca, lưu người phân công
    ---
    tags: [Nurse assignments]
    security: [{Bearer: []}]
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [nurse_id, schedule_id]
          properties:
            nurse_id: {type: integer}
            schedule_id: {type: integer}
            note: {type: string}
    responses:
      201: {description: Đã phân công}
      400: {description: Dữ liệu sai hoặc tài khoản không phải NURSE đang hoạt động}
      404: {description: Không tìm thấy tài khoản hoặc ca}
      409: {description: Phân công đang hiệu lực bị trùng}
    """
    return jsonify(service.create_assignment(current_user(), schema.validate_create(request.get_json(silent=True)))), 201


@nurse_assignment_bp.post('/admin/nurse-assignments/<int:assignment_id>/revoke')
@roles_required(constants.ROLE_ADMIN)
def revoke_assignment(assignment_id):
    """Thu hồi phân công, giữ bản ghi và lịch sử người/thời điểm thu hồi
    ---
    tags: [Nurse assignments]
    security: [{Bearer: []}]
    parameters:
      - {in: path, name: assignment_id, type: integer, required: true}
    responses:
      200: {description: Đã thu hồi}
      404: {description: Không tìm thấy phân công}
      409: {description: Đã thu hồi trước đó}
    """
    return jsonify(service.revoke_assignment(current_user(), assignment_id))


@nurse_assignment_bp.get('/nurse/assignments')
@roles_required(constants.ROLE_NURSE)
def list_own_assignments():
    """Y tá xem phân công của mình; nurse_id từ query không thay đổi chủ sở hữu
    ---
    tags: [Nurse assignments]
    security: [{Bearer: []}]
    parameters:
      - {in: query, name: schedule_id, type: integer}
      - {in: query, name: include_revoked, type: boolean}
      - {in: query, name: page, type: integer}
      - {in: query, name: page_size, type: integer}
    responses:
      200: {description: Phân công của y tá đăng nhập}
      403: {description: Chỉ NURSE được truy cập}
    """
    return jsonify(service.list_assignments(schema.parse_list_query(request.args), current_user()['user_id']))
