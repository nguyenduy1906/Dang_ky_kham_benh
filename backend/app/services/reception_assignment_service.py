from datetime import datetime
from psycopg.errors import UniqueViolation
from backend.app.core.errors import conflict, not_found
from backend.app.core.security import require_role
from backend.app.db.database import get_db_connection
from backend.app.models import reception_assignment_model as model, staff_leave_model, auth_model
from backend.app.services import staff_leave_service, staff_notification_service as notifications
from backend.app.utils.database_helpers import jsonable
from backend.app.utils.date import VN_TZ, utc_now


def future(row):
    if datetime.combine(row['work_date'], row['start_time'], VN_TZ) <= utc_now():
        raise conflict('Ca đã bắt đầu hoặc đã qua; không thể thay đổi phân công', 'ASSIGNMENT_STARTED')


def resolve_area(db, fields):
    if fields.get('workstation_id'):
        return fields['workstation_id']
    name = fields['area_name']
    row = db.execute('SELECT * FROM reception_workstation WHERE lower(name)=lower(%s) ORDER BY workstation_id LIMIT 1', (name,)).fetchone()
    if row:
        if not row['is_active']:
            raise conflict('Khu vực đã ngừng hoạt động', 'WORKSTATION_INVALID')
        return row['workstation_id']
    return db.execute('INSERT INTO reception_workstation(name,area) VALUES(%s,%s) RETURNING workstation_id', (name,name)).fetchone()['workstation_id']


def validate(db, row, exclude=None):
    future(row)
    staff = auth_model.get_user_by_id(db, row['receptionist_id'])
    if (not staff or staff['role_name'] != 'RECEPTIONIST' or staff['deleted_at'] is not None
            or staff['account_status'] != 'ACTIVE' or staff['approval_status'] != 'APPROVED'):
        raise conflict('Chỉ phân công lễ tân đang hoạt động và đã được duyệt', 'RECEPTIONIST_INVALID')
    station = db.execute('SELECT * FROM reception_workstation WHERE workstation_id=%s', (row['workstation_id'],)).fetchone()
    if not station or not station['is_active']:
        raise conflict('Khu vực làm việc không còn hoạt động', 'WORKSTATION_INVALID')
    staff_leave_service.ensure_available(db, row['receptionist_id'], row['work_date'], row['start_time'], row['end_time'])
    if model.overlap(db, row, exclude):
        raise conflict('Lễ tân đã có phân công trùng giờ', 'RECEPTION_ASSIGNMENT_OVERLAP')


def notify(db, actor_id, row, action, before=None):
    label = {'created': 'Bạn được phân công ca lễ tân', 'updated': 'Phân công lễ tân được cập nhật',
             'revoked': 'Phân công lễ tân đã được thu hồi'}[action]
    description = lambda r: (f"{r['work_date']}, {str(r['start_time'])[:5]}–{str(r['end_time'])[:5]}, "
                             f"{r['workstation_name']}")
    content = description(row)
    if before and action == 'updated':
        content = f'Trước: {description(before)}. Sau: {content}'
    if row.get('revoke_reason'):
        content += '. Lý do: ' + row['revoke_reason']
    key = f"reception-assignment:{row['assignment_id']}:{row['version']}:{action}"
    notifications.send(db, [row['receptionist_id']], key, 'ASSIGNMENT', label, content,
                       'RECEPTION_ASSIGNMENT', row['assignment_id'])
    if before and before['receptionist_id'] != row['receptionist_id']:
        notifications.send(db, [before['receptionist_id']], key + ':previous', 'ASSIGNMENT',
                           'Bạn không còn phụ trách ca lễ tân này', description(before),
                           'RECEPTION_ASSIGNMENT', row['assignment_id'])



def listing(actor, query, own=False):
    require_role(actor, 'RECEPTIONIST' if own else 'ADMIN')
    with get_db_connection() as db:
        rows, total = model.listing(db, query, actor['user_id'] if own else None)
    return {'items': jsonable(rows), 'total': total, 'page': query['page'], 'page_size': query['page_size']}


def detail(actor, identifier):
    require_role(actor, 'ADMIN')
    with get_db_connection() as db:
        row = model.get(db, identifier)
        if not row:
            raise not_found('Không tìm thấy phân công lễ tân')
        history = db.execute('''SELECT c.change_id,c.action,c.changed_at,c.before_data,c.after_data,u.full_name AS actor_name
          FROM reception_assignment_change c JOIN users u ON u.user_id=c.actor_id
          WHERE assignment_id=%s ORDER BY c.change_id DESC''', (identifier,)).fetchall()
    return {'assignment': jsonable(row), 'history': jsonable(history)}


def create(actor, fields):
    require_role(actor, 'ADMIN')
    rows = []
    with get_db_connection() as db:
        staff_leave_model.lock_changes(db)
        fields = {**fields, 'workstation_id': resolve_area(db, fields)}
        for shift in fields['shifts']:
            row = {**shift, **{k: fields[k] for k in ('receptionist_id', 'workstation_id', 'note')}}
            validate(db, row)
            identifier = model.insert(db, actor['user_id'], row)
            after = model.get(db, identifier)
            model.audit(db, actor['user_id'], 'created', after)
            notify(db, actor['user_id'], after, 'created')
            rows.append(after)
    return {'items': jsonable(rows), 'total': len(rows)}


def update(actor, identifier, fields, revoke=False):
    require_role(actor, 'ADMIN')
    with get_db_connection() as db:
        staff_leave_model.lock_changes(db)
        before = model.get(db, identifier, lock=True)
        if not before:
            raise not_found('Không tìm thấy phân công lễ tân')
        if revoke and before['revoked_at'] and fields['expected_version'] == before['version']:
            return {'assignment': jsonable(before)}
        if before['version'] != fields['expected_version']:
            raise conflict('Phân công đã thay đổi. Vui lòng tải lại.', 'ASSIGNMENT_STALE')
        if before['revoked_at']:
            raise conflict('Phân công đã thu hồi, không thể sửa', 'ASSIGNMENT_REVOKED')
        future(before)
        if revoke:
            model.revoke(db, identifier, actor['user_id'], fields['reason'])
        else:
            fields = {**fields, 'workstation_id': resolve_area(db, fields)}
            validate(db, fields, identifier)
            if all(before[k] == fields[k] for k in ('receptionist_id','workstation_id','work_date','start_time','end_time','note')):
                return {'assignment': jsonable(before)}
            model.update(db, identifier, fields)
        after = model.get(db, identifier)
        action = 'revoked' if revoke else 'updated'
        model.audit(db, actor['user_id'], action, after, before)
        notify(db, actor['user_id'], after, action, before)
    return {'assignment': jsonable(after)}


def workstations(actor, include_inactive=False):
    require_role(actor, 'ADMIN')
    with get_db_connection() as db:
        rows = db.execute('SELECT * FROM reception_workstation' + ('' if include_inactive else ' WHERE is_active')
                          + ' ORDER BY area,name,workstation_id').fetchall()
    return {'items': jsonable(rows)}


def save_workstation(actor, fields, identifier=None):
    require_role(actor, 'ADMIN')
    try:
        with get_db_connection() as db:
            staff_leave_model.lock_changes(db)
            if identifier:
                before = db.execute('SELECT * FROM reception_workstation WHERE workstation_id=%s FOR UPDATE', (identifier,)).fetchone()
                if not before:
                    raise not_found('Không tìm thấy khu vực')
                if before['version'] != fields['expected_version']:
                    raise conflict('Quầy đã thay đổi. Vui lòng tải lại.', 'WORKSTATION_STALE')
                assigned = db.execute('''SELECT 1 FROM reception_assignment WHERE workstation_id=%s AND revoked_at IS NULL
                  AND (work_date+end_time) AT TIME ZONE 'Asia/Ho_Chi_Minh'>CURRENT_TIMESTAMP LIMIT 1''', (identifier,)).fetchone()
                if assigned:
                    raise conflict('Khu vực đang có ca chưa kết thúc; xử lý phân công trước khi sửa khu vực', 'WORKSTATION_ASSIGNED')
                row = db.execute('''UPDATE reception_workstation SET name=%s,area=%s,is_active=%s,version=version+1
                  WHERE workstation_id=%s RETURNING *''', (fields['name'],fields['area'],fields['is_active'],identifier)).fetchone()
            else:
                row = db.execute('INSERT INTO reception_workstation(name,area) VALUES(%s,%s) RETURNING *',
                                 (fields['name'],fields['area'])).fetchone()
        return {'workstation': jsonable(row)}
    except UniqueViolation:
        raise conflict('Tên khu vực đã tồn tại ', 'WORKSTATION_DUPLICATE') from None


def revoke_for_leave(db, actor_id, leave):
    identifiers = []
    for before in model.leave_assignments(db, leave):
        model.revoke(db, before['assignment_id'], actor_id, f"Nghỉ theo đơn NP_{leave['request_id']:03d}")
        after = model.get(db, before['assignment_id'])
        model.audit(db, actor_id, 'revoked', after, before)
        notify(db, actor_id, after, 'revoked', before)
        identifiers.append(after['assignment_id'])
    return identifiers
