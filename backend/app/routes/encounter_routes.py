from flask import Blueprint, jsonify, request
from flasgger import swag_from

from backend.app.core.security import current_user, login_required
from backend.app.schemas import encounter_schema
from backend.app.schemas.common_schema import page_params
from backend.app.services import encounter_service, reception_service

encounter_bp = Blueprint('encounter', __name__)

_SECURITY = [{'Bearer': []}]
_PAGE = [{'in': 'query', 'name': 'page', 'type': 'integer', 'default': 1},
         {'in': 'query', 'name': 'page_size', 'type': 'integer', 'default': 20}]
_ID = {'in': 'path', 'name': 'encounter_id', 'type': 'integer', 'required': True}
_RESPONSES = {200: {'description': 'Dữ liệu trong phạm vi quyền tài khoản'},
              401: {'description': 'Chưa đăng nhập'},
              404: {'description': 'Không tìm thấy hoặc không có quyền xem'}}


@encounter_bp.get('/encounters')
@login_required
@swag_from({'tags': ['Encounters'], 'summary': 'Danh sách lượt khám theo quyền, lọc và phân trang',
            'security': _SECURITY, 'parameters': _PAGE + [
                {'in': 'query', 'name': name, 'type': 'integer'}
                for name in ('patient_id', 'schedule_id', 'doctor_profile_id')] + [
                {'in': 'query', 'name': 'encounter_status', 'type': 'string', 'enum': list(encounter_schema.STATUSES)},
                {'in': 'query', 'name': 'encounter_type', 'type': 'string', 'enum': ['ONLINE', 'WALK_IN']},
                {'in': 'query', 'name': 'work_date', 'type': 'string', 'format': 'date'}],
            'responses': _RESPONSES})
def list_encounters():
    return jsonify(encounter_service.list_encounters(current_user(), encounter_schema.parse_list_query(request.args)))


@encounter_bp.get('/encounters/<int:encounter_id>')
@login_required
@swag_from({'tags': ['Encounters'], 'summary': 'Chi tiết lượt khám theo quyền sở hữu/phân công',
            'security': _SECURITY, 'parameters': [_ID], 'responses': _RESPONSES})
def get_encounter(encounter_id):
    return jsonify(encounter_service.get_encounter(current_user(), encounter_id))


@encounter_bp.get('/encounters/<int:encounter_id>/status-history')
@login_required
@swag_from({'tags': ['Encounters'], 'summary': 'Lịch sử trạng thái lượt khám',
            'security': _SECURITY, 'parameters': [_ID] + _PAGE, 'responses': _RESPONSES})
def status_history(encounter_id):
    return jsonify(encounter_service.history(current_user(), encounter_id, 'status', *page_params(request.args)))


@encounter_bp.get('/encounters/<int:encounter_id>/transfer-history')
@login_required
@swag_from({'tags': ['Encounters'], 'summary': 'Lịch sử chuyển bác sĩ',
            'security': _SECURITY, 'parameters': [_ID] + _PAGE, 'responses': _RESPONSES})
def transfer_history(encounter_id):
    return jsonify(encounter_service.history(current_user(), encounter_id, 'transfer', *page_params(request.args)))


def _body(properties, required=()):
    return {'in': 'body', 'name': 'body', 'required': True,
            'schema': {'type': 'object', 'required': list(required), 'properties': properties}}


_ACTION_RESPONSES = {200: {'description': 'Thành công; gọi lại cùng trạng thái không tạo tác dụng phụ'},
                     400: {'description': 'Dữ liệu không hợp lệ'}, 401: {'description': 'Chưa đăng nhập'},
                     403: {'description': 'Sai vai trò'}, 404: {'description': 'Không tìm thấy trong phạm vi quyền'},
                     409: {'description': 'Trạng thái, thời gian hoặc quota không cho phép'}}
_REASON = _body({'reason': {'type': 'string', 'example': 'Bệnh nhân đổi kế hoạch'}})


@encounter_bp.post('/encounters/online')
@login_required
@swag_from({'tags': ['Encounters'], 'summary': 'USER giữ chỗ 10 phút, cọc 100% giá bác sĩ; chưa cấp số',
            'description': 'Đặt theo ca sáng/chiều, ít nhất 5 giờ trước giờ bắt đầu ca (Asia/Saigon). '
                           'Đúng mốc 5 giờ được nhận; sau mốc này hoặc trong ca bị từ chối với 409/SCHEDULE_TOO_LATE. '
                           'Lượt đã HOLDING vẫn có 10 phút để thanh toán.',
            'security': _SECURITY, 'parameters': [_body({'patient_id': {'type': 'integer'},
                'schedule_id': {'type': 'integer'}, 'symptoms': {'type': 'string'}}, ('patient_id', 'schedule_id'))],
            'responses': {**_ACTION_RESPONSES, 201: {'description': 'HOLDING, giữ quota và giá/cọc snapshot'}}})
def online():
    return jsonify(encounter_service.create_online(current_user(), encounter_schema.validate_online(request.get_json(silent=True)))), 201


@encounter_bp.post('/encounters/<int:encounter_id>/cancel')
@login_required
@swag_from({'tags': ['Encounters'], 'summary': 'Hủy lượt, hoàn quota; giữ nguyên số đã cấp',
            'security': _SECURITY, 'parameters': [_ID, _body({'reason': {'type': 'string'},
                'cancel_origin': {'type': 'string', 'enum': ['PATIENT', 'HOSPITAL'], 'default': 'PATIENT',
                                  'description': 'HOSPITAL chỉ ADMIN/RECEPTIONIST ghi nhận, cần reason'}})],
            'responses': _ACTION_RESPONSES})
def cancel(encounter_id):
    data = request.get_json(silent=True)
    fields = encounter_schema.validate_cancel({} if data is None else data)
    return jsonify(encounter_service.action(current_user(), encounter_id, 'cancel', fields['reason'],
                                           cancel_origin=fields['cancel_origin']))


@encounter_bp.post('/staff/encounters/walk-in')
@login_required
@swag_from({'tags': ['Reception'], 'summary': 'Tiếp nhận walk-in; tự chọn ca còn chỗ, cấp số ngay',
            'security': _SECURITY, 'parameters': [_body({'patient_id': {'type': 'integer'},
                'doctor_profile_id': {'type': 'integer'}, 'symptoms': {'type': 'string'}}, ('patient_id', 'doctor_profile_id'))],
            'responses': {**_ACTION_RESPONSES, 201: {'description': 'CHECKED_IN, số thứ tự đã cấp'}}})
def walk_in():
    return jsonify(reception_service.create_walk_in(current_user(), encounter_schema.validate_walk_in(request.get_json(silent=True)))), 201


@encounter_bp.post('/staff/encounters/<int:encounter_id>/check-in')
@login_required
@swag_from({'tags': ['Reception'], 'summary': 'Check-in online ít nhất 30 phút trước giờ hẹn',
            'security': _SECURITY, 'parameters': [_ID], 'responses': _ACTION_RESPONSES})
def check_in(encounter_id):
    return jsonify(encounter_service.action(current_user(), encounter_id, 'check-in'))


@encounter_bp.get('/staff/queues')
@login_required
@swag_from({'tags': ['Reception'], 'summary': 'Hàng đợi theo ca và quyền phân công; bỏ qua lượt đã hủy',
            'security': _SECURITY, 'parameters': _PAGE + [
                {'in': 'query', 'name': 'schedule_id', 'type': 'integer'},
                {'in': 'query', 'name': 'work_date', 'type': 'string', 'format': 'date'}], 'responses': _RESPONSES})
def queues():
    return jsonify(reception_service.queues(current_user(), encounter_schema.parse_list_query(request.args)))


@encounter_bp.get('/staff/encounters/<int:encounter_id>/transfer-options')
@login_required
@swag_from({'tags': ['Reception'], 'summary': 'Ca của bác sĩ khác cùng khoa còn chỗ để điều phối',
            'security': _SECURITY, 'parameters': [_ID] + _PAGE, 'responses': _ACTION_RESPONSES})
def transfer_options(encounter_id):
    return jsonify(reception_service.transfer_options(current_user(), encounter_id, *page_params(request.args)))


@encounter_bp.post('/staff/encounters/<int:encounter_id>/transfer')
@login_required
@swag_from({'tags': ['Reception'], 'summary': 'Chuyển bác sĩ cùng khoa, giữ nguyên giá/cọc đã chốt',
            'security': _SECURITY, 'parameters': [_ID, _body({'schedule_id': {'type': 'integer'},
                'reason': {'type': 'string'}}, ('schedule_id', 'reason'))], 'responses': _ACTION_RESPONSES})
def transfer(encounter_id):
    return jsonify(reception_service.transfer(current_user(), encounter_id, encounter_schema.validate_transfer(request.get_json(silent=True))))


@encounter_bp.post('/staff/encounters/<int:encounter_id>/no-show')
@login_required
@swag_from({'tags': ['Reception'], 'summary': 'Đánh dấu vắng mặt sau kết thúc ca 15 phút, hoàn quota',
            'security': _SECURITY, 'parameters': [_ID, _REASON], 'responses': _ACTION_RESPONSES})
def no_show(encounter_id):
    fields = encounter_schema.validate_reason(request.get_json(silent=True) or {})
    return jsonify(encounter_service.action(current_user(), encounter_id, 'no-show', fields))


@encounter_bp.get('/staff/schedules/<int:schedule_id>/affected-encounters')
@login_required
@swag_from({'tags': ['Reception'], 'summary': 'Các lượt đang hoạt động bị ảnh hưởng khi ca báo nghỉ/đóng',
            'security': _SECURITY, 'parameters': [{'in': 'path', 'name': 'schedule_id', 'type': 'integer', 'required': True}] + _PAGE,
            'responses': _RESPONSES})
def affected(schedule_id):
    page, size = page_params(request.args)
    return jsonify(reception_service.affected_encounters(current_user(), schedule_id, {'page': page, 'page_size': size}))


@encounter_bp.post('/doctor/encounters/<int:encounter_id>/start')
@login_required
@swag_from({'tags': ['Doctor encounters'], 'summary': 'Bác sĩ phụ trách bắt đầu khám lượt đã check-in',
            'security': _SECURITY, 'parameters': [_ID], 'responses': _ACTION_RESPONSES})
def start(encounter_id):
    return jsonify(encounter_service.action(current_user(), encounter_id, 'start'))
