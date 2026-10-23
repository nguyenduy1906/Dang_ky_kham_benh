"""Transactional notifications for the staff affected by a business operation."""
import hashlib
import json

from backend.app.utils.business_codes import business_code


def event_version(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


def send(db, recipients, key, kind, title, content, reference, identifier):
    recipients = sorted({int(user_id) for user_id in recipients if user_id is not None})
    if not recipients:
        return
    # The recipient set comes from the operation, never from browser input.
    db.execute('''INSERT INTO notification(user_id,event_key,notification_type,title,content,reference_type,reference_id)
        SELECT u.user_id,%s,%s,%s,%s,%s,%s FROM users u JOIN role r USING(role_id)
        WHERE u.user_id=ANY(%s) AND r.role_name IN ('DOCTOR','NURSE','RECEPTIONIST')
        AND u.deleted_at IS NULL AND u.account_status='ACTIVE' AND u.approval_status='APPROVED'
        ON CONFLICT(user_id,event_key) DO NOTHING''',
        (key, kind, title, content, reference, identifier, recipients))


def schedule_recipients(db, schedule_id):
    rows = db.execute('''SELECT d.user_id FROM work_schedule s
        JOIN doctor_profile d USING(doctor_profile_id) WHERE s.schedule_id=%s
        UNION SELECT nurse_id AS user_id FROM nurse_assignment
        WHERE schedule_id=%s AND revoked_at IS NULL''', (schedule_id, schedule_id)).fetchall()
    return {row['user_id'] for row in rows}


def schedule_description(row):
    work_date = row['work_date']
    day = work_date.strftime('%d/%m/%Y') if hasattr(work_date, 'strftime') else str(work_date)
    doctor = row.get('doctor_name') or business_code('BS', row['doctor_profile_id'])
    return (f"Ca {business_code('CA', row['schedule_id'])}, bác sĩ {doctor}, ngày {day}, "
            f"{str(row['start_time'])[:5]}–{str(row['end_time'])[:5]}, "
            f"{row.get('room_name') or business_code('PH', row['room_id'])}")


def schedule_changed(db, row, action, *, before=None, key=None, extra_recipients=()):
    if before is not None and all(before.get(field) == row.get(field) for field in
            ('room_id', 'work_date', 'start_time', 'end_time', 'max_quota', 'slot_minutes', 'schedule_status')):
        return
    titles = {'created': 'Bạn được giao ca làm việc', 'updated': 'Lịch làm việc được cập nhật',
              'moved': 'Ca làm việc đã được chuyển', 'unavailable': 'Ca làm việc đã báo nghỉ'}
    content = schedule_description(row)
    if before:
        content = f"Trước: {schedule_description(before)}. Sau: {content}"
    status = {'OPEN': 'Đang mở', 'FULL': 'Đã đủ chỗ', 'CLOSED': 'Đã đóng', 'UNAVAILABLE': 'Đã báo nghỉ'}
    content += f". Trạng thái: {status.get(row['schedule_status'], row['schedule_status'])}."
    recipients = schedule_recipients(db, row['schedule_id']) | set(extra_recipients)
    send(db, recipients, key or f"staff-schedule:{row['schedule_id']}:{action}:{event_version(row)}",
         'SCHEDULE', titles[action], content, 'WORK_SCHEDULE', row['schedule_id'])


def assignment_changed(db, row, action, *, key=None):
    titles = {'assigned': 'Bạn được phân công ca làm việc', 'revoked': 'Phân công của bạn đã được thu hồi',
              'updated': 'Phân công ca làm việc được cập nhật'}
    content = (f"Phân công {business_code('PC', row['assignment_id'])}; "
               f"{schedule_description(row)}.")
    send(db, [row['nurse_id']], key or f"staff-assignment:{row['assignment_id']}:{action}:{event_version(row)}",
         'ASSIGNMENT', titles[action], content, 'NURSE_ASSIGNMENT', row['assignment_id'])


def encounter_completed(db, encounter_id):
    row = db.execute('''SELECT d.user_id FROM encounter e JOIN doctor_profile d USING(doctor_profile_id)
        WHERE e.encounter_id=%s''', (encounter_id,)).fetchone()
    if row:
        send(db, [row['user_id']], f'staff-completed:{encounter_id}', 'ENCOUNTER',
             'Bạn vừa hoàn thành một lượt khám',
             f"Lượt khám {business_code('LK', encounter_id)} đã hoàn tất.", 'ENCOUNTER', encounter_id)


def encounter_transferred(db, actor, encounter_id, log_id, source, target):
    recipients = schedule_recipients(db, source['schedule_id']) | schedule_recipients(db, target['schedule_id'])
    if actor['role_name'] == 'RECEPTIONIST':
        recipients.add(actor['user_id'])
    send(db, recipients, f'staff-transfer:{log_id}', 'ENCOUNTER', 'Đã chuyển lịch / điều phối lượt khám',
         f"Lượt khám {business_code('LK', encounter_id)}. Từ {schedule_description(source)} "
         f"sang {schedule_description(target)}.", 'ENCOUNTER', encounter_id)
