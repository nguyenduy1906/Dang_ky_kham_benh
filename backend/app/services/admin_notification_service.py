"""Forward successful, allowlisted business events to active administrators."""
import hashlib
import json
import logging
import re
from datetime import datetime, timezone, timedelta
from flask import g, request
from backend.app.db.database import get_db_connection
from backend.app.utils.business_codes import business_code

RULES = [
    (r'/auth/register', 'user', 'user_id', 'ACCOUNT', 'USER', 'tài khoản người dùng', 'TK'),
    (r'/admin/doctors(?:/(\d+)(?:/avatar)?)?|/doctor/profile(?:/avatar)?', 'doctor', 'doctor_profile_id', 'DOCTOR', 'DOCTOR', 'hồ sơ bác sĩ', 'BS'),
    (r'/patients(?:/(\d+)(?:/archive)?)?', 'patient', 'patient_id', 'PATIENT', 'PATIENT', 'hồ sơ bệnh nhân', 'BN'),
    (r'/me(?:/avatar)?|/admin/users/(\d+)/avatar', 'user', 'user_id', 'ACCOUNT', 'USER', 'thông tin tài khoản', 'TK'),
    (r'/doctor/encounters/(\d+)/medical-record|/doctor/medical-records/(\d+)/prescription-items', 'medical_record', 'encounter_id', 'MEDICAL_RECORD', 'ENCOUNTER', 'kết quả khám', 'LK'),
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
    # Sending or withdrawing leave requests already notifies admins inside its transaction.
]


def publication_stamp(value):
    stamp = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)
    return (stamp.astimezone(timezone.utc) - datetime(1970, 1, 1, tzinfo=timezone.utc)) // timedelta(microseconds=1)

def business_event(path, method, payload, actor):
    if method not in ('POST', 'PUT', 'PATCH', 'DELETE') or not isinstance(payload, dict):
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
        if method == 'DELETE' and re.fullmatch(r'/admin/users/\d+', path):
            row = {'user_id': int(path.rsplit('/', 1)[1]), 'deleted': True}
        if not isinstance(row, dict):
            continue
        identifier = row.get(id_key)
        # Some endpoints return only the updated object; never use an encounter ID as a payment ID.
        if not isinstance(identifier, int) or identifier < 1:
            continue
        status = row.get('transaction_status') or row.get('encounter_status') or row.get('status') or row.get('schedule_status')
        operation = 'ngừng sử dụng' if method == 'DELETE' or row.get('archived_at') or row.get('deleted_at') else (
            'tạo' if method == 'POST' and not any(match.groups()) else 'cập nhật')
        values = [f'{actor.get("full_name") or "Hệ thống"} đã {operation} {noun} {business_code(prefix, identifier)}.']
        for field, title in [('title', 'Tiêu đề'), ('amount', 'Số tiền'), ('reason', 'Lý do'), ('cancel_reason', 'Lý do hủy'), ('published_at', 'Thời điểm đăng')]:
            if row.get(field) is not None:
                values.append(f'{title}: {str(row[field])[:500]}.')
        if status:
            values.append(f'Trạng thái: {status}.')
        # Do not include passwords, tokens, clinical notes or full response bodies in notifications.
        revision = {k: row.get(k) for k in ('updated_at', 'created_at', 'version', 'is_active', 'is_hidden', 'published_at', 'transaction_status', 'encounter_status', 'status', 'schedule_status', 'revoked_at', 'archived_at', 'deleted_at', 'avatar_url', 'result_received_at', 'refunded_at')}
        digest = hashlib.sha256(json.dumps([path, identifier, revision, values], sort_keys=True, default=str).encode()).hexdigest()
        event_key = 'admin-event:' + digest
        if key == 'article' and row.get('is_active') and row.get('published_at'):
            published = publication_stamp(row['published_at'])
            if published > publication_stamp(datetime.now(timezone.utc)):
                event_key = f'admin-article-scheduled:{identifier}:{published}:{digest}'
        if key == 'payment' and row.get('payment_type') == 'REFUND':
            kind = 'REFUND'
            if row.get('original_payment_id'):
                event_key = f'admin-refund:{row["original_payment_id"]}'
        return {'key': event_key, 'kind': kind, 'reference': reference, 'id': identifier,
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
        if response.status_code < 200 or response.status_code >= 300:
            return response
        if request.method not in ('POST', 'PUT', 'PATCH', 'DELETE'):
            return response
        try:
            payload = response.get_json(silent=True)
            if not actor and request.path == '/auth/register' and isinstance(payload, dict):
                actor = payload.get('user')
            if not actor:
                return response
            # Prescription responses contain items/version, not the encounter reference.
            prescription = re.fullmatch(r'/doctor/medical-records/(\d+)/prescription-items', request.path)
            if prescription and isinstance(payload, dict):
                with get_db_connection() as db:
                    record = db.execute('SELECT encounter_id,version FROM medical_record WHERE record_id=%s',
                                        (int(prescription[1]),)).fetchone()
                if record:
                    payload = {**payload, 'medical_record': dict(record)}
            event = business_event(request.path, request.method, payload, actor)
            if event:
                with get_db_connection() as db:
                    publish(db, event)
        except Exception:
            # The business operation is already committed; do not turn it into a misleading failure.
            logging.getLogger(__name__).exception('Unable to publish administrator notification')
        return response


def enqueue_article_publications():
    """Notify only articles scheduled through the new hook, with no historical backfill."""
    with get_db_connection() as db:
        rows = db.execute('''SELECT a.article_id,a.title,a.published_at FROM article a
            WHERE a.is_active=1 AND a.published_at<=CURRENT_TIMESTAMP
            AND EXISTS (SELECT 1 FROM notification n WHERE n.reference_type='ARTICLE'
                AND n.reference_id=a.article_id AND n.event_key LIKE
                'admin-article-scheduled:'||a.article_id::text||':'||
                ((extract(epoch FROM a.published_at)*1000000)::bigint)::text||':%')
            AND NOT EXISTS (SELECT 1 FROM notification n WHERE n.event_key=
                'admin-article-published:'||a.article_id::text||':'||
                ((extract(epoch FROM a.published_at)*1000000)::bigint)::text)
            ORDER BY a.published_at,a.article_id LIMIT 100''').fetchall()
        for row in rows:
            publish(db, {'key':f'admin-article-published:{row["article_id"]}:{publication_stamp(row["published_at"])}',
                'kind':'ARTICLE','reference':'ARTICLE','id':row['article_id'],
                'title':'Bài viết hẹn đăng đã xuất bản',
                'content':f'Bài viết {business_code("BV",row["article_id"])} đã đến giờ xuất bản: {row["title"]}.'})
    return len(rows)
