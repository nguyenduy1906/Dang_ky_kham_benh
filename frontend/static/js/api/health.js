import { apiRequest } from "../core/api.js";

/** Kiểm tra /health của backend, không tự chạy kiểm tra khi import module. */

/** GET /health */
export function check(options = {}) {
  return apiRequest("/health", { ...options, method: "GET", auth: false });
}

