from psycopg import errors as pg_errors
from backend.app.core.errors import conflict, not_found
from backend.app.db.database import get_db_connection
from backend.app.models import article_model as model
from backend.app.models._sql import jsonable
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
        row = db.execute(model.SELECT + ' WHERE a.slug=%s AND a.is_active=1 AND a.published_at<=CURRENT_TIMESTAMP', (slug,)).fetchone()
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
        existing = db.execute('SELECT * FROM article WHERE article_id=%s FOR UPDATE', (article_id,)).fetchone()
        if existing is None: raise not_found('Không tìm thấy bài viết', 'ARTICLE_NOT_FOUND')
        if fields.get('is_active') == 1 and existing['published_at'] is None and 'published_at' not in fields:
            fields = {**fields, 'published_at': encounters.utc_now()}
        try:
            row = model.update(db, article_id, fields)
        except pg_errors.UniqueViolation:
            raise conflict('slug đã được dùng', 'DUPLICATE_ARTICLE_SLUG') from None
    return {'article': _public(row, admin=True)}
