// Cấu hình dùng chung cho các ES module gọi API.
// Đổi baseUrl tại đây nếu backend chạy ở địa chỉ/cổng khác.
export const API_CONFIG = Object.freeze({
  baseUrl: "http://127.0.0.1:5000",
  timeoutMs: 15000,
});
