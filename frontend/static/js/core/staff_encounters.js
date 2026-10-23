import { doctorEncounterStatuses, loadDoctorEncounterRows, doctorEncounterTable } from "./doctor_encounter_list.js";
import { code } from "./business_codes.js";
import { startAutoRefresh } from "./auto_refresh.js";
import * as api from "../api/encounter.js";
import * as records from "../api/medical_record.js";
import { getPatient } from "../api/patient.js";
import { $, esc, date, today, time, facts, panel, dialog, badge, encounterSummary, encounterColumns, table, statusOptions, pagination, run, submit } from "./staff_ui.js";

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
  return medicalRecordMarkup(record,items);
}
export function medicalRecordMarkup(record, items = []) {
  if(!record) return panel("Bệnh án","<p>Chưa có bệnh án cho lượt khám này.</p>");
  return panel("Bệnh án", facts([["Chẩn đoán", record.diagnosis], ["Hướng điều trị", record.treatment], ["Ghi chú bác sĩ", record.doctor_notes], ["Ngày khám", date(record.examined_at)]])) + panel("Đơn thuốc", table(["Thuốc", "Liều dùng", "Số lượng", "Hướng dẫn"], items.map(item => `<tr><td>${esc(item.medication_name)}</td><td>${esc(item.dosage || "—")}</td><td>${item.quantity}</td><td>${esc(item.instructions || "—")}</td></tr>`)));
}

export async function initEncounterList({ role, completed = false, assignments = [], target = "#page-body", compact = false }) {
  const params = new URLSearchParams(location.search);
  const scheduleId = /^\d+$/.test(params.get("schedule_id") || "") ? params.get("schedule_id") : "";
  const initialDate = /^\d{4}-\d{2}-\d{2}$/.test(params.get("work_date") || "") ? params.get("work_date") : ["doctor", "reception"].includes(role) ? today() : "";
  const receptionSearch = role === "reception";
  const doctorSearch = role === "doctor" && compact;
  const doctorList = doctorSearch && !completed;
  const visibleStatuses = new Set(doctorEncounterStatuses);
  const searchField = `<label class="encounter-search-field">Tìm kiếm<input type="search" id="encounter-search" placeholder="Tên bệnh nhân, mã phiếu, phòng, bác sĩ…"></label>`;
  $(target).innerHTML = panel(completed ? "Các lượt đã hoàn tất" : "Danh sách lượt khám", `
    <form id="encounter-filters" class="staff-toolbar${receptionSearch ? " reception-encounter-filters" : ""}">${receptionSearch ? searchField : ""}<label>Ngày khám<input type="date" name="work_date" value="${initialDate}"></label>
    ${role === "nurse" ? `<label>Ca được phân công<select name="schedule_id"><option value="">Tất cả ca được giao</option>${assignments.map(a => `<option value="${a.schedule_id}" ${String(a.schedule_id) === scheduleId ? "selected" : ""}>${esc(a.room_name)} · ${date(a.work_date)} · ${esc(a.start_time.slice(0, 5))}</option>`).join("")}</select></label>` : `<input type="hidden" name="schedule_id" value="${scheduleId}">`}
    ${completed ? "" : `<label>Trạng thái<select name="encounter_status">${statusOptions()}</select></label>`}${doctorSearch ? searchField : ""}${compact || receptionSearch ? "" : '<button type="submit">Lọc lượt khám</button><button type="reset" class="secondary">Bỏ bộ lọc</button>'}</form>
    ${doctorSearch || receptionSearch ? "" : searchField}
    <div id="encounter-list"></div><div id="list-pagination" class="list-pagination"></div>`);
  const form = $("#encounter-filters");
  if (doctorList || receptionSearch) form.elements.encounter_status.querySelectorAll("option").forEach(option => {
    if (option.value && !visibleStatuses.has(option.value)) option.remove();
  });
  if (receptionSearch && !completed) form.elements.encounter_status.value = "CONFIRMED";
  let rows = [], page = 1, version = 0, active = true;
  const stop = () => { active = false; version++; };
  window.addEventListener("pagehide", stop, { once: true });
  window.addEventListener("neu:auth-change", stop, { once: true });
  async function load(next = 1) {
    if (!active) return;
    page = next;
    const current = ++version;
    await run(async () => {
      const query = Object.fromEntries(new FormData(form));
      if (doctorList || receptionSearch) {
        const collected = await loadDoctorEncounterRows(query);
        if (!active || current !== version) return;
        rows = receptionSearch ? collected.filter(row => ["ONLINE", "WALK_IN"].includes(row.encounter_type)) : collected;
        render();
        return;
      }
      const result = await api.listEncounters({ ...query, encounter_status: completed ? "COMPLETED" : query.encounter_status, page, page_size: 20 });
      if (!active || current !== version) return;
      rows = result.items; render(); pagination(result, load);
    });
  }
  function render() {
    const normalize = value => String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[đĐ]/g,"d").toLowerCase().trim();
    const query = normalize($("#encounter-search").value);
    let matches = rows.filter(e => {
      if (!doctorSearch && !receptionSearch) return normalize(`${e.patient_name} ${code("LK",e.encounter_id)} ${code("BN",e.patient_id)} ${e.ticket_code || ""}`).includes(query);
      const content = document.createElement("template");
      content.innerHTML = `<table><tbody><tr>${encounterColumns(e)}</tr></tbody></table>`;
      const text = normalize(`${Array.from(content.content.querySelectorAll("td, small, strong")).map(node => node.textContent).join(" ")} ${code("BN", e.patient_id)}`);
      return query.split(/\s+/).every(word => text.includes(word));
    });
    if (doctorList || receptionSearch) {
      const total = matches.length;
      page = Math.min(page, Math.max(1, Math.ceil(total / 10)));
      matches = matches.slice((page - 1) * 10, page * 10);
      pagination({total, page, page_size:10}, next => { page = next; render(); });
    }
    $("#encounter-list").innerHTML = doctorList ? doctorEncounterTable(matches) : table(["Người bệnh / phiếu khám", "Khung giờ", "Phòng / bác sĩ", "Trạng thái", compact && !completed ? "Mở hồ sơ bệnh án" : "Thao tác"], matches.map(e => `<tr>${encounterColumns(e)}<td><div class="actions">${doctorList ? "" : `<button class="secondary" data-detail="${e.encounter_id}">Chi tiết</button>`}${role === "doctor" && !completed ? `<a class="button-link secondary" href="clinical.html?encounter_id=${e.encounter_id}&mode=${e.encounter_status === "IN_PROGRESS" ? "edit" : "view"}">${completed ? "Xem / bổ sung" : "Mở bệnh án"}</a>` : ""}${role === "reception" && e.encounter_status === "CONFIRMED" ? `<button data-checkin="${e.encounter_id}">Check-in</button>` : ""}</div></td></tr>`));
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
      dialog("Chi tiết lượt khám", (role === "reception" ? `<div class="reception-checkin-heading"><div><span>THÔNG TIN NGƯỜI BỆNH</span><h3>${esc(e.patient_name)}</h3><p>${esc(code("LK", e.encounter_id))} · ${e.encounter_type === "ONLINE" ? "Đặt trực tuyến" : "Khám trực tiếp"}</p></div><div class="reception-checkin-time"><span>Khung giờ khám</span><strong>${time(e.estimated_exam_at)} – ${time(e.appointment_end_at)}</strong><small>${date(e.work_date)}</small></div></div><section class="reception-checkin-summary"><h3>Thông tin lượt khám</h3>${encounterSummary(e)}</section>` : encounterSummary(e)) + clinical + panel("Lịch sử trạng thái", table(["Thời gian", "Trạng thái", "Ghi chú"], history.items.map(h => `<tr><td>${date(h.changed_at)} ${time(h.changed_at)}</td><td>${badge(h.new_status)}</td><td>${esc(h.note || "—")}</td></tr>`))) + (role === "reception" && ["CONFIRMED", "CHECKED_IN"].includes(e.encounter_status) ? `<a class="button-link" href="coordination.html?encounter_id=${e.encounter_id}">Chuyển bác sĩ / ca</a>` : ""));
      if (role === "reception") {
        const content = $("#staff-dialog-content");
        const detail = document.createElement("div"); detail.className = "reception-checkin reception-visit-detail";
        while (content.firstChild) detail.append(content.firstChild);
        content.append(detail);
        const actions = document.createElement("div"); actions.className = "actions reception-detail-actions";
        if (["HOLDING", "CONFIRMED", "CHECKED_IN"].includes(e.encounter_status)) actions.innerHTML += '<button type="button" data-reception-action="cancel" class="secondary">Hủy lượt khám</button>';
        const transfer = detail.querySelector(":scope > a.button-link");
        if (transfer) actions.prepend(transfer);
        detail.append(actions);
        actions.querySelectorAll("button").forEach(action => action.addEventListener("click", () => {
          const cancel = action.dataset.receptionAction === "cancel";
          dialog(cancel ? "Xác nhận hủy" : "Xác nhận vắng mặt", encounterSummary(e) + `<form id="reception-action-form">${cancel ? '<label class="reception-cancel-source">Hình thức hủy *<select name="cancel_origin" required><option value="" selected disabled>Chọn hình thức hủy</option><option value="PATIENT">Hủy do cá nhân</option><option value="HOSPITAL">Hủy do bệnh viện</option></select></label>' : ""}<label>Lý do ${cancel ? "*" : ""}<textarea name="reason" rows="3" maxlength="1000" ${cancel ? "required" : ""}></textarea></label><p>${cancel ? "Hệ thống sẽ ghi nguyên nhân hủy và xử lý chính sách hoàn cọc tương ứng." : "Chỉ được đánh dấu vắng mặt sau khi kết thúc ca ít nhất 15 phút."}</p><button type="submit">Xác nhận ${cancel ? "hủy lượt khám" : "vắng mặt"}</button><p role="status" class="form-feedback"></p></form>`);
          $("#reception-action-form").addEventListener("submit", event => {
            event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
            submit(event.currentTarget, async () => { if (cancel) await api.cancel(e.encounter_id, data); else await api.noShow(e.encounter_id, data); $("#staff-dialog").close(); await load(page); }, cancel ? "Đã hủy lượt khám." : "Đã ghi nhận vắng mặt.");
          });
        }));
      }
    })));
    $("#encounter-list").querySelectorAll("[data-checkin]").forEach(button => button.addEventListener("click", () => {
      const e = rows.find(item => item.encounter_id === Number(button.dataset.checkin));
      dialog("Xác nhận check-in", `<div class="reception-checkin"><div class="reception-checkin-heading"><div><span>TIẾP NHẬN NGƯỜI BỆNH</span><h3>${esc(e.patient_name)}</h3><p>Kiểm tra thông tin trước khi xác nhận người bệnh đã đến.</p></div><div class="reception-checkin-time"><span>Khung giờ khám</span><strong>${time(e.estimated_exam_at)} – ${time(e.appointment_end_at)}</strong><small>${date(e.work_date)}</small></div></div><section class="reception-checkin-summary"><h3>Thông tin lượt khám</h3>${encounterSummary(e)}</section>${registrationSummary(e)}<form id="checkin-form"><p class="reception-checkin-note">Đối chiếu giấy tờ, số điện thoại và phiếu với người bệnh có mặt. Khi xác nhận tiếp nhận, hệ thống tạo tài khoản cho người bệnh nếu chưa có.</p><div class="reception-checkin-footer"><p role="status" class="form-feedback"></p><button type="submit">Xác nhận check-in</button></div></form></div>`);
      $("#checkin-form").addEventListener("submit", event => { event.preventDefault(); submit(event.currentTarget, async () => { await api.checkIn(e.encounter_id); $("#staff-dialog").close(); await load(page); }, "Đã check-in lượt khám."); });
    }));
  }
  if (compact || receptionSearch) form.addEventListener("change", event => { if (event.target.id !== "encounter-search") load(); });
  form.addEventListener("submit", event => { event.preventDefault(); load(); });
  form.addEventListener("reset", event => { event.preventDefault(); for (const input of form.querySelectorAll("input, select")) input.value = ""; $("#encounter-search").value = ""; load(); });
  $("#encounter-search").addEventListener("input", () => { if (doctorList || receptionSearch) page = 1; render(); });
  await load();
  startAutoRefresh(() => load(page), { canRefresh: () => active });
  return { selectSchedule(id, day) {
    if (compact && !Array.from(form.elements.schedule_id.options).some(option => option.value === String(id))) {
      form.elements.schedule_id.add(new Option(`Ca ${id} · ${date(day)}`, String(id)));
    }
    form.elements.schedule_id.value = String(id);
    form.elements.work_date.value = day || "";
    form.elements.encounter_status.value = "";
    load();
    $(target).scrollIntoView({ behavior: "smooth", block: "start" });
  } };
}
