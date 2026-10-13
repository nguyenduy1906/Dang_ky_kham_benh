import { apiRequest, pathSegment } from "../core/api.js";

/** Bộ lọc: unread_only, page, page_size. Giữ nguyên unread_count và updated_count từ backend. */

/** GET /notifications */
export function listNotifications(params = {}, options = {}) {
  return apiRequest("/notifications", { ...options, method: "GET", params });
}

/** GET /notifications/unread-count */
export function getUnreadCount(options = {}) {
  return apiRequest("/notifications/unread-count", { ...options, method: "GET" });
}

/** PATCH /notifications/<int:notification_id>/read */
export function markRead(notificationId, options = {}) {
  return apiRequest(`/notifications/${pathSegment(notificationId)}/read`, { ...options, method: "PATCH" });
}

/** POST /notifications/read-all */
export function readAll(options = {}) {
  return apiRequest("/notifications/read-all", { ...options, method: "POST" });
}

