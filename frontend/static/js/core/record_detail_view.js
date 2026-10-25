import { esc, facts, badge } from "./staff_ui.js";

export function recordDetailView({ name, patientCode, status, patientFields, visitFields, symptoms, clinical }) {
  return `<div class="record-detail-view">
    <header class="record-detail-person"><div><h3>${esc(name || "Người bệnh")}</h3><p>${esc(patientCode || "")}</p></div>${badge(status)}</header>
    <section class="record-detail-section"><h3>Thông tin người bệnh</h3>${facts(patientFields)}</section>
    <section class="record-detail-section"><h3>Thông tin lượt khám</h3>${facts(visitFields)}<div class="record-detail-symptoms"><h4>Lý do đến khám / triệu chứng</h4><p>${esc(symptoms || "Chưa cập nhật")}</p></div></section>
    <div class="record-detail-clinical">${clinical}</div>
  </div>`;
}
