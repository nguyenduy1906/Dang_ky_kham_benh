import { apiRequest, pathSegment } from "../core/api.js";

/** Bệnh án: diagnosis, treatment, doctor_notes, reason, expected_version. Đơn thuốc: { items, reason, expected_version }, giữ nguyên items=[]; đánh giá: rating, comment. Lịch sử/version và điều kiện sửa do backend xử lý. */

/** GET /encounters/<int:encounter_id>/medical-record */
export function getRecord(encounterId, options = {}) {
  return apiRequest(`/encounters/${pathSegment(encounterId)}/medical-record`, { ...options, method: "GET" });
}

/** PUT /doctor/encounters/<int:encounter_id>/medical-record */
export function saveRecord(encounterId, data, options = {}) {
  return apiRequest(`/doctor/encounters/${pathSegment(encounterId)}/medical-record`, { ...options, method: "PUT", data });
}

/** GET /medical-records/<int:record_id>/prescription-items */
export function listPrescriptionItems(recordId, params = {}, options = {}) {
  return apiRequest(`/medical-records/${pathSegment(recordId)}/prescription-items`, { ...options, method: "GET", params });
}

/** PUT /doctor/medical-records/<int:record_id>/prescription-items */
export function savePrescriptionItems(recordId, data, options = {}) {
  return apiRequest(`/doctor/medical-records/${pathSegment(recordId)}/prescription-items`, { ...options, method: "PUT", data });
}

/** POST /doctor/encounters/<int:encounter_id>/complete */
export function completeEncounter(encounterId, options = {}) {
  return apiRequest(`/doctor/encounters/${pathSegment(encounterId)}/complete`, { ...options, method: "POST" });
}

/** POST /encounters/<int:encounter_id>/review */
export function createReview(encounterId, data, options = {}) {
  return apiRequest(`/encounters/${pathSegment(encounterId)}/review`, { ...options, method: "POST", data });
}

/** GET /doctors/<int:doctor_profile_id>/reviews */
export function listDoctorReviews(doctorProfileId, params = {}, options = {}) {
  return apiRequest(`/doctors/${pathSegment(doctorProfileId)}/reviews`, { ...options, method: "GET", params, auth: false });
}

