// Calendar display state is based on the assigned shift's end in Vietnam time.
// It does not change the stored leave request or attendance record.
export function isCompletedShift(shift, now = Date.now()) {
  const end = Date.parse(`${shift.date}T${String(shift.end_time || '').slice(0, 8)}+07:00`);
  return Number.isFinite(end) && now >= end;
}

export function calendarShiftState(shift, now = Date.now()) {
  if (isCompletedShift(shift, now)) return {label:'Ca đã hoàn thành', className:'is-completed'};
  if (shift.status === 'ON_LEAVE') return {label:'Đã duyệt nghỉ', className:'is-leave'};
  if (shift.pending_leave) return {label:'Đang xin nghỉ · Vẫn làm việc', className:'is-pending'};
  return {label:'Làm việc', className:''};
}
