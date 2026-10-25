from flask import Blueprint, jsonify, request
from flasgger import swag_from
from backend.app.core.security import roles_required
from backend.app.core.errors import bad_request, not_found
from backend.app.db.database import get_db_connection
from backend.app.utils.validation import page_params, date_range
from backend.app.utils.database_helpers import jsonable
from backend.app.utils.swagger_helpers import spec, path, PAGE

admin_activity_bp = Blueprint('admin_activity', __name__)
ACTIONS = {'CREATE','UPDATE','DELETE','LOCK','UNLOCK'}
TARGETS = {'USER','PATIENT','DOCTOR','DEPARTMENT','ROOM','WORK_SCHEDULE','ASSIGNMENT','ARTICLE','CONFIGURATION','PAYMENT','REVIEW','STAFF_LEAVE','RECEPTION_ASSIGNMENT','RECEPTION_WORKSTATION'}

def activity_query(args):
    page, size = page_params(args)
    start, end = date_range(args)
    action, target, q = args.get('action',''), args.get('target',''), args.get('q','').strip()
    if (action and action not in ACTIONS) or (target and target not in TARGETS) or len(q)>255:
        raise bad_request('Bộ lọc nhật ký không hợp lệ')
    return page,size,start,end,action,target,q

@admin_activity_bp.get('/admin/activity-logs')
@roles_required('ADMIN')
@swag_from(spec('Admin activity', 'Nhật ký thay đổi do admin thực hiện, chỉ đọc', PAGE + [{'in':'query','name':key,'type':'string'} for key in ('q','action','target','from_date','to_date')]))
def listing():
    page,size,start,end,action,target,q=activity_query(request.args)
    conditions,params=[],[]
    for key,value in [('action',action),('target',target)]:
        if value:conditions.append(f'{key}=%s');params.append(value)
    if start:conditions.append("(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= %s");params.append(start)
    if end:conditions.append("(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= %s");params.append(end)
    if q:
        conditions.append("(actor_name ILIKE %s OR ('NK_'||lpad(log_id::text,greatest(3,length(log_id::text)),'0')) ILIKE %s OR target_id ILIKE %s OR coalesce(before_data::text,'') ILIKE %s OR coalesce(after_data::text,'') ILIKE %s)")
        params.extend(['%'+q+'%']*5)
    where=' WHERE '+' AND '.join(conditions) if conditions else ''
    grouped = """WITH all_logs AS (
        SELECT *,actor_id::text||':'||coalesce(batch_key,'single:'||log_id::text)||':'||target||':'||action AS group_key
        FROM admin_activity_log), matched AS (SELECT DISTINCT group_key FROM all_logs"""+where+"""),
        selected AS (SELECT * FROM all_logs WHERE group_key IN (SELECT group_key FROM matched)),
        grouped AS (SELECT min(log_id) AS log_id,actor_id,min(actor_name) AS actor_name,action,target,
          min(target_id) AS target_id,max(created_at) AS created_at,count(*)::integer AS batch_count,
          min(after_data->>'work_date') AS from_date,max(after_data->>'work_date') AS to_date
          FROM selected GROUP BY group_key,actor_id,action,target)
        """
    with get_db_connection() as db:
        total=db.execute(grouped+'SELECT count(*) AS n FROM grouped',params).fetchone()['n']
        rows=db.execute(grouped+'SELECT * FROM grouped ORDER BY created_at DESC,log_id DESC LIMIT %s OFFSET %s',params+[size,(page-1)*size]).fetchall()
    return jsonify(items=jsonable(rows),total=total,page=page,page_size=size)

@admin_activity_bp.get('/admin/activity-logs/<int:log_id>')
@roles_required('ADMIN')
@swag_from(spec('Admin activity', 'Chi tiết dữ liệu trước và sau thay đổi', [path('log_id')]))
def detail(log_id):
    with get_db_connection() as db:
        row=db.execute('SELECT * FROM admin_activity_log WHERE log_id=%s',(log_id,)).fetchone()
        if row and row.get('batch_key'):
            children=db.execute("""SELECT * FROM admin_activity_log WHERE actor_id=%s AND batch_key=%s
                AND target=%s AND action=%s ORDER BY log_id""",(row['actor_id'],row['batch_key'],row['target'],row['action'])).fetchall()
            row={**row,'batch_count':len(children),'batch_items':children}
    if row is None:raise not_found('Không tìm thấy nhật ký')
    return jsonify(activity=jsonable(row))
