from flask import Blueprint, jsonify, request
from flasgger import swag_from
from backend.app.core.security import current_user, roles_required
from backend.app.schemas.review_schema import validate_review
from backend.app.schemas.common_schema import page_params
from backend.app.services import review_service as service
from backend.app.routes.package5_docs import spec, path, body, PAGE

review_bp = Blueprint('review', __name__)


@review_bp.post('/encounters/<int:encounter_id>/review')
@roles_required('USER')
@swag_from(spec('Reviews', 'USER sở hữu đánh giá lượt COMPLETED, tối đa một đánh giá/lượt', [path('encounter_id'), body({
    'rating': {'type': 'integer', 'minimum': 1, 'maximum': 5}, 'comment': {'type': 'string'}}, ('rating',))]))
def create(encounter_id):
    result, created = service.create(current_user(), encounter_id, validate_review(request.get_json(silent=True)))
    return jsonify(result), 201 if created else 200


@review_bp.get('/doctors/<int:doctor_profile_id>/reviews')
@swag_from(spec('Reviews', 'Đánh giá công khai và điểm trung bình; không trả hồ sơ/bệnh án/danh tính bệnh nhân',
                [path('doctor_profile_id')] + PAGE, public=True))
def listing(doctor_profile_id):
    return jsonify(service.list_public(doctor_profile_id, *page_params(request.args)))
