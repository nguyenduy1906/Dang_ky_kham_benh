import * as api from "../api/encounter.js";
import * as records from "../api/medical_record.js";
import { getPatient } from "../api/patient.js";
import { $, esc, date, time, facts, panel, dialog, badge, empty, encounterSummary, encounterColumns, table, statusOptions, pagination, run, submit, showError } from "./staff_ui.js";

export function registrationSummary(encounter) {
  const entry = encounter.registration_details;
  if (!entry) return "";
  return panel("Thông tin khai khi đặt khám", facts([["Họ tên khai", entry.full_name], ["Số điện thoại", entry.phone],
    ["CCCD / mã định danh", entry.id_card], ["Ngày sinh", date(entry.dob)], ["Giới tính", entry.gender],
    ["Địa chỉ khai", entry.address], ["BHYT", entry.health_insurance]]));
}

export async function readMedicalRecord(encounter) {
  let record;
  try { record = (await records.getRecord(encounter.encounter_id)).medical_record; }
  catch (error) { if (error.code === "MEDICAL_RECORD_NOT_FOUND") return panel("Bệnh án", "<p>Chưa có bệnh án cho lượt khám này.</p>"); throw error; }
  const items = (await records.listPrescriptionItems(record.record_id, { page_size: 100 })).items;
  return panel("Bệnh án", facts([["Chẩn đoán", record.diagnosis], ["Hướng điều trị", record.treatment], ["Ghi chú bác sĩ", record.doctor_notes], ["Ngày khám", date(record.examined_at)]])) + panel("Đơn thuốc", table(["Thuốc", "Liều dùng", "Số lượng", "Hướng dẫn"], items.map(item => `<tr><td>${esc(item.medication_name)}</td><td>${esc(item.dosage || "—")}</td><td>${item.quantity}</td><td>${esc(item.instructions || "—")}</td></tr>`)));
}

export function initEncounterList({ role, completed = false, assignments = [] }) {
  const params = new URLSearchParams(location.search);
  const scheduleId = /^\d+$/.test(params.get("schedule_id") || "") ? params.get("schedule_id") : "";
  const initialDate = /^\d{4}-\d{2}-\d{2}$/.test(params.get("work_date") || "") ? params.get("work_date") : "";
  $("#page-body").innerHTML = panel(completed ? "Các lượt đã hoàn tất" : "Danh sách lượt khám", `
    <form id="encounter-filters" class="staff-toolbar"><label>Ngày khám<input type="date" name="work_date" value="${initialDate}"></label>
    ${role === "nurse" ? `<label>Ca được phân công<select name="schedule_id"><option value="">Tất cả ca được giao</option>${assignments.map(a => `<option value="${a.schedule_id}" ${String(a.schedule_id) === scheduleId ? "selected" : ""}>${esc(a.room_name)} · ${date(a.work_date)} · ${esc(a.start_time.slice(0, 5))}</option>`).join("")}</select></label>` : `<input type="hidden" name="schedule_id" value="${scheduleId}">`}
    ${completed ? "" : `<label>Trạng thái<select name="encounter_status">${statusOptions()}</select></label>`}<button type="submit">Lọc lượt khám</button><button type="reset" class="secondary">Bỏ bộ lọc</button></form>
    <label>Tìm tên hoặc mã trong trang<input type="search" id="encounter-search" placeholder="Tên người bệnh, mã phiếu hoặc mã lượt"></label>
    <div id="encounter-list"></div><div id="list-pagination" class="list-pagination"></div>`);
  const form = $("#encounter-filters");
  let rows = [], page = 1, version = 0;
  async function load(next = 1) {
    page = next;
    const current = ++version;
    await run(async () => {
      const query = Object.fromEntries(new FormData(form));
      const result = await api.listEncounters({ ...query, encounter_status: completed ? "COMPLETED" : query.encounter_status, page, page_size: 20 });
      if (current !== version) return;
      rows = result.items; render(); pagination(result, load);
    });
  }
  function render() {
    const query = $("#encounter-search").value.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const matches = rows.filter(e => `${e.patient_name} ${e.encounter_id} ${e.ticket_code || ""}`.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().includes(query));
    $("#encounter-list").innerHTML = table(["Người bệnh / phiếu khám", "Khung giờ", "Phòng / bác sĩ", "Trạng thái", "Thao tác"], matches.map(e => `<tr>${encounterColumns(e)}<td><div class="actions"><button class="secondary" data-detail="${e.encounter_id}">Chi tiết</button>${role === "doctor" ? `<a class="button-link secondary" href="clinical.html?encounter_id=${e.encounter_id}">${completed ? "Xem / bổ sung" : "Mở bệnh án"}</a>` : ""}${role === "reception" && e.encounter_status === "CONFIRMED" ? `<button data-checkin="${e.encounter_id}">Check-in</button>` : ""}</div></td></tr>`));
    $("#encounter-list").querySelectorAll("[data-detail]").forEach(button => button.addEventListener("click", () => run(async () => {
      const e = (await api.getEncounter(button.dataset.detail)).encounter;
      const history = await api.listStatusHistory(e.encounter_id, { page_size: 100 });
      let clinical = "";
      if (role === "reception") clinical += registrationSummary(e);
      if (role === "nurse") {
        const { patient } = await getPatient(e.patient_id);
        clinical += panel("Thông tin người bệnh", facts([["Ngày sinh", date(patient.dob)], ["Giới tính", patient.gender], ["Điện thoại", patient.phone], ["BHYT", patient.health_insurance]]));
      }
      if (role === "nurse" || (role === "doctor" && ["IN_PROGRESS", "COMPLETED"].includes(e.encounter_status))) clinical += await readMedicalRecord(e);
      dialog("Chi tiết lượt khám", encounterSummary(e) + clinical + panel("Lịch sử trạng thái", table(["Thời gian", "Trạng thái", "Ghi chú"], history.items.map(h => `<tr><td>${date(h.changed_at)} ${time(h.changed_at)}</td><td>${badge(h.new_status)}</td><td>${esc(h.note || "—")}</td></tr>`))) + (role === "reception" && ["CONFIRMED", "CHECKED_IN"].includes(e.encounter_status) ? `<a class="button-link" href="coordination.html?encounter_id=${e.encounter_id}">Chuyển bác sĩ / ca</a>` : ""));
      if (role === "reception") {
        const actions = document.createElement("div"); actions.className = "actions";
        if (["HOLDING", "CONFIRMED", "CHECKED_IN"].includes(e.encounter_status)) actions.innerHTML += '<button type="button" data-reception-action="cancel" class="secondary">Hủy do bệnh viện</button>';
        if (e.encounter_status === "CONFIRMED") actions.innerHTML += '<button type="button" data-reception-action="no-show" class="secondary">Đánh dấu vắng mặt</button>';
        $("#staff-dialog-content").append(actions);
        actions.querySelectorAll("button").forEach(action => action.addEventListener("click", () => {
          const cancel = action.dataset.receptionAction === "cancel";
          dialog(cancel ? "Xác nhận hủy do bệnh viện" : "Xác nhận vắng mặt", encounterSummary(e) + `<form id="reception-action-form"><label>Lý do ${cancel ? "*" : ""}<textarea name="reason" rows="3" maxlength="1000" ${cancel ? "required" : ""}></textarea></label><p>${cancel ? "Hệ thống sẽ ghi nguyên nhân hủy và xử lý chính sách hoàn cọc tương ứng." : "Chỉ được đánh dấu vắng mặt sau khi kết thúc ca ít nhất 15 phút."}</p><button type="submit">Xác nhận ${cancel ? "hủy lượt khám" : "vắng mặt"}</button><p role="status" class="form-feedback"></p></form>`);
          $("#reception-action-form").addEventListener("submit", event => {
            event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
            submit(event.currentTarget, async () => { if (cancel) await api.cancel(e.encounter_id, { ...data, cancel_origin: "HOSPITAL" }); else await api.noShow(e.encounter_id, data); await load(page); }, cancel ? "Đã hủy lượt khám." : "Đã ghi nhận vắng mặt.");
          });
        }));
      }
    })));
    $("#encounter-list").querySelectorAll("[data-checkin]").forEach(button => button.addEventListener("click", () => {
      const e = rows.find(item => item.encounter_id === Number(button.dataset.checkin));
      dialog("Xác nhận check-in", encounterSummary(e) + registrationSummary(e) + '<form id="checkin-form"><p>Đối chiếu giấy tờ, số điện thoại và phiếu với người bệnh có mặt. Khi xác nhận tiếp nhận, hệ thống tạo tài khoản cho người bệnh nếu chưa có.</p><button type="submit">Xác nhận check-in</button><p role="status" class="form-feedback"></p></form>');
      $("#checkin-form").addEventListener("submit", event => { event.preventDefault(); submit(event.currentTarget, async () => { await api.checkIn(e.encounter_id); await load(page); }, "Đã check-in lượt khám."); });
    }));
  }
  form.addEventListener("submit", event => { event.preventDefault(); load(); });
  form.addEventListener("reset", event => { event.preventDefault(); for (const input of form.querySelectorAll("input, select")) input.value = ""; $("#encounter-search").value = ""; load(); });
  $("#encounter-search").addEventListener("input", render);
  return load();
}
