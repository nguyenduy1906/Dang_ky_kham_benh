import {listStaffSchedules,getStaffSchedule} from "../api/schedule.js";
import {listPatients,getPatient} from "../api/patient.js";
import {allPages} from "./admin_ui.js";
import {parseCode} from "./business_codes.js";
import {createReceptionWalkIn} from "./reception_intake_data.js";

export const normalizeScheduleSearch = value => String(value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[đĐ]/g,"d").toLowerCase().trim();
function present(row,doctor) {
  if(!row.schedule_id || String(row.doctor_profile_id)!==String(doctor.doctor_profile_id))throw new Error("Lịch khám trả về không khớp bác sĩ.");
  return {...row,doctor_name:row.doctor_name || doctor.full_name,department_name:row.department_name || doctor.department_name};
}
export async function loadReceptionDoctorSchedules(day, options = {}) {
  if(day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0,10)!==day))throw new Error("Vui lòng chọn ngày khám hợp lệ.");
  const rows=await allPages(listStaffSchedules,day?{from_date:day,to_date:day}:{},options.signal);
  if(rows.some(row=>!row.schedule_id || !row.doctor_profile_id))throw new Error("Lịch khám trả về không hợp lệ.");
  rows.sort((a,b)=>`${a.work_date} ${a.start_time}`.localeCompare(`${b.work_date} ${b.start_time}`)||String(a.doctor_name).localeCompare(String(b.doctor_name),'vi')||a.schedule_id-b.schedule_id);
  return {rows,departments:[...new Set(rows.map(row=>row.department_name).filter(Boolean))]};
}
export function filterReceptionDoctorSchedules(rows, filters = {}) {
  const words=normalizeScheduleSearch(filters.q).split(/\s+/).filter(Boolean),department=normalizeScheduleSearch(filters.department);
  return rows.filter(row=>(!filters.work_date||row.work_date===filters.work_date)
    &&(!department||normalizeScheduleSearch(row.department_name).includes(department))
    && words.every(word=>normalizeScheduleSearch(`${row.doctor_name} ${row.department_name} ${row.room_name}`).includes(word)));
}
export async function readReceptionDoctorSchedule(row, options = {}) {
  const {schedule:current}=await getStaffSchedule(row.schedule_id,options);
  if(String(current?.schedule_id)!==String(row.schedule_id))throw new Error("Ca khám trả về không khớp ca đã chọn.");
  return present(current,{doctor_profile_id:row.doctor_profile_id,full_name:row.doctor_name,department_name:row.department_name});
}
export function canReceiveInSchedule(row, now = Date.now()) {
  return row.work_date === new Date(now + 7 * 3600000).toISOString().slice(0,10) && ['OPEN','FULL'].includes(row.schedule_status) && Date.parse(`${row.work_date}T${row.end_time}+07:00`)>now;
}
export async function searchSchedulePatients(q,options = {}) {
  const value=String(q||'').trim();
  if(/^BN_\d+$/i.test(value)) {
    const id=parseCode(value,'BN'),{patient}=await getPatient(id,options);
    if(String(patient?.patient_id)!==String(id))throw new Error("Hồ sơ trả về không khớp mã bệnh nhân.");
    return !patient.is_archived && !patient.archived_at ? [patient] : [];
  }
  return allPages(listPatients,{q:value},options.signal);
}
export async function receiveSchedulePatient(row,patientId,options = {}) {
  const current=await readReceptionDoctorSchedule(row,options);
  if(!canReceiveInSchedule(current))throw new Error("Chỉ tiếp nhận vào ca hôm nay còn hoạt động và chưa kết thúc.");
  return createReceptionWalkIn(patientId,{doctor_profile_id:current.doctor_profile_id},options,current.schedule_id);
}
