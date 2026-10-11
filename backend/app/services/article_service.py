from backend.app.repositories import article_repository as queries
from psycopg import errors as pg_errors
from backend.app.utils.errors import conflict, not_found
from backend.app.config.database import get_db_connection
from backend.app.repositories import article_repository as model
from backend.app.utils.serialization import jsonable
from backend.app.services import encounter_service as encounters


def _public(row, *, summary=False, admin=False):
    data = dict(row)
    data['is_active'] = bool(data['is_active'])
    if not admin: data.pop('author_id', None)
    if summary: data.pop('content', None)
    return jsonable(data)


def listing(query, actor=None):
    if actor is not None: encounters.require_role(actor, 'ADMIN')
    with get_db_connection() as db:
        rows, total = model.listing(db, query, actor is not None)
    return {'items': [_public(r, summary=actor is None, admin=actor is not None) for r in rows],
            'total': total, 'page': query['page'], 'page_size': query['page_size']}


def detail(slug):
    with get_db_connection() as db:
        row = queries.get_published_by_slug(db, slug)
        if row is None: raise not_found('Không tìm thấy bài viết', 'ARTICLE_NOT_FOUND')
    return {'article': _public(row)}


def create(actor, fields):
    encounters.require_role(actor, 'ADMIN')
    fields = {**fields, 'author_id': actor['user_id'], 'is_active': fields.get('is_active', 1)}
    if 'published_at' not in fields and fields['is_active']:
        fields['published_at'] = encounters.utc_now()
    with get_db_connection() as db:
        try:
            row = model.create(db, fields)
        except pg_errors.UniqueViolation:
            raise conflict('slug đã được dùng', 'DUPLICATE_ARTICLE_SLUG') from None
    return {'article': _public(row, admin=True)}


def update(actor, article_id, fields):
    encounters.require_role(actor, 'ADMIN')
    with get_db_connection() as db:
        existing = queries.lock_article(db, article_id)
        if existing is None: raise not_found('Không tìm thấy bài viết', 'ARTICLE_NOT_FOUND')
        if fields.get('is_active') == 1 and existing['published_at'] is None and 'published_at' not in fields:
            fields = {**fields, 'published_at': encounters.utc_now()}
        try:
            row = model.update(db, article_id, fields)
        except pg_errors.UniqueViolation:
            raise conflict('slug đã được dùng', 'DUPLICATE_ARTICLE_SLUG') from None
    return {'article': _public(row, admin=True)}
