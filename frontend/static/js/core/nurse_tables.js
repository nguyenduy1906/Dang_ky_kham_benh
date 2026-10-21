import { code } from "./business_codes.js";
import { esc, date, time, badge, table, empty } from "./staff_ui.js";
import { attendance } from "./nurse_encounter_data.js";

export function nurseAssignmentTable(items, range = null) {
  return items.length ? `<div class="nurse-assignment-table">${table(["Mã phòng", "Phòng / bác sĩ", "Ngày làm việc", "Giờ làm việc", "Trạng thái", "Danh sách khám"], items.map(a => {
    const params = new URLSearchParams({ ...(range ? { from_date: range.from, to_date: range.to } : {}), schedule_id: a.schedule_id });
    return `<tr><td><strong>${esc(code("PH", a.room_id))}</strong></td>
      <td><strong>${esc(a.room_name)}</strong>${a.doctor_name ? `<small class="cell-subtitle">${esc(a.doctor_name)}</small>` : ""}${a.note ? `<small class="cell-subtitle">${esc(a.note)}</small>` : ""}</td>
      <td>${date(a.work_date)}</td><td>${esc(String(a.start_time || "").slice(0, 5))} – ${esc(String(a.end_time || "").slice(0, 5))}</td>
      <td>${badge(a.schedule_status)}</td><td><a class="button-link secondary" href="patients.html?${esc(params.toString())}">Mở danh sách khám</a></td></tr>`;
  }))}</div>` : empty("Chưa có phân công phù hợp.");
}

export function nurseVisitTable(items, action = e => `<button type="button" class="secondary" data-visit="${esc(e.encounter_id)}">Xem chi tiết</button>`) {
  return items.length ? `<div class="nurse-visit-table">${table(["Người bệnh / phiếu khám", "Ngày / giờ khám", "Phòng / bác sĩ", "Trạng thái", "Hoạt động", "Chi tiết"], items.map(e => `<tr>
    <td><strong>${esc(e.patient_name)}</strong><small class="cell-subtitle">${esc(e.ticket_code || `Lượt ${code("LK", e.encounter_id)}`)}</small></td>
    <td>${date(e.work_date)}<small class="cell-subtitle">${time(e.estimated_exam_at)} – ${time(e.appointment_end_at)}</small></td>
    <td>${esc(e.room_name)}<small class="cell-subtitle">${esc(e.doctor_name)}</small></td>
    <td>${badge(e.encounter_status)}</td><td>${attendance(e)}</td>
    <td><div class="actions">${action(e)}</div></td></tr>`))}</div>` : empty("Không có người bệnh phù hợp với bộ lọc.");
}

export function nurseRecordTable(items, latest, action = p => `<button type="button" class="secondary" data-patient="${esc(p.patient_id)}">Xem hồ sơ</button>`) {
  return items.length ? `<div class="nurse-record-table">${table(["Người bệnh", "Ngày khám", "Điện thoại", "Kết quả", "Hồ sơ"], items.map(p => {
    const last = latest.get(String(p.patient_id));
    return `<tr><td><strong>${esc(p.full_name)}</strong><small class="cell-subtitle">Mã hồ sơ ${esc(code("BN", p.patient_id))}</small></td><td>${date(last.work_date)}</td><td>${esc(p.phone || "—")}</td><td>${badge(last.encounter_status)}</td><td><div class="actions">${action(p)}</div></td></tr>`;
  }))}</div>` : empty("Chưa có người bệnh đã khám xong hoặc không đến khám phù hợp.");
}
