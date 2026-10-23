from backend.app.utils.business_codes import business_code
from datetime import datetime, timedelta, time
from psycopg.types.json import Jsonb

from backend.app.core.errors import conflict, forbidden, not_found
from backend.app.db.database import get_db_connection
from backend.app.models import (auth_model, staff_leave_model as model,
                                encounter_model, schedule_model)
from backend.app.utils.database_helpers import jsonable
from backend.app.utils.date import VN_TZ
from backend.app.services import staff_notification_service as staff_notifications

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
        request_id = model.create_request(db, actor['user_id'], fields)
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
        affected = encounter_model.count_active_for_schedules(db, ids)
    return {'leave_request': jsonable(row), 'affected_schedule_ids': ids, 'affected_encounters': affected}


def cancel(actor, request_id):
    with get_db_connection() as db:
        model.lock_changes(db)
        row = _get(db, actor, request_id, lock=True)
        if row['status'] == 'CANCELLED':
            return {'leave_request': jsonable(row)}
        if row['status'] != 'PENDING':
            raise conflict('Chỉ được rút đơn đang chờ duyệt', 'LEAVE_NOT_PENDING')
        model.cancel_request(db, request_id)
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
            effects['affected_encounters'] = encounter_model.count_active_for_schedules(db, ids)
            if staff['role_name'] == 'DOCTOR':
                # Stop new bookings, preserve encounters/quota/payment for manual coordination.
                changed = schedule_model.mark_unavailable_schedules(db, ids, f'Nghỉ theo đơn {business_code("NP", request_id)}')
                effects['unavailable_schedule_ids'] = [s['schedule_id'] for s in changed]
                for change in changed:
                    staff_notifications.schedule_changed(db, schedule_model.get_schedule(db, change['schedule_id']),
                        "unavailable", key=f'staff-leave-schedule:{request_id}:{change["schedule_id"]}')
            elif staff['role_name'] == 'NURSE':
                changed = schedule_model.revoke_leave_assignments(db, actor['user_id'], row['user_id'], ids)
                effects['revoked_assignment_ids'] = [a['assignment_id'] for a in changed]
                for change in changed:
                    staff_notifications.assignment_changed(db, schedule_model.get_assignment(db, change['assignment_id']),
                        "revoked", key=f'staff-leave-assignment:{request_id}:{change["assignment_id"]}')
        model.review_request(db, request_id, fields, actor['user_id'], Jsonb(effects))
        row = model.get_request(db, request_id)
        decision_text = 'đã được duyệt' if row['status'] == 'APPROVED' else 'không được duyệt'
        model.notify(db, row['user_id'], request_id, 'reviewed', f'Đơn xin nghỉ {decision_text}',
                     f"Đơn {business_code('NP', request_id)} {decision_text}. {fields['note']}")
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
        leaves = model.calendar_leaves(db, target_id, query)
        if user['role_name'] == 'RECEPTIONIST':
            clinical = []
        else:
            clinical = schedule_model.staff_calendar(db, target_id, user['role_name'], leaves, query)
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
