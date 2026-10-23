import { patientDetails } from "../core/admin_patient_detail.js";
import { patientEditForm } from "../core/admin_patient_form.js";
import { resources } from "../core/admin_resources.js";
import { receptionShiftVisits } from "../core/reception_shift_visits.js";
import { receptionScheduleOverview } from "../core/reception_schedule_overview.js";
import { receptionOverviewCounts } from "../core/reception_overview.js";
import { loadReceptionOverview } from "../core/reception_overview_data.js";
import { code, parseCode } from "../core/business_codes.js";
import { startAutoRefresh } from "../core/auto_refresh.js";
import { initTodayOverview } from "../core/staff_overview.js";
import { staffReady } from "../core/staff_workspace.js";
import * as patients from "../api/patient.js";
import * as doctors from "../api/doctor.js";
import * as schedules from "../api/schedule.js";
import * as encounters from "../api/encounter.js";
import { initEncounterList } from "../core/staff_encounters.js";
import { bindLiveSearch } from "../core/live_search.js";
import { $, esc, today, date, time, badge, panel, stats, facts, dialog, bindDialog, empty, table, pagination, run, submit, status, encounterSummary, encounterColumns } from "../core/staff_ui.js";

const user = await staffReady;
if (user) {
  bindDialog();
  const page = document.body.dataset.page;
  if (page === "overview") await overview();
  if (page === "patients") await patientPage();
  if (page === "walk_in") {
    const { initReceptionPatientForm } = await import("./reception_patient_form.js");
    initReceptionPatientForm();
    $("#page-body").innerHTML = '<div id="reception-encounters"></div><div id="walkin-body"></div>';
    await initEncounterList({ role: "reception", target: "#reception-encounters" });
    await run(walkInPage);
  }
  if (page === "coordination") await run(coordinationPage);
}
function receptionSummary(rows) {
  const counts = receptionOverviewCounts(rows);
  const icons = [
    '<circle cx="9" cy="7" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4M16 4a3 3 0 0 1 0 6M21 21v-4a6 6 0 0 0-3-5"/>',
    '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    '<path d="M14 2H6v20h14V8zM14 2v6h6M9 12h6M9 16h6"/>',
  ];
  return `<div class="summary-grid reception-status-cards">${[
    ["Chờ check-in", counts.pending, "Lịch online đã xác nhận"],
    ["Đang chờ khám", counts.waiting, "Người bệnh đã đến viện"],
    ["Đã tiếp nhận", counts.received, "Tổng lượt đã tiếp nhận trong ngày"],
  ].map(([label, value, note], index) => `<article class="summary-card"><span>${label}</span><svg class="reception-status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[index]}</svg><strong>${value}</strong><p>${note}</p></article>`).join("")}</div>`;
}
async function overview() {
  await initTodayOverview(async (range, options) => {
    const {rows, calendar} = await loadReceptionOverview(range.from, user.user_id, options);
    return receptionSummary(rows) + receptionScheduleOverview(range.from, calendar.shifts, calendar.error) + receptionShiftVisits(rows);
  });
}
function patientFacts(p) { return facts([["Mã hồ sơ", code("BN", p.patient_id)], ["Họ tên", p.full_name], ["Ngày sinh", date(p.dob)], ["Giới tính", p.gender], ["Số điện thoại", p.phone], ["CCCD / mã định danh", p.id_card], ["BHYT", p.health_insurance], ["Địa chỉ", p.address], ["Trạng thái", p.is_archived ? "Đã lưu trữ" : "Đang sử dụng"]]); }
function patientFields(p = {}, edit = false) {
  return `<div class="form-grid"><label class="full-width">Họ và tên *<input name="full_name" value="${esc(p.full_name)}" required maxlength="150"></label><label>Số điện thoại *<input name="phone" type="tel" value="${esc(p.phone)}" required maxlength="20" ${edit ? 'readonly aria-describedby="patient-phone-note"' : ""}></label><label>Ngày sinh<input name="dob" type="date" value="${esc(p.dob)}" max="${today()}"></label><label>CCCD / mã định danh<input name="id_card" inputmode="numeric" pattern="([0-9]{9}|[0-9]{12})" value="${esc(p.id_card)}" maxlength="12"></label><label>Giới tính<select name="gender"><option value="">Chưa cập nhật</option>${["Nam", "Nữ", "Khác"].map(value => `<option ${p.gender === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>Mã thẻ BHYT<input name="health_insurance" pattern="[A-Za-z0-9]{10,15}" value="${esc(p.health_insurance)}" maxlength="15"></label><label class="full-width">Địa chỉ<input name="address" value="${esc(p.address)}" maxlength="255"></label></div><p class="muted">Cần ngày sinh hoặc CCCD/mã định danh để phân biệt người bệnh.</p>${edit ? '<p id="patient-phone-note" class="muted">Số điện thoại liên kết được thay đổi tại tài khoản chủ hồ sơ.</p>' : ""}`;
}
function patientPayload(form) {
  const data = Object.fromEntries(new FormData(form));
  for (const key of Object.keys(data)) data[key] = data[key].trim() || null;
  const feedback = form.querySelector('[role="status"]');
  if (!data.dob && !data.id_card) { feedback.textContent = "Cần ngày sinh hoặc CCCD/mã định danh để xác định hồ sơ."; feedback.dataset.error = "true"; return null; }
  if (!data.full_name) { feedback.textContent = "Vui lòng nhập họ tên người bệnh."; feedback.dataset.error = "true"; return null; }
  return data;
}
async function patientPage() {
  $("#page-body").innerHTML = panel("Danh sách hồ sơ", '<form id="patient-search-form" class="staff-toolbar" role="search" aria-label="Tra cứu hồ sơ"><label>Tên, số điện thoại hoặc CCCD<input name="q" type="search" maxlength="100" placeholder="Nhập thông tin để tìm hồ sơ" aria-controls="patient-list"></label><label>Ngày khám<input name="work_date" type="date" aria-controls="patient-list"></label></form><div id="patient-list"></div><div id="list-pagination" class="list-pagination"></div>');
  const searchForm = $("#patient-search-form");
  let currentPage = 1, version = 0, request;
  async function load(page = 1) {
    currentPage = page;
    const current = ++version;
    request?.abort(); request = new AbortController();
    await run(async () => {
      let result;
      try { result = await patients.listPatients({ q: searchForm.elements.q.value.trim(), page, page_size: 10 }, { signal: request.signal }); }
      catch (error) { if (current !== version) return; throw error; }
      if (current !== version) return;
      $("#patient-list").innerHTML = table(["Hồ sơ", "Ngày sinh / CCCD", "Liên hệ", "Thao tác"], result.items.map(p => `<tr><td><strong>${esc(p.full_name)}</strong><small class="cell-subtitle">Hồ sơ ${code("BN", p.patient_id)}</small></td><td>${date(p.dob)}<small class="cell-subtitle">${esc(p.id_card || "—")}</small></td><td>${esc(p.phone || "—")}</td><td><div class="actions"><button data-patient="${p.patient_id}" data-mode="view" class="secondary">Xem</button><button data-patient="${p.patient_id}" data-mode="edit" class="secondary">Chỉnh sửa</button></div></td></tr>`));
      pagination(result, load);
      $("#patient-list").querySelectorAll("[data-patient]").forEach(button => button.addEventListener("click", () => run(async () => {
        const p = (await patients.getPatient(button.dataset.patient)).patient;
        const edit = button.dataset.mode === "edit";
        const row = { ...p, relatives: [] };
        const wrapper = html => `<div class="admin-page reception-patient-view">${html}</div>`;
        if (edit) {
          dialog("Chỉnh sửa thông tin bệnh nhân", wrapper(patientEditForm(row, resources.patients.fields.map(field => field.name === "phone" ? { ...field, readOnEdit: false } : field), {}, '<div class="actions"><button type="button" class="secondary" data-patient-edit-cancel>Hủy</button><button type="submit">Lưu thay đổi</button></div><p role="status" class="form-feedback"></p>', {showAccountStatus: false, phoneEditable: true})));
          const form = $("#staff-dialog-content form");
          form.addEventListener("click", event => {
            if (event.target.closest("[data-patient-edit-cancel]")) { $("#staff-dialog").close(); return; }
            const clear = event.target.closest('[data-action="clear-input"]');
            if (clear) { const input = clear.parentElement.querySelector("input"); input.value = ""; input.focus(); }
          });
          form.addEventListener("submit", event => {
            event.preventDefault(); const data = patientPayload(form); if (!data) return;
            submit(form, async () => { await patients.updatePatient(p.patient_id, data); $("#staff-dialog").close(); await load(currentPage); });
          });
        } else {
          dialog("Thông tin bệnh nhân", wrapper(patientDetails(row) + '<section class="admin-patient-section"><h3>Lịch sử khám bệnh</h3><div id="reception-patient-history" role="status">Đang tải lịch sử khám…</div></section>'));
          const historyNode = $("#reception-patient-history");
          try {
            const visits = []; let page = 1, result;
            do { result = await patients.listEncounters(p.patient_id, { page, page_size: 100 }); visits.push(...result.items); page++; }
            while (result.items.length && visits.length < result.total);
            visits.sort((a, b) => String(b.work_date || "").localeCompare(String(a.work_date || "")) || String(b.estimated_exam_at || b.created_at || "").localeCompare(String(a.estimated_exam_at || a.created_at || "")) || Number(b.encounter_id) - Number(a.encounter_id));
            historyNode.tabIndex = 0;
            historyNode.setAttribute("role", "region");
            historyNode.setAttribute("aria-label", "Lịch sử khám bệnh, cuộn để xem thêm");
            if (historyNode.isConnected) historyNode.innerHTML = table(["Mã lượt khám", "Bệnh nhân", "Ngày khám", "Bác sĩ / phòng", "Hình thức", "Trạng thái"], visits.map(visit => `<tr><td>${esc(code("LK", visit.encounter_id))}</td><td>${esc(visit.patient_name || (String(visit.patient_id) === String(p.patient_id) ? p.full_name : "Chưa cập nhật"))}</td><td>${date(visit.work_date)}</td><td>${esc(visit.doctor_name || "—")}<small class="cell-subtitle">${esc(visit.room_name || "—")}</small></td><td><span class="reception-history-type ${visit.encounter_type === "ONLINE" ? "is-online" : "is-direct"}">${visit.encounter_type === "ONLINE" ? "Online" : "Trực tiếp"}</span></td><td>${badge(visit.encounter_status)}</td></tr>`));
          } catch (error) { if (historyNode.isConnected) historyNode.textContent = error.message || "Không tải được lịch sử khám."; }
        }
      })));
    });
  }
  const refreshSearch = bindLiveSearch(searchForm.elements.q, () => load(), { invalidate() {
    version++; request?.abort();
    $("#patient-list").innerHTML = '<p role="status">Đang tìm hồ sơ…</p>'; $("#list-pagination").innerHTML = "";
  } });
  searchForm.addEventListener("submit", event => { event.preventDefault(); refreshSearch(); });
  await load();
  startAutoRefresh(() => load(currentPage));
}
async function allDoctors() {
  const first = await doctors.listDoctors({ page_size: 100 }); const items = [...first.items];
  for (let page = 2; (page - 1) * first.page_size < first.total; page++) items.push(...(await doctors.listDoctors({ page, page_size: first.page_size })).items);
  return items;
}
async function walkInPage() {
  const id = new URLSearchParams(location.search).get("patient_id");
  let selectedPatient = id && /^\d+$/.test(id) ? (await patients.getPatient(id)).patient : null;
  const doctorList = await allDoctors();
  $("#walkin-body").innerHTML = panel("01 / Chọn đúng người bệnh", '<form id="walkin-search" class="staff-toolbar" role="search" aria-label="Tìm người bệnh"><label>Tìm hồ sơ theo tên, điện thoại hoặc CCCD<input type="search" name="q" maxlength="100" aria-controls="walkin-results"></label><a href="patients.html">Tạo hồ sơ mới →</a></form><div id="walkin-results"></div><div id="walkin-pagination" class="list-pagination"></div><div id="walkin-selected"></div>') + panel("02 / Tiếp nhận khám", `<form id="walkin-form"><div class="form-grid"><label class="full-width">Bác sĩ *<select name="doctor_profile_id" required><option value="">Chọn bác sĩ tiếp nhận</option>${doctorList.map(d => `<option value="${d.doctor_profile_id}">${esc(d.full_name)} · ${esc(d.department_name)}</option>`).join("")}</select></label><label class="full-width">Triệu chứng<textarea name="symptoms" rows="4" maxlength="5000"></textarea></label></div><p class="scope-note">Hệ thống chọn ca còn tiếp nhận và khung giờ phù hợp, chốt phí khám và phát mã phiếu. Khách khám trực tiếp được check-in khi tiếp nhận.</p><button type="submit">Tiếp nhận và phát phiếu</button><p role="status" class="form-feedback"></p><div id="walkin-created"></div></form>`);
  function renderSelected() { $("#walkin-selected").innerHTML = selectedPatient ? `<div class="staff-confirm"><strong>Hồ sơ đã chọn</strong>${patientFacts(selectedPatient)}</div>` : '<p class="scope-note">Chọn hồ sơ người bệnh trước khi tiếp nhận.</p>'; }
  renderSelected();
  let searchVersion = 0, searchRequest;
  async function search(page = 1) {
    const current = ++searchVersion;
    searchRequest?.abort(); searchRequest = new AbortController();
    await run(async () => {
      let result;
      try { result = await patients.listPatients({ q: $("#walkin-search").elements.q.value.trim(), page, page_size: 10 }, { signal: searchRequest.signal }); }
      catch (error) { if (current !== searchVersion) return; throw error; }
      if (current !== searchVersion) return;
      $("#walkin-results").innerHTML = table(["Họ tên", "Ngày sinh", "CCCD", "Điện thoại", "Chọn hồ sơ"], result.items.map(p => `<tr><td>${esc(p.full_name)}</td><td>${date(p.dob)}</td><td>${esc(p.id_card || "—")}</td><td>${esc(p.phone)}</td><td><button class="secondary" data-use-patient="${p.patient_id}">Dùng hồ sơ ${code("BN", p.patient_id)}</button></td></tr>`));
      pagination(result, search, $("#walkin-pagination"));
      $("#walkin-results").querySelectorAll("[data-use-patient]").forEach(button => button.addEventListener("click", () => { selectedPatient = result.items.find(p => p.patient_id === Number(button.dataset.usePatient)); renderSelected(); $("#walkin-created").innerHTML = ""; }));
    });
  }
  const refreshSearch = bindLiveSearch($("#walkin-search").elements.q, () => search(), { invalidate() {
    searchVersion++; searchRequest?.abort();
    $("#walkin-results").innerHTML = '<p role="status">Đang tìm hồ sơ…</p>'; $("#walkin-pagination").innerHTML = "";
  } });
  $("#walkin-search").addEventListener("submit", event => { event.preventDefault(); refreshSearch(); });
  $("#walkin-form").addEventListener("submit", event => {
    event.preventDefault(); if (!selectedPatient || selectedPatient.is_archived) { status("Vui lòng chọn hồ sơ đang sử dụng của đúng người bệnh.", true); return; }
    const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); data.patient_id = selectedPatient.patient_id; data.doctor_profile_id = Number(data.doctor_profile_id);
    submit(form, async () => {
      const e = (await encounters.createWalkIn(data)).encounter;
      $("#walkin-created").innerHTML = `<div class="staff-confirm"><h3>Đã tiếp nhận và phát phiếu</h3>${encounterSummary(e)}<a href="walk_in.html?schedule_id=${e.schedule_id}">Xem lượt khám trong ca →</a></div>`;
    }, "Đã tiếp nhận khám trực tiếp.");
  });
}
async function coordinationPage() {
  const { initReceptionCoordination } = await import("./reception_coordination.js");
  await initReceptionCoordination();
}
