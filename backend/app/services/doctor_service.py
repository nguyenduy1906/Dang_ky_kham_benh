from psycopg import errors as pg_errors

from backend.app.core import constants
from backend.app.core.errors import bad_request, conflict, forbidden, not_found
from backend.app.db.database import get_db_connection
from backend.app.models import doctor_model, auth_model
from backend.app.utils.database_helpers import flags, jsonable
from backend.app.services import auth_service, catalog_service

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


_check_department = catalog_service.require_active_department


def create_doctor(fields):
    with get_db_connection() as db:
        user = auth_model.get_user_by_id(db, fields['user_id'])
        if user is None or user['deleted_at'] is not None:
            raise not_found('Không tìm thấy tài khoản', 'USER_NOT_FOUND')
        if user['role_name'] != constants.ROLE_DOCTOR:
            raise bad_request('Tài khoản phải có vai trò DOCTOR', 'NOT_A_DOCTOR')
        catalog_service.require_active_department(db, fields['department_id'])
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
            catalog_service.require_active_department(db, fields['department_id'])
        try:
            doctor_model.update_profile(db, doctor_profile_id, fields)
        except pg_errors.CheckViolation:
            raise conflict('Hãy gỡ phân công trưởng/phó khoa trước khi chuyển bác sĩ sang khoa khác','DOCTOR_LEADERSHIP_ACTIVE') from None
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
    return _replace_avatar(current['doctor_profile_id'], file_storage)


def upload_admin_avatar(user, doctor_profile_id, file_storage):
    if user['role_name'] != constants.ROLE_ADMIN:
        raise forbidden()
    return _replace_avatar(doctor_profile_id, file_storage)


def _replace_avatar(doctor_profile_id, file_storage):
    with get_db_connection() as db:
        current = doctor_model.get_by_id(db, doctor_profile_id)
        if current is None:
            raise not_found('Không tìm thấy bác sĩ', 'DOCTOR_NOT_FOUND')
    auth_service.replace_avatar(current['user_id'], file_storage)
    with get_db_connection() as db:
        row = doctor_model.get_by_id(db, doctor_profile_id)
    return {'doctor': _present(row, True)}
