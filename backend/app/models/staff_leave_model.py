"""SQL cho đơn nghỉ; các thay đổi lịch/phân công cùng transaction với quyết định duyệt."""
SELECT = '''SELECT l.*,u.full_name AS staff_name,r.role_name
 FROM staff_leave_request l JOIN users u ON u.user_id=l.user_id
 JOIN role r ON r.role_id=u.role_id'''


def lock_changes(db):
    # Shared by leave decisions and creation/editing of clinical assignments.
    db.execute('SELECT pg_advisory_xact_lock(78124004)')


def get_request(db, request_id, user_id=None, *, lock=False):
    clause = 'l.request_id=%s'
    params = [request_id]
    if user_id is not None:
        clause += ' AND l.user_id=%s'
        params.append(user_id)
    return db.execute(SELECT + ' WHERE ' + clause + (' FOR UPDATE OF l' if lock else ''), params).fetchone()


def listing(db, user_id, status, page, size):
    where, params = ['TRUE'], []
    if user_id is not None:
        where.append('l.user_id=%s')
        params.append(user_id)
    if status:
        where.append('l.status=%s')
        params.append(status)
    base = SELECT + ' WHERE ' + ' AND '.join(where)
    total = db.execute('SELECT COUNT(*) AS n FROM (' + base + ') visible', params).fetchone()['n']
    rows = db.execute(base + ' ORDER BY l.created_at DESC,l.request_id DESC LIMIT %s OFFSET %s',
                      params + [size, (page - 1) * size]).fetchall()
    return rows, total


def create_request(db, user_id, fields):
    return db.execute('''INSERT INTO staff_leave_request(user_id,from_date,to_date,period,reason)
            VALUES (%s,%s,%s,%s,%s) RETURNING request_id''',
            (user_id, fields['from_date'], fields['to_date'], fields['period'], fields['reason'])).fetchone()['request_id']


def cancel_request(db, request_id):
    db.execute("UPDATE staff_leave_request SET status='CANCELLED',cancelled_at=CURRENT_TIMESTAMP WHERE request_id=%s", (request_id,))


def review_request(db, request_id, fields, actor_id, effects):
    db.execute('''UPDATE staff_leave_request SET status=%s,review_note=%s,reviewed_by_id=%s,
            reviewed_at=CURRENT_TIMESTAMP,effects=%s WHERE request_id=%s''',
            (fields['decision'], fields['note'], actor_id, effects, request_id))


def overlapping(db, user_id, start, end, period, *, approved_only=False):
    # Calendar intersection must contain a weekday (Fri and Mon requests may share a weekend).
    return db.execute('''SELECT l.* FROM staff_leave_request l WHERE user_id=%s
        AND status=ANY(%s) AND from_date<=%s AND to_date>=%s
        AND (period='FULL_DAY' OR %s='FULL_DAY' OR period=%s)
        AND EXISTS(SELECT 1 FROM generate_series(GREATEST(l.from_date,%s::date),
            LEAST(l.to_date,%s::date),'1 day'::interval) d WHERE EXTRACT(ISODOW FROM d)<=5)
        ORDER BY request_id''', (user_id, ['APPROVED'] if approved_only else ['PENDING', 'APPROVED'],
                                end, start, period, period, start, end)).fetchall()


def notify(db, user_id, request_id, event, title, content):
    db.execute('''INSERT INTO notification(user_id,event_key,notification_type,title,content,reference_type,reference_id)
        VALUES (%s,%s,'STAFF_LEAVE',%s,%s,'STAFF_LEAVE_REQUEST',%s)
        ON CONFLICT(user_id,event_key) DO NOTHING''',
               (user_id, f'staff-leave:{request_id}:{event}', title, content, request_id))


def calendar_leaves(db, target_id, query):
    return db.execute('''SELECT * FROM staff_leave_request WHERE user_id=%s AND status IN ('PENDING','APPROVED')
            AND from_date<=%s AND to_date>=%s ORDER BY request_id''',
            (target_id, query['to_date'], query['from_date'])).fetchall()


def affected_schedules(db, leave, role, *, lock=False):
    if role == 'RECEPTIONIST':
        return []
    scope = ('d.user_id=%s' if role == 'DOCTOR' else '''EXISTS(SELECT 1 FROM nurse_assignment a
        WHERE a.schedule_id=s.schedule_id AND a.nurse_id=%s AND a.revoked_at IS NULL)''')
    return db.execute('''SELECT s.* FROM work_schedule s JOIN doctor_profile d USING(doctor_profile_id)
        WHERE ''' + scope + ''' AND s.work_date BETWEEN %s AND %s AND EXTRACT(ISODOW FROM s.work_date)<=5
        AND (%s='FULL_DAY' OR (%s='MORNING' AND s.start_time<'12:00')
             OR (%s='AFTERNOON' AND s.end_time>'12:00'))
        ORDER BY s.schedule_id''' + (' FOR UPDATE OF s' if lock else ''),
        (leave['user_id'], leave['from_date'], leave['to_date'], leave['period'], leave['period'], leave['period'])).fetchall()
