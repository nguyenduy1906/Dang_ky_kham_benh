from flask import Blueprint, jsonify, make_response, request, send_from_directory
from flasgger import swag_from
from backend.app.core.security import current_user, roles_required
from backend.app.schemas.article_schema import parse_query, validate_article
from backend.app.services import article_service as service
from backend.app.utils.swagger_helpers import spec, path, body, PAGE
from backend.app.utils import uploads
from backend.app.core.errors import not_found

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


@article_bp.post('/admin/articles/images')
@roles_required('ADMIN')
@swag_from({
    'tags': ['Articles Admin'], 'summary': 'Tải ảnh đại diện hoặc ảnh trong bài (JPEG/PNG/WebP, tối đa 5 MB)',
    'security': [{'Bearer': []}], 'consumes': ['multipart/form-data'],
    'parameters': [{'in': 'formData', 'name': 'file', 'type': 'file', 'required': True}],
    'responses': {201: {'description': 'URL ảnh để dùng trong thumbnail_url hoặc content'},
                  400: {'description': 'File ảnh không hợp lệ'}, 403: {'description': 'Chỉ ADMIN được phép'}},
})
def upload_image():
    return jsonify(service.upload_image(current_user(), request.files.get('file'))), 201


@article_bp.get('/uploads/articles/<filename>')
@swag_from(spec('Articles', 'Xem ảnh bài viết', [path('filename', type_name='string')], public=True))
def image(filename):
    if not uploads.FILENAME_RE.fullmatch(filename):
        raise not_found('Không tìm thấy ảnh')
    mime = {'jpg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp'}[filename.rsplit('.', 1)[1]]
    response = make_response(send_from_directory(uploads.article_dir(), filename, mimetype=mime))
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Cache-Control'] = 'public, max-age=86400'
    return response
