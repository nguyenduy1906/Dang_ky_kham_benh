"""Public, bounded demo chat endpoint; no database writes or agent tools."""
import json
from collections import deque
from threading import Lock, BoundedSemaphore
from time import monotonic

from flask import Blueprint, jsonify, request
from backend.app.core.errors import AppError, bad_request
from backend.app.services import chatbot_service

chatbot_bp = Blueprint('chatbot', __name__)
# Per-process limits for a local demo. A public deployment needs a shared limiter.
_lock = Lock()
_visitors = {}
_global_calls = deque()
_slots = BoundedSemaphore(2)


def _limit():
    now = monotonic()
    with _lock:
        for ip in list(_visitors):
            times = _visitors[ip]
            while times and times[0] <= now - 60:
                times.popleft()
            if not times:
                del _visitors[ip]
        while _global_calls and _global_calls[0] <= now - 60:
            _global_calls.popleft()
        # Do not trust X-Forwarded-For from arbitrary clients.
        ip = request.remote_addr or 'unknown'
        times = _visitors.setdefault(ip, deque())
        if len(times) >= 12 or len(_global_calls) >= 60:
            raise AppError(429, 'CHAT_RATE_LIMIT', 'Bạn gửi quá nhiều câu hỏi. Vui lòng đợi khoảng một phút.')
        times.append(now)
        _global_calls.append(now)


@chatbot_bp.post('/chatbot/message')
def chat_message():
    """Trò chuyện hỗ trợ khách hàng bằng AI dựa trên danh mục công khai.
    ---
    tags:
      - Chatbot
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [message]
          properties:
            message: {type: string, maxLength: 500}
            history:
              type: array
              maxItems: 12
              items:
                type: object
                properties:
                  role: {type: string, enum: [user, assistant]}
                  content: {type: string, maxLength: 6000}
    responses:
      200: {description: 'text, links và mode (ai, basic hoặc guide)'}
      400: {description: Dữ liệu không hợp lệ}
      413: {description: Nội dung quá lớn}
      429: {description: Quá nhiều yêu cầu}
      503: {description: AI chưa cấu hình hoặc dịch vụ chưa sẵn sàng}
    """
    _limit()
    if not request.is_json:
        raise bad_request('Yêu cầu cần Content-Type application/json.')
    if request.content_length and request.content_length > 524288:
        raise AppError(413, 'CHAT_TOO_LARGE', 'Nội dung trò chuyện quá lớn.')
    raw = request.stream.read(524289)
    if len(raw) > 524288:
        raise AppError(413, 'CHAT_TOO_LARGE', 'Nội dung trò chuyện quá lớn.')
    try:
        data = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        raise bad_request('JSON không hợp lệ.') from None
    message, history = chatbot_service.validate_payload(data)
    if not _slots.acquire(blocking=False):
        raise AppError(429, 'CHAT_BUSY', 'Trợ lý đang bận. Bạn vui lòng thử lại sau ít giây.')
    try:
        response = jsonify(chatbot_service.reply(message, history))
        response.headers['Cache-Control'] = 'no-store'
        return response
    finally:
        _slots.release()
