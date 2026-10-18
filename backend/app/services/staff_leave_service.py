from backend.app.utils.business_codes import business_code
from datetime import datetime, timedelta, time
from psycopg.types.json import Jsonb

from backend.app.core.errors import conflict, forbidden, not_found
from backend.app.db.database import get_db_connection
from backend.app.models import auth_model, staff_leave_model as model
from backend.app.utils.database_helpers import jsonable
from backend.app.utils.date import VN_TZ

STAFF_ROLES = ('DOCTOR', 'NURSE', 'RECEPTIONIST')
SHIFTS = {'MORNING': (time(8), time(11, 30)), 'AFTERNOON': (time(13, 30), time(17))}


def _role(actor, admin=False):
    if actor['role_name'] not in (('ADMIN',) if admin else STAFF_ROLES):
        raise forbidden()


def _staff(db, user_id):
    user = auth_model.get_user_by_id(db, user_id)
    if (not user or user['role_name'] not in STAFF_ROLES or user['deleted_at'] is not None
            or user['account_status'] != 'ACTIVE' or user['approval_status'] != 'APPROVED'):
        raise not_found('Không tìm thấy nhân viên đang hoạt động', 'STAFF_NOT_FOUND')
    return user


def _future(leave):
    first = leave['from_date']
    while first.weekday() > 4:
        first += timedelta(days=1)
    start = SHIFTS['AFTERNOON' if leave['period'] == 'AFTERNOON' else 'MORNING'][0]
    if datetime.combine(first, start, VN_TZ) <= datetime.now(VN_TZ):
        raise conflict('Ca xin nghỉ đã bắt đầu; không thể gửi hoặc duyệt hồi tố', 'LEAVE_ALREADY_STARTED')


def _get(db, actor, request_id, *, admin=False, lock=False):
    _role(actor, admin)
    row = model.get_request(db, request_id, None if admin else actor['user_id'], lock=lock)
    if row is None:
        raise not_found('Không tìm thấy đơn nghỉ trong phạm vi quyền', 'LEAVE_NOT_FOUND')
    return row


def _notify_admins(db, row, event):
    for admin in db.execute("""SELECT u.user_id FROM users u JOIN role r USING(role_id)
            WHERE r.role_name='ADMIN' AND u.deleted_at IS NULL AND u.account_status='ACTIVE'
            AND u.approval_status='APPROVED'"""):
        model.notify(db, admin['user_id'], row['request_id'], event, 'Đơn xin nghỉ của nhân viên',
                     f"Đơn {business_code('NP', row['request_id'])} của {row['staff_name']}: {row['status']}.")


def create(actor, fields):
    _role(actor)
    with get_db_connection() as db:
        model.lock_changes(db)
        _future(fields)
        _staff(db, actor['user_id'])
        if model.overlapping(db, actor['user_id'], fields['from_date'], fields['to_date'], fields['period']):
            raise conflict('Đã có đơn nghỉ chờ duyệt hoặc được duyệt trùng ca', 'LEAVE_OVERLAP')
        request_id = db.execute('''INSERT INTO staff_leave_request(user_id,from_date,to_date,period,reason)
            VALUES (%s,%s,%s,%s,%s) RETURNING request_id''',
            (actor['user_id'], fields['from_date'], fields['to_date'], fields['period'], fields['reason'])).fetchone()['request_id']
        row = model.get_request(db, request_id)
        _notify_admins(db, row, 'created')
    return {'leave_request': jsonable(row)}


def listing(actor, query, *, admin=False):
    _role(actor, admin)
    with get_db_connection() as db:
        rows, total = model.listing(db, query['user_id'] if admin else actor['user_id'],
                                    query['status'], query['page'], query['page_size'])
    return {'items': jsonable(rows), 'total': total, 'page': query['page'], 'page_size': query['page_size']}


def detail(actor, request_id, *, admin=False):
    with get_db_connection() as db:
        row = _get(db, actor, request_id, admin=admin)
        schedules = model.affected_schedules(db, row, row['role_name'])
        ids = [s['schedule_id'] for s in schedules]
        affected = db.execute('''SELECT COUNT(*) AS n FROM encounter WHERE schedule_id=ANY(%s)
            AND encounter_status IN ('HOLDING','CONFIRMED','CHECKED_IN','IN_PROGRESS')''', (ids,)).fetchone()['n']
    return {'leave_request': jsonable(row), 'affected_schedule_ids': ids, 'affected_encounters': affected}


def cancel(actor, request_id):
    with get_db_connection() as db:
        model.lock_changes(db)
        row = _get(db, actor, request_id, lock=True)
        if row['status'] == 'CANCELLED':
            return {'leave_request': jsonable(row)}
        if row['status'] != 'PENDING':
            raise conflict('Chỉ được rút đơn đang chờ duyệt', 'LEAVE_NOT_PENDING')
        db.execute("UPDATE staff_leave_request SET status='CANCELLED',cancelled_at=CURRENT_TIMESTAMP WHERE request_id=%s", (request_id,))
        row = model.get_request(db, request_id)
        _notify_admins(db, row, 'cancelled')
    return {'leave_request': jsonable(row)}


def review(actor, request_id, fields):
    _role(actor, True)
    with get_db_connection() as db:
        model.lock_changes(db)
        row = _get(db, actor, request_id, admin=True, lock=True)
        if row['user_id'] == actor['user_id']:
            raise forbidden('Không được tự duyệt đơn nghỉ của mình')
        if row['status'] == fields['decision']:
            return {'leave_request': jsonable(row)}
        if row['status'] != 'PENDING':
            raise conflict('Đơn nghỉ đã được xử lý hoặc rút', 'LEAVE_NOT_PENDING')
        effects = {'unavailable_schedule_ids': [], 'revoked_assignment_ids': [], 'affected_encounters': 0}
        if fields['decision'] == 'APPROVED':
            _future(row)
            staff = _staff(db, row['user_id'])
            schedules = model.affected_schedules(db, row, staff['role_name'], lock=True)
            ids = [s['schedule_id'] for s in schedules]
            effects['affected_encounters'] = db.execute('''SELECT COUNT(*) AS n FROM encounter
                WHERE schedule_id=ANY(%s) AND encounter_status IN ('HOLDING','CONFIRMED','CHECKED_IN','IN_PROGRESS')''', (ids,)).fetchone()['n']
            if staff['role_name'] == 'DOCTOR':
                # Stop new bookings, preserve encounters/quota/payment for manual coordination.
                changed = db.execute("""UPDATE work_schedule SET schedule_status='UNAVAILABLE',unavailable_reason=%s
                    WHERE schedule_id=ANY(%s) AND schedule_status IN ('OPEN','FULL') RETURNING schedule_id""",
                    (f'Nghỉ theo đơn {business_code("NP", request_id)}', ids)).fetchall()
                effects['unavailable_schedule_ids'] = [s['schedule_id'] for s in changed]
            elif staff['role_name'] == 'NURSE':
                changed = db.execute('''UPDATE nurse_assignment SET revoked_at=CURRENT_TIMESTAMP,revoked_by_id=%s
                    WHERE nurse_id=%s AND schedule_id=ANY(%s) AND revoked_at IS NULL RETURNING assignment_id''',
                    (actor['user_id'], row['user_id'], ids)).fetchall()
                effects['revoked_assignment_ids'] = [a['assignment_id'] for a in changed]
        db.execute('''UPDATE staff_leave_request SET status=%s,review_note=%s,reviewed_by_id=%s,
            reviewed_at=CURRENT_TIMESTAMP,effects=%s WHERE request_id=%s''',
            (fields['decision'], fields['note'], actor['user_id'], Jsonb(effects), request_id))
        row = model.get_request(db, request_id)
        model.notify(db, row['user_id'], request_id, 'reviewed', 'Kết quả đơn xin nghỉ',
                     f"Đơn {business_code('NP', request_id)}: {row['status']}. {fields['note']}")
    return {'leave_request': jsonable(row)}


def ensure_available(db, user_id, work_date, start, end):
    """Called under lock_changes before assigning clinical work to an absent employee."""
    if work_date.weekday() > 4:
        return
    for leave in model.overlapping(db, user_id, work_date, work_date, 'FULL_DAY', approved_only=True):
        if (leave['period'] == 'FULL_DAY' or (leave['period'] == 'MORNING' and start < time(12))
                or (leave['period'] == 'AFTERNOON' and end > time(12))):
            raise conflict('Nhân viên đã được duyệt nghỉ trong ca này', 'STAFF_ON_LEAVE')


def calendar(actor, query, user_id=None):
    _role(actor, user_id is not None)
    target_id = user_id if user_id is not None else actor['user_id']
    with get_db_connection() as db:
        user = _staff(db, target_id)
        leaves = db.execute('''SELECT * FROM staff_leave_request WHERE user_id=%s AND status IN ('PENDING','APPROVED')
            AND from_date<=%s AND to_date>=%s ORDER BY request_id''',
            (target_id, query['to_date'], query['from_date'])).fetchall()
        if user['role_name'] == 'RECEPTIONIST':
            clinical = []
        else:
            scope = 'd.user_id=%s' if user['role_name'] == 'DOCTOR' else '''EXISTS(SELECT 1 FROM nurse_assignment a
                WHERE a.schedule_id=s.schedule_id AND a.nurse_id=%s AND (a.revoked_at IS NULL OR a.assignment_id=ANY(%s)))'''
            scope_args = [target_id]
            if user['role_name'] == 'NURSE':
                # Keep approved absences visible after approval revokes clinical access.
                scope_args.append([aid for leave in leaves if leave['status'] == 'APPROVED'
                                   for aid in (leave.get('effects') or {}).get('revoked_assignment_ids', [])])
            clinical = db.execute('''SELECT s.schedule_id,s.work_date,s.start_time,s.end_time,s.schedule_status,s.room_id,r.room_name
                FROM work_schedule s JOIN doctor_profile d USING(doctor_profile_id) JOIN room r ON r.room_id=s.room_id WHERE ''' + scope +
                ' AND s.work_date BETWEEN %s AND %s ORDER BY s.work_date,s.start_time',
                (*scope_args, query['from_date'], query['to_date'])).fetchall()
    days = []
    day = query['from_date']
    while day <= query['to_date']:
        shifts = []
        daily_clinical = [s for s in clinical if s['work_date'] == day and s['schedule_status'] in ('OPEN', 'FULL')]
        if user['role_name'] == 'NURSE':
            # A nurse works the assigned periods, including explicitly assigned weekends.
            periods = {period: (min(s['start_time'] for s in matching), max(s['end_time'] for s in matching))
                       for period in SHIFTS
                       if (matching := [s for s in daily_clinical if
                           (s['start_time'] < time(12) if period == 'MORNING' else s['end_time'] > time(12))])}
        else:
            periods = SHIFTS if day.weekday() < 5 else {}
        if periods:
            for period, (start, end) in periods.items():
                matching = [l for l in leaves if l['from_date'] <= day <= l['to_date'] and l['period'] in ('FULL_DAY', period)]
                shifts.append({'period': period, 'start_time': start, 'end_time': end,
                               'status': 'ON_LEAVE' if any(l['status'] == 'APPROVED' for l in matching) else 'WORKING',
                               'leave_request_ids': [l['request_id'] for l in matching],
                               'pending_leave': any(l['status'] == 'PENDING' for l in matching)})
        days.append({'work_date': day, 'is_default_workday': day.weekday() < 5, 'shifts': shifts,
                     'clinical_schedules': [s for s in clinical if s['work_date'] == day]})
        day += timedelta(days=1)
    return jsonable({'user_id': target_id, 'full_name': user['full_name'], 'role_name': user['role_name'],
                     'timezone': 'Asia/Saigon', 'default_weekdays': [1, 2, 3, 4, 5],
                     'from_date': query['from_date'], 'to_date': query['to_date'], 'items': days})
