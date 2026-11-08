from datetime import datetime, timedelta
from uuid import UUID
from backend.app.core.errors import bad_request
from backend.app.utils.validation import ensure_object, text_field


def validate_plan(data):
    data = ensure_object(data)
    if set(data) - {'request_key', 'content', 'notes', 'location', 'sessions'}:
        raise bad_request('Dữ liệu hẹn điều trị chứa trường không được phép')
    try:
        key = str(UUID(data.get('request_key', '')))
    except (ValueError, TypeError, AttributeError):
        raise bad_request('Mã yêu cầu lưu lịch không hợp lệ') from None
    sessions = data.get('sessions')
    if not isinstance(sessions, list) or not 1 <= len(sessions) <= 30:
        raise bad_request('Cần từ 1 đến 30 buổi hẹn')
    cleaned = []
    for session in sessions:
        if not isinstance(session, dict) or set(session) != {'starts_at', 'ends_at'}:
            raise bad_request('Mỗi buổi hẹn cần giờ bắt đầu và kết thúc')
        try:
            start, end = [datetime.fromisoformat(session[k].replace('Z', '+00:00')) for k in ('starts_at', 'ends_at')]
            if start.utcoffset() is None or end.utcoffset() is None:
                raise ValueError()
            if not start < end or end - start > timedelta(days=1):
                raise ValueError()
        except (ValueError, TypeError, AttributeError):
            raise bad_request('Giờ hẹn phải có múi giờ; kết thúc sau bắt đầu và trong vòng 24 giờ') from None
        cleaned.append({'starts_at': start, 'ends_at': end})
    cleaned.sort(key=lambda row: row['starts_at'])
    if any(a['ends_at'] > b['starts_at'] for a, b in zip(cleaned, cleaned[1:])):
        raise bad_request('Các buổi hẹn trong cùng yêu cầu không được chồng giờ')
    return {'request_key': key, 'content': text_field(data, 'content', required=True, max_len=2000),
            'notes': text_field(data, 'notes', max_len=2000),
            'location': text_field(data, 'location', required=True, max_len=255), 'sessions': cleaned}
