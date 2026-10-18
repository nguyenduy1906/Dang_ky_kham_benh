from psycopg import errors as pg_errors
from backend.app.core.errors import conflict, not_found
from backend.app.db.database import get_db_connection
from backend.app.models import article_model as model
from backend.app.utils.database_helpers import jsonable
from backend.app.core.security import require_role
from backend.app.utils import date as date_utils
from backend.app.utils import uploads


def _public(row, *, summary=False, admin=False):
    data = dict(row)
    data['is_active'] = bool(data['is_active'])
    if not admin: data.pop('author_id', None)
    if summary: data.pop('content', None)
    return jsonable(data)


def listing(query, actor=None):
    if actor is not None: require_role(actor, 'ADMIN')
    with get_db_connection() as db:
        rows, total = model.listing(db, query, actor is not None)
    return {'items': [_public(r, summary=actor is None, admin=actor is not None) for r in rows],
            'total': total, 'page': query['page'], 'page_size': query['page_size']}


def detail(slug):
    with get_db_connection() as db:
        row = model.public_by_slug(db, slug)
        if row is None: raise not_found('Không tìm thấy bài viết', 'ARTICLE_NOT_FOUND')
    return {'article': _public(row)}


def upload_image(actor, file_storage):
    require_role(actor, 'ADMIN')
    return {'url': uploads.save_article_image(file_storage)}


def create(actor, fields):
    require_role(actor, 'ADMIN')
    fields = {**fields, 'author_id': actor['user_id'], 'is_active': fields.get('is_active', 1)}
    if 'published_at' not in fields and fields['is_active']:
        fields['published_at'] = date_utils.utc_now()
    with get_db_connection() as db:
        try:
            row = model.create(db, fields)
        except pg_errors.UniqueViolation:
            raise conflict('slug đã được dùng', 'DUPLICATE_ARTICLE_SLUG') from None
    return {'article': _public(row, admin=True)}


def update(actor, article_id, fields):
    require_role(actor, 'ADMIN')
    with get_db_connection() as db:
        existing = model.get_for_update(db, article_id)
        if existing is None: raise not_found('Không tìm thấy bài viết', 'ARTICLE_NOT_FOUND')
        if fields.get('is_active') == 1 and existing['published_at'] is None and 'published_at' not in fields:
            fields = {**fields, 'published_at': date_utils.utc_now()}
        try:
            row = model.update(db, article_id, fields)
        except pg_errors.UniqueViolation:
            raise conflict('slug đã được dùng', 'DUPLICATE_ARTICLE_SLUG') from None
    return {'article': _public(row, admin=True)}
