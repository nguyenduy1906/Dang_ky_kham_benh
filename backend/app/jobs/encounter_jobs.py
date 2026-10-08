"""python -m backend.app.jobs.encounter_jobs [--once]; chạy ở process riêng."""
import argparse
import logging
import secrets
import signal
from threading import Event

from werkzeug.security import generate_password_hash
from backend.app.core.constants import SYSTEM_WORKER_EMAIL

from backend.app.db.database import get_db_connection
from backend.app.services import encounter_service as service

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
            from backend.app.jobs.payment_jobs import enqueue_reminders
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
