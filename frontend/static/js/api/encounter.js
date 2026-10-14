import { apiRequest, pathSegment } from "../core/api.js";

/** Bộ lọc: patient_id, schedule_id, doctor_profile_id, encounter_status, encounter_type, work_date, page, page_size. Online nhận patient_id/schedule_id/appointment_time/symptoms; chuyển bác sĩ nhận schedule_id/appointment_time/reason. Giờ dùng HH:MM, giá và mã phiếu do backend chốt. */

/** GET /encounters */
export function listEncounters(params = {}, options = {}) {
  return apiRequest("/encounters", { ...options, method: "GET", params });
}

/** GET /encounters/<int:encounter_id> */
export function getEncounter(encounterId, options = {}) {
  return apiRequest(`/encounters/${pathSegment(encounterId)}`, { ...options, method: "GET" });
}

/** GET /encounters/<int:encounter_id>/ticket */
export function getTicket(encounterId, options = {}) {
  return apiRequest(`/encounters/${pathSegment(encounterId)}/ticket`, { ...options, method: "GET" });
}

/** GET /encounters/<int:encounter_id>/status-history */
export function listStatusHistory(encounterId, params = {}, options = {}) {
  return apiRequest(`/encounters/${pathSegment(encounterId)}/status-history`, { ...options, method: "GET", params });
}

/** GET /encounters/<int:encounter_id>/transfer-history */
export function listTransferHistory(encounterId, params = {}, options = {}) {
  return apiRequest(`/encounters/${pathSegment(encounterId)}/transfer-history`, { ...options, method: "GET", params });
}

/** POST /encounters/online */
export function createOnline(data, options = {}) {
  return apiRequest("/encounters/online", { ...options, method: "POST", data });
}

/** POST /encounters/<int:encounter_id>/cancel */
export function cancel(encounterId, data = {}, options = {}) {
  return apiRequest(`/encounters/${pathSegment(encounterId)}/cancel`, { ...options, method: "POST", data });
}

/** POST /staff/encounters/walk-in */
export function createWalkIn(data, options = {}) {
  return apiRequest("/staff/encounters/walk-in", { ...options, method: "POST", data });
}

/** POST /staff/encounters/<int:encounter_id>/check-in */
export function checkIn(encounterId, options = {}) {
  return apiRequest(`/staff/encounters/${pathSegment(encounterId)}/check-in`, { ...options, method: "POST" });
}

/** GET /staff/appointment-tickets */
export function listStaffTickets(params = {}, options = {}) {
  return apiRequest("/staff/appointment-tickets", { ...options, method: "GET", params });
}

/** GET /staff/queues (alias tương thích của /staff/appointment-tickets) */
export function listStaffQueues(params = {}, options = {}) {
  return apiRequest("/staff/queues", { ...options, method: "GET", params });
}

/** GET /staff/encounters/<int:encounter_id>/transfer-options */
export function getTransferOptions(encounterId, params = {}, options = {}) {
  return apiRequest(`/staff/encounters/${pathSegment(encounterId)}/transfer-options`, { ...options, method: "GET", params });
}

/** POST /staff/encounters/<int:encounter_id>/transfer */
export function transfer(encounterId, data, options = {}) {
  return apiRequest(`/staff/encounters/${pathSegment(encounterId)}/transfer`, { ...options, method: "POST", data });
}

/** POST /staff/encounters/<int:encounter_id>/no-show */
export function noShow(encounterId, data = {}, options = {}) {
  return apiRequest(`/staff/encounters/${pathSegment(encounterId)}/no-show`, { ...options, method: "POST", data });
}

/** GET /staff/schedules/<int:schedule_id>/affected-encounters */
export function listAffectedEncounters(scheduleId, params = {}, options = {}) {
  return apiRequest(`/staff/schedules/${pathSegment(scheduleId)}/affected-encounters`, { ...options, method: "GET", params });
}

/** POST /doctor/encounters/<int:encounter_id>/start */
export function startExamination(encounterId, options = {}) {
  return apiRequest(`/doctor/encounters/${pathSegment(encounterId)}/start`, { ...options, method: "POST" });
}

