"""Tạo thông báo nhắc lịch trong DB; worker gói 3 gọi mỗi chu kỳ, không gửi email thật."""
from datetime import timedelta
from backend.app.db.database import get_db_connection
from backend.app.models.configuration_model import reminder_hours
from backend.app.services import encounter_service as encounters, notification_service as notifications


def enqueue_reminders():
    count = 0
    with get_db_connection() as db:
        now = encounters.utc_now()
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
            local = row['estimated_exam_at'].astimezone(encounters.VN_TZ)
            created = notifications.notify_encounter(db, row['encounter_id'], key, 'REMINDER', 'Nhắc lịch khám',
                f'Giờ hẹn {local:%d/%m/%Y %H:%M} (Asia/Saigon). Cần check-in ít nhất 30 phút trước giờ hẹn.')
            count += created is not None
    return count
