"""python -m backend.app.utils.worker [--once]; chạy ở process riêng."""
import argparse
import logging
import secrets
import signal
from threading import Event
from datetime import timedelta

from werkzeug.security import generate_password_hash
from backend.app.core.constants import SYSTEM_WORKER_EMAIL

from backend.app.db.database import get_db_connection
from backend.app.models.configuration_model import reminder_hours
from backend.app.services import encounter_service as service, notification_service as notifications

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
                                (service.utc_now(),)).fetchall()
        for schedule in schedules:
            holds = db.execute("SELECT * FROM encounter WHERE schedule_id=%s AND encounter_status='HOLDING' "
                                'AND hold_expires_at<=%s ORDER BY encounter_id FOR UPDATE',
                                (schedule['schedule_id'], service.utc_now())).fetchall()
            for encounter in holds:
                count += service.expire_locked(db, encounter, schedule, actor_id)
    return count


def enqueue_reminders():
    count = 0
    with get_db_connection() as db:
        now = service.utc_now()
        cutoff = now + timedelta(hours=reminder_hours(db))
        rows = db.execute("SELECT e.encounter_id,e.estimated_exam_at FROM encounter e "
                          "JOIN work_schedule s ON s.schedule_id=e.schedule_id JOIN patient p ON p.patient_id=e.patient_id "
                          "WHERE e.encounter_type='ONLINE' AND e.encounter_status='CONFIRMED' "
                          "AND p.user_id IS NOT NULL AND s.schedule_status IN ('OPEN','FULL') "
                          'AND e.estimated_exam_at>%s AND e.estimated_exam_at<=%s '
                          "AND NOT EXISTS (SELECT 1 FROM notification n WHERE n.user_id=p.user_id "
                          "AND n.event_key='reminder:' || e.encounter_id::text || ':' || "
                          "to_char(e.estimated_exam_at AT TIME ZONE 'UTC','YYYYMMDDHH24MISS')) "
                          'ORDER BY e.estimated_exam_at,e.encounter_id LIMIT 100 FOR UPDATE OF e SKIP LOCKED',
                          (now + timedelta(minutes=30), cutoff)).fetchall()
        for row in rows:
            key = f'reminder:{row["encounter_id"]}:{row["estimated_exam_at"].strftime("%Y%m%d%H%M%S")}'
            local = row['estimated_exam_at'].astimezone(service.VN_TZ)
            created = notifications.notify_encounter(db, row['encounter_id'], key, 'REMINDER', 'Nhắc lịch khám',
                f'Giờ hẹn {local:%d/%m/%Y %H:%M} (Asia/Saigon). Cần check-in ít nhất 30 phút trước giờ hẹn.')
            count += created is not None
    return count


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
            logger.info('Expired holds: %s', expire_holds())
            logger.info('Appointment reminders: %s', enqueue_reminders())
        except Exception:
            logger.exception('Expiry cycle failed; transaction rolled back')
            if args.once:
                raise
        if args.once:
            break
        stopping.wait(30)


if __name__ == '__main__':
    main()
