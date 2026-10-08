from psycopg import errors as pg_errors

from backend.app.core import constants, uploads
from backend.app.core.errors import bad_request, conflict, not_found
from backend.app.db.database import get_db_connection
from backend.app.models import department_model, doctor_model, user_model
from backend.app.models._sql import flags, jsonable

_PRIVATE = ('user_id', 'email', 'phone', 'account_ok')


def _present(row, full):
    data = flags(row, 'is_active', 'account_ok')
    if not full:
        for key in _PRIVATE:
            data.pop(key, None)
    return jsonable(data)


def list_doctors(query, include_inactive):
    with get_db_connection() as db:
        rows, total = doctor_model.list_doctors(
            db, department_id=query['department_id'], q=query['q'],
            include_inactive=include_inactive, limit=query['page_size'],
            offset=(query['page'] - 1) * query['page_size'])
    return {'items': [_present(r, include_inactive) for r in rows], 'total': total,
            'page': query['page'], 'page_size': query['page_size']}


def get_doctor(doctor_profile_id, is_admin):
    with get_db_connection() as db:
        row = doctor_model.get_by_id(db, doctor_profile_id)
    visible = row and (is_admin or (row['is_active'] and row['account_ok']))
    if not visible:
        raise not_found('Không tìm thấy bác sĩ', 'DOCTOR_NOT_FOUND')
    return {'doctor': _present(row, is_admin)}


def _check_department(db, department_id):
    department = department_model.get_department(db, department_id)
    if department is None or not department['is_active']:
        raise bad_request('Chuyên khoa không tồn tại hoặc đã ngưng hoạt động', 'DEPARTMENT_INVALID')


def create_doctor(fields):
    with get_db_connection() as db:
        user = user_model.get_user_by_id(db, fields['user_id'])
        if user is None or user['deleted_at'] is not None:
            raise not_found('Không tìm thấy tài khoản', 'USER_NOT_FOUND')
        if user['role_name'] != constants.ROLE_DOCTOR:
            raise bad_request('Tài khoản phải có vai trò DOCTOR', 'NOT_A_DOCTOR')
        _check_department(db, fields['department_id'])
        try:
            profile_id = doctor_model.create_profile(db, fields)
        except pg_errors.UniqueViolation:
            raise conflict('Tài khoản này đã có hồ sơ bác sĩ', 'DUPLICATE_DOCTOR_PROFILE') from None
        row = doctor_model.get_by_id(db, profile_id)
    return {'doctor': _present(row, True)}


def update_doctor(doctor_profile_id, fields):
    with get_db_connection() as db:
        if doctor_model.get_by_id(db, doctor_profile_id) is None:
            raise not_found('Không tìm thấy bác sĩ', 'DOCTOR_NOT_FOUND')
        if 'department_id' in fields:
            _check_department(db, fields['department_id'])
        doctor_model.update_profile(db, doctor_profile_id, fields)
        row = doctor_model.get_by_id(db, doctor_profile_id)
    return {'doctor': _present(row, True)}


def _own_profile(db, user):
    row = doctor_model.get_by_user_id(db, user['user_id'])
    if row is None:
        raise not_found('Tài khoản chưa có hồ sơ bác sĩ, hãy liên hệ quản trị viên', 'DOCTOR_PROFILE_MISSING')
    return row


def get_own_profile(user):
    with get_db_connection() as db:
        return {'doctor': _present(_own_profile(db, user), True)}


def update_own_profile(user, fields):
    with get_db_connection() as db:
        current = _own_profile(db, user)
        doctor_model.update_profile(db, current['doctor_profile_id'], fields)
        row = doctor_model.get_by_id(db, current['doctor_profile_id'])
    return {'doctor': _present(row, True)}


def upload_avatar(user, file_storage):
    if file_storage is None or not file_storage.filename:
        raise bad_request("Thiếu file ảnh (trường form 'file')", 'MISSING_FILE')
    with get_db_connection() as db:
        current = _own_profile(db, user)
    new_url = uploads.save_avatar(file_storage)
    try:
        with get_db_connection() as db:
            doctor_model.update_profile(db, current['doctor_profile_id'], {'avatar_url': new_url})
            row = doctor_model.get_by_id(db, current['doctor_profile_id'])
    except Exception:
        uploads.delete_avatar(new_url)
        raise
    uploads.delete_avatar(current['avatar_url'])
    return {'doctor': _present(row, True)}
