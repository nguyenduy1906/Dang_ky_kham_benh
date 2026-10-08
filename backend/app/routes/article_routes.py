from flask import Blueprint, jsonify, request
from flasgger import swag_from
from backend.app.core.security import current_user, roles_required
from backend.app.schemas.article_schema import parse_query, validate_article
from backend.app.services import article_service as service
from backend.app.routes.package5_docs import spec, path, body, PAGE

article_bp = Blueprint('article', __name__)
FILTERS = PAGE + [{'in': 'query', 'name': 'q', 'type': 'string'}, {'in': 'query', 'name': 'category', 'type': 'string'}]
FIELDS = {'title': {'type': 'string'}, 'slug': {'type': 'string', 'example': 'huong-dan-dat-lich'},
          'category': {'type': 'string'}, 'thumbnail_url': {'type': 'string'},
          'content': {'type': 'string', 'description': 'Nội dung văn bản/Markdown; frontend không chèn HTML thô'},
          'is_active': {'type': 'boolean'}, 'published_at': {'type': 'string', 'format': 'date-time',
                    'description': 'ISO 8601 có timezone; null giữ nháp; thời điểm tương lai để lên lịch'}}


@article_bp.get('/articles')
@swag_from(spec('Articles', 'Danh sách bài đã xuất bản; ẩn nháp, bài ngừng hiển thị và lịch xuất bản tương lai', FILTERS, public=True))
def listing():
    return jsonify(service.listing(parse_query(request.args)))


@article_bp.get('/articles/<string:slug>')
@swag_from(spec('Articles', 'Chi tiết bài viết đã xuất bản theo slug', [path('slug', type_name='string')], public=True))
def detail(slug):
    return jsonify(service.detail(slug))


@article_bp.get('/admin/articles')
@roles_required('ADMIN')
@swag_from(spec('Articles Admin', 'ADMIN xem cả bài nháp và đã xuất bản', FILTERS + [
    {'in': 'query', 'name': 'is_active', 'type': 'boolean'}, {'in': 'query', 'name': 'article_id', 'type': 'integer'}]))
def admin_list():
    return jsonify(service.listing(parse_query(request.args, admin=True), current_user()))


@article_bp.post('/admin/articles')
@roles_required('ADMIN')
@swag_from(spec('Articles Admin', 'Tạo bài; tác giả từ ADMIN đăng nhập, slug duy nhất', [body(FIELDS, ('title', 'slug', 'content'))]))
def create():
    return jsonify(service.create(current_user(), validate_article(request.get_json(silent=True)))), 201


@article_bp.patch('/admin/articles/<int:article_id>')
@roles_required('ADMIN')
@swag_from(spec('Articles Admin', 'Sửa bài/ẩn bài/xuất bản; không đổi tác giả', [path('article_id'), body(FIELDS)]))
def update(article_id):
    return jsonify(service.update(current_user(), article_id, validate_article(request.get_json(silent=True), partial=True)))
