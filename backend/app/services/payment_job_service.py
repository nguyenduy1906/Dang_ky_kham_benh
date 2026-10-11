"""Background business workflows, keeping the original transactions."""
from backend.app.repositories import payment_job_repository as queries
from datetime import timedelta
from backend.app.config.database import get_db_connection
from backend.app.services.configuration_service import reminder_hours
from backend.app.services import encounter_service as encounters, notification_service as notifications

def enqueue_reminders():
    count = 0
    with get_db_connection() as db:
        now = encounters.utc_now()
        cutoff = now + timedelta(hours=reminder_hours(db))
        rows = queries.lock_reminder_candidates(db, cutoff, now + timedelta(minutes=30))
        for row in rows:
            key = f'reminder:{row["encounter_id"]}:{row["estimated_exam_at"].strftime("%Y%m%d%H%M%S")}'
            local = row['estimated_exam_at'].astimezone(encounters.VN_TZ)
            created = notifications.notify_encounter(db, row['encounter_id'], key, 'REMINDER', 'Nhắc lịch khám',
                f'Giờ hẹn {local:%d/%m/%Y %H:%M} (Asia/Saigon). Cần check-in ít nhất 30 phút trước giờ hẹn.')
            count += created is not None
    return count
