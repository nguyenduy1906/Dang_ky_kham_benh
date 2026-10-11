from backend.app.controllers import nurse_assignment_controller as controller
from flask import Blueprint

from backend.app.config import constants
from backend.app.middlewares.auth_middleware import roles_required


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
    return controller.list_assignments()


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
    return controller.create_assignment()


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
    return controller.revoke_assignment(assignment_id)


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
    return controller.list_own_assignments()
