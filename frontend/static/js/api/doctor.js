import { apiRequest, pathSegment } from "../core/api.js";

/** Bộ lọc: department_id, q, include_inactive, page, page_size. ID là doctor_profile_id. Avatar tải lên dùng trường multipart 'file'; tải về trả Blob. */

/** GET /doctors */
export function listDoctors(params = {}, options = {}) {
  return apiRequest("/doctors", { ...options, method: "GET", params });
}

/** GET /doctors/<int:doctor_profile_id> */
export function getDoctor(doctorProfileId, options = {}) {
  return apiRequest(`/doctors/${pathSegment(doctorProfileId)}`, { ...options, method: "GET" });
}

/** POST /admin/doctors */
export function createDoctor(data, options = {}) {
  return apiRequest("/admin/doctors", { ...options, method: "POST", data });
}

/** PATCH /admin/doctors/<int:doctor_profile_id> */
export function updateDoctor(doctorProfileId, data, options = {}) {
  return apiRequest(`/admin/doctors/${pathSegment(doctorProfileId)}`, { ...options, method: "PATCH", data });
}

/** GET /doctor/profile */
export function getOwnProfile(options = {}) {
  return apiRequest("/doctor/profile", { ...options, method: "GET" });
}

/** PATCH /doctor/profile */
export function updateOwnProfile(data, options = {}) {
  return apiRequest("/doctor/profile", { ...options, method: "PATCH", data });
}

/** POST /doctor/profile/avatar */
export function uploadAvatar(file, options = {}) {
  const data = new FormData();
  data.append("file", file);
  return apiRequest("/doctor/profile/avatar", { ...options, method: "POST", data });
}

/** POST /admin/doctors/<int:doctor_profile_id>/avatar */
export function uploadDoctorAvatar(doctorProfileId, file, options = {}) {
  const data = new FormData(); data.append("file", file);
  return apiRequest(`/admin/doctors/${pathSegment(doctorProfileId)}/avatar`, { ...options, method: "POST", data });
}

/** GET /uploads/avatars/<filename> */
export function getAvatar(filename, options = {}) {
  return apiRequest(`/uploads/avatars/${pathSegment(filename)}`, { ...options, method: "GET", auth: false, responseType: "blob" });
}

