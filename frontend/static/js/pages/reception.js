import {encounterTypeBadge} from "../core/encounter_type.js";
import { patientDetails } from "../core/admin_patient_detail.js";
import { patientEditForm } from "../core/admin_patient_form.js";
import { resources } from "../core/admin_resources.js";
import { receptionShiftVisits } from "../core/reception_shift_visits.js";
import { receptionScheduleOverview } from "../core/reception_schedule_overview.js";
import { receptionOverviewCounts } from "../core/reception_overview.js";
import { loadReceptionOverview } from "../core/reception_overview_data.js";
import { createReceptionWalkIn } from "../core/reception_intake_data.js";
import {searchReceptionPatients,readReceptionPatient,readReceptionPatientHistory,saveReceptionPatient} from "../core/reception_patient_search.js";
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
    $("#page-body").innerHTML = '<div id="reception-encounters"></div>';
    const list = await initEncounterList({ role: "reception", target: "#reception-encounters" });
    initReceptionPatientForm({onCreated: () => list.refresh()});
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
export async function patientPage() {
  $("#page-body").innerHTML = panel("Danh sách hồ sơ", '<form id="patient-search-form" class="staff-toolbar" role="search" aria-label="Tra cứu hồ sơ"><label>Tên, số điện thoại hoặc CCCD<input name="q" type="search" maxlength="100" placeholder="Nhập thông tin để tìm hồ sơ" aria-controls="patient-list"></label><label>Ngày khám<input name="work_date" type="date" aria-controls="patient-list"></label></form><div id="patient-list"></div><div id="list-pagination" class="list-pagination"></div>');
  const searchForm = $("#patient-search-form");
  searchForm.elements.work_date.value = today();
  let currentPage = 1, version = 0, request, active = true, detailVersion = 0, detailRequest;
  const stop = () => {active=false;version++;detailVersion++;request?.abort();detailRequest?.abort();};
  window.addEventListener("pagehide",stop,{once:true});
  window.addEventListener("neu:auth-change",()=>{stop();$("#staff-dialog").close();$("#staff-dialog-content").innerHTML="";$("#page-body").innerHTML="";},{once:true});
  $("#staff-dialog").addEventListener("close",()=>{detailVersion++;detailRequest?.abort();});
  $("#staff-dialog").addEventListener("cancel",event=>{if($("#staff-dialog form")?.dataset.busy==="true")event.preventDefault();});
  async function load(page = 1) {
    if(!active)return;
    currentPage = page;
    const current = ++version;
    request?.abort(); request = new AbortController();
    await run(async () => {
      let result;
      try { result = await searchReceptionPatients({ q: searchForm.elements.q.value, work_date:searchForm.elements.work_date.value }, page, 10, { signal: request.signal }); }
      catch (error) { if (!active || current !== version) return;$("#patient-list").innerHTML="";$("#list-pagination").innerHTML="";throw error; }
      if (!active || current !== version) return;
      currentPage = result.page;
      $("#patient-list").innerHTML = table(["Hồ sơ", "Ngày sinh / CCCD", "Liên hệ", "Thao tác"], result.items.map(p => `<tr><td><strong>${esc(p.full_name)}</strong><small class="cell-subtitle">Hồ sơ ${code("BN", p.patient_id)}</small></td><td>${date(p.dob)}<small class="cell-subtitle">${esc(p.id_card || "—")}</small></td><td>${esc(p.phone || "—")}</td><td><div class="actions"><button data-patient="${p.patient_id}" data-mode="view" class="secondary">Xem</button><button data-patient="${p.patient_id}" data-mode="edit" class="secondary">Chỉnh sửa</button></div></td></tr>`));
      pagination(result, load);
      $("#patient-list").querySelectorAll("[data-patient]").forEach(button => button.addEventListener("click", () => run(async () => {
        const detailCurrent=++detailVersion;detailRequest?.abort();detailRequest=new AbortController();
        const detailOptions={signal:detailRequest.signal};
        const p = await readReceptionPatient(button.dataset.patient,detailOptions);
        if(!active || detailCurrent!==detailVersion)return;
        const edit = button.dataset.mode === "edit";
        const row = { ...p };
        const wrapper = html => `<div class="admin-page reception-patient-view">${html}</div>`;
        if (edit) {
          if(p.is_archived || p.archived_at)throw new Error("Hồ sơ đã lưu trữ, chỉ được tra cứu và xem lịch sử.");
          dialog("Chỉnh sửa thông tin bệnh nhân", wrapper(patientEditForm(row, resources.patients.fields, {}, '<div class="actions"><button type="button" class="secondary" data-patient-edit-cancel>Hủy</button><button type="submit">Lưu thay đổi</button></div><p role="status" class="form-feedback"></p>', {showAccountStatus: false, showRelatives:false})));
          const form = $("#staff-dialog-content form");
          form.addEventListener("click", event => {
            if(form.dataset.busy==="true")return;
            if (event.target.closest("[data-patient-edit-cancel]")) { $("#staff-dialog").close(); return; }
            const clear = event.target.closest('[data-action="clear-input"]');
            if (clear) { const input = clear.parentElement.querySelector("input"); input.value = ""; input.focus(); }
          });
          form.elements.dob.max=today();
          form.addEventListener("submit", async event => {
            event.preventDefault(); if(!active || form.dataset.busy==="true" || !form.reportValidity())return;
            const data = patientPayload(form); if (!data) return;
            $("#staff-dialog-close").disabled=true;
            await submit(form, async () => { await saveReceptionPatient(p.patient_id, data,detailOptions); if(!active || detailCurrent!==detailVersion)return;$("#staff-dialog").close(); await load(currentPage); });
            $("#staff-dialog-close").disabled=false;
          });
        } else {
          dialog("Thông tin bệnh nhân", wrapper(patientDetails(row,{showRelatives:false,showAccountStatus:false}) + '<section class="admin-patient-section"><h3>Lịch sử khám bệnh</h3><div id="reception-patient-history" role="status">Đang tải lịch sử khám…</div></section>'));
          const historyNode = $("#reception-patient-history");
          try {
            const visits = await readReceptionPatientHistory(p.patient_id,detailOptions);
            if(!active || detailCurrent!==detailVersion)return;
            historyNode.tabIndex = 0;
            historyNode.setAttribute("role", "region");
            historyNode.setAttribute("aria-label", "Lịch sử khám bệnh, cuộn để xem thêm");
            if (historyNode.isConnected) historyNode.innerHTML = table(["Mã lượt khám", "Bệnh nhân", "Ngày khám", "Bác sĩ / phòng", "Hình thức", "Trạng thái"], visits.map(visit => `<tr><td>${esc(code("LK", visit.encounter_id))}</td><td>${esc(visit.patient_name || (String(visit.patient_id) === String(p.patient_id) ? p.full_name : "Chưa cập nhật"))}</td><td>${date(visit.work_date)}</td><td>${esc(visit.doctor_name || "—")}<small class="cell-subtitle">${esc(visit.room_name || "—")}</small></td><td>${encounterTypeBadge(visit.encounter_type)}</td><td>${badge(visit.encounter_status)}</td></tr>`));
          } catch (error) { if (active && detailCurrent===detailVersion && historyNode.isConnected) {historyNode.textContent = error.message || "Không tải được lịch sử khám.";if([401,403].includes(error.status))throw error;} }
        }
      })));
    });
  }
  const refreshSearch = bindLiveSearch(searchForm.elements.q, () => load(), { invalidate() {
    version++; request?.abort();
    if(!active)return;
    $("#patient-list").innerHTML = '<p role="status">Đang tìm hồ sơ…</p>'; $("#list-pagination").innerHTML = "";
  } });
  searchForm.addEventListener("submit", event => { event.preventDefault(); refreshSearch(); });
  searchForm.elements.work_date.addEventListener("change",()=>refreshSearch());
  await load();
  startAutoRefresh(() => load(currentPage),{canRefresh:()=>active});
}
async function coordinationPage() {
  const { initReceptionCoordination } = await import("./reception_coordination.js");
  await initReceptionCoordination();
}
