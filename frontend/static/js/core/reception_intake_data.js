import {encounterStatusLabels} from "./encounter_status.js";
import * as encounters from "../api/encounter.js";
import * as patients from "../api/patient.js";
import { allPages } from "./admin_ui.js";

const statuses = Object.keys(encounterStatusLabels);
export async function loadReceptionEncounters(filters = {}, options = {}) {
  const rows = await allPages((params, opts) => encounters.listEncounters(params, opts), filters, options.signal);
  return rows.filter(row => ["ONLINE", "WALK_IN"].includes(row.encounter_type) && statuses.includes(row.encounter_status)
    && (!filters.encounter_type || row.encounter_type===filters.encounter_type)
    && (!filters.work_date || row.work_date === filters.work_date)
    && (!filters.schedule_id || String(row.schedule_id) === String(filters.schedule_id))
    && (!filters.encounter_status || row.encounter_status === filters.encounter_status));
}
function patientResult(patient, id) {
  if (!patient?.patient_id || (id && String(patient.patient_id) !== String(id))) throw new Error("Không xác minh được hồ sơ bệnh nhân.");
  if (patient.is_archived || patient.archived_at) throw new Error("Hồ sơ đã lưu trữ, không thể tiếp nhận khám.");
  return patient;
}
export async function createReceptionPatient(input, options = {}) {
  const fields = ["full_name", "phone", "dob", "id_card", "gender", "address", "health_insurance", "email", "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship"];
  const payload = Object.fromEntries(fields.filter(key => key in input).map(key => [key, String(input[key] ?? "").trim() || null]));
  if (!payload.full_name || !payload.phone) throw new Error("Vui lòng nhập họ tên và số điện thoại bệnh nhân.");
  if (!payload.dob && !payload.id_card) throw new Error("Cần ngày sinh hoặc CCCD / mã định danh để xác định đúng hồ sơ.");
  return patientResult((await patients.createPatient(payload, options)).patient);
}
function confirmedEncounter(result, id, state) {
  const row = result?.encounter;
  if (!row?.encounter_id || (id && String(row.encounter_id) !== String(id)) || row.encounter_status !== state) {
    throw new Error("Chưa xác minh được kết quả tiếp nhận. Hãy kiểm tra lại danh sách trước khi thao tác tiếp.");
  }
  return row;
}
export async function checkInReception(id, options = {}) {
  const row = (await encounters.getEncounter(id, options)).encounter;
  if (String(row?.encounter_id) !== String(id)) throw new Error("Lượt khám không khớp thông tin đã chọn.");
  if (row.encounter_status === "CHECKED_IN") return row;
  if (!['ONLINE','WALK_IN'].includes(row.encounter_type) || row.encounter_status !== "CONFIRMED") throw new Error("Chỉ check-in lượt khám đã thanh toán. Vui lòng tải lại danh sách.");
  return confirmedEncounter(await encounters.checkIn(id, options), id, "CHECKED_IN");
}
export async function cancelReceptionEncounter(id, input, options = {}) {
  const reason = String(input.reason || "").trim();
  if (!reason || reason.length > 1000 || !["PATIENT", "HOSPITAL"].includes(input.cancel_origin)) throw new Error("Chọn hình thức hủy và nhập lý do, tối đa 1.000 ký tự.");
  return confirmedEncounter(await encounters.cancel(id, {reason, cancel_origin:input.cancel_origin}, options), id, "CANCELLED");
}
export async function createReceptionWalkIn(patientId, input, options = {}, scheduleId = null) {
  if (!Number.isSafeInteger(Number(patientId)) || Number(patientId) < 1 || !Number.isSafeInteger(Number(input.doctor_profile_id)) || Number(input.doctor_profile_id) < 1) throw new Error("Chọn đúng hồ sơ bệnh nhân và bác sĩ tiếp nhận.");
  const patient = patientResult((await patients.getPatient(patientId, options)).patient, patientId);
  const payload = {patient_id:patient.patient_id, doctor_profile_id:Number(input.doctor_profile_id), symptoms:String(input.symptoms || "").trim() || null};
  if(scheduleId != null) {
    if(!Number.isSafeInteger(Number(scheduleId)) || Number(scheduleId)<1)throw new Error("Ca khám không hợp lệ.");
    payload.schedule_id=Number(scheduleId);
  }
  if ((payload.symptoms || "").length > 5000) throw new Error("Triệu chứng tối đa 5.000 ký tự.");
  const row = confirmedEncounter(await encounters.createWalkIn(payload, options), null, "CHECKED_IN");
  if (row.encounter_type !== "WALK_IN" || String(row.patient_id) !== String(patientId) || String(row.doctor_profile_id) !== String(payload.doctor_profile_id) || !row.ticket_code || !row.schedule_id || (scheduleId != null && String(row.schedule_id)!==String(scheduleId))) throw new Error("Chưa xác minh được phiếu khám trực tiếp. Hãy kiểm tra danh sách trước khi tiếp nhận lại.");
  return row;
}
