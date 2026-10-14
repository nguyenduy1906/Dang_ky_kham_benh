import secrets
from psycopg import errors as pg_errors

from backend.app.core import constants
from backend.app.core.security import hash_password
from backend.app.core.errors import bad_request, conflict, forbidden, not_found
from backend.app.db.database import get_db_connection
from backend.app.models import patient_model, auth_model
from backend.app.utils.database_helpers import jsonable

STAFF_READ = (constants.ROLE_ADMIN, constants.ROLE_RECEPTIONIST,
              constants.ROLE_DOCTOR, constants.ROLE_NURSE)
STAFF_WRITE = (constants.ROLE_ADMIN, constants.ROLE_RECEPTIONIST)


def _present(row, actor=None):
    data = dict(row)
    if actor and actor['role_name'] == constants.ROLE_USER and not _is_owner(actor, row):
        data = {key: data[key] for key in ('patient_id', 'user_id', 'full_name', 'dob', 'phone',
                                         'relationship', 'archived_at')}
    data['is_archived'] = data['archived_at'] is not None
    return jsonable(data)


def _is_owner(actor, patient):
    return patient['user_id'] is not None and patient['user_id'] == actor['user_id']


def _load_visible(db, actor, patient_id):
    patient = patient_model.get_patient(db, patient_id)
    # USER không sở hữu hồ sơ thì coi như không tồn tại để không lộ thông tin.
    if patient is None or (actor['role_name'] == constants.ROLE_USER
                           and not patient_model.can_book(db, patient_id, actor['user_id'])):
        raise not_found('Không tìm thấy hồ sơ bệnh nhân', 'PATIENT_NOT_FOUND')
    if actor['role_name'] not in STAFF_READ + (constants.ROLE_USER,):
        raise forbidden()
    if (actor['role_name'] == constants.ROLE_NURSE
            and not patient_model.nurse_can_view(db, patient_id, actor['user_id'])):
        raise not_found('Không tìm thấy hồ sơ bệnh nhân', 'PATIENT_NOT_FOUND')
    return patient


def _require_write(actor, patient):
    if actor['role_name'] in STAFF_WRITE or _is_owner(actor, patient):
        return
    raise forbidden()


def list_patients(actor, query):
    owner_filter = actor['user_id'] if actor['role_name'] == constants.ROLE_USER else None
    if owner_filter is None and actor['role_name'] not in STAFF_READ:
        raise forbidden()
    with get_db_connection() as db:
        rows, total = patient_model.list_patients(
            db, user_id=owner_filter,
            nurse_id=actor['user_id'] if actor['role_name'] == constants.ROLE_NURSE else None,
            q=query['q'], include_archived=query['include_archived'],
            limit=query['page_size'], offset=(query['page'] - 1) * query['page_size'])
    return {'items': [_present(r, actor) for r in rows], 'total': total,
            'page': query['page'], 'page_size': query['page_size']}


def _account_for_patient(db, fields):
    account = auth_model.get_user_by_phone(db, fields['phone'])
    created = False
    if account is None:
        role = auth_model.get_role_by_name(db, constants.ROLE_USER)
        if role is None:
            raise conflict('Chưa có vai trò USER, hãy chạy seed_db', 'ROLE_NOT_SEEDED')
        try:
            with db.transaction():
                uid = auth_model.create_user(db, role_id=role['role_id'], full_name=fields['full_name'],
                    email=None, phone=fields['phone'], password_hash=hash_password(secrets.token_urlsafe(48)),
                    approval_status=constants.APPROVAL_APPROVED)
            account = auth_model.get_user_by_id(db, uid)
            created = True
        except pg_errors.UniqueViolation:
            account = auth_model.get_user_by_phone(db, fields['phone'])
    if (account is None or account['deleted_at'] is not None
            or account['account_status'] != constants.ACCOUNT_ACTIVE
            or account['approval_status'] != constants.APPROVAL_APPROVED
            or account['role_name'] != constants.ROLE_USER):
        raise conflict('Không thể dùng tài khoản của số điện thoại này cho hồ sơ bệnh nhân',
                       'PATIENT_ACCOUNT_UNAVAILABLE')
    return account, created


def create_patient(actor, fields):
    role = actor['role_name']
    if role not in STAFF_WRITE + (constants.ROLE_USER,):
        raise forbidden()
    fields = dict(fields)
    confirmed = fields.pop('confirm_shared_phone', False)
    requested_owner = fields.pop('user_id', None)
    same_phone = fields['phone'] == actor.get('phone')
    relative = (fields.get('relationship', 'SELF') != 'SELF'
                or ' '.join(fields['full_name'].split()).casefold()
                != ' '.join(actor['full_name'].split()).casefold())
    if role == constants.ROLE_USER and same_phone and relative and not confirmed:
        raise conflict('Số điện thoại trùng tài khoản của bạn. Xác nhận lưu hồ sơ người thân '
                       'và bệnh án của người này trong tài khoản của bạn?', 'CONFIRM_SHARED_PHONE')
    with get_db_connection() as db:
        db.execute('SELECT pg_advisory_xact_lock(78124003)')
        matches = patient_model.find_identity(db, fields)
        if len(matches) > 1:
            raise conflict('Có nhiều hồ sơ trùng thông tin; cần lễ tân kiểm tra', 'PATIENT_IDENTITY_CONFLICT')
        row = matches[0] if matches else None
        if row:
            if (row['phone'] != fields['phone']
                    or ' '.join(row['full_name'].split()).casefold()
                    != ' '.join(fields['full_name'].split()).casefold()
                    or (row['dob'] and fields.get('dob') and row['dob'] != fields['dob'])
                    or (row['id_card'] and fields.get('id_card') and row['id_card'] != fields['id_card'])):
                raise conflict('Thông tin không khớp hồ sơ đã lưu; cần lễ tân kiểm tra',
                               'PATIENT_IDENTITY_CONFLICT')
            if row['archived_at'] is not None:
                raise conflict('Hồ sơ đã được lưu trữ', 'PATIENT_ARCHIVED')
        account, created = _account_for_patient(db, fields)
        if requested_owner is not None and requested_owner != account['user_id']:
            raise bad_request('user_id phải là tài khoản của số điện thoại bệnh nhân')
        fields['user_id'] = account['user_id']
        if row:
            if row['user_id'] is None:
                db.execute('UPDATE patient SET user_id=%s WHERE patient_id=%s',
                           (account['user_id'], row['patient_id']))
                row = patient_model.get_patient(db, row['patient_id'])
            elif row['user_id'] != account['user_id']:
                raise conflict('Hồ sơ đang liên kết với tài khoản khác; cần lễ tân kiểm tra',
                               'PATIENT_IDENTITY_CONFLICT')
        else:
            row = patient_model.create_patient(db, fields)
        if role == constants.ROLE_USER and actor['user_id'] != account['user_id']:
            relationship = fields.get('relationship') or 'OTHER'
            patient_model.add_delegate(db, row['patient_id'], actor['user_id'],
                                       relationship if relationship != 'SELF' else 'OTHER')
    return {'patient': _present(row, actor), 'patient_reused': bool(matches),
            'account_created': created, 'account_exists': not created,
            'message': ('Đã tạo tài khoản theo số điện thoại; bệnh nhân dùng Quên mật khẩu để đăng nhập'
                        if created else 'Tài khoản đã tồn tại; sử dụng hồ sơ bệnh nhân đã chọn')}


def get_patient(actor, patient_id):
    with get_db_connection() as db:
        return {'patient': _present(_load_visible(db, actor, patient_id), actor)}


def update_patient(actor, patient_id, fields):
    with get_db_connection() as db:
        db.execute('SELECT pg_advisory_xact_lock(78124003)')
        patient = _load_visible(db, actor, patient_id)
        _require_write(actor, patient)
        if patient['archived_at'] is not None:
            raise conflict('Hồ sơ đã được lưu trữ, không thể sửa', 'PATIENT_ARCHIVED')
        if 'phone' in fields and fields['phone'] != patient['phone']:
            raise bad_request('Đổi số điện thoại ở tài khoản chủ hồ sơ để giữ đúng liên kết',
                              'PATIENT_ACCOUNT_PHONE_MISMATCH')
        identity = {**patient, **fields}
        if identity.get('phone'):
            matches = patient_model.find_identity(db, identity)
            if any(row['patient_id'] != patient_id for row in matches):
                raise conflict('Thông tin trùng hồ sơ bệnh nhân khác', 'PATIENT_IDENTITY_CONFLICT')
        row = patient_model.update_patient(db, patient_id, fields)
    return {'patient': _present(row)}


def archive_patient(actor, patient_id):
    with get_db_connection() as db:
        patient = _load_visible(db, actor, patient_id)
        _require_write(actor, patient)
        row = patient_model.archive_patient(db, patient_id)
        if row is None:
            raise conflict('Hồ sơ đã được lưu trữ trước đó', 'PATIENT_ARCHIVED')
    return {'patient': _present(row)}


def list_encounters(actor, patient_id, page, page_size):
    with get_db_connection() as db:
        _load_visible(db, actor, patient_id)
        rows, total = patient_model.list_encounters(
            db, patient_id, page_size, (page - 1) * page_size,
            user_id=actor['user_id'] if actor['role_name'] == constants.ROLE_USER else None,
            nurse_id=actor['user_id'] if actor['role_name'] == constants.ROLE_NURSE else None)
    return {'items': [jsonable(dict(r)) for r in rows], 'total': total,
            'page': page, 'page_size': page_size}
