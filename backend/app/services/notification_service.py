from backend.app.repositories import notification_repository as queries
from backend.app.utils.errors import not_found
from backend.app.config.database import get_db_connection
from backend.app.repositories import notification_repository as model
from backend.app.utils.serialization import jsonable


def notify_encounter(db, encounter_id, event_key, kind, title, content):
    owner = queries.get_encounter_owner(db, encounter_id)
    if owner and owner['user_id'] is not None:
        return model.create_once(db, owner['user_id'], event_key, kind, title, content, encounter_id)


def notify_status(db, encounter_id, log_id, status, note):
    titles = {'HOLDING': 'Đang giữ chỗ khám trong 10 phút', 'CONFIRMED': 'Đặt lịch khám đã được xác nhận',
              'CHECKED_IN': 'Đã tiếp nhận bệnh nhân', 'IN_PROGRESS': 'Bác sĩ đã bắt đầu khám',
              'COMPLETED': 'Lượt khám đã hoàn tất', 'CANCELLED': 'Lượt khám đã hủy',
              'EXPIRED': 'Giữ chỗ khám đã hết hạn', 'NO_SHOW': 'Lượt khám được đánh dấu vắng mặt'}
    notify_encounter(db, encounter_id, f'encounter-status:{log_id}', 'ENCOUNTER_STATUS',
                     titles[status], f'Lượt khám #{encounter_id}: {note or status}')


def listing(actor, page, size, unread_only):
    with get_db_connection() as db:
        rows, total = model.listing(db, actor['user_id'], page, size, unread_only)
    return {'items': [public(r) for r in rows], 'total': total, 'page': page, 'page_size': size}


def public(row):
    data = dict(row)
    data['is_read'] = bool(data['is_read'])
    data.pop('event_key', None)
    return jsonable(data)


def unread_count(actor):
    with get_db_connection() as db:
        count = queries.count_unread(db, actor)['n']
    return {'unread_count': count}


def mark_read(actor, notification_id):
    with get_db_connection() as db:
        row = queries.mark_read(db, actor, notification_id)
        if row is None:
            raise not_found('Không tìm thấy thông báo', 'NOTIFICATION_NOT_FOUND')
    return {'notification': public(row)}


def read_all(actor):
    with get_db_connection() as db:
        count = queries.mark_all_read(db, actor)
    return {'updated_count': count}
