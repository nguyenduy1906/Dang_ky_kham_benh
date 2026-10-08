from backend.app.core import constants
from backend.app.core.errors import bad_request, conflict, forbidden, not_found
from backend.app.db.database import get_db_connection
from backend.app.models import patient_model, user_model
from backend.app.models._sql import jsonable

STAFF_READ = (constants.ROLE_ADMIN, constants.ROLE_RECEPTIONIST,
              constants.ROLE_DOCTOR, constants.ROLE_NURSE)
STAFF_WRITE = (constants.ROLE_ADMIN, constants.ROLE_RECEPTIONIST)


def _present(row):
    data = dict(row)
    data['is_archived'] = data['archived_at'] is not None
    return jsonable(data)


def _is_owner(actor, patient):
    return patient['user_id'] is not None and patient['user_id'] == actor['user_id']


def _load_visible(db, actor, patient_id):
    patient = patient_model.get_patient(db, patient_id)
    # USER không sở hữu hồ sơ thì coi như không tồn tại để không lộ thông tin.
    if patient is None or (actor['role_name'] == constants.ROLE_USER and not _is_owner(actor, patient)):
        raise not_found('Không tìm thấy hồ sơ bệnh nhân', 'PATIENT_NOT_FOUND')
    if actor['role_name'] not in STAFF_READ + (constants.ROLE_USER,):
        raise forbidden()
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
            db, user_id=owner_filter, q=query['q'], include_archived=query['include_archived'],
            limit=query['page_size'], offset=(query['page'] - 1) * query['page_size'])
    return {'items': [_present(r) for r in rows], 'total': total,
            'page': query['page'], 'page_size': query['page_size']}


def create_patient(actor, fields):
    role = actor['role_name']
    with get_db_connection() as db:
        if role == constants.ROLE_USER:
            fields['user_id'] = actor['user_id']
        elif role in STAFF_WRITE:
            if fields.get('user_id') is not None:
                owner = user_model.get_user_by_id(db, fields['user_id'])
                if owner is None or owner['deleted_at'] is not None:
                    raise bad_request('Tài khoản chủ hồ sơ không tồn tại', 'USER_NOT_FOUND')
        else:
            raise forbidden()
        row = patient_model.create_patient(db, fields)
    return {'patient': _present(row)}


def get_patient(actor, patient_id):
    with get_db_connection() as db:
        return {'patient': _present(_load_visible(db, actor, patient_id))}


def update_patient(actor, patient_id, fields):
    with get_db_connection() as db:
        patient = _load_visible(db, actor, patient_id)
        _require_write(actor, patient)
        if patient['archived_at'] is not None:
            raise conflict('Hồ sơ đã được lưu trữ, không thể sửa', 'PATIENT_ARCHIVED')
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
        rows, total = patient_model.list_encounters(db, patient_id, page_size, (page - 1) * page_size)
    return {'items': [jsonable(dict(r)) for r in rows], 'total': total,
            'page': page, 'page_size': page_size}
