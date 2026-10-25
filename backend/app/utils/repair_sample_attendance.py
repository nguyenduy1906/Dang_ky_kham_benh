"""Audit-only by default; --apply corrects synthetic active attendance, retaining history."""
import argparse
from backend.app.db.database import get_db_connection
from backend.app.utils import date as dates
from backend.app.services import encounter_service as service
from backend.app.utils.worker import system_actor


def repair(apply=False):
    changes=[]
    with get_db_connection() as db:
        actor=system_actor(db) if apply else None
        rows=db.execute("""SELECT e.*,s.work_date,
          EXISTS(SELECT 1 FROM encounter_status_log l WHERE l.encounter_id=e.encounter_id AND l.note LIKE 'Dữ liệu mẫu:%')
          AND NOT EXISTS(SELECT 1 FROM encounter_status_log l WHERE l.encounter_id=e.encounter_id AND COALESCE(l.note,'') NOT LIKE 'Dữ liệu mẫu:%') AS pure_sample,
          EXISTS(SELECT 1 FROM payment p WHERE p.encounter_id=e.encounter_id AND p.transaction_status='SUCCESS' AND p.payment_type IN ('DEPOSIT','EXAM_FEE')) AS paid
          FROM encounter e JOIN work_schedule s USING(schedule_id)
          WHERE e.encounter_status IN ('CHECKED_IN','IN_PROGRESS') ORDER BY e.encounter_id""").fetchall()
        for row in rows:
            wrong_date=row['checked_in_at'] is not None and row['checked_in_at'].astimezone(dates.VN_TZ).date()!=row['work_date']
            early=row['encounter_status']=='IN_PROGRESS' and row['estimated_exam_at']>dates.utc_now()
            if not (row['pure_sample'] or wrong_date or early):continue
            if row['pure_sample'] or wrong_date:
                state='CONFIRMED' if row['encounter_type']=='ONLINE' and row['paid'] else 'CANCELLED'
                checked=None
            else:
                state='CHECKED_IN';checked=row['checked_in_at']
            if row['pure_sample'] and row['work_date'] < dates.today_vn():state='NO_SHOW';checked=None
            changes.append((row['encounter_id'],row['encounter_status'],state,'sample' if row['pure_sample'] else 'invalid_time'))
            if not apply:continue
            # Same lock order as normal encounter actions; recheck snapshot after waiting.
            current,schedules=service.locked_context(db,row['encounter_id'])
            if current['encounter_status']!=row['encounter_status'] or current['checked_in_at']!=row['checked_in_at']:
                raise RuntimeError('Encounter changed during repair; rollback and rerun audit')
            fields={'encounter_status':state,'checked_in_at':checked}
            if state=='CANCELLED':
                fields.update(cancel_reason='Hiệu chỉnh dữ liệu mẫu không có xác nhận đến viện thực tế',cancelled_by_id=actor,cancelled_at=dates.utc_now(),cancel_origin='HOSPITAL',refund_reference_at=row['estimated_exam_at'])
                service._change_quota(db,schedules[current['schedule_id']],-1)
            if state=='NO_SHOW':service._change_quota(db,schedules[current['schedule_id']],-1)
            service.model.update_encounter(db,row['encounter_id'],fields)
            service.model.add_status(db,row['encounter_id'],row['encounter_status'],state,actor,'Hiệu chỉnh trạng thái mẫu hoặc mốc check-in/bắt đầu khám sai thời gian; giữ nguyên lịch sử trước hiệu chỉnh')
    return changes


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    print(repair(args.apply))
