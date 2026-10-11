from backend.app.repositories._sql import insert_row

COLUMNS = ('encounter_id', 'payment_type', 'amount', 'payment_method', 'transaction_status',
           'transaction_code', 'paid_at', 'refunded_at', 'original_payment_id',
           'created_by_id', 'processed_by_id', 'reason', 'failure_reason', 'result_received_at')


def create(db, fields):
    return insert_row(db, 'payment', fields, COLUMNS)


def get(db, payment_id, *, lock=False):
    return db.execute('SELECT * FROM payment WHERE payment_id=%s' + (' FOR UPDATE' if lock else ''),
                      (payment_id,)).fetchone()


def list_for_encounter(db, encounter_id, page, size):
    total = db.execute('SELECT COUNT(*) AS n FROM payment WHERE encounter_id=%s', (encounter_id,)).fetchone()['n']
    rows = db.execute('SELECT * FROM payment WHERE encounter_id=%s ORDER BY payment_id DESC LIMIT %s OFFSET %s',
                      (encounter_id, size, (page - 1) * size)).fetchall()
    return rows, total


def paid_total(db, encounter_id, kind=None):
    clause = ' AND payment_type=%s' if kind else " AND payment_type IN ('DEPOSIT','EXAM_FEE')"
    params = [encounter_id] + ([kind] if kind else [])
    # REFUNDED là giao dịch đã từng thu; không cho thu lại sau hoàn tiền.
    return db.execute("SELECT COALESCE(SUM(amount),0) AS n FROM payment WHERE encounter_id=%s "
                      "AND transaction_status IN ('SUCCESS','REFUNDED')" + clause, params).fetchone()['n']


def fail_pending_deposits(db, encounter_id, reason):
    db.execute("UPDATE payment SET transaction_status='FAILED',failure_reason=%s "
               "WHERE encounter_id=%s AND payment_type='DEPOSIT' AND transaction_status='PENDING'",
               (reason, encounter_id))


def find_pending_deposit(db, encounter_id):
    return db.execute("SELECT * FROM payment WHERE encounter_id=%s AND payment_type='DEPOSIT' AND transaction_status='PENDING' ORDER BY payment_id LIMIT 1 FOR UPDATE", (encounter_id,)).fetchone()


def find_last_successful_exam_fee(db, encounter_id):
    return db.execute("SELECT * FROM payment WHERE encounter_id=%s AND payment_type='EXAM_FEE' AND transaction_status='SUCCESS' ORDER BY payment_id DESC LIMIT 1", (encounter_id,)).fetchone()


def find_pending_exam_fee(db, encounter_id):
    return db.execute("SELECT 1 FROM payment WHERE encounter_id=%s AND payment_type='EXAM_FEE' AND transaction_status='PENDING'", (encounter_id,)).fetchone()


def find_refund_for_payment(db, payment):
    return db.execute("SELECT * FROM payment WHERE original_payment_id=%s AND payment_type='REFUND'", (payment['payment_id'],)).fetchone()


def mark_refunded(db, now, payment):
    return db.execute("UPDATE payment SET transaction_status='REFUNDED',refunded_at=%s WHERE payment_id=%s", (now, payment['payment_id']))


def find_refund_for_id(db, payment_id):
    return db.execute("SELECT * FROM payment WHERE original_payment_id=%s AND payment_type='REFUND'", (payment_id,)).fetchone()


def find_processed_refund(db, payment_id):
    return db.execute("SELECT * FROM payment WHERE original_payment_id=%s AND payment_type='REFUND'", (payment_id,)).fetchone()


def mark_demo_failed(db, actor, now, payment_id):
    return db.execute("UPDATE payment SET transaction_status='FAILED',result_received_at=%s,processed_by_id=%s,failure_reason=COALESCE(failure_reason,'DEMO_FAILED') WHERE payment_id=%s RETURNING *", (now, actor['user_id'], payment_id)).fetchone()


def mark_demo_success(db, actor, now, payment_id):
    return db.execute("UPDATE payment SET transaction_status='SUCCESS',paid_at=%s,result_received_at=%s,processed_by_id=%s WHERE payment_id=%s RETURNING *", (now, now, actor['user_id'], payment_id)).fetchone()
