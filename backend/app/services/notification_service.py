from backend.app.utils.business_codes import business_code
from backend.app.core.errors import not_found
from backend.app.db.database import get_db_connection
from backend.app.models import notification_model as model
from backend.app.utils.database_helpers import jsonable


def notify_encounter(db, encounter_id, event_key, kind, title, content):
    owner = model.encounter_owner(db, encounter_id)
    if owner and owner['user_id'] is not None:
        return model.create_once(db, owner['user_id'], event_key, kind, title, content, encounter_id)


def notify_status(db, encounter_id, log_id, status, note):
    titles = {'HOLDING': 'Đang giữ chỗ khám trong 10 phút', 'CONFIRMED': 'Đặt lịch khám đã được xác nhận',
              'CHECKED_IN': 'Đã tiếp nhận bệnh nhân', 'IN_PROGRESS': 'Bác sĩ đã bắt đầu khám',
              'COMPLETED': 'Lượt khám đã hoàn tất', 'CANCELLED': 'Lượt khám đã hủy',
              'EXPIRED': 'Giữ chỗ khám đã hết hạn', 'NO_SHOW': 'Lượt khám được đánh dấu vắng mặt'}
    notify_encounter(db, encounter_id, f'encounter-status:{log_id}', 'ENCOUNTER_STATUS',
                     titles[status], f'Lượt khám {business_code("LK", encounter_id)}: {note or status}')
    from backend.app.services.admin_notification_service import publish
    publish(db, {'key':f'admin-encounter-status:{log_id}', 'kind':'CANCELLATION' if status=='CANCELLED' else 'ENCOUNTER',
                 'reference':'ENCOUNTER','id':encounter_id,'title':titles[status],
                 'content':f'Lượt khám {business_code("LK", encounter_id)}: {note or status}'})



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
        count = model.unread_count(db, actor['user_id'])
    return {'unread_count': count}


def mark_read(actor, notification_id):
    with get_db_connection() as db:
        row = model.mark_read(db, notification_id, actor['user_id'])
        if row is None:
            raise not_found('Không tìm thấy thông báo', 'NOTIFICATION_NOT_FOUND')
    return {'notification': public(row)}


def read_all(actor):
    with get_db_connection() as db:
        count = model.read_all(db, actor['user_id'])
    return {'updated_count': count}
