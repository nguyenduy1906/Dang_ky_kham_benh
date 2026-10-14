"""Khung giờ trong ca; bên ghi dữ liệu phải khóa work_schedule trước khi gọi."""
from datetime import timedelta

from backend.app.core.errors import conflict, bad_request

OCCUPIED = ('HOLDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED')


def intervals(schedule):
    from backend.app.services.encounter_service import schedule_bounds
    start, end = schedule_bounds(schedule)
    duration = timedelta(minutes=schedule['slot_minutes'])
    while start + duration <= end:
        yield start, start + duration
        start += duration


def available_slots(db, schedule):
    rows = db.execute('SELECT estimated_exam_at FROM encounter WHERE schedule_id=%s '
                      'AND encounter_status=ANY(%s)',
                      (schedule['schedule_id'], list(OCCUPIED))).fetchall()
    occupied = {row['estimated_exam_at'] for row in rows}
    return [(start, end) for start, end in intervals(schedule) if start not in occupied]


def reserve_interval(db, schedule, appointment_time=None, *, now=None):
    candidates = list(intervals(schedule))
    if appointment_time is not None:
        candidates = [(start, end) for start, end in candidates
                      if start.time().replace(tzinfo=None) == appointment_time]
        if not candidates:
            raise bad_request('Giờ khám không nằm trên khung giờ của ca', 'INVALID_APPOINTMENT_TIME')
    available = set(available_slots(db, schedule))
    for start, end in candidates:
        if (start, end) in available and (now is None or start >= now):
            return start, end
    raise conflict('Khung giờ đã được giữ hoặc không còn khung giờ phù hợp', 'SLOT_UNAVAILABLE')
