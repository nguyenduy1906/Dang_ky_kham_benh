from backend.app.models._sql import jsonable

JOIN = (' JOIN encounter e ON e.encounter_id={encounter_id} JOIN work_schedule s ON s.schedule_id=e.schedule_id '
        'JOIN doctor_profile d ON d.doctor_profile_id=e.doctor_profile_id ')


def conditions(query, date_expression):
    where, params = ['TRUE'], []
    for key, expression in (('doctor_profile_id', 'e.doctor_profile_id'), ('department_id', 'd.department_id'),
                            ('encounter_id', 'e.encounter_id'), ('encounter_status', 'e.encounter_status'),
                            ('encounter_type', 'e.encounter_type')):
        if query[key] is not None:
            where.append(expression + '=%s'); params.append(query[key])
    if query['from_date']:
        where.append(date_expression + '>=%s'); params.append(query['from_date'])
    if query['to_date']:
        where.append(date_expression + '<=%s'); params.append(query['to_date'])
    return ' AND '.join(where), params


def grouping(query, date_expression):
    return {'day': date_expression, 'doctor': 'e.doctor_profile_id', 'department': 'd.department_id'}[query['group_by']]


def _group_page(db, grouped, params, query):
    total = db.execute('SELECT COUNT(*) n FROM (' + grouped + ') groups', params).fetchone()['n']
    rows = db.execute(grouped + ' ORDER BY group_value LIMIT %s OFFSET %s',
                      params + [query['page_size'], (query['page'] - 1) * query['page_size']]).fetchall()
    return jsonable(rows), total


def encounters(db, query):
    where, params = conditions(query, 's.work_date')
    base = ' FROM encounter e JOIN work_schedule s ON s.schedule_id=e.schedule_id JOIN doctor_profile d ON d.doctor_profile_id=e.doctor_profile_id WHERE ' + where
    aggregate = ('COUNT(*) AS total,COUNT(*) FILTER (WHERE e.encounter_type=\'ONLINE\') AS online_count,'
                 "COUNT(*) FILTER (WHERE e.encounter_type='WALK_IN') AS walk_in_count")
    summary = db.execute('SELECT ' + aggregate + base, params).fetchone()
    statuses = db.execute('SELECT e.encounter_status,COUNT(*) AS count' + base + ' GROUP BY e.encounter_status ORDER BY e.encounter_status', params).fetchall()
    group = grouping(query, 's.work_date')
    rows, total = _group_page(db, 'SELECT ' + group + ' AS group_value,' + aggregate + base + ' GROUP BY ' + group, params, query)
    return {'summary': dict(summary), 'by_status': statuses, 'items': rows, 'total': total}


def payments(db, query):
    stamp = "(COALESCE(p.paid_at,p.created_at) AT TIME ZONE 'Asia/Saigon')::date"
    where, params = conditions(query, stamp)
    base = ' FROM payment p' + JOIN.format(encounter_id='p.encounter_id') + ' WHERE ' + where
    # Giao dịch gốc REFUNDED vẫn là tiền đã thu; hoàn 50% chỉ trừ số tiền REFUND thực tế.
    aggregate = ("COUNT(*) AS transaction_count,COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type='DEPOSIT' AND p.transaction_status IN ('SUCCESS','REFUNDED')),0) AS deposit_received,"
                 "COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type='EXAM_FEE' AND p.transaction_status IN ('SUCCESS','REFUNDED')),0) AS exam_fee_received,"
                 "COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type='REFUND' AND p.transaction_status='SUCCESS'),0) AS refunded_amount")
    summary = dict(db.execute('SELECT ' + aggregate + base, params).fetchone())
    group = grouping(query, stamp)
    rows, total = _group_page(db, 'SELECT ' + group + ' AS group_value,' + aggregate + base + ' GROUP BY ' + group, params, query)
    for row in [summary] + rows:
        row['gross_received'] = row['deposit_received'] + row['exam_fee_received']
        row['net_received'] = row['gross_received'] - row['refunded_amount']
    return {'summary': jsonable(summary), 'items': rows, 'total': total}


def reviews(db, query):
    stamp = "(r.created_at AT TIME ZONE 'Asia/Saigon')::date"
    where, params = conditions(query, stamp)
    base = (' FROM review r JOIN medical_record m ON m.record_id=r.record_id ' + JOIN.format(encounter_id='m.encounter_id') + ' WHERE ' + where)
    aggregate = 'COUNT(*) AS review_count,ROUND(AVG(r.rating),2) AS average_rating'
    summary = db.execute('SELECT ' + aggregate + base, params).fetchone()
    distribution = db.execute('SELECT r.rating,COUNT(*) AS count' + base + ' GROUP BY r.rating ORDER BY r.rating', params).fetchall()
    group = grouping(query, stamp)
    rows, total = _group_page(db, 'SELECT ' + group + ' AS group_value,' + aggregate + base + ' GROUP BY ' + group, params, query)
    return {'summary': jsonable(summary), 'rating_distribution': distribution, 'items': rows, 'total': total}


def audit(db, query):
    where, params = conditions(query, 's.work_date')
    base = (' FROM encounter e JOIN work_schedule s ON s.schedule_id=e.schedule_id '
            'JOIN doctor_profile d ON d.doctor_profile_id=e.doctor_profile_id LEFT JOIN medical_record m ON m.encounter_id=e.encounter_id '
            'LEFT JOIN LATERAL (SELECT COUNT(*) AS expected_booked_count FROM encounter qe WHERE qe.schedule_id=e.schedule_id '
            "AND qe.encounter_status IN ('HOLDING','CONFIRMED','CHECKED_IN','IN_PROGRESS','COMPLETED')) qc ON TRUE "
            'LEFT JOIN LATERAL (SELECT '
            "COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type='DEPOSIT' AND p.transaction_status IN ('SUCCESS','REFUNDED')),0) AS deposit_received,"
            "COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type IN ('DEPOSIT','EXAM_FEE') AND p.transaction_status IN ('SUCCESS','REFUNDED')),0) AS gross_received,"
            "COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type='REFUND' AND p.transaction_status='SUCCESS'),0) AS refunded_amount "
            'FROM payment p WHERE p.encounter_id=e.encounter_id) money ON TRUE WHERE ' + where)
    total = db.execute('SELECT COUNT(*) n' + base, params).fetchone()['n']
    rows = db.execute('SELECT e.encounter_id,e.encounter_status,e.encounter_type,e.schedule_id,e.doctor_profile_id,'
                      'e.consultation_fee_snapshot,e.deposit_amount_snapshot,e.cancel_origin,e.cancelled_at,'
                      's.booked_count,qc.expected_booked_count,money.deposit_received,money.gross_received,money.refunded_amount,'
                      'm.record_id,m.diagnosis IS NOT NULL AND trim(m.diagnosis)<>\'\' AS has_diagnosis,'
                      'm.version AS record_version,jsonb_array_length(m.revision_history) AS medical_revision_count' + base +
                      ' ORDER BY e.encounter_id DESC LIMIT %s OFFSET %s', params + [query['page_size'], (query['page'] - 1) * query['page_size']]).fetchall()
    for row in rows:
        issues = []
        if row['booked_count'] != row['expected_booked_count']: issues.append('SCHEDULE_QUOTA_MISMATCH')
        if row['encounter_status'] == 'COMPLETED' and (row['record_id'] is None or not row['has_diagnosis']):
            issues.append('COMPLETED_WITHOUT_VALID_RECORD')
        if row['consultation_fee_snapshot'] is None: issues.append('PRICE_SNAPSHOT_MISSING')
        elif row['gross_received'] > row['consultation_fee_snapshot']: issues.append('CHARGED_ABOVE_SNAPSHOT')
        if row['refunded_amount'] > row['gross_received']: issues.append('REFUND_EXCEEDS_RECEIPTS')
        if (row['encounter_type'] == 'ONLINE' and row['encounter_status'] in ('CONFIRMED','CHECKED_IN','IN_PROGRESS','COMPLETED')
                and row['deposit_amount_snapshot'] is not None and row['deposit_received'] < row['deposit_amount_snapshot']):
            issues.append('ONLINE_DEPOSIT_NOT_FULLY_PAID')
        row['net_received'] = row['gross_received'] - row['refunded_amount']
        row['issues'] = issues
    # Chi tiết lịch sử chỉ khi truy vấn một encounter; giới hạn 100 mục mỗi loại.
    if query['encounter_id'] and rows:
        row = rows[0]; eid = row['encounter_id']
        row['status_history'] = db.execute('SELECT * FROM encounter_status_log WHERE encounter_id=%s ORDER BY log_id DESC LIMIT 100', (eid,)).fetchall()
        row['transfer_history'] = db.execute('SELECT * FROM encounter_transfer_log WHERE encounter_id=%s ORDER BY log_id DESC LIMIT 100', (eid,)).fetchall()
        row['payment_history'] = db.execute('SELECT * FROM payment WHERE encounter_id=%s ORDER BY payment_id DESC LIMIT 100', (eid,)).fetchall()
        history = db.execute('SELECT revision_history FROM medical_record WHERE encounter_id=%s', (eid,)).fetchone()
        row['medical_revision_history'] = list(reversed(history['revision_history'][-100:])) if history else []
        row['history_limit'] = 100
    return {'items': jsonable(rows), 'total': total}
