from backend.app.repositories import statistics_repository as queries
from backend.app.config.database import get_db_connection
from backend.app.repositories import statistics_repository as model
from backend.app.utils.serialization import jsonable
from backend.app.services.encounter_service import require_role


def report(actor, kind, query):
    require_role(actor, 'ADMIN')
    function = {'encounters': model.encounters, 'payments': _payments, 'reviews': model.reviews, 'audit': _audit}[kind]
    with get_db_connection() as db:
        queries.begin_read_only_snapshot(db)
        result = function(db, query)
    return {**jsonable(result), 'page': query['page'], 'page_size': query['page_size'],
            'group_by': query['group_by'], 'from_date': jsonable(query['from_date']), 'to_date': jsonable(query['to_date'])}


def _payments(db, query):
    result = model.payments(db, query)
    summary, rows = result['summary'], result['items']
    for row in [summary] + rows:
        row['gross_received'] = row['deposit_received'] + row['exam_fee_received']
        row['net_received'] = row['gross_received'] - row['refunded_amount']
    return {**result, 'summary': jsonable(summary)}


def _audit(db, query):
    result = model.audit(db, query)
    rows = result['items']
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
    if query['encounter_id'] and rows:
        model.attach_audit_history(db, query, rows)
    return {**result, 'items': jsonable(rows)}
