import { code } from "./business_codes.js";
import { startAutoRefresh } from "./auto_refresh.js";
import { getEncounter } from "../api/encounter.js";
import { getPatient } from "../api/patient.js";
import { listOwnNurseAssignments } from "../api/schedule.js";
import { readMedicalRecord } from "./staff_encounters.js";
import { sessionError } from "./staff_workspace.js";
import { activeStatuses, nurseEncounters, allPages, localPage, shiftEnd, normalizeSearch, nurseRange, inNurseRange, visitOrder } from "./nurse_encounter_data.js";
import { nurseVisitTable } from "./nurse_tables.js";
import { $, esc, date, facts, panel, pagination, dialog, encounterSummary, today } from "./staff_ui.js";

export async function initNursePatients({ assignments }) {
  let initialRange = nurseRange();
  let inheritedRange = initialRange;
  const requested = new URLSearchParams(location.search).get("schedule_id") || "";
  const selected = assignments.some(a => String(a.schedule_id) === requested) ? requested : "";
  if (!initialRange) {
    const day = assignments.find(a=>String(a.schedule_id)===selected)?.work_date || today();
    initialRange = {from:day,to:day}; inheritedRange = initialRange;
  }
  const shifts = [...assignments].sort((a, b) => `${a.work_date}${a.start_time}`.localeCompare(`${b.work_date}${b.start_time}`));
  $("#page-body").innerHTML = panel("Người bệnh trong ca", `
    <form id="nurse-visit-filters" class="staff-toolbar">
      <label>Phạm vi ca<select name="period"><option value="upcoming" ${!selected && !initialRange ? "selected" : ""}>Ca hiện tại và sắp tới</option><option value="past">Ca trước chưa xử lý</option><option value="all" ${selected || initialRange ? "selected" : ""}>Tất cả ca được phân công</option></select></label>
      <label>Ngày khám<input type="date" name="work_date"></label>
      <label>Ca được phân công<select name="schedule_id"><option value="">Tất cả ca</option>${shifts.map(a => `<option value="${esc(a.schedule_id)}" ${String(a.schedule_id) === selected ? "selected" : ""}>${date(a.work_date)} · ${esc(a.start_time.slice(0, 5))}–${esc(a.end_time.slice(0, 5))} · ${esc(a.room_name)}</option>`).join("")}</select></label>
      <label>Trạng thái<select name="encounter_status"><option value="">Tất cả</option><option value="CONFIRMED">Sắp khám</option><option value="CHECKED_IN">Chờ khám</option><option value="IN_PROGRESS">Đang khám</option></select></label>
    </form>
    <p id="nurse-visit-range" class="muted" ${initialRange && initialRange.from !== initialRange.to ? "" : "hidden"}>Khoảng ngày từ tổng quan: ${date(initialRange?.from)} – ${date(initialRange?.to)}</p>
    <label class="nurse-visit-search-field">Tìm người bệnh hoặc mã phiếu<input id="nurse-visit-search" type="search" maxlength="100" placeholder="Họ tên, mã phiếu hoặc mã lượt khám" autocomplete="off" aria-controls="nurse-visit-list"></label>
    <p id="nurse-visit-status" role="status" hidden></p><div id="nurse-visit-list"></div><div id="nurse-visit-pages" class="list-pagination"></div>`);
  const form = $("#nurse-visit-filters"), search = $("#nurse-visit-search"), status = $("#nurse-visit-status");
  form.elements.schedule_id.value = selected;
  if (selected) form.elements.period.value = "all";
  if (initialRange) {
    form.elements.period.value = "all";
    if (initialRange.from === initialRange.to) form.elements.work_date.value = initialRange.from;
  }
  let active = true, version = 0, detailVersion = 0, request, detailRequest, rows = [], currentPage = 1;
  const assigned = new Set(assignments.map(a => String(a.schedule_id)));
  function stop() {
    active = false; version++; detailVersion++; request?.abort(); detailRequest?.abort(); rows = [];
    $("#page-body").replaceChildren(); $("#staff-dialog").close();
  }
  window.addEventListener("pagehide", stop, { once: true });
  window.addEventListener("neu:auth-change", stop, { once: true });

  function render(next = 1) {
    currentPage = next;
    const q = normalizeSearch(search.value.trim()), now = Date.now(), period = form.elements.period.value;
    const matches = rows.filter(e => assigned.has(String(e.schedule_id))
      && (period === "all" || (period === "past" ? shiftEnd(e) < now : shiftEnd(e) >= now || e.encounter_status === "IN_PROGRESS"))
      && normalizeSearch(`${e.patient_name} ${e.ticket_code || ""} ${code("LK",e.encounter_id)} ${code("BN",e.patient_id)}`).includes(q));
    matches.sort(visitOrder);
    const result = localPage(matches, next); 
    $("#nurse-visit-list").innerHTML = nurseVisitTable(result.items);
    pagination(result, render, $("#nurse-visit-pages"));
  }
  async function load(keepPage = false) {
    const current = ++version; request?.abort(); request = new AbortController();
    detailVersion++; detailRequest?.abort(); $("#staff-dialog").close(); rows = [];
    $("#nurse-visit-list").innerHTML = ""; $("#nurse-visit-pages").innerHTML = "";
    status.hidden = false; status.textContent = "Đang tải danh sách khám…"; status.dataset.error = "false";
    try {
      if (keepPage === true) {
        const assignments = await allPages(listOwnNurseAssignments, { signal: request.signal });
        if (!active || current !== version) return;
        assigned.clear(); assignments.forEach(a => assigned.add(String(a.schedule_id)));
        const picked = form.elements.schedule_id.value;
        const shifts = assignments.sort((a, b) => `${a.work_date}${a.start_time}`.localeCompare(`${b.work_date}${b.start_time}`));
        form.elements.schedule_id.innerHTML = '<option value="">Tất cả ca</option>' + shifts.map(a => `<option value="${esc(a.schedule_id)}">${date(a.work_date)} · ${esc(a.start_time.slice(0, 5))}–${esc(a.end_time.slice(0, 5))} · ${esc(a.room_name)}</option>`).join("")
          + (picked && !assigned.has(picked) ? `<option value="${esc(picked)}">Ca không còn được phân công</option>` : "");
        form.elements.schedule_id.value = picked;
      }
      const filter = { work_date: form.elements.work_date.value, schedule_id: form.elements.schedule_id.value };
      const range = filter.work_date ? null : inheritedRange;
      if (filter.schedule_id && !assigned.has(filter.schedule_id)) throw new Error("Ca khám không thuộc phân công của bạn.");
      const state = form.elements.encounter_status.value;
      if (state && !activeStatuses.includes(state)) throw new Error("Trạng thái lọc không hợp lệ.");
      const items = await nurseEncounters(state ? [state] : activeStatuses, filter, { signal: request.signal });
      if (!active || current !== version) return;
      rows = items.filter(e => inNurseRange(e, range)
        && (!filter.work_date || e.work_date === filter.work_date)
        && (!filter.schedule_id || String(e.schedule_id) === filter.schedule_id));
      render(keepPage ? currentPage : 1); status.hidden = true;
    } catch (error) {
      if (active && current === version) { status.textContent = sessionError(error); status.dataset.error = "true"; }
    }
  }
  async function showVisit(encounterId) {
    if (!active) return;
    const row = rows.find(e => String(e.encounter_id) === String(encounterId));
    if (!row || !assigned.has(String(row.schedule_id))) return;
    const current = ++detailVersion; detailRequest?.abort(); detailRequest = new AbortController();
    status.hidden = false; status.textContent = "Đang tải thông tin…"; status.dataset.error = "false";
    try {
      const { encounter } = await getEncounter(row.encounter_id, { signal: detailRequest.signal });
      if (!active || current !== detailVersion) return;
      if (String(encounter.patient_id) !== String(row.patient_id) || !assigned.has(String(encounter.schedule_id))) throw new Error("Lượt khám không thuộc người bệnh hoặc ca đang xem.");
      const { patient } = await getPatient(encounter.patient_id, { signal: detailRequest.signal });
      if (!active || current !== detailVersion) return;
      if (String(patient.patient_id) !== String(encounter.patient_id)) throw new Error("Hồ sơ trả về không thuộc người bệnh đã chọn.");
      const clinical = encounter.encounter_status === "IN_PROGRESS" ? await readMedicalRecord(encounter) : "";
      if (!active || current !== detailVersion) return;
      dialog("Chi tiết lượt khám", encounterSummary(encounter) + panel("Thông tin người bệnh", facts([["Ngày sinh", date(patient.dob)], ["Giới tính", patient.gender], ["Điện thoại", patient.phone], ["BHYT", patient.health_insurance]])) + clinical);
      status.hidden = true;
    } catch (error) {
      if (active && current === detailVersion) { status.textContent = sessionError(error); status.dataset.error = "true"; }
    }
  }
  $("#nurse-visit-list").addEventListener("click", event => {
    const button = event.target.closest("[data-visit]");
    if (button) return showVisit(button.dataset.visit);
  });
  form.addEventListener("submit", event => { event.preventDefault(); load(); });
  form.addEventListener("change", event => {
    if (event?.target?.name === "work_date") {
      inheritedRange = null;
      const note = $("#nurse-visit-range"); if (note) note.hidden = true;
    }
    return load();
  });
  search.addEventListener("input", () => { if (active) render(); });
  await load();
  const encounterId = new URLSearchParams(location.search).get("encounter_id");
  if (encounterId) await showVisit(encounterId);
  startAutoRefresh(() => load(true), { canRefresh: () => active });
}
