from backend.app.models._sql import insert_row, update_row

COLUMNS = ('author_id', 'title', 'slug', 'category', 'thumbnail_url', 'content', 'is_active', 'published_at')
SELECT = 'SELECT a.*,u.full_name AS author_name FROM article a JOIN users u ON u.user_id=a.author_id'


def listing(db, query, admin):
    where, params = ['TRUE'], []
    if query['article_id'] is not None:
        where.append('a.article_id=%s'); params.append(query['article_id'])
    if not admin:
        where.append('a.is_active=1 AND a.published_at IS NOT NULL AND a.published_at<=CURRENT_TIMESTAMP')
    if query['is_active'] is not None:
        where.append('a.is_active=%s'); params.append(query['is_active'])
    if query['category']:
        where.append('a.category=%s'); params.append(query['category'])
    if query['q']:
        where.append('(a.title ILIKE %s OR a.content ILIKE %s)'); params.extend(['%' + query['q'] + '%'] * 2)
    base = SELECT + ' WHERE ' + ' AND '.join(where)
    total = db.execute('SELECT COUNT(*) AS n FROM (' + base + ') articles', params).fetchone()['n']
    # Service bỏ content ở danh sách public; ADMIN cần đọc nội dung bản nháp.
    rows = db.execute(base + ' ORDER BY a.published_at DESC NULLS LAST,a.article_id DESC LIMIT %s OFFSET %s',
                      params + [query['page_size'], (query['page'] - 1) * query['page_size']]).fetchall()
    return rows, total


def create(db, fields):
    return insert_row(db, 'article', fields, COLUMNS)


def update(db, article_id, fields):
    return update_row(db, 'article', 'article_id', article_id, fields, set(COLUMNS) - {'author_id'})
