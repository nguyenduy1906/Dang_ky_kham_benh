from backend.app.core.security import require_role
from backend.app.core.errors import conflict
from backend.app.db.database import get_db_connection
from backend.app.models import treatment_model as model
from backend.app.services.encounter_service import visible_encounter
from backend.app.utils.database_helpers import jsonable
from backend.app.utils.date import utc_now


def create(actor, encounter_id, fields):
    require_role(actor, 'DOCTOR')
    with get_db_connection() as db:
        db.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))', (fields['request_key'],))
        # One doctor cannot create overlapping appointments in concurrent requests.
        db.execute('SELECT pg_advisory_xact_lock(73512,%s)', (actor['user_id'],))
        db.execute('SELECT encounter_id FROM encounter WHERE encounter_id=%s FOR UPDATE', (encounter_id,))
        encounter = visible_encounter(db, actor, encounter_id)
        existing = model.batch(db, fields['request_key'])
        if existing:
            same = (len(existing) == len(fields['sessions']) and all(
                row['encounter_id'] == encounter_id and row['doctor_user_id'] == actor['user_id']
                and all(row[k] == fields[k] for k in ('content','notes','location'))
                and row['starts_at'] == session['starts_at'] and row['ends_at'] == session['ends_at']
                for row, session in zip(existing, fields['sessions'])))
            if not same:
                raise conflict('Mã yêu cầu đã dùng cho nội dung khác. Vui lòng tải lại danh sách.', 'TREATMENT_REQUEST_CONFLICT')
            return {'items': jsonable(existing)}, False
        if encounter['encounter_status'] != 'IN_PROGRESS':
            raise conflict('Chỉ hẹn điều trị từ lượt đang khám', 'TREATMENT_ENCOUNTER_INVALID')
        if any(row['starts_at'] <= utc_now() for row in fields['sessions']):
            raise conflict('Các buổi hẹn phải ở thời điểm tương lai', 'TREATMENT_TIME_PASSED')
        for session in fields['sessions']:
            overlap = db.execute('''SELECT 1 FROM treatment_appointment t JOIN encounter other USING(encounter_id)
                WHERE (t.doctor_user_id=%s OR other.patient_id=%s)
                AND t.starts_at<%s AND t.ends_at>%s LIMIT 1''',
                (actor['user_id'],encounter['patient_id'],session['ends_at'],session['starts_at'])).fetchone()
            if overlap:
                raise conflict('Bác sĩ hoặc bệnh nhân đã có lịch điều trị trùng giờ', 'TREATMENT_OVERLAP')
        # Serialize appointments of the same patient across different doctors too.
        # The patient lock is acquired before writing, and overlaps are rechecked below.
        db.execute('SELECT pg_advisory_xact_lock(73513,%s)', (encounter['patient_id'],))
        for index, session in enumerate(fields['sessions']):
            overlap = db.execute('''SELECT 1 FROM treatment_appointment t JOIN encounter other USING(encounter_id)
                WHERE other.patient_id=%s AND t.starts_at<%s AND t.ends_at>%s LIMIT 1''',
                (encounter['patient_id'],session['ends_at'],session['starts_at'])).fetchone()
            if overlap:
                raise conflict('Bệnh nhân đã có lịch điều trị trùng giờ', 'TREATMENT_OVERLAP')
            db.execute('''INSERT INTO treatment_appointment(request_key,batch_index,encounter_id,doctor_user_id,
                starts_at,ends_at,content,notes,location) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
                (fields['request_key'],index,encounter_id,actor['user_id'],session['starts_at'],session['ends_at'],fields['content'],fields['notes'],fields['location']))
        return {'items':jsonable(model.batch(db, fields['request_key']))}, True


def listing(actor, page, size, *, view=None, patient_id=None):
    require_role(actor,'USER','DOCTOR')
    with get_db_connection(read_only=True) as db:
        rows,total=model.listing(db,actor,page,size,view=view,patient_id=patient_id)
    return {'items':jsonable(rows),'total':total,'page':page,'page_size':size}
