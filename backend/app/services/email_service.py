"""Transactional event queue; only the background worker sends notification email."""
import os
from datetime import timedelta
from backend.app.core.errors import AppError
from backend.app.db.database import get_db_connection
from backend.app.utils import mail
from backend.app.utils.date import utc_now, VN_TZ


def enqueue(db, user_id, encounter_id, kind, key, *, treatment_id=None):
    db.execute('''INSERT INTO email_outbox(event_key,user_id,encounter_id,kind,treatment_id)
        VALUES (%s,%s,%s,%s,%s) ON CONFLICT(event_key) DO NOTHING''', (key, user_id, encounter_id, kind,treatment_id))


def process_pending(limit=10):
    if os.environ.get('EMAIL_ENABLED') != '1':
        return 0
    mail.settings()
    mail.website_url('(patient)/records.html')
    sent = 0
    for _ in range(limit):
        with get_db_connection() as db:
            row = db.execute('''SELECT * FROM email_outbox WHERE status='PENDING'
                AND next_attempt_at<=CURRENT_TIMESTAMP ORDER BY next_attempt_at,email_id
                LIMIT 1 FOR UPDATE SKIP LOCKED''').fetchone()
            if row is None:
                break
            treatment = row['kind'] == 'TREATMENT_REMINDER'
            if treatment:
                recipient = db.execute('''SELECT u.email,t.starts_at AS estimated_exam_at,t.ends_at,
                    t.location,d.full_name AS doctor_name,p.patient_id
                    FROM treatment_appointment t JOIN encounter e USING(encounter_id)
                    JOIN patient p USING(patient_id) JOIN users u ON u.user_id=p.user_id
                    JOIN users d ON d.user_id=t.doctor_user_id
                    WHERE t.treatment_id=%s AND t.encounter_id=%s AND u.user_id=%s
                    AND u.deleted_at IS NULL AND u.account_status='ACTIVE' ''',
                    (row.get('treatment_id'),row['encounter_id'],row['user_id'])).fetchone()
            else:
                recipient = db.execute('''SELECT u.email,e.encounter_status,e.estimated_exam_at,s.schedule_status
                FROM users u JOIN encounter e ON e.encounter_id=%s
                JOIN patient p ON p.patient_id=e.patient_id AND p.user_id=u.user_id
                JOIN work_schedule s USING(schedule_id)
                WHERE u.user_id=%s AND u.deleted_at IS NULL AND u.account_status='ACTIVE' ''',
                    (row['encounter_id'], row['user_id'])).fetchone()
            stale = (not recipient or not recipient['email']
                     or (row['kind'] == 'REMINDER' and
                         (recipient['encounter_status'] != 'CONFIRMED'
                          or recipient['schedule_status'] not in ('OPEN', 'FULL')
                          or not recipient['estimated_exam_at'] or recipient['estimated_exam_at'] <= utc_now()))
                     or (row['kind'] == 'RESULT_READY' and recipient['encounter_status'] != 'COMPLETED'))
            if not stale and treatment:
                appointment=recipient['estimated_exam_at']
                suffix=f'{row.get("treatment_id")}:{appointment.strftime("%Y%m%d%H%M%S")}'
                stale=(appointment<=utc_now() or row['event_key'] not in
                       ('treatment-reminder24:'+suffix,'treatment-reminder12:'+suffix))
                if row['event_key'].startswith('treatment-reminder24:'):
                    stale=stale or appointment<=utc_now()+timedelta(hours=12)
            if not stale and row['kind'] == 'REMINDER':
                suffix = f'{row["encounter_id"]}:{recipient["estimated_exam_at"].strftime("%Y%m%d%H%M%S")}'
                stale = row['event_key'] not in ('reminder:' + suffix, 'reminder24:' + suffix)
                if row['event_key'].startswith('reminder24:'):
                    stale = stale or recipient['estimated_exam_at'] <= utc_now() + timedelta(hours=12)
            if stale:
                db.execute("UPDATE email_outbox SET status='CANCELLED',last_error='NO_ELIGIBLE_RECIPIENT_OR_EVENT' WHERE email_id=%s", (row['email_id'],))
                continue
            if treatment:
                local=recipient['estimated_exam_at'].astimezone(VN_TZ)
                end=recipient['ends_at'].astimezone(VN_TZ)
                hours=24 if row['event_key'].startswith('treatment-reminder24:') else 12
                title=f'NEU Medical - Nhắc lịch khám lại trước {hours} giờ'
                body=(f'Bạn có lịch khám lại lúc {local:%H:%M ngày %d/%m/%Y} (giờ Việt Nam).\n'
                      f'Thời gian dự kiến: {local:%H:%M}–{end:%H:%M}.\n'
                      f'Bác sĩ: {recipient["doctor_name"]}.\nĐịa điểm: {recipient["location"]}.\n'
                      'Vui lòng đăng nhập để xem đúng người khám, nội dung và lời dặn của bác sĩ:\n'
                      +mail.website_url('(patient)/chemotherapy.html')
                      +f'?view=upcoming&patient_id={recipient["patient_id"]}')
            elif row['kind'] == 'REMINDER':
                local = recipient['estimated_exam_at'].astimezone(VN_TZ)
                hours = 24 if row['event_key'].startswith('reminder24:') else 12
                title = f'NEU Medical - Nhắc lịch hẹn khám trước {hours} giờ'
                body = (f'Bạn có lịch hẹn khám lúc {local:%H:%M ngày %d/%m/%Y} (giờ Việt Nam).\n'
                        'Vui lòng đăng nhập để xem phiếu, địa điểm và hạn check-in của lịch hẹn:\n'
                        + mail.website_url('(patient)/appointments.html'))
            else:
                title = 'NEU Medical - Đã có kết quả khám'
                body = ('Bác sĩ đã hoàn tất kết quả khám. Vui lòng đăng nhập và chọn đúng hồ sơ, lượt khám để xem kết quả:\n'
                        + mail.website_url('(patient)/records.html'))
            try:
                domain = mail.settings()[4].split('@')[-1]
                mail.deliver(recipient['email'], title, body, message_id=f'<neu-email-{row["email_id"]}@{domain}>')
            except AppError as error:
                attempts = row['attempts'] + 1
                db.execute('''UPDATE email_outbox SET attempts=%s,status=%s,last_error=%s,next_attempt_at=%s
                    WHERE email_id=%s''', (attempts, 'FAILED' if attempts >= 5 or error.code == 'EMAIL_RECIPIENT_INVALID' else 'PENDING',
                    error.code, utc_now() + timedelta(minutes=min(60, 2 ** attempts)), row['email_id']))
            else:
                db.execute("UPDATE email_outbox SET status='SENT',sent_at=CURRENT_TIMESTAMP,attempts=attempts+1,last_error=NULL WHERE email_id=%s", (row['email_id'],))
                sent += 1
    return sent
