import { bookingUrl } from "./session.js";

export const statusLabels = Object.freeze({
  HOLDING: "Đang giữ chỗ", CONFIRMED: "Đã xác nhận", CHECKED_IN: "Đã check-in",
  IN_PROGRESS: "Đang khám", COMPLETED: "Đã khám xong", EXPIRED: "Hết hạn giữ chỗ",
  CANCELLED: "Đã hủy", NO_SHOW: "Không tới khám",
});
const active = new Set(["HOLDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"]);
export function isUpcoming(encounter, now = Date.now()) {
  const end = new Date(encounter.appointment_end_at).getTime();
  const unexpiredHold = encounter.encounter_status !== "HOLDING" || new Date(encounter.hold_expires_at).getTime() > now;
  return active.has(encounter.encounter_status) && Number.isFinite(end) && end > now && unexpiredHold;
}
export function filterAppointments(items, { view = "upcoming", patient = "", status = "" } = {}, now = Date.now()) {
  return items.filter(item => isUpcoming(item, now) === (view === "upcoming") &&
    (!patient || String(item.patient_id) === String(patient)) && (!status || item.encounter_status === status))
    .sort((a, b) => (view === "upcoming" ? 1 : -1) *
      (new Date(a.estimated_exam_at) - new Date(b.estimated_exam_at)) || b.encounter_id - a.encounter_id);
}
export function appointmentActionUrl(encounter) {
  const url = new URL(bookingUrl);
  if (encounter.encounter_status === "HOLDING") url.searchParams.set("encounter", encounter.encounter_id);
  else url.searchParams.set("doctor", encounter.doctor_profile_id);
  return url.href;
}

export function cancellationNotice(encounter, now = Date.now()) {
  const status = encounter.encounter_status;
  if (status === "CANCELLED") return { allowed: false, message: "Lịch khám này đã được hủy trước đó." };
  if (status === "EXPIRED") return { allowed: false, message: "Lịch đã hết hạn giữ chỗ, không còn lịch đang hiệu lực để hủy." };
  if (!["HOLDING", "CONFIRMED"].includes(status)) return { allowed: false, message: "Lịch không còn ở trạng thái bệnh nhân được tự hủy. Vui lòng liên hệ bộ phận tiếp nhận để được hỗ trợ." };
  if (!isUpcoming(encounter, now)) return { allowed: false, message: "Thời gian giữ chỗ hoặc khung giờ khám đã hết hạn. Vui lòng tải lại danh sách và liên hệ bộ phận tiếp nhận nếu cần hỗ trợ." };
  if (status === "HOLDING") return { allowed: true, message: "Lịch đang giữ chỗ, chưa xác nhận thanh toán. Nếu bạn đã chuyển tiền nhưng chưa có kết quả, hãy kiểm tra giao dịch; hệ thống xử lý khoản thu đến muộn theo chính sách." };
  const hours = (new Date(encounter.estimated_exam_at).getTime() - now) / 3600000;
  return { allowed: true, message: hours >= 12
    ? "Nếu hủy theo nhu cầu cá nhân lúc này, bạn được xét hoàn 50% tiền cọc theo chính sách. Việc hoàn tiền do bộ phận quản trị xử lý riêng, chưa được thực hiện khi bạn bấm hủy."
    : "Đã dưới 12 giờ trước giờ hẹn. Nếu hủy theo nhu cầu cá nhân lúc này, bạn không được hoàn tiền cọc." };
}
