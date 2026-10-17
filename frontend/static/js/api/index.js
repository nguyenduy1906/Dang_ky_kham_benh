/**
 * Điểm import chung cho lớp API (ES modules), chưa được nạp vào HTML.
 * Ví dụ khi nối trang sau này:
 *   import { authApi, setAccessToken } from "./api/index.js";
 *   const result = await authApi.login({ identifier, password });
 *   setAccessToken(result.access_token); // chỉ khi bên gọi chủ động muốn dùng token
 *   const me = await authApi.getMe();
 * Các hàm không tự chạy request, tạo phiên, chuyển trang hay đổi giao diện.
 */
export { ApiError, apiRequest, apiUrl, setAccessToken } from "../core/api.js";
export * as authApi from "./auth.js";
export * as catalogApi from "./catalog.js";
export * as doctorApi from "./doctor.js";
export * as scheduleApi from "./schedule.js";
export * as staffLeaveApi from "./staff_leave.js";
export * as patientApi from "./patient.js";
export * as encounterApi from "./encounter.js";
export * as paymentApi from "./payment.js";
export * as notificationApi from "./notification.js";
export * as medicalRecordApi from "./medical_record.js";
export * as articleApi from "./article.js";
export * as configurationApi from "./configuration.js";
export * as statisticsApi from "./statistics.js";
export * as healthApi from "./health.js";

