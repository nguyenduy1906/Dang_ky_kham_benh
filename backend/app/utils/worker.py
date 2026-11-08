"""python -m backend.app.utils.worker [--once]; chạy ở process riêng."""
import argparse
import logging
import secrets
import signal
from threading import Event
from datetime import timedelta

from werkzeug.security import generate_password_hash
from backend.app.core.constants import SYSTEM_WORKER_EMAIL
from backend.app.utils import date as date_utils
from backend.app.utils.date import VN_TZ

from backend.app.db.database import get_db_connection
from backend.app.models.configuration_model import encounter_policy
from backend.app.services import encounter_service as service, notification_service as notifications
from backend.app.services.admin_notification_service import enqueue_article_publications

logger = logging.getLogger(__name__)


def system_actor(db):
    # Tài khoản riêng, không dùng danh tính ADMIN đang thao tác và không đăng nhập được.
    db.execute('SELECT pg_advisory_xact_lock(78124002)')
    row = db.execute("SELECT u.*,r.role_name FROM users u JOIN role r ON r.role_id=u.role_id "
                     'WHERE email=%s', (SYSTEM_WORKER_EMAIL,)).fetchone()
    if row is not None:
        if row['account_status'] != 'LOCKED' or row['role_name'] != 'ADMIN' or row['deleted_at'] is not None:
            raise RuntimeError('Tài khoản hệ thống không hợp lệ; không giả danh tài khoản đang hoạt động')
        return row['user_id']
    return db.execute("INSERT INTO users (role_id,full_name,email,password_hash,account_status,approval_status) "
                      "SELECT role_id,'SYSTEM: encounter expiry worker',%s,"
                      "%s,'LOCKED','APPROVED' FROM role WHERE role_name='ADMIN' RETURNING user_id",
                      (SYSTEM_WORKER_EMAIL, generate_password_hash(secrets.token_urlsafe(48)))).fetchone()['user_id']


def expire_holds():
    count = 0
    with get_db_connection() as db:
        actor_id = system_actor(db)
        schedules = db.execute("SELECT s.* FROM work_schedule s WHERE EXISTS "
                                "(SELECT 1 FROM encounter e WHERE e.schedule_id=s.schedule_id "
                                "AND e.encounter_status='HOLDING' AND e.hold_expires_at<=%s) "
                                'ORDER BY s.schedule_id LIMIT 100 FOR UPDATE OF s SKIP LOCKED',
                                (date_utils.utc_now(),)).fetchall()
        for schedule in schedules:
            holds = db.execute("SELECT * FROM encounter WHERE schedule_id=%s AND encounter_status='HOLDING' "
                                'AND hold_expires_at<=%s ORDER BY encounter_id FOR UPDATE',
                                (schedule['schedule_id'], date_utils.utc_now())).fetchall()
            for encounter in holds:
                count += service.expire_locked(db, encounter, schedule, actor_id)
    return count


def enqueue_reminders():
    count = 0
    with get_db_connection() as db:
        now = date_utils.utc_now()
        # Preserve legacy 12-hour keys so previously sent reminders stay deduplicated.
        # The 24-hour window closes at 12 hours; never backfill two messages at once.
        for hours, prefix, lower in ((24, 'reminder24:', now + timedelta(hours=12)),
                                     (12, 'reminder:', now)):
            rows = db.execute("SELECT e.encounter_id,e.estimated_exam_at,e.policy_snapshot FROM encounter e "
                "JOIN work_schedule s ON s.schedule_id=e.schedule_id JOIN patient p ON p.patient_id=e.patient_id "
                "WHERE e.encounter_type='ONLINE' AND e.encounter_status='CONFIRMED' "
                "AND p.user_id IS NOT NULL AND s.schedule_status IN ('OPEN','FULL') "
                "AND e.estimated_exam_at + make_interval(mins => COALESCE((e.policy_snapshot->>'CHECKIN_LATE_MINUTES')::int,0) "
                "- COALESCE((e.policy_snapshot->>'CHECKIN_EARLY_MINUTES')::int,30)) > %s "
                "AND e.estimated_exam_at>%s AND e.estimated_exam_at<=%s "
                "AND NOT EXISTS (SELECT 1 FROM email_outbox n WHERE n.user_id=p.user_id "
                "AND n.event_key=%s || e.encounter_id::text || ':' || "
                "to_char(e.estimated_exam_at AT TIME ZONE 'UTC','YYYYMMDDHH24MISS')) "
                'ORDER BY e.estimated_exam_at,e.encounter_id LIMIT 100 FOR UPDATE OF e SKIP LOCKED',
                (now, lower, now + timedelta(hours=hours), prefix)).fetchall()
            for row in rows:
                key = f'{prefix}{row["encounter_id"]}:{row["estimated_exam_at"].strftime("%Y%m%d%H%M%S")}'
                local = row['estimated_exam_at'].astimezone(VN_TZ)
                policy = encounter_policy(row)
                deadline = local + timedelta(minutes=policy['CHECKIN_LATE_MINUTES'] - policy['CHECKIN_EARLY_MINUTES'])
                created = notifications.notify_encounter(db, row['encounter_id'], key, 'REMINDER',
                    f'Nhắc lịch khám - trước {hours} giờ',
                    f'Giờ hẹn {local:%d/%m/%Y %H:%M} (Asia/Saigon). Vui lòng check-in trước {deadline:%d/%m/%Y %H:%M}.')
                count += created is not None
    return count


def enqueue_treatment_reminders():
    """Follow-up timing is independent of the original encounter's status or shift."""
    from backend.app.services.email_service import enqueue
    count=0
    with get_db_connection() as db:
        now=date_utils.utc_now()
        for hours,lower in ((24,now+timedelta(hours=12)),(12,now)):
            prefix=f'treatment-reminder{hours}:'
            rows=db.execute('''SELECT t.treatment_id,t.encounter_id,t.starts_at,p.user_id
                FROM treatment_appointment t JOIN encounter e USING(encounter_id)
                JOIN patient p USING(patient_id) JOIN users u ON u.user_id=p.user_id
                WHERE u.deleted_at IS NULL AND u.account_status='ACTIVE'
                AND u.email IS NOT NULL AND trim(u.email)<>''
                AND t.starts_at>%s AND t.starts_at<=%s
                AND NOT EXISTS (SELECT 1 FROM email_outbox q WHERE q.event_key=%s || t.treatment_id::text || ':' ||
                    to_char(t.starts_at AT TIME ZONE 'UTC','YYYYMMDDHH24MISS'))
                ORDER BY t.starts_at,t.treatment_id LIMIT 100 FOR UPDATE OF t SKIP LOCKED''',
                (lower,now+timedelta(hours=hours),prefix)).fetchall()
            for row in rows:
                key=prefix+f'{row["treatment_id"]}:{row["starts_at"].strftime("%Y%m%d%H%M%S")}'
                enqueue(db,row['user_id'],row['encounter_id'],'TREATMENT_REMINDER',key,treatment_id=row['treatment_id'])
                count+=1
    return count


def mark_overdue_no_shows():
    """Only unarrived confirmed visits; never infer attendance or clinical progress."""
    from datetime import datetime
    from backend.app.services.appointment_slot_service import schedule_bounds
    count = 0
    with get_db_connection() as db:
        actor_id = system_actor(db)
        schedules = db.execute("SELECT s.* FROM work_schedule s WHERE s.work_date <= %s AND s.schedule_status NOT IN ('CLOSED','UNAVAILABLE') AND EXISTS(SELECT 1 FROM encounter e WHERE e.schedule_id=s.schedule_id AND e.encounter_status='CONFIRMED' AND e.checked_in_at IS NULL) ORDER BY s.schedule_id LIMIT 100 FOR UPDATE OF s SKIP LOCKED", (date_utils.utc_now().astimezone(VN_TZ).date(),)).fetchall()
        for schedule in schedules:
            rows = db.execute("SELECT * FROM encounter WHERE schedule_id=%s AND encounter_status='CONFIRMED' AND checked_in_at IS NULL ORDER BY encounter_id FOR UPDATE", (schedule['schedule_id'],)).fetchall()
            for row in rows:
                now = date_utils.utc_now()
                deadline = schedule_bounds(schedule)[1] + timedelta(minutes=encounter_policy(row)['NO_SHOW_GRACE_MINUTES'])
                if now <= deadline:
                    continue
                service.model.update_encounter(db,row['encounter_id'],{'encounter_status':'NO_SHOW'})
                service._change_quota(db,schedule,-1)
                service.model.add_status(db,row['encounter_id'],'CONFIRMED','NO_SHOW',actor_id,'Tự động đánh dấu không đến: hết ca và thời gian chờ, chưa có check-in')
                count += 1
    return count


def reject_overdue_leave_requests():
    from backend.app.services.staff_leave_service import reject_overdue_pending
    with get_db_connection() as db:
        actor_id = system_actor(db)
        return reject_overdue_pending(db, actor_id, date_utils.utc_now())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    stopping = Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: stopping.set())
    while not stopping.is_set():
        try:
            logger.info('Overdue leave requests rejected: %s', reject_overdue_leave_requests())
            logger.info('Expired holds: %s', expire_holds())
            logger.info('No-show visits: %s', mark_overdue_no_shows())
            logger.info('Appointment reminders: %s', enqueue_reminders())
            logger.info('Follow-up reminders: %s', enqueue_treatment_reminders())
            logger.info('Scheduled articles published: %s', enqueue_article_publications())
            from backend.app.services.email_service import process_pending
            try:
                logger.info('Notification emails sent: %s', process_pending())
            except Exception:
                # Do not expose SMTP credentials or stop appointment maintenance.
                logger.warning('Email delivery cycle unavailable; queued messages retained')
        except Exception:
            logger.exception('Expiry cycle failed; transaction rolled back')
            if args.once:
                raise
        if args.once:
            break
        stopping.wait(30)


if __name__ == '__main__':
    main()
