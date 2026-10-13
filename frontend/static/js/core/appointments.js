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
