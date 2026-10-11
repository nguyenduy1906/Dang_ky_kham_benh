"""Background business workflows, keeping the original transactions."""
from backend.app.repositories import encounter_job_repository as queries
import secrets
from werkzeug.security import generate_password_hash
from backend.app.config.constants import SYSTEM_WORKER_EMAIL
from backend.app.config.database import get_db_connection
from backend.app.services import encounter_service as service

def system_actor(db):
    # Tài khoản riêng, không dùng danh tính ADMIN đang thao tác và không đăng nhập được.
    queries.lock_system_worker(db)
    row = queries.get_system_worker(db, SYSTEM_WORKER_EMAIL)
    if row is not None:
        if row['account_status'] != 'LOCKED' or row['role_name'] != 'ADMIN' or row['deleted_at'] is not None:
            raise RuntimeError('Tài khoản hệ thống không hợp lệ; không giả danh tài khoản đang hoạt động')
        return row['user_id']
    return queries.create_system_worker(db, SYSTEM_WORKER_EMAIL, generate_password_hash(secrets.token_urlsafe(48)))['user_id']


def expire_holds():
    count = 0
    with get_db_connection() as db:
        actor_id = system_actor(db)
        schedules = queries.lock_expired_schedules(db, service.utc_now())
        for schedule in schedules:
            holds = queries.lock_expired_holds(db, service.utc_now(), schedule)
            for encounter in holds:
                count += service.expire_locked(db, encounter, schedule, actor_id)
    return count
