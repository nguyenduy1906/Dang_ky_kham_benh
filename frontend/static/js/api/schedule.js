import { apiRequest, pathSegment } from "../core/api.js";

export const listStaffSchedules = (params = {}, options = {}) => apiRequest('/staff/schedules', {...options, method:'GET', params});
export const getStaffSchedule = (id, options = {}) => apiRequest(`/staff/schedules/${pathSegment(id)}`, {...options, method:'GET'});
export const getStaffRoomOptions = (id, options = {}) => apiRequest(`/staff/schedules/${pathSegment(id)}/room-options`, {...options, method:'GET'});
export const assignStaffRoom = (id, data, options = {}) => apiRequest(`/staff/schedules/${pathSegment(id)}/room`, {...options, method:'PATCH', data});

/** Bộ lọc ca: doctor_profile_id, room_id, department_id, from_date, to_date, status, page, page_size. Phân công: nurse_id, schedule_id, include_revoked, page, page_size. */

/** GET /doctors/<int:doctor_profile_id>/schedules */
export function listDoctorSchedules(doctorProfileId, params = {}, options = {}) {
  return apiRequest(`/doctors/${pathSegment(doctorProfileId)}/schedules`, { ...options, method: "GET", params, auth: false });
}

/** GET /doctor/schedules */
export function listOwnSchedules(params = {}, options = {}) {
  return apiRequest("/doctor/schedules", { ...options, method: "GET", params });
}

/** GET /admin/schedules */
export function listAdminSchedules(params = {}, options = {}) {
  return apiRequest("/admin/schedules", { ...options, method: "GET", params });
}

/** POST /admin/schedules */
export function createSchedule(data, options = {}) {
  return apiRequest("/admin/schedules", { ...options, method: "POST", data });
}

/** PATCH /admin/schedules/<int:schedule_id> */
export function updateSchedule(scheduleId, data, options = {}) {
  return apiRequest(`/admin/schedules/${pathSegment(scheduleId)}`, { ...options, method: "PATCH", data });
}

/** POST /doctor/schedules/<int:schedule_id>/unavailability */
export function reportUnavailable(scheduleId, data, options = {}) {
  return apiRequest(`/doctor/schedules/${pathSegment(scheduleId)}/unavailability`, { ...options, method: "POST", data });
}

/** GET /admin/nurse-assignments */
export function listNurseAssignments(params = {}, options = {}) {
  return apiRequest("/admin/nurse-assignments", { ...options, method: "GET", params });
}

/** POST /admin/nurse-assignments */
export function createNurseAssignment(data, options = {}) {
  return apiRequest("/admin/nurse-assignments", { ...options, method: "POST", data });
}

/** POST /admin/nurse-assignments/<int:assignment_id>/revoke */
export function revokeNurseAssignment(assignmentId, options = {}) {
  return apiRequest(`/admin/nurse-assignments/${pathSegment(assignmentId)}/revoke`, { ...options, method: "POST" });
}

/** GET /nurse/assignments */
export function listOwnNurseAssignments(params = {}, options = {}) {
  return apiRequest("/nurse/assignments", { ...options, method: "GET", params });
}


export function getNurseAssignment(id,options={}) {
  return apiRequest(`/admin/nurse-assignments/${pathSegment(id)}`,{...options,method:"GET"});
}
export function updateNurseAssignment(id,data,options={}) {
  return apiRequest(`/admin/nurse-assignments/${pathSegment(id)}`,{...options,method:"PATCH",data});
}
