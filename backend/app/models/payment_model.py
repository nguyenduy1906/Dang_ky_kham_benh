from backend.app.utils.database_helpers import insert_row

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


def list_history(db, page, size):
    total = db.execute('SELECT COUNT(*) AS n FROM payment').fetchone()['n']
    rows = db.execute('SELECT * FROM payment ORDER BY created_at DESC, payment_id DESC LIMIT %s OFFSET %s',
                      (size, (page - 1) * size)).fetchall()
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


def list_staff_history(db,query):
    clauses,args=['TRUE'],[]
    if query.get('from_date'):
        clauses.append("(COALESCE(p.refunded_at,p.paid_at,p.result_received_at,p.created_at) AT TIME ZONE 'Asia/Saigon')::date>=%s");args.append(query['from_date'])
    if query.get('to_date'):
        clauses.append("(COALESCE(p.refunded_at,p.paid_at,p.result_received_at,p.created_at) AT TIME ZONE 'Asia/Saigon')::date<=%s");args.append(query['to_date'])
    if query.get('status'):
        clauses.append('p.transaction_status=%s');args.append(query['status'])
    if query.get('q'):
        clauses.append("concat_ws(' ',p.payment_code,p.transaction_code,e.encounter_code,pt.full_name,pt.phone) ILIKE %s");args.append('%'+query['q']+'%')
    base=' FROM payment p JOIN encounter e USING(encounter_id) JOIN patient pt USING(patient_id) WHERE '+' AND '.join(clauses)
    total=db.execute('SELECT COUNT(*) AS n'+base,args).fetchone()['n']
    rows=db.execute('SELECT p.*,e.encounter_type,e.encounter_status,pt.full_name AS patient_name,pt.phone AS patient_phone'+base+' ORDER BY COALESCE(p.refunded_at,p.paid_at,p.result_received_at,p.created_at) DESC,p.payment_id DESC LIMIT %s OFFSET %s',args+[query['page_size'],(query['page']-1)*query['page_size']]).fetchall()
    return rows,total


def billable_encounters(db,page,size):
    base=""" FROM encounter e JOIN patient p USING(patient_id) JOIN work_schedule s USING(schedule_id)
        LEFT JOIN LATERAL (SELECT COALESCE(SUM(amount),0) AS paid FROM payment
            WHERE encounter_id=e.encounter_id AND payment_type IN ('DEPOSIT','EXAM_FEE') AND transaction_status IN ('SUCCESS','REFUNDED')) totals ON TRUE
        WHERE (e.encounter_status='HOLDING' AND e.hold_expires_at>CURRENT_TIMESTAMP AND s.schedule_status IN ('OPEN','FULL')
            OR e.encounter_status IN ('CHECKED_IN','IN_PROGRESS','COMPLETED') AND e.consultation_fee_snapshot>totals.paid)"""
    total=db.execute('SELECT COUNT(*) AS n'+base).fetchone()['n']
    rows=db.execute("SELECT e.encounter_id,e.patient_id,p.full_name AS patient_name,p.phone AS patient_phone,e.encounter_type,e.encounter_status,CASE WHEN e.encounter_status='HOLDING' THEN e.deposit_amount_snapshot ELSE e.consultation_fee_snapshot-totals.paid END AS amount_due"+base+' ORDER BY e.created_at DESC,e.encounter_id DESC LIMIT %s OFFSET %s',(size,(page-1)*size)).fetchall()
    return rows,total
