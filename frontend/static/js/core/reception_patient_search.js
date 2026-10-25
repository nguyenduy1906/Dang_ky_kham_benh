import * as patients from "../api/patient.js";
import { listEncounters } from "../api/encounter.js";
import { allPages } from "./admin_ui.js";

export async function searchReceptionPatients({q = "", work_date = ""} = {}, page = 1, size = 10, options = {}) {
  const params = {q:q.trim(), include_archived:true};
  if (!work_date) {
    const result = await patients.listPatients({...params, page, page_size:size}, options);
    const last = Math.max(1,Math.ceil(result.total/result.page_size));
    return page > last ? patients.listPatients({...params,page:last,page_size:size},options) : result;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(work_date) || !Number.isFinite(Date.parse(work_date)) || new Date(work_date).toISOString().slice(0,10) !== work_date) throw new Error("Vui lòng chọn ngày khám hợp lệ.");
  const [profiles, visits] = await Promise.all([
    allPages(patients.listPatients,params,options.signal),
    allPages(listEncounters,{work_date},options.signal),
  ]);
  const ids = new Set(visits.filter(row=>row.work_date===work_date).map(row=>String(row.patient_id)));
  const items = profiles.filter(row=>ids.has(String(row.patient_id)));
  const current = Math.min(Math.max(1,page),Math.max(1,Math.ceil(items.length/size)));
  return {items:items.slice((current-1)*size,current*size),total:items.length,page:current,page_size:size};
}

export async function readReceptionPatient(id, options = {}) {
  const {patient} = await patients.getPatient(id, options);
  if (!patient?.patient_id || String(patient.patient_id)!==String(id)) throw new Error("Hồ sơ trả về không khớp bệnh nhân đã chọn.");
  return patient;
}

export async function readReceptionPatientHistory(id, options = {}) {
  const visits = await allPages((params,opts)=>patients.listEncounters(id,params,opts),{},options.signal);
  if (visits.some(row=>row.patient_id != null && String(row.patient_id)!==String(id))) throw new Error("Lịch sử khám không khớp hồ sơ bệnh nhân đã chọn.");
  return visits.map(row=>({...row,patient_id:row.patient_id ?? Number(id)})).sort((a,b)=>String(b.work_date || "").localeCompare(String(a.work_date || ""))
    || String(b.estimated_exam_at || b.created_at || "").localeCompare(String(a.estimated_exam_at || a.created_at || "")) || Number(b.encounter_id)-Number(a.encounter_id));
}

export async function saveReceptionPatient(id, input, options = {}) {
  const current = await readReceptionPatient(id,options);
  if (current.is_archived || current.archived_at) throw new Error("Hồ sơ đã lưu trữ, không thể chỉnh sửa.");
  if (Object.hasOwn(input,"phone") && String(input.phone || "").trim() !== String(current.phone || "")) throw new Error("Số điện thoại phải được thay đổi tại tài khoản chủ hồ sơ.");
  const fields = ["full_name","dob","gender","id_card","address","health_insurance","email","emergency_contact_name","emergency_contact_phone","emergency_contact_relationship"];
  const values = Object.fromEntries(fields.filter(key=>Object.hasOwn(input,key)).map(key=>[key,String(input[key] ?? "").trim() || null]));
  const merged = {...current,...values};
  if (!merged.full_name || (!merged.dob && !merged.id_card)) throw new Error("Cần họ tên và ngày sinh hoặc CCCD / mã định danh để xác định đúng người bệnh.");
  const changes = Object.fromEntries(Object.entries(values).filter(([key,value])=>(current[key] ?? null)!==value));
  if (!Object.keys(changes).length) return current;
  const result = await patients.updatePatient(id,changes,options);
  if (String(result?.patient?.patient_id)!==String(id)) throw new Error("Chưa xác minh được kết quả lưu hồ sơ. Vui lòng mở lại để kiểm tra.");
  return result.patient;
}
