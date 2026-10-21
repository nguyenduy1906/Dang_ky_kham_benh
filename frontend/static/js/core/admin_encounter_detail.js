import { esc, facts, date, money, badge, label } from "./admin_ui.js";
import { code } from "./business_codes.js";

export function encounterDetails(row, {showActions=true} = {}) {
  const formatter = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit",
  });
  const time = [row.estimated_exam_at,row.appointment_end_at].map(value=>value&&Number.isFinite(Date.parse(value))?formatter.format(new Date(value)):"—").join(" – ");
  const id = encodeURIComponent(row.encounter_id);
  return `<div class="admin-encounter-detail">
    <div class="admin-encounter-summary"><div><span class="admin-encounter-code">${esc(code("LK", row.encounter_id))}</span><h3>${esc(row.patient_name || "Chưa có tên người bệnh")}</h3></div>${badge(row.encounter_status)}</div>
    <section class="admin-encounter-section" aria-label="Thông tin khám">${facts([
      ["Bác sĩ", row.doctor_name || "Chưa phân công"], ["Phòng khám", row.room_name || "Chưa phân công"],
      ["Hình thức", label(row.encounter_type)], ["Ngày khám", date(row.work_date)],
      ["Khung giờ", time], ["Mã phiếu", row.ticket_code || "Chưa phát phiếu"],
    ])}</section>
    <section class="admin-encounter-symptoms"><h3>Triệu chứng</h3><p>${esc(row.symptoms || "Chưa ghi nhận triệu chứng")}</p></section>
    <dl class="admin-encounter-fee"><div><dt>Tiền khám bệnh</dt><dd>${esc(row.consultation_fee_snapshot == null ? "Chưa có thông tin" : money(row.consultation_fee_snapshot))}</dd></div></dl>
    ${row.cancel_reason ? `<section class="admin-encounter-cancellation"><h3>Lý do hủy</h3><p>${esc(row.cancel_reason)}</p></section>` : ""}
    ${showActions?`<div class="actions admin-encounter-actions"><a class="button-link secondary" href="payments.html?encounter_id=${id}">Giao dịch của lượt khám</a></div>`:""}
  </div>`;
}
