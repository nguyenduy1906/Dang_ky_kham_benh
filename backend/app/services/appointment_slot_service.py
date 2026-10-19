"""Khung giờ trong ca; bên ghi dữ liệu phải khóa work_schedule trước khi gọi."""
from datetime import datetime, timedelta

from backend.app.core.errors import conflict, bad_request
from backend.app.models import encounter_model
from backend.app.utils.date import VN_TZ

OCCUPIED = ('HOLDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED')


def schedule_bounds(schedule):
    return (datetime.combine(schedule['work_date'], schedule['start_time'], VN_TZ),
            datetime.combine(schedule['work_date'], schedule['end_time'], VN_TZ))


def intervals(schedule):
    start, end = schedule_bounds(schedule)
    duration = timedelta(minutes=schedule['slot_minutes'])
    while start + duration <= end:
        yield start, start + duration
        start += duration


def available_slots(db, schedule):
    occupied=encounter_model.occupied_intervals(db,schedule['schedule_id'],list(OCCUPIED))
    return [(start,end) for start,end in intervals(schedule)
            if not any(start<row['appointment_end_at'] and end>row['estimated_exam_at'] for row in occupied)]


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


def reserve_walk_in_interval(db,schedule,now):
    start,end=schedule_bounds(schedule)
    if now<start:return reserve_interval(db,schedule,now=now)
    duration=timedelta(minutes=schedule['slot_minutes'])
    candidate=max(start,now)
    occupied=encounter_model.occupied_intervals(db,schedule['schedule_id'],['HOLDING','CONFIRMED','CHECKED_IN','IN_PROGRESS'])
    # Historical completed visits keep their appointment timestamps and ticket codes.
    historical={row['estimated_exam_at'] for row in encounter_model.occupied_slot_starts(db,schedule['schedule_id'],['COMPLETED'])}
    for row in occupied:
        if row['appointment_end_at']<=candidate:continue
        while candidate in historical:candidate+=timedelta(microseconds=1)
        if candidate+duration<=row['estimated_exam_at']:break
        candidate=max(candidate,row['appointment_end_at'])
    while candidate in historical:candidate+=timedelta(microseconds=1)
    if candidate+duration>end:raise conflict('Không còn đủ thời gian cho một lượt khám trong ca','SLOT_UNAVAILABLE')
    return candidate,candidate+duration
