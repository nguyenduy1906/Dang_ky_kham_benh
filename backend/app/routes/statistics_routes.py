from flask import Blueprint, jsonify, request
from flasgger import swag_from
from backend.app.core.security import current_user, roles_required
from backend.app.schemas.statistics_schema import parse_query
from backend.app.services.statistics_service import report
from backend.app.routes.package5_docs import spec, PAGE

statistics_bp = Blueprint('statistics', __name__)
FILTERS = PAGE + [{'in': 'query', 'name': name, 'type': 'string', 'format': 'date'} for name in ('from_date', 'to_date')] + [
    {'in': 'query', 'name': name, 'type': 'integer'} for name in ('doctor_profile_id', 'department_id', 'encounter_id')] + [
    {'in': 'query', 'name': 'encounter_status', 'type': 'string'},
    {'in': 'query', 'name': 'encounter_type', 'type': 'string', 'enum': ['ONLINE', 'WALK_IN']},
    {'in': 'query', 'name': 'group_by', 'type': 'string', 'enum': ['day', 'doctor', 'department'], 'default': 'day'}]


@statistics_bp.get('/admin/statistics/encounters')
@roles_required('ADMIN')
@swag_from(spec('Statistics', 'Số lượt theo ngày ca/bác sĩ/khoa, loại và trạng thái hiện tại', FILTERS))
def encounters():
    return jsonify(report(current_user(), 'encounters', parse_query(request.args)))


@statistics_bp.get('/admin/statistics/payments')
@roles_required('ADMIN')
@swag_from(spec('Statistics', 'Dòng tiền theo ngày giao dịch Asia/Saigon; thu gốc, hoàn thực tế, thu ròng', FILTERS))
def payments():
    return jsonify(report(current_user(), 'payments', parse_query(request.args)))


@statistics_bp.get('/admin/statistics/reviews')
@roles_required('ADMIN')
@swag_from(spec('Statistics', 'Số đánh giá, trung bình và phân bố điểm theo ngày đánh giá/bác sĩ/khoa', FILTERS))
def reviews():
    return jsonify(report(current_user(), 'reviews', parse_query(request.args)))


@statistics_bp.get('/admin/audit/encounters')
@roles_required('ADMIN')
@swag_from(spec('Audit', 'Đối soát lượt khám; encounter_id để xem 100 lịch sử gần nhất mỗi loại gồm sửa bệnh án', FILTERS))
def audit():
    return jsonify(report(current_user(), 'audit', parse_query(request.args)))
