from psycopg.types.json import Jsonb
from backend.app.utils.database_helpers import jsonable

SELECT = '''SELECT a.*,u.full_name AS receptionist_name,w.name AS workstation_name,w.area,
 maker.full_name AS assigned_by_name,revoker.full_name AS revoked_by_name
 FROM reception_assignment a JOIN users u ON u.user_id=a.receptionist_id
 JOIN reception_workstation w USING(workstation_id)
 JOIN users maker ON maker.user_id=a.assigned_by_id
 LEFT JOIN users revoker ON revoker.user_id=a.revoked_by_id'''


def get(db, identifier, lock=False):
    return db.execute(SELECT + ' WHERE a.assignment_id=%s' + (' FOR UPDATE OF a' if lock else ''), (identifier,)).fetchone()


def listing(db, query, owner=None):
    where, params = ['TRUE'], []
    for key, expr in [('from_date', 'a.work_date>=%s'), ('to_date', 'a.work_date<=%s')]:
        if query.get(key):
            where.append(expr); params.append(query[key])
    target = owner if owner is not None else query.get('receptionist_id')
    if target is not None:
        where.append('a.receptionist_id=%s'); params.append(target)
    if not query.get('include_revoked'):
        where.append('a.revoked_at IS NULL')
    if query.get('q'):
        where.append("(u.full_name ILIKE %s OR w.name ILIKE %s OR w.area ILIKE %s OR 'PC_'||lpad(a.assignment_id::text,greatest(3,length(a.assignment_id::text)),'0') ILIKE %s OR 'TK_'||lpad(a.receptionist_id::text,greatest(3,length(a.receptionist_id::text)),'0') ILIKE %s)")
        params += ['%' + query['q'] + '%'] * 5
    base = SELECT + ' WHERE ' + ' AND '.join(where)
    total = db.execute('SELECT COUNT(*) AS n FROM (' + base + ') x', params).fetchone()['n']
    rows = db.execute(base + ' ORDER BY a.work_date DESC,a.start_time,a.assignment_id DESC LIMIT %s OFFSET %s',
                      params + [query['page_size'], (query['page'] - 1) * query['page_size']]).fetchall()
    return rows, total


def overlap(db, row, exclude=None):
    return db.execute('''SELECT assignment_id FROM reception_assignment WHERE revoked_at IS NULL
      AND work_date=%s AND start_time<%s AND end_time>%s
      AND receptionist_id=%s AND (%s::bigint IS NULL OR assignment_id<>%s)
      LIMIT 1''', (row['work_date'], row['end_time'], row['start_time'], row['receptionist_id'],
                   exclude, exclude)).fetchone()


def insert(db, actor_id, row):
    return db.execute('''INSERT INTO reception_assignment(receptionist_id,workstation_id,work_date,start_time,end_time,note,assigned_by_id)
      VALUES(%s,%s,%s,%s,%s,%s,%s) RETURNING assignment_id''',
      tuple(row.get(key) for key in ('receptionist_id','workstation_id','work_date','start_time','end_time','note')) + (actor_id,)).fetchone()['assignment_id']


def update(db, identifier, row):
    db.execute('''UPDATE reception_assignment SET receptionist_id=%s,workstation_id=%s,work_date=%s,
      start_time=%s,end_time=%s,note=%s,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE assignment_id=%s''',
      tuple(row.get(key) for key in ('receptionist_id','workstation_id','work_date','start_time','end_time','note')) + (identifier,))


def revoke(db, identifier, actor_id, reason):
    db.execute('''UPDATE reception_assignment SET revoked_at=CURRENT_TIMESTAMP,revoked_by_id=%s,
      revoke_reason=%s,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE assignment_id=%s AND revoked_at IS NULL''',
      (actor_id, reason, identifier))


def audit(db, actor_id, action, after, before=None):
    db.execute('''INSERT INTO reception_assignment_change(assignment_id,actor_id,action,before_data,after_data)
      VALUES(%s,%s,%s,%s,%s)''', (after['assignment_id'], actor_id, action,
                               Jsonb(jsonable(before)) if before else None, Jsonb(jsonable(after))))


def calendar(db, user_id, query, include_revoked=False):
    return db.execute(SELECT + ''' WHERE a.receptionist_id=%s AND a.work_date BETWEEN %s AND %s'''
                      + ('' if include_revoked else ' AND a.revoked_at IS NULL') + ' ORDER BY a.work_date,a.start_time',
                      (user_id, query['from_date'], query['to_date'])).fetchall()


def leave_assignments(db, leave):
    return db.execute(SELECT + ''' WHERE a.receptionist_id=%s AND a.revoked_at IS NULL
      AND a.work_date BETWEEN %s AND %s AND EXTRACT(ISODOW FROM a.work_date)<=5
      AND (%s='FULL_DAY' OR (%s='MORNING' AND a.start_time<'12:00') OR (%s='AFTERNOON' AND a.end_time>'12:00'))
      ORDER BY a.assignment_id FOR UPDATE OF a''', (leave['user_id'], leave['from_date'], leave['to_date'],
                                                 leave['period'], leave['period'], leave['period'])).fetchall()
