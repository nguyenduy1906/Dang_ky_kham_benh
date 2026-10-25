// Shift bounds are Vietnam local time. Missing/invalid bounds never allow editing.
export function canEditClinicalShift(shift, now = new Date()) {
  const day = shift.work_date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || "") || !/^\d{2}:\d{2}(:\d{2})?$/.test(shift.start_time || "") || !/^\d{2}:\d{2}(:\d{2})?$/.test(shift.end_time || "")) return false;
  const start = Date.parse(`${day}T${shift.start_time}+07:00`);
  const end = Date.parse(`${day}T${shift.end_time}+07:00`);
  return Number.isFinite(start) && Number.isFinite(end) && start < end && now.getTime() >= start && now.getTime() < end;
}


export function clinicalShiftEnded(shift, now = new Date()) {
  const end = Date.parse(`${shift.work_date}T${shift.end_time}+07:00`);
  return !Number.isFinite(end) || now.getTime() >= end;
}

export function canBeginClinical(visit, now = new Date()) {
  const status=visit.encounter_status ?? visit.status;
  const appointment=Date.parse(visit.estimated_exam_at);
  return visit.payment_confirmed===true && status==='CHECKED_IN'
    && !['CLOSED','UNAVAILABLE'].includes(visit.schedule_status)
    && canEditClinicalShift(visit,now) && Number.isFinite(appointment) && now.getTime()>=appointment;
}
