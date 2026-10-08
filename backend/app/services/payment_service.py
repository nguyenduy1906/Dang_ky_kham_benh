"""Thanh toán mô phỏng; khóa ca → lượt khám → payment trong cùng transaction."""
import os
from datetime import timedelta
from uuid import uuid4

from backend.app.core.errors import conflict, not_found
from backend.app.db.database import get_db_connection
from backend.app.models import payment_model as model, encounter_model
from backend.app.models._sql import jsonable
from backend.app.services import encounter_service as encounters, notification_service as notifications


def _financial_access(db, actor, encounter_id):
    encounters.require_role(actor, 'USER', 'ADMIN', 'RECEPTIONIST')
    return encounters._visible(db, actor, encounter_id)


def _snapshot(encounter):
    if encounter['consultation_fee_snapshot'] is None or encounter['deposit_amount_snapshot'] is None:
        raise conflict('Lượt khám chưa có giá lịch sử; không tự lấy giá hiện tại để thu tiền', 'PRICE_SNAPSHOT_MISSING')


def _locked_payment(db, actor, payment_id):
    peek = model.get(db, payment_id)
    if peek is None:
        raise not_found('Không tìm thấy giao dịch', 'PAYMENT_NOT_FOUND')
    _financial_access(db, actor, peek['encounter_id'])
    encounter, schedules = encounters.locked_context(db, peek['encounter_id'])
    _financial_access(db, actor, peek['encounter_id'])
    return model.get(db, payment_id, lock=True), encounter, schedules[encounter['schedule_id']]


def _response(db, payment, actor, *, refund=None):
    out = {'payment': jsonable(payment),
           'encounter': encounters._present(encounters._visible(db, actor, payment['encounter_id']))}
    if refund is not None:
        out['refund'] = jsonable(refund)
    return out


def list_payments(actor, encounter_id, page, size):
    with get_db_connection() as db:
        _financial_access(db, actor, encounter_id)
        rows, total = model.list_for_encounter(db, encounter_id, page, size)
    return {'items': jsonable(rows), 'total': total, 'page': page, 'page_size': size}


def get_payment(actor, payment_id):
    with get_db_connection() as db:
        row = model.get(db, payment_id)
        if row is None:
            raise not_found('Không tìm thấy giao dịch', 'PAYMENT_NOT_FOUND')
        _financial_access(db, actor, row['encounter_id'])
    return {'payment': jsonable(row)}


def create_intent(actor, encounter_id, fields):
    encounters.require_role(actor, 'USER')
    expired = False
    with get_db_connection() as db:
        _financial_access(db, actor, encounter_id)
        encounter, schedules = encounters.locked_context(db, encounter_id)
        _financial_access(db, actor, encounter_id)
        _snapshot(encounter)
        if encounter['encounter_type'] != 'ONLINE' or encounter['encounter_status'] != 'HOLDING':
            raise conflict('Chỉ tạo phiên cọc cho online đang giữ chỗ', 'INVALID_ENCOUNTER_STATUS')
        schedule = schedules[encounter['schedule_id']]
        expired = encounters.expire_locked(db, encounter, schedule, actor['user_id'])
        if not expired:
            if schedule['schedule_status'] in ('CLOSED', 'UNAVAILABLE'):
                raise conflict('Ca đã đóng/báo nghỉ, không nhận cọc', 'SCHEDULE_UNAVAILABLE')
            if model.paid_total(db, encounter_id, 'DEPOSIT'):
                raise conflict('Đã có tiền cọc; không tạo giao dịch thu thêm', 'DEPOSIT_ALREADY_PAID')
            pending = db.execute("SELECT * FROM payment WHERE encounter_id=%s AND payment_type='DEPOSIT' "
                                 "AND transaction_status='PENDING' ORDER BY payment_id LIMIT 1 FOR UPDATE", (encounter_id,)).fetchone()
            if pending:
                if pending['payment_method'] != fields['payment_method']:
                    raise conflict('Có phiên đang chờ với phương thức khác; xử lý phiên đó trước', 'PAYMENT_INTENT_EXISTS')
                row, created = pending, False
            else:
                row = model.create(db, {'encounter_id': encounter_id, 'payment_type': 'DEPOSIT',
                    'amount': encounter['deposit_amount_snapshot'], **fields, 'transaction_status': 'PENDING',
                    'transaction_code': 'DEMO-' + uuid4().hex, 'created_by_id': actor['user_id']})
                created = True
            result = _response(db, row, actor)
    # Raise sau khi commit để giữ trạng thái EXPIRED/quota/log.
    if expired:
        raise conflict('Giữ chỗ đã hết hạn', 'HOLD_EXPIRED')
    return result, created


def collect_exam_fee(actor, encounter_id, fields):
    encounters.require_role(actor, 'ADMIN', 'RECEPTIONIST')
    with get_db_connection() as db:
        encounter, _ = encounters.locked_context(db, encounter_id)
        _financial_access(db, actor, encounter_id)
        _snapshot(encounter)
        if encounter['encounter_status'] not in ('CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'):
            raise conflict('Chỉ thu phí lượt đã tiếp nhận, đang khám hoặc hoàn tất', 'INVALID_ENCOUNTER_STATUS')
        paid = model.paid_total(db, encounter_id)
        remaining = encounter['consultation_fee_snapshot'] - paid
        if remaining < 0:
            raise conflict('Tổng thu vượt giá đã chốt; cần đối soát', 'PAYMENT_TOTAL_CONFLICT')
        if remaining == 0:
            last = db.execute("SELECT * FROM payment WHERE encounter_id=%s AND payment_type='EXAM_FEE' "
                              "AND transaction_status='SUCCESS' ORDER BY payment_id DESC LIMIT 1", (encounter_id,)).fetchone()
            return {'payment': jsonable(last), 'amount_due': 0, 'message': 'Đã thanh toán đủ giá khám đã chốt'}, False
        pending = db.execute("SELECT 1 FROM payment WHERE encounter_id=%s AND payment_type='EXAM_FEE' "
                             "AND transaction_status='PENDING'", (encounter_id,)).fetchone()
        if pending:
            raise conflict('Có phiên phí khám chưa xử lý; không thu lần hai', 'PAYMENT_INTENT_EXISTS')
        now = encounters.utc_now()
        row = model.create(db, {'encounter_id': encounter_id, 'payment_type': 'EXAM_FEE', 'amount': remaining,
            **fields, 'transaction_status': 'SUCCESS', 'transaction_code': 'DEMO-' + uuid4().hex,
            'paid_at': now, 'result_received_at': now, 'created_by_id': actor['user_id'], 'processed_by_id': actor['user_id']})
        notifications.notify_encounter(db, encounter_id, f'exam-fee:{row["payment_id"]}', 'PAYMENT',
                                       'Đã thu phí khám', f'Đã thu {remaining:,} đồng cho lượt khám #{encounter_id} (giả lập).')
        result = _response(db, row, actor)
        result['amount_due'] = 0
    return result, True


def _refund_amount(db, payment, actor_id, reason, amount):
    """Một giao dịch hoàn theo chính sách; không nhận số tiền từ client."""
    existing = db.execute("SELECT * FROM payment WHERE original_payment_id=%s AND payment_type='REFUND'",
                           (payment['payment_id'],)).fetchone()
    if existing:
        return existing
    if payment['payment_type'] == 'REFUND' or payment['transaction_status'] != 'SUCCESS':
        raise conflict('Chỉ hoàn giao dịch thu thành công chưa hoàn', 'PAYMENT_NOT_REFUNDABLE')
    if amount <= 0 or amount > payment['amount']:
        raise conflict('Số tiền hoàn không hợp lệ', 'INVALID_REFUND_AMOUNT')
    now = encounters.utc_now()
    refund = model.create(db, {'encounter_id': payment['encounter_id'], 'payment_type': 'REFUND',
        'amount': amount, 'payment_method': payment['payment_method'], 'transaction_status': 'SUCCESS',
        'original_payment_id': payment['payment_id'], 'transaction_code': 'DEMO-REFUND-' + uuid4().hex,
        'paid_at': now, 'refunded_at': now, 'result_received_at': now, 'reason': reason,
        'created_by_id': actor_id, 'processed_by_id': actor_id})
    db.execute("UPDATE payment SET transaction_status='REFUNDED',refunded_at=%s WHERE payment_id=%s",
               (now, payment['payment_id']))
    notifications.notify_encounter(db, payment['encounter_id'], f'refund:{payment["payment_id"]}', 'REFUND',
                                   'Đã hoàn tiền giả lập', f'Hoàn {amount:,} đồng. Lý do: {reason}')
    return refund


def refund(actor, payment_id, reason):
    encounters.require_role(actor, 'ADMIN')
    with get_db_connection() as db:
        payment, encounter, _ = _locked_payment(db, actor, payment_id)
        existing = db.execute("SELECT * FROM payment WHERE original_payment_id=%s AND payment_type='REFUND'", (payment_id,)).fetchone()
        if existing:
            return _response(db, payment, actor, refund=existing)
        if payment['payment_type'] == 'REFUND' or payment['transaction_status'] != 'SUCCESS':
            raise conflict('Chỉ hoàn giao dịch thu thành công chưa hoàn', 'PAYMENT_NOT_REFUNDABLE')
        if encounter['encounter_status'] != 'CANCELLED':
            raise conflict('Hủy lượt khám trước khi hoàn; no-show không được hoàn cọc', 'ENCOUNTER_NOT_CANCELLED')
        if encounter['cancel_origin'] == 'HOSPITAL':
            amount = payment['amount']
        else:
            if payment['payment_type'] != 'DEPOSIT':
                raise conflict('Chính sách bệnh nhân hủy chỉ hoàn tiền cọc', 'PAYMENT_NOT_REFUNDABLE')
            reference = encounter['refund_reference_at'] or encounter['estimated_exam_at']
            if reference is None or encounter['cancelled_at'] is None:
                raise conflict('Thiếu thời điểm hủy/giờ hẹn để xác định chính sách', 'REFUND_REFERENCE_MISSING')
            if reference - encounter['cancelled_at'] < timedelta(hours=12):
                raise conflict('Hủy dưới 12 giờ trước lịch khám: mất cọc', 'REFUND_NOT_ELIGIBLE')
            amount = payment['amount'] // 2
        if amount == 0:
            return {**_response(db, payment, actor), 'refund': None, 'amount_refunded': 0,
                    'message': 'Số tiền hoàn sau làm tròn là 0 đồng'}
        refunded = _refund_amount(db, payment, actor['user_id'], reason, amount)
        result = _response(db, model.get(db, payment_id), actor, refund=refunded)
    return result


def demo_result(actor, payment_id, outcome):
    # Kiểm tra cả ở service để không gọi mô phỏng khi môi trường thật tắt demo.
    if os.environ.get('DEMO_MODE', '0') != '1':
        raise not_found('Không tìm thấy API', 'NOT_FOUND')
    encounters.require_role(actor, 'USER', 'ADMIN')
    with get_db_connection() as db:
        payment, encounter, schedule = _locked_payment(db, actor, payment_id)
        if payment['payment_type'] != 'DEPOSIT' or encounter['encounter_type'] != 'ONLINE':
            raise conflict('API demo chỉ nhận phiên cọc online', 'INVALID_PAYMENT_TYPE')
        _snapshot(encounter)
        status = payment['transaction_status']
        if status in ('SUCCESS', 'REFUNDED'):
            if outcome != 'SUCCESS':
                raise conflict('Không đổi kết quả giao dịch đã xử lý', 'PAYMENT_RESULT_CONFLICT')
            refunded = db.execute("SELECT * FROM payment WHERE original_payment_id=%s AND payment_type='REFUND'", (payment_id,)).fetchone()
            return _response(db, payment, actor, refund=refunded)
        auto_failed = payment['failure_reason'] in ('HOLD_EXPIRED', 'ENCOUNTER_CANCELLED', 'HOSPITAL_CANCELLED')
        if status == 'FAILED' and (payment['result_received_at'] is not None or not auto_failed):
            if outcome != 'FAILED':
                raise conflict('Không đổi kết quả giao dịch đã xử lý', 'PAYMENT_RESULT_CONFLICT')
            return _response(db, payment, actor)
        now = encounters.utc_now()
        if encounter['encounter_status'] == 'HOLDING':
            expired = encounters.expire_locked(db, encounter, schedule, actor['user_id'])
            if expired:
                encounter = encounter_model.lock_encounter(db, encounter['encounter_id'])
        if outcome == 'FAILED':
            row = db.execute("UPDATE payment SET transaction_status='FAILED',result_received_at=%s,processed_by_id=%s,"
                              "failure_reason=COALESCE(failure_reason,'DEMO_FAILED') WHERE payment_id=%s RETURNING *",
                              (now, actor['user_id'], payment_id)).fetchone()
            notifications.notify_encounter(db, encounter['encounter_id'], f'payment-failed:{payment_id}', 'PAYMENT',
                                           'Thanh toán giả lập thất bại', 'Có thể tạo phiên mới nếu giữ chỗ còn hiệu lực.')
            return _response(db, row, actor)
        if payment['amount'] != encounter['deposit_amount_snapshot']:
            raise conflict('Tiền giao dịch không khớp snapshot cọc', 'PAYMENT_AMOUNT_MISMATCH')
        if model.paid_total(db, encounter['encounter_id'], 'DEPOSIT'):
            raise conflict('Lượt khám đã có cọc; không thu lần hai', 'DEPOSIT_ALREADY_PAID')
        if encounter['encounter_status'] == 'HOLDING' and schedule['schedule_status'] in ('CLOSED', 'UNAVAILABLE'):
            encounters.cancel_hospital_locked(db, encounter, schedule, actor['user_id'], 'Bệnh viện/bác sĩ ngừng tiếp nhận trước xác nhận cọc')
            encounter = encounter_model.lock_encounter(db, encounter['encounter_id'])
        row = db.execute("UPDATE payment SET transaction_status='SUCCESS',paid_at=%s,result_received_at=%s,processed_by_id=%s "
                          'WHERE payment_id=%s RETURNING *', (now, now, actor['user_id'], payment_id)).fetchone()
        confirmed = encounters.confirm_paid_online(db, encounter['encounter_id'], actor['user_id'])
        refunded = None
        if not confirmed and row['amount'] > 0:
            refunded = _refund_amount(db, row, actor['user_id'], 'Tiền đến sau khi lượt khám không còn giữ chỗ; không xác nhận lại ca', row['amount'])
            row = model.get(db, payment_id)
        result = _response(db, row, actor, refund=refunded)
        result['booking_confirmed'] = confirmed
    return result
