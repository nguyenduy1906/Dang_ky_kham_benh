from backend.app.repositories import nurse_assignment_repository as queries
from psycopg import errors as pg_errors

from backend.app.config import constants
from backend.app.utils.errors import bad_request, conflict, not_found
from backend.app.config.database import get_db_connection
from backend.app.repositories import nurse_assignment_repository as model, schedule_repository
from backend.app.utils.serialization import jsonable


def list_assignments(query, nurse_id=None):
    with get_db_connection() as db:
        rows, total = model.list_assignments(
            db, nurse_id=nurse_id if nurse_id is not None else query['nurse_id'],
            schedule_id=query['schedule_id'], include_revoked=query['include_revoked'],
            limit=query['page_size'], offset=(query['page'] - 1) * query['page_size'])
    return {'items': [jsonable(dict(row)) for row in rows], 'total': total,
            'page': query['page'], 'page_size': query['page_size']}


def create_assignment(actor, fields):
    with get_db_connection() as db:
        # Khóa tài khoản để vai trò/trạng thái không đổi trong lúc phân công.
        nurse = queries.lock_nurse_account(db, fields)
        if nurse is None or nurse['deleted_at'] is not None:
            raise not_found('Không tìm thấy tài khoản y tá', 'NURSE_NOT_FOUND')
        if nurse['role_name'] != constants.ROLE_NURSE:
            raise bad_request('Tài khoản phải có vai trò NURSE', 'NOT_A_NURSE')
        if (nurse['account_status'] != constants.ACCOUNT_ACTIVE
                or nurse['approval_status'] != constants.APPROVAL_APPROVED):
            raise bad_request('Tài khoản y tá chưa được duyệt hoặc bị khóa', 'NURSE_INACTIVE')
        if schedule_repository.get_for_update(db, fields['schedule_id']) is None:
            raise not_found('Không tìm thấy ca làm việc', 'SCHEDULE_NOT_FOUND')
        try:
            assignment_id = model.create_assignment(db, actor['user_id'], fields)
        except pg_errors.UniqueViolation:
            raise conflict('Y tá đã được phân công trong ca này', 'DUPLICATE_NURSE_ASSIGNMENT') from None
        row = model.get_assignment(db, assignment_id)
    return {'assignment': jsonable(dict(row))}


def revoke_assignment(actor, assignment_id):
    with get_db_connection() as db:
        if model.revoke_assignment(db, assignment_id, actor['user_id']) is None:
            if model.get_assignment(db, assignment_id) is None:
                raise not_found('Không tìm thấy phân công', 'ASSIGNMENT_NOT_FOUND')
            raise conflict('Phân công đã được thu hồi', 'ASSIGNMENT_ALREADY_REVOKED')
        row = model.get_assignment(db, assignment_id)
    return {'assignment': jsonable(dict(row))}
