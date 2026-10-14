import { apiRequest, pathSegment } from "../core/api.js";

/** Bộ lọc: include_inactive, department_id. Quyền xem dữ liệu ngừng hoạt động do backend quyết định. */

/** GET /departments */
export function listDepartments(params = {}, options = {}) {
  return apiRequest("/departments", { ...options, method: "GET", params });
}

/** GET /departments/<int:department_id> */
export function getDepartment(departmentId, options = {}) {
  return apiRequest(`/departments/${pathSegment(departmentId)}`, { ...options, method: "GET" });
}

/** POST /admin/departments */
export function createDepartment(data, options = {}) {
  return apiRequest("/admin/departments", { ...options, method: "POST", data });
}

/** PATCH /admin/departments/<int:department_id> */
export function updateDepartment(departmentId, data, options = {}) {
  return apiRequest(`/admin/departments/${pathSegment(departmentId)}`, { ...options, method: "PATCH", data });
}

/** GET /rooms */
export function getDepartmentLeadership(departmentId, options = {}) {
  return apiRequest(`/admin/departments/${pathSegment(departmentId)}/leadership`, { ...options, method: "GET" });
}
export function replaceDepartmentLeadership(departmentId, data, options = {}) {
  return apiRequest(`/admin/departments/${pathSegment(departmentId)}/leadership`, { ...options, method: "PUT", data });
}
export function uploadDepartmentImage(departmentId, file, options = {}) {
  const data = new FormData(); data.append("file", file);
  return apiRequest(`/admin/departments/${pathSegment(departmentId)}/images`, { ...options, method: "POST", data });
}

/** GET /rooms */
export function listRooms(params = {}, options = {}) {
  return apiRequest("/rooms", { ...options, method: "GET", params });
}

/** POST /admin/rooms */
export function createRoom(data, options = {}) {
  return apiRequest("/admin/rooms", { ...options, method: "POST", data });
}

/** PATCH /admin/rooms/<int:room_id> */
export function updateRoom(roomId, data, options = {}) {
  return apiRequest(`/admin/rooms/${pathSegment(roomId)}`, { ...options, method: "PATCH", data });
}

