import { apiRequest, pathSegment } from "../core/api.js";

export function getWorkSchedules(params = {}, options = {}) {
  return apiRequest("/staff/work-schedules", { ...options, method: "GET", params });
}
export function getStaffWorkSchedules(userId, params = {}, options = {}) {
  return apiRequest(`/admin/staff/${pathSegment(userId)}/work-schedules`, { ...options, method: "GET", params });
}
export function listLeaveRequests(params = {}, options = {}) {
  return apiRequest("/staff/leave-requests", { ...options, method: "GET", params });
}
export function createLeaveRequest(data, options = {}) {
  return apiRequest("/staff/leave-requests", { ...options, method: "POST", data });
}
export function getLeaveRequest(requestId, options = {}) {
  return apiRequest(`/staff/leave-requests/${pathSegment(requestId)}`, { ...options, method: "GET" });
}
export function cancelLeaveRequest(requestId, options = {}) {
  return apiRequest(`/staff/leave-requests/${pathSegment(requestId)}/cancel`, { ...options, method: "POST" });
}
export function listAdminLeaveRequests(params = {}, options = {}) {
  return apiRequest("/admin/leave-requests", { ...options, method: "GET", params });
}
export function getAdminLeaveRequest(requestId, options = {}) {
  return apiRequest(`/admin/leave-requests/${pathSegment(requestId)}`, { ...options, method: "GET" });
}
export function reviewLeaveRequest(requestId, data, options = {}) {
  return apiRequest(`/admin/leave-requests/${pathSegment(requestId)}/review`, { ...options, method: "POST", data });
}
