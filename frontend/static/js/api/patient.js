import { apiRequest, pathSegment } from "../core/api.js";

/** Bộ lọc: q, include_archived, page, page_size. Tạo hồ sơ gửi nguyên dữ liệu, gồm confirm_shared_phone khi người gọi đã xác nhận; không tự xác nhận hoặc tạo tài khoản ở FE. */

/** GET /patients */
export function listPatients(params = {}, options = {}) {
  return apiRequest("/patients", { ...options, method: "GET", params });
}

/** POST /patients */
export function createPatient(data, options = {}) {
  return apiRequest("/patients", { ...options, method: "POST", data });
}

/** GET /patients/<int:patient_id> */
export function getPatient(patientId, options = {}) {
  return apiRequest(`/patients/${pathSegment(patientId)}`, { ...options, method: "GET" });
}

/** PATCH /patients/<int:patient_id> */
export function updatePatient(patientId, data, options = {}) {
  return apiRequest(`/patients/${pathSegment(patientId)}`, { ...options, method: "PATCH", data });
}

/** POST /patients/<int:patient_id>/archive */
export function archivePatient(patientId, options = {}) {
  return apiRequest(`/patients/${pathSegment(patientId)}/archive`, { ...options, method: "POST" });
}

/** GET /patients/<int:patient_id>/encounters */
export function listEncounters(patientId, params = {}, options = {}) {
  return apiRequest(`/patients/${pathSegment(patientId)}/encounters`, { ...options, method: "GET", params });
}

