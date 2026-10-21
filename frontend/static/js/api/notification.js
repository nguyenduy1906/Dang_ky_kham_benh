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
export async function markRead(notificationId, options = {}) {
  const result=await apiRequest(`/notifications/${pathSegment(notificationId)}/read`, { ...options, method: "PATCH" });
  if(typeof window!=='undefined'&&typeof window.dispatchEvent==='function')window.dispatchEvent(new Event('notifications-changed'));
  return result;
}

/** POST /notifications/read-all */
export async function readAll(options = {}) {
  const result=await apiRequest("/notifications/read-all", { ...options, method: "POST" });
  if(typeof window!=='undefined'&&typeof window.dispatchEvent==='function')window.dispatchEvent(new Event('notifications-changed'));
  return result;
}

