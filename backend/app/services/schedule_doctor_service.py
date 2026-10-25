"""Atomic replacement/swap of future clinical shifts, preserving encounter snapshots."""
from datetime import datetime
from psycopg.types.json import Jsonb
from backend.app.core.errors import bad_request, conflict, not_found
from backend.app.core.security import require_role
from backend.app.db.database import get_db_connection
from backend.app.models import schedule_model, doctor_model, encounter_model, staff_leave_model
from backend.app.services import schedule_service, staff_leave_service, staff_notification_service as notices
from backend.app.services.notification_service import notify_encounter
from backend.app.utils.date import utc_now, VN_TZ
from backend.app.utils.database_helpers import jsonable


def validate(data):
    from backend.app.utils.validation import ensure_object, int_field, text_field
    data=ensure_object(data)
    if set(data)-{'doctor_profile_id','target_schedule_id','reason','expected_version'}:
        raise bad_request('Dữ liệu chứa trường không được phép')
    if bool(data.get('doctor_profile_id')) == bool(data.get('target_schedule_id')):
        raise bad_request('Chọn bác sĩ thay thế hoặc ca hoán đổi')
    result={'reason':text_field(data,'reason',required=True,max_len=500)}
    key='target_schedule_id' if data.get('target_schedule_id') else 'doctor_profile_id'
    result[key]=int_field(data,key,required=True,minimum=1)
    result['expected_version']=text_field(data,'expected_version',max_len=64)
    return result


def _context(db,sid,fields,lock=False):
    ids=sorted({sid,fields.get('target_schedule_id',sid)})
    if lock:schedule_model.lock_schedules(db,ids)
    rows=[schedule_model.get_schedule(db,i) for i in ids]
    if any(r is None for r in rows):raise not_found('Không tìm thấy ca','SCHEDULE_NOT_FOUND')
    source=next(r for r in rows if r['schedule_id']==sid)
    if fields.get('target_schedule_id')==sid:raise bad_request('Hai ca phải khác nhau')
    other=next((r for r in rows if r['schedule_id']!=sid),None)
    replacements={sid:other['doctor_profile_id'] if other else fields['doctor_profile_id']}
    if other:replacements[other['schedule_id']]=source['doctor_profile_id']
    visits=db.execute('SELECT * FROM encounter WHERE schedule_id=ANY(%s) ORDER BY encounter_id'+(' FOR UPDATE' if lock else ''),(ids,)).fetchall()
    for row in rows:
        if row['move'] or row['schedule_status']=='CLOSED':raise conflict('Ca đã đóng hoặc đã chuyển','SCHEDULE_NOT_OPEN')
        if datetime.combine(row['work_date'],row['start_time'],VN_TZ)<=utc_now():raise conflict('Chỉ thay thế hoặc hoán đổi ca chưa bắt đầu','SCHEDULE_ALREADY_STARTED')
        new=replacements[row['schedule_id']]
        if new==row['doctor_profile_id']:raise conflict('Bác sĩ mới phải khác bác sĩ cũ','SAME_DOCTOR')
        doctor=doctor_model.get_by_id(db,new)
        old=doctor_model.get_by_id(db,row['doctor_profile_id'])
        if not doctor or not doctor['is_active'] or not doctor['account_ok']:raise conflict('Bác sĩ thay thế không hoạt động','DOCTOR_INVALID')
        if doctor['department_id']!=old['department_id'] or doctor['department_id']!=row['department_id']:raise conflict('Bác sĩ và phòng phải cùng chuyên khoa','DEPARTMENT_MISMATCH')
        staff_leave_service.ensure_available(db,doctor['user_id'],row['work_date'],row['start_time'],row['end_time'])
        overlap=db.execute('SELECT 1 FROM work_schedule WHERE doctor_profile_id=%s AND work_date=%s AND start_time<%s AND end_time>%s AND NOT(schedule_id=ANY(%s)) LIMIT 1',(new,row['work_date'],row['end_time'],row['start_time'],ids)).fetchone()
        if overlap:raise conflict('Bác sĩ mới đã có ca trùng giờ','DOCTOR_SCHEDULE_OVERLAP')
    active=[v for v in visits if v['encounter_status'] in ('HOLDING','CONFIRMED','CHECKED_IN')]
    if any(v['encounter_status'] in ('IN_PROGRESS','COMPLETED') for v in visits):raise conflict('Ca có lượt đang khám hoặc đã hoàn tất, không thể thay bác sĩ cả ca','SCHEDULE_HAS_CLINICAL_HISTORY')
    resulting=[]
    for v in active:
        row=next(r for r in rows if r['schedule_id']==v['schedule_id'])
        key=(v['patient_id'],replacements[v['schedule_id']],row['work_date'])
        if key in resulting:raise conflict('Bệnh nhân sẽ có lượt trùng bác sĩ/ngày','DUPLICATE_ENCOUNTER')
        resulting.append(key)
        duplicate=db.execute("SELECT 1 FROM encounter e JOIN work_schedule s USING(schedule_id) WHERE e.patient_id=%s AND e.doctor_profile_id=%s AND s.work_date=%s AND NOT(e.schedule_id=ANY(%s)) AND e.encounter_status IN ('HOLDING','CONFIRMED','CHECKED_IN','IN_PROGRESS','COMPLETED') LIMIT 1",(*key,ids)).fetchone()
        if duplicate:raise conflict('Bệnh nhân đã có lịch với bác sĩ thay thế trong ngày','DUPLICATE_ENCOUNTER')
    version=notices.event_version({'rows':rows,'visits':visits,'replacements':replacements})
    return rows,active,replacements,version


def preview(actor,sid,fields):
    require_role(actor,'ADMIN','RECEPTIONIST')
    with get_db_connection() as db:
        rows,visits,replacements,version=_context(db,sid,fields)
        return {'schedules':[schedule_service._present(r) for r in rows], 'affected_encounters':[jsonable(v) for v in visits], 'replacements':replacements,'version':version}


def apply(actor,sid,fields):
    require_role(actor,'ADMIN','RECEPTIONIST')
    if not fields.get('expected_version'):raise bad_request('Cần xem trước và xác nhận dữ liệu mới nhất')
    with get_db_connection() as db:
        staff_leave_model.lock_changes(db)
        ids=sorted({sid,fields.get('target_schedule_id',sid)})
        patients=db.execute('SELECT DISTINCT patient_id FROM encounter WHERE schedule_id=ANY(%s) ORDER BY patient_id',(ids,)).fetchall()
        for p in patients:db.execute('SELECT 1 FROM patient WHERE patient_id=%s FOR UPDATE',(p['patient_id'],))
        rows,visits,replacements,version=_context(db,sid,fields,True)
        if version!=fields['expected_version']:raise conflict('Dữ liệu đã thay đổi. Vui lòng xem trước lại.','SCHEDULE_STALE')
        db.execute('SET CONSTRAINTS schedule_doctor_start_unique DEFERRED')
        for row in rows:
            new=replacements[row['schedule_id']]
            db.execute('INSERT INTO schedule_doctor_change(schedule_id,old_doctor_id,new_doctor_id,changed_by_id,reason,before_data) VALUES(%s,%s,%s,%s,%s,%s)',(row['schedule_id'],row['doctor_profile_id'],new,actor['user_id'],fields['reason'],Jsonb(jsonable(row))))
            status='FULL' if row['booked_count']>=row['max_quota'] else 'OPEN'
            db.execute('UPDATE work_schedule SET doctor_profile_id=%s,schedule_status=%s,unavailable_reason=NULL WHERE schedule_id=%s',(new,status,row['schedule_id']))
            after=schedule_model.get_schedule(db,row['schedule_id'])
            recipients=notices.schedule_recipients(db,row['schedule_id'])|{actor['user_id'],doctor_model.get_by_id(db,row['doctor_profile_id'])['user_id']}
            notices.send(db,recipients,'doctor-change:'+notices.event_version(after),'SCHEDULE','Thay đổi bác sĩ phụ trách ca',notices.schedule_description(after)+'. Lý do: '+fields['reason'],'WORK_SCHEDULE',row['schedule_id'])
        for v in visits:
            new=replacements[v['schedule_id']]
            encounter_model.update_encounter(db,v['encounter_id'],{'doctor_profile_id':new})
            log=encounter_model.add_transfer(db,v['encounter_id'],v['doctor_profile_id'],new,actor['user_id'],fields['reason'])
            notify_encounter(db,v['encounter_id'],f'doctor-change:{log}','ENCOUNTER','Bác sĩ phụ trách lượt khám đã thay đổi','Giữ nguyên phòng, giờ hẹn, mã phiếu và phí đã chốt. Lý do: '+fields['reason'])
        db.execute('SET CONSTRAINTS schedule_doctor_start_unique IMMEDIATE')
        return {'schedules':[schedule_service._present(schedule_model.get_schedule(db,r['schedule_id'])) for r in rows], 'affected_count':len(visits)}
