from backend.app.controllers import review_controller as controller
from flask import Blueprint
from flasgger import swag_from
from backend.app.middlewares.auth_middleware import roles_required


from backend.app.utils.swagger import spec, path, body, PAGE

review_bp = Blueprint('review', __name__)


@review_bp.post('/encounters/<int:encounter_id>/review')
@roles_required('USER')
@swag_from(spec('Reviews', 'USER sở hữu đánh giá lượt COMPLETED, tối đa một đánh giá/lượt', [path('encounter_id'), body({
    'rating': {'type': 'integer', 'minimum': 1, 'maximum': 5}, 'comment': {'type': 'string'}}, ('rating',))]))
def create(encounter_id):
    return controller.create(encounter_id)


@review_bp.get('/doctors/<int:doctor_profile_id>/reviews')
@swag_from(spec('Reviews', 'Đánh giá công khai và điểm trung bình; không trả hồ sơ/bệnh án/danh tính bệnh nhân',
                [path('doctor_profile_id')] + PAGE, public=True))
def listing(doctor_profile_id):
    return controller.listing(doctor_profile_id)
