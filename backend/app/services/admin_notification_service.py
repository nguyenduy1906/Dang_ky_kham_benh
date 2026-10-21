"""Forward successful, allowlisted business events to active administrators."""
import hashlib
import json
import logging
import re
from flask import g, request
from backend.app.db.database import get_db_connection
from backend.app.utils.business_codes import business_code

RULES = [
    (r'/admin/articles(?:/(\d+))?', 'article', 'article_id', 'ARTICLE', 'ARTICLE', 'bài viết', 'BV'),
    (r'/(?:admin/payments/(\d+)/refund|demo/payments/(\d+)/result|staff/encounters/(\d+)/exam-fees|encounters/(\d+)/payment-intents)', 'payment', 'payment_id', 'PAYMENT', 'PAYMENT', 'giao dịch thanh toán', 'TT'),
    (r'/admin/leave-requests/(\d+)/review', 'leave_request', 'request_id', 'STAFF_LEAVE', 'STAFF_LEAVE_REQUEST', 'đơn xin nghỉ', 'NP'),
    (r'/(?:staff/encounters/\d+/transfer|encounters/\d+/registration)', 'encounter', 'encounter_id', 'ENCOUNTER', 'ENCOUNTER', 'lượt khám', 'LK'),
    (r'/admin/schedules(?:/(\d+)(?:/move)?)?', 'schedule', 'schedule_id', 'SCHEDULE', 'WORK_SCHEDULE', 'ca làm việc', 'CA'),
    (r'/admin/nurse-assignments(?:/(\d+)(?:/revoke)?)?', 'assignment', 'assignment_id', 'ASSIGNMENT', 'NURSE_ASSIGNMENT', 'phân công nhân viên', 'PC'),
    (r'/admin/(?:departments)(?:/(\d+)(?:/leadership|/members(?:/\d+/revoke-role)?)?)?', 'department', 'department_id', 'CATALOG', 'DEPARTMENT', 'chuyên khoa', 'CK'),
    (r'/admin/rooms(?:/(\d+))?', 'room', 'room_id', 'CATALOG', 'ROOM', 'phòng khám', 'PH'),
    (r'/admin/users(?:/(\d+)(?:/account-status)?)?', 'user', 'user_id', 'ACCOUNT', 'USER', 'tài khoản', 'TK'),
    (r'/encounters/(\d+)/review', 'review', 'review_id', 'REVIEW', 'REVIEW', 'đánh giá', 'DG'),
    (r'/admin/reviews/(\d+)/visibility', 'review', 'review_id', 'REVIEW', 'REVIEW', 'trạng thái hiển thị đánh giá', 'DG'),
    (r'/doctor/schedules/(\d+)/unavailability', 'schedule', 'schedule_id', 'SCHEDULE', 'WORK_SCHEDULE', 'báo nghỉ ca làm việc', 'CA'),
]

def business_event(path, method, payload, actor):
    if method not in ('POST', 'PUT', 'PATCH') or not isinstance(payload, dict):
        return None
    if re.fullmatch(r'/admin/configurations/[^/]+', path):
        key = path.rsplit('/', 1)[-1]
        row = payload.get('configuration', payload)
        digest = hashlib.sha256(json.dumps([path,row],sort_keys=True,default=str).encode()).hexdigest()
        return {'key':'admin-event:'+digest,'kind':'SYSTEM','reference':'CONFIGURATION','id':1,
                'title':'Cấu hình hệ thống thay đổi','content':f'{actor.get("full_name") or "Quản trị viên"} đã cập nhật cấu hình {key}.'}
    for pattern, key, id_key, kind, reference, noun, prefix in RULES:
        match = re.fullmatch(pattern, path)
        if not match:
            continue
        row = payload.get('refund') or payload.get(key)
        if not isinstance(row, dict):
            continue
        identifier = row.get(id_key)
        # Some endpoints return only the updated object; never use an encounter ID as a payment ID.
        if not isinstance(identifier, int) or identifier < 1:
            continue
        status = row.get('transaction_status') or row.get('encounter_status') or row.get('status') or row.get('schedule_status')
        values = [f'{actor.get("full_name") or "Hệ thống"} đã {"tạo" if method == "POST" and not match.groups() else "cập nhật"} {noun} {business_code(prefix, identifier)}.']
        for field, title in [('title', 'Tiêu đề'), ('amount', 'Số tiền'), ('reason', 'Lý do'), ('cancel_reason', 'Lý do hủy'), ('published_at', 'Thời điểm đăng')]:
            if row.get(field) is not None:
                values.append(f'{title}: {str(row[field])[:500]}.')
        if status:
            values.append(f'Trạng thái: {status}.')
        # Do not include passwords, tokens, clinical notes or full response bodies in notifications.
        revision = {k: row.get(k) for k in ('updated_at', 'created_at', 'version', 'is_active', 'is_hidden', 'published_at', 'transaction_status', 'encounter_status', 'status', 'schedule_status', 'revoked_at')}
        digest = hashlib.sha256(json.dumps([path, identifier, revision, values], sort_keys=True, default=str).encode()).hexdigest()
        return {'key': 'admin-event:' + digest, 'kind': kind, 'reference': reference, 'id': identifier,
                'title': f'Cập nhật {noun}', 'content': ' '.join(values)}
    return None

def publish(db, event):
    db.execute('''INSERT INTO notification(user_id,event_key,notification_type,title,content,reference_type,reference_id)
        SELECT u.user_id,%s,%s,%s,%s,%s,%s FROM users u JOIN role r USING(role_id)
        WHERE r.role_name='ADMIN' AND u.account_status='ACTIVE' AND u.approval_status='APPROVED' AND u.deleted_at IS NULL
        ON CONFLICT(user_id,event_key) DO NOTHING''',
        (event['key'],event['kind'],event['title'],event['content'],event['reference'],event['id']))

def register_admin_notifications(app):
    @app.after_request
    def send(response):
        actor = getattr(g, 'current_user', None)
        if response.status_code < 200 or response.status_code >= 300 or not actor:
            return response
        event = business_event(request.path, request.method, response.get_json(silent=True), actor)
        if event:
            try:
                with get_db_connection() as db:
                    publish(db, event)
            except Exception:
                # The business operation is already committed; do not turn it into a misleading failure.
                logging.getLogger(__name__).exception('Unable to publish administrator notification')
        return response
