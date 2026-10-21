from psycopg import errors as pg_errors

from backend.app.core.errors import bad_request, conflict, not_found
from backend.app.db.database import get_db_connection
from backend.app.models import catalog_model, doctor_model
from backend.app.utils import uploads
from backend.app.utils.database_helpers import flags, jsonable


def _present(row):
    return jsonable(flags(row, 'is_active', 'content_is_demo'))


def _department(db, row, admin=False):
    data=_present(row)
    doctors=catalog_model.department_doctors(db,row['department_id'],include_inactive=admin)
    data['doctor_count']=len(doctors)
    leaders=catalog_model.department_leaders(db,row['department_id'],include_inactive=admin)
    if not admin:
        keys={'doctor_profile_id','department_id','position','appointed_at','full_name','avatar_url','academic_degree','specialization','experience_years','is_active'}
        leaders=[{k:v for k,v in leader.items() if k in keys} for leader in leaders]
    data['leadership']={'head':next((_present(r) for r in leaders if r['position']=='HEAD'),None),
                        'deputies':[_present(r) for r in leaders if r['position']=='DEPUTY']}
    return data,[_present(r) for r in doctors]


def list_departments(include_inactive):
    with get_db_connection() as db:
        rows = catalog_model.list_departments(db, include_inactive)
        items=[_department(db,row,include_inactive)[0] for row in rows]
    return {'items': items}


def get_department(department_id, include_inactive):
    with get_db_connection() as db:
        row = catalog_model.get_department(db, department_id)
        if row is None or (not row['is_active'] and not include_inactive):
            raise not_found('Không tìm thấy chuyên khoa', 'DEPARTMENT_NOT_FOUND')
        data,doctors=_department(db,row,include_inactive)
    return {'department': data,'doctors':doctors}


def create_department(fields):
    with get_db_connection() as db:
        if catalog_model.department_name_exists(db, fields['name']):
            raise conflict('Tên chuyên khoa đã tồn tại', 'DUPLICATE_DEPARTMENT')
        try:
            row = catalog_model.create_department(db, fields)
        except pg_errors.UniqueViolation:
            raise conflict('Tên chuyên khoa đã tồn tại', 'DUPLICATE_DEPARTMENT') from None
    return {'department': _present(row)}


def update_department(department_id, fields):
    with get_db_connection() as db:
        current=catalog_model.get_department_for_update(db, department_id)
        if current is None:
            raise not_found('Không tìm thấy chuyên khoa', 'DEPARTMENT_NOT_FOUND')
        if 'expected_version' in fields and fields['expected_version']!=current['version']:
            raise conflict('Khoa đã được thay đổi, hãy tải lại trước khi lưu','DEPARTMENT_VERSION_CONFLICT')
        if 'name' in fields and catalog_model.department_name_exists(db, fields['name'], department_id):
            raise conflict('Tên chuyên khoa đã tồn tại', 'DUPLICATE_DEPARTMENT')
        try:
            row = catalog_model.update_department(db, department_id, fields)
        except pg_errors.UniqueViolation:
            raise conflict('Tên chuyên khoa đã tồn tại','DUPLICATE_DEPARTMENT') from None
    return {'department': _present(row)}


def leadership_history(department_id):
    with get_db_connection() as db:
        department=catalog_model.get_department(db,department_id)
        if not department: raise not_found('Không tìm thấy chuyên khoa','DEPARTMENT_NOT_FOUND')
        rows=catalog_model.department_leaders(db,department_id,history=True,include_inactive=True)
    return {'items':[_present(row) for row in rows],'version':department['version']}


def replace_leadership(user, department_id, fields):
    with get_db_connection() as db:
        catalog_model.lock_memberships(db)
        department=catalog_model.get_department_for_update(db, department_id)
        if not department: raise not_found('Không tìm thấy chuyên khoa','DEPARTMENT_NOT_FOUND')
        if fields['expected_version']!=department['version']:
            raise conflict('Khoa đã được thay đổi, hãy tải lại trước khi phân công','DEPARTMENT_VERSION_CONFLICT')
        count=len(catalog_model.department_doctors(db,department_id,include_inactive=True))
        if len(fields['deputy_doctor_ids'])>(3 if count>20 else 2):
            raise conflict('Vượt số lượng phó khoa được phép','DEPUTY_LIMIT')
        desired={did:'DEPUTY' for did in fields['deputy_doctor_ids']}
        if fields['head_doctor_id'] is not None: desired[fields['head_doctor_id']]='HEAD'
        for did in sorted(desired):
            identity=doctor_model.lock_leadership_identity(db, did)
            doctor=doctor_model.get_by_id(db,did)
            if not doctor or not identity or identity['role_name']!='DOCTOR' or doctor['department_id']!=department_id or not doctor['is_active'] or not doctor['account_ok']:
                raise bad_request('Lãnh đạo phải là bác sĩ đang hoạt động, đã duyệt và thuộc khoa này','DEPARTMENT_LEADER_INVALID')
        current=catalog_model.department_leaders(db,department_id,include_inactive=True)
        existing={row['doctor_profile_id']:row['position'] for row in current}
        if existing!=desired:
            for row in current:
                if desired.get(row['doctor_profile_id'])!=row['position']:
                    catalog_model.end_leadership(db, user['user_id'], row['leadership_id'])
            for did,position in desired.items():
                if existing.get(did)!=position:
                    catalog_model.appoint_leadership(db, department_id, did, position, user['user_id'])
            department=catalog_model.advance_leadership_version(db, department_id)
        data,doctors=_department(db,department,True)
    return {'department':data,'doctors':doctors}


def upload_department_image(department_id,file_storage):
    with get_db_connection() as db:
        if not catalog_model.get_department(db,department_id): raise not_found('Không tìm thấy chuyên khoa','DEPARTMENT_NOT_FOUND')
    return {'url':uploads.save_article_image(file_storage)}


def require_active_department(db, department_id):
    """Check department availability without changing the caller's transaction."""
    department = catalog_model.get_department(db, department_id)
    if department is None or not department['is_active']:
        raise bad_request('Chuyên khoa không tồn tại hoặc đã ngưng hoạt động', 'DEPARTMENT_INVALID')


_check_department = require_active_department


def list_rooms(department_id, include_inactive):
    with get_db_connection() as db:
        rows = catalog_model.list_rooms(db, department_id, include_inactive)
    return {'items': [_present(r) for r in rows]}


def create_room(fields):
    with get_db_connection() as db:
        require_active_department(db, fields['department_id'])
        if catalog_model.room_name_exists(db, fields['department_id'], fields['room_name']):
            raise conflict('Phòng cùng tên đã tồn tại trong chuyên khoa', 'DUPLICATE_ROOM')
        room_id = catalog_model.create_room(db, fields)
        row = catalog_model.get_room(db, room_id)
    return {'room': _present(row)}


def update_room(room_id, fields):
    with get_db_connection() as db:
        current = catalog_model.get_room(db, room_id)
        if current is None:
            raise not_found('Không tìm thấy phòng', 'ROOM_NOT_FOUND')
        if 'department_id' in fields and fields['department_id'] != current['department_id']:
            require_active_department(db, fields['department_id'])
        dept = fields.get('department_id', current['department_id'])
        name = fields.get('room_name', current['room_name'])
        if ('department_id' in fields or 'room_name' in fields) and \
                catalog_model.room_name_exists(db, dept, name, room_id):
            raise conflict('Phòng cùng tên đã tồn tại trong chuyên khoa', 'DUPLICATE_ROOM')
        catalog_model.update_room(db, room_id, fields)
        row = catalog_model.get_room(db, room_id)
    return {'room': _present(row)}


def _members(db, department_id):
    department=catalog_model.get_department(db,department_id)
    if not department:raise not_found('Không tìm thấy khoa','DEPARTMENT_NOT_FOUND')
    data,doctors=_department(db,department,True)
    leaders=catalog_model.department_leaders(db,department_id,include_inactive=True)
    positions={r['doctor_profile_id']:r['position'] for r in leaders}
    return {'department':data,'version':department['version'],
            'items':[{**row,'position':positions.get(row['doctor_profile_id'],'DOCTOR')} for row in doctors]}


def get_members(department_id):
    with get_db_connection() as db:return _members(db,department_id)


def add_member(actor, department_id, fields):
    did=fields['doctor_profile_id']
    with get_db_connection() as db:
        catalog_model.lock_memberships(db)
        source=fields['expected_source_department_id']
        for dep_id in sorted({source,department_id}):
            if not catalog_model.get_department_for_update(db,dep_id):raise not_found('Không tìm thấy khoa','DEPARTMENT_NOT_FOUND')
        department=catalog_model.get_department(db,department_id)
        if department['version']!=fields['expected_version']:raise conflict('Khoa đã thay đổi, hãy tải lại','DEPARTMENT_VERSION_CONFLICT')
        if not department['is_active']:raise conflict('Khoa đã ngừng hoạt động','DEPARTMENT_INACTIVE')
        identity=doctor_model.lock_leadership_identity(db,did)
        doctor=doctor_model.get_by_id(db,did)
        if not doctor or not identity or identity['role_name']!='DOCTOR' or not doctor['is_active'] or not doctor['account_ok']:
            raise bad_request('Bác sĩ chưa được duyệt, ngừng hoạt động hoặc không hợp lệ','DEPARTMENT_MEMBER_INVALID')
        if doctor['department_id']!=source:raise conflict('Bác sĩ đã chuyển khoa, hãy tải lại','MEMBER_SOURCE_CHANGED')
        if source==department_id:raise conflict('Bác sĩ đã thuộc khoa này','MEMBER_ALREADY_EXISTS')
        if db.execute('SELECT 1 FROM department_leadership WHERE doctor_profile_id=%s AND ended_at IS NULL',(did,)).fetchone():
            raise conflict('Cần thu hồi chức vụ tại khoa cũ trước khi chuyển','DOCTOR_LEADERSHIP_ACTIVE')
        if not catalog_model.check_source_deputies(db,source):raise conflict('Khoa cũ sẽ vượt giới hạn phó khoa sau khi chuyển','SOURCE_DEPUTY_LIMIT')
        count=db.execute('SELECT count(*) n FROM doctor_profile WHERE department_id=%s',(department_id,)).fetchone()['n']+1
        leaders=catalog_model.department_leaders(db,department_id,include_inactive=True)
        if fields['position']=='HEAD' and any(r['position']=='HEAD' for r in leaders):raise conflict('Khoa đã có trưởng khoa','HEAD_ALREADY_EXISTS')
        if fields['position']=='DEPUTY' and sum(r['position']=='DEPUTY' for r in leaders)>=(3 if count>20 else 2):raise conflict('Khoa đã đủ phó khoa','DEPUTY_LIMIT')
        doctor_model.update_profile(db,did,{'department_id':department_id})
        catalog_model.record_membership_transfer(db,did,source,department_id,actor['user_id'])
        if fields['position']!='DOCTOR':catalog_model.appoint_leadership(db,department_id,did,fields['position'],actor['user_id'])
        catalog_model.advance_leadership_version(db,source)
        catalog_model.advance_leadership_version(db,department_id)
        return _members(db,department_id)


def revoke_member_role(actor,department_id,doctor_id,expected_version):
    with get_db_connection() as db:
        catalog_model.lock_memberships(db)
        department=catalog_model.get_department_for_update(db,department_id)
        if not department:raise not_found('Không tìm thấy khoa','DEPARTMENT_NOT_FOUND')
        if department['version']!=expected_version:raise conflict('Khoa đã thay đổi, hãy tải lại','DEPARTMENT_VERSION_CONFLICT')
        doctor_model.lock_leadership_identity(db,doctor_id)
        leaders=catalog_model.department_leaders(db,department_id,include_inactive=True)
        current=[r for r in leaders if r['doctor_profile_id']==doctor_id]
        if not current:raise conflict('Bác sĩ không giữ chức vụ tại khoa này','MEMBER_NOT_LEADER')
        for row in current:catalog_model.end_leadership(db,actor['user_id'],row['leadership_id'])
        catalog_model.advance_leadership_version(db,department_id)
        return _members(db,department_id)
