from backend.app.models._sql import insert_row

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
