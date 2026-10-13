import { apiRequest, pathSegment } from "../core/api.js";

/** Bộ lọc: page/page_size. Cập nhật nhận { config_value }; backend quyết định khóa được sửa và trả read_only/effective_value. */

/** GET /admin/configurations */
export function listConfigurations(params = {}, options = {}) {
  return apiRequest("/admin/configurations", { ...options, method: "GET", params });
}

/** PATCH /admin/configurations/<string:key> */
export function updateConfiguration(key, data, options = {}) {
  return apiRequest(`/admin/configurations/${pathSegment(key)}`, { ...options, method: "PATCH", data });
}

