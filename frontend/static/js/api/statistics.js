import { apiRequest } from "../core/api.js";

/** Bộ lọc: from_date, to_date, doctor_profile_id, department_id, encounter_id, encounter_status, encounter_type, group_by, page, page_size. Giữ nguyên nhóm, số liệu, issues và lịch sử backend trả. */

/** GET /admin/statistics/encounters */
export function getEncounterStatistics(params = {}, options = {}) {
  return apiRequest("/admin/statistics/encounters", { ...options, method: "GET", params });
}

/** GET /admin/statistics/payments */
export function getPaymentStatistics(params = {}, options = {}) {
  return apiRequest("/admin/statistics/payments", { ...options, method: "GET", params });
}

/** GET /admin/statistics/reviews */
export function getReviewStatistics(params = {}, options = {}) {
  return apiRequest("/admin/statistics/reviews", { ...options, method: "GET", params });
}

/** GET /admin/audit/encounters */
export function getEncounterAudit(params = {}, options = {}) {
  return apiRequest("/admin/audit/encounters", { ...options, method: "GET", params });
}

