import { apiRequest, pathSegment } from "../core/api.js";

/** Payload giữ tên trường backend: identifier/password, full_name/email/phone, otp, reset_token/new_password, current_password/new_password, account_status. Hàm login/logout chỉ gửi request; không tự lưu/xóa token. */

/** POST /auth/register */
export function register(data, options = {}) {
  return apiRequest("/auth/register", { ...options, method: "POST", data, auth: false });
}

/** POST /auth/login */
export function login(data, options = {}) {
  return apiRequest("/auth/login", { ...options, method: "POST", data, auth: false });
}

/** POST /auth/logout */
export function logout(options = {}) {
  return apiRequest("/auth/logout", { ...options, method: "POST" });
}

/** POST /auth/forgot-password */
export function forgotPassword(data, options = {}) {
  return apiRequest("/auth/forgot-password", { ...options, method: "POST", data, auth: false });
}

/** POST /auth/verify-otp */
export function verifyOtp(data, options = {}) {
  return apiRequest("/auth/verify-otp", { ...options, method: "POST", data, auth: false });
}

/** POST /auth/reset-password */
export function resetPassword(data, options = {}) {
  return apiRequest("/auth/reset-password", { ...options, method: "POST", data, auth: false });
}


/** GET /me */
export function getMe(options = {}) {
  return apiRequest("/me", { ...options, method: "GET" });
}

/** PATCH /me */
export function updateMe(data, options = {}) {
  return apiRequest("/me", { ...options, method: "PATCH", data });
}

/** POST /me/avatar; the same account avatar endpoint is available to every role. */
export function uploadMyAvatar(file, options = {}) {
  const data = new FormData();
  data.append("file", file);
  return apiRequest("/me/avatar", { ...options, method: "POST", data });
}


/** POST /me/change-password */
export function changePassword(data, options = {}) {
  return apiRequest("/me/change-password", { ...options, method: "POST", data });
}

/** GET /admin/roles */
export function listRoles(options = {}) {
  return apiRequest("/admin/roles", { ...options, method: "GET" });
}

/** GET /admin/users */
export function listUsers(params = {}, options = {}) {
  return apiRequest("/admin/users", { ...options, method: "GET", params });
}

/** POST /admin/users */
export function createUser(data, options = {}) {
  return apiRequest("/admin/users", { ...options, method: "POST", data });
}

/** GET /admin/users/<int:user_id> */
export function getUser(userId, options = {}) {
  return apiRequest(`/admin/users/${pathSegment(userId)}`, { ...options, method: "GET" });
}

/** PATCH /admin/users/<int:user_id> */
export function updateUser(userId, data, options = {}) {
  return apiRequest(`/admin/users/${pathSegment(userId)}`, { ...options, method: "PATCH", data });
}

/** PATCH /admin/users/<int:user_id>/account-status */
export function setAccountStatus(userId, data, options = {}) {
  return apiRequest(`/admin/users/${pathSegment(userId)}/account-status`, { ...options, method: "PATCH", data });
}


