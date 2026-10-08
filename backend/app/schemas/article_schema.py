import re
from datetime import datetime, timezone
from urllib.parse import urlparse
from backend.app.core.errors import bad_request
from backend.app.schemas.auth_schema import ensure_object, text_field
from backend.app.schemas.common_schema import page_params, flag_field, optional_int_arg


def validate_article(data, *, partial=False):
    data = ensure_object(data)
    allowed = {'title', 'slug', 'category', 'thumbnail_url', 'content', 'is_active', 'published_at'}
    if not data or set(data) - allowed:
        raise bad_request('Body bài viết rỗng hoặc có trường không được phép')
    fields = {}
    for key, maximum in (('title', 255), ('slug', 200), ('category', 100), ('thumbnail_url', 2000), ('content', 100000)):
        if key in data or (not partial and key in ('title', 'slug', 'content')):
            fields[key] = text_field(data, key, required=key in ('title', 'slug', 'content'), max_len=maximum)
    if 'slug' in fields and not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', fields['slug']):
        raise bad_request('slug chỉ gồm chữ thường không dấu, số và dấu gạch nối')
    if fields.get('thumbnail_url'):
        url = fields['thumbnail_url']
        parsed = urlparse(url)
        if not (url.startswith('/uploads/') or (parsed.scheme in ('http', 'https') and parsed.netloc)):
            raise bad_request('thumbnail_url phải là URL HTTP(S) hoặc đường dẫn /uploads/')
    if 'is_active' in data:
        fields['is_active'] = flag_field(data, 'is_active')
    if 'published_at' in data:
        value = data['published_at']
        if value is None:
            fields['published_at'] = None
        else:
            try:
                stamp = datetime.fromisoformat(value.replace('Z', '+00:00')) if isinstance(value, str) else None
                if stamp is None or stamp.tzinfo is None:
                    raise ValueError
            except ValueError:
                raise bad_request('published_at phải là ISO 8601 có múi giờ hoặc null') from None
            fields['published_at'] = stamp.astimezone(timezone.utc)
    return fields


def parse_query(args, *, admin=False):
    page, size = page_params(args)
    q, category = args.get('q', '').strip(), args.get('category', '').strip()
    if len(q) > 255 or len(category) > 100:
        raise bad_request('Bộ lọc bài viết quá dài')
    active = None
    if admin and args.get('is_active') not in (None, ''):
        raw = args['is_active'].lower()
        if raw not in ('true', 'false', '1', '0'):
            raise bad_request('is_active phải là true/false')
        active = int(raw in ('true', '1'))
    article_id = optional_int_arg(args, 'article_id') if admin else None
    if article_id is not None and article_id < 1:
        raise bad_request('article_id phải là số nguyên dương')
    return {'page': page, 'page_size': size, 'q': q, 'category': category, 'is_active': active, 'article_id': article_id}
