"""Route lịch làm việc."""
from backend.app.controllers import schedule_controller as controller
from flask import Blueprint

from backend.app.config import constants
from backend.app.middlewares.auth_middleware import roles_required


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
    return controller.doctor_schedules(doctor_profile_id)


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
    return controller.own_schedules()


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
    return controller.admin_schedules()


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
    return controller.create_schedule()


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
    return controller.update_schedule(schedule_id)


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
    return controller.report_unavailable(schedule_id)
