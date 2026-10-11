"""SQL queries using the connection supplied by the service."""


def lock_reminder_candidates(db, cutoff, earliest_at):
    return db.execute("SELECT e.encounter_id,e.estimated_exam_at FROM encounter e JOIN work_schedule s ON s.schedule_id=e.schedule_id JOIN patient p ON p.patient_id=e.patient_id WHERE e.encounter_type='ONLINE' AND e.encounter_status='CONFIRMED' AND p.user_id IS NOT NULL AND s.schedule_status IN ('OPEN','FULL') AND e.estimated_exam_at>%s AND e.estimated_exam_at<=%s AND NOT EXISTS (SELECT 1 FROM notification n WHERE n.user_id=p.user_id AND n.event_key='reminder:' || e.encounter_id::text || ':' || to_char(e.estimated_exam_at AT TIME ZONE 'UTC','YYYYMMDDHH24MISS')) ORDER BY e.estimated_exam_at,e.encounter_id LIMIT 100 FOR UPDATE OF e SKIP LOCKED", (earliest_at, cutoff)).fetchall()
