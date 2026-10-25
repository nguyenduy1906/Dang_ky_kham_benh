import "./form_workflow.js";
import { API_CONFIG } from "../config.js";

// Chỉ giữ token trong bộ nhớ khi bên gọi chủ động cung cấp. Không tạo/lưu phiên.
let accessToken = null;
let pendingRequests = 0;
export const hasPendingApiRequests = () => pendingRequests > 0;

export function setAccessToken(token) {
  if (token !== null && typeof token !== "string") {
    throw new TypeError("Token phải là chuỗi hoặc null.");
  }
  accessToken = token || null;
}

/** Giữ nguyên status, error.code, error.message và toàn bộ phản hồi backend. */
export class ApiError extends Error {
  constructor(message, { status = 0, code = "CLIENT_ERROR", data = null, cause } = {}) {
    super(message, { cause });
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/** Mã hóa một tham số đường dẫn; không kiểm tra quy tắc nghiệp vụ của backend. */
export function pathSegment(value) {
  if (!["string", "number"].includes(typeof value) || String(value) === "" || [".", ".."].includes(String(value))) {
    throw new TypeError("Tham số đường dẫn phải là một chuỗi hoặc số không rỗng.");
  }
  return encodeURIComponent(String(value));
}

export function apiUrl(path, params = {}) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
    throw new TypeError("Đường dẫn API phải bắt đầu bằng một dấu /.");
  }
  const url = new URL(path, API_CONFIG.baseUrl);
  if (url.origin !== new URL(API_CONFIG.baseUrl).origin) {
    throw new TypeError("Đường dẫn API phải thuộc backend đã cấu hình.");
  }
  // Giữ false và 0; bỏ các bộ lọc chưa được chọn. Backend tự kiểm tra giá trị.
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.href;
}

/**
 * Gửi JSON hoặc FormData và trả nguyên phản hồi JSON (ảnh trả Blob).
 * options: token (ghi đè token trong bộ nhớ), signal, timeoutMs, headers.
 * Không tự retry, chuyển trang, hiển thị lỗi hoặc thay đổi phiên đăng nhập.
 */
export async function apiRequest(path, {
  method = "GET", params = {}, data, token = accessToken, auth = true,
  responseType = "json", signal, timeoutMs = API_CONFIG.timeoutMs, headers = {},
} = {}) {
  const url = apiUrl(path, params);
  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has("Accept")) requestHeaders.set("Accept", responseType === "blob" ? "image/*" : "application/json");
  requestHeaders.delete("Authorization");
  if (auth && token) requestHeaders.set("Authorization", `Bearer ${token}`);
  let body;
  if (data instanceof FormData) {
    body = data;
    // Trình duyệt phải tự tạo multipart boundary.
    requestHeaders.delete("Content-Type");
  } else if (data !== undefined) {
    body = JSON.stringify(data);
    requestHeaders.set("Content-Type", "application/json");
  }
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(signal.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = timeoutMs > 0 ? setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs) : null;
  pendingRequests++;
  try {
    const response = await fetch(url, {
      method, headers: requestHeaders, body, signal: controller.signal,
      credentials: "omit", cache: "no-store",
    });
    if (response.ok && responseType === "blob") return await response.blob();
    if (response.status === 204) return null;
    const text = await response.text();
    let payload;
    try { payload = text ? JSON.parse(text) : null; }
    catch (cause) {
      throw new ApiError(response.ok ? "Phản hồi API không phải JSON hợp lệ." : `Yêu cầu thất bại (HTTP ${response.status}).`, {
        status: response.status, code: response.ok ? "CLIENT_INVALID_RESPONSE" : "HTTP_ERROR", cause,
      });
    }
    if (!response.ok) {
      throw new ApiError(payload?.error?.message || `Yêu cầu thất bại (HTTP ${response.status}).`, {
        status: response.status, code: payload?.error?.code || "HTTP_ERROR", data: payload,
      });
    }
    return payload;
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    const code = timedOut ? "CLIENT_TIMEOUT" : controller.signal.aborted ? "CLIENT_ABORTED" : "CLIENT_NETWORK_ERROR";
    const message = timedOut ? "Máy chủ phản hồi quá lâu." : controller.signal.aborted ? "Yêu cầu đã được hủy." : "Hệ thống chưa sẵn sàng hoạt động.";
    throw new ApiError(message, { code, cause });
  } finally {
    pendingRequests--;
    if (timer !== null) clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
