import { panel, table, encounterColumns } from "./staff_ui.js";

export function receptionShiftVisits(rows) {
  const eligible = rows.filter(row => ["ONLINE", "WALK_IN"].includes(row.encounter_type)
    && ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "NO_SHOW"].includes(row.encounter_status));
  const markup = table(["Người bệnh / phiếu", "Khung giờ", "Hình thức", "Phòng / bác sĩ", "Trạng thái", "Thao tác"], eligible.map(row => {
    const columns = encounterColumns(row);
    const split = columns.indexOf("</td>", columns.indexOf("</td>") + 5) + 5;
    return `<tr>${columns.slice(0, split)}<td><span class="reception-visit-type ${row.encounter_type === "ONLINE" ? "is-online" : "is-direct"}">${row.encounter_type === "ONLINE" ? "Online" : "Trực tiếp"}</span></td>${columns.slice(split)}<td><a href="walk_in.html?schedule_id=${encodeURIComponent(row.schedule_id)}" class="button-link secondary">Xem ca khám</a></td></tr>`;
  }));
  return `<div class="reception-shift-visits">${panel("Lượt khám trong ca", `<div class="reception-shift-scroll" tabindex="0" role="region" aria-label="Lượt khám trong ca, cuộn để xem thêm">${markup}</div>`, '<a href="walk_in.html">Tất cả lượt khám →</a>')}</div>`;
}
