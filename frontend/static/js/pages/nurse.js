import { initTodayOverview } from "../core/staff_overview.js";
import { startAutoRefresh } from "../core/auto_refresh.js";
import { staffReady } from "../core/staff_workspace.js";
import * as schedules from "../api/schedule.js";
import { initNursePatients } from "../core/nurse_patients.js";
import { initNurseRecords } from "../core/nurse_records.js";
import { allPages, nurseRange, nurseFormRange, inNurseRange, localPage, normalizeSearch } from "../core/nurse_encounter_data.js";
import { code } from "../core/business_codes.js";
import { renderNurseOverview } from "../core/nurse_overview.js";
import { nurseAssignmentTable } from "../core/nurse_tables.js";
import { initDragScroll } from "../core/drag_scroll.js";
import { $, panel, pagination, bindDialog, run } from "../core/staff_ui.js";

const user = await staffReady;
if (user) {
  await run(async () => {
    const page = document.body.dataset.page;
    if (page === "patients" || page === "records") bindDialog();
    if (page === "overview") await overview();
    if (page === "assignments") await assignmentsPage();
    if (page === "records") await initNurseRecords();
    if (page === "patients") {
      const assignments = await allAssignments();
      await initNursePatients({ assignments });
    }
  });
}
async function allAssignments(options = {}) {
  return allPages((paging, request) => schedules.listOwnNurseAssignments(paging, request), options);
}
async function overview() {
  initDragScroll($("#page-body"), ".nurse-compact-shifts");
  await initTodayOverview(renderNurseOverview);
}
async function assignmentsPage() {
  let range = nurseRange();
  $("#page-body").innerHTML = panel("Phân công còn hiệu lực", `
    <form id="nurse-assignment-search" class="staff-toolbar" role="search" aria-label="Tìm phân công">
      <label>Mã phòng<input type="search" name="room_code" maxlength="100" placeholder="Nhập mã phòng, ví dụ PH_001" autocomplete="off" aria-controls="assignment-list"></label>
      <label>Tên phòng<input type="search" name="room_name" maxlength="100" placeholder="Nhập tên phòng" autocomplete="off" aria-controls="assignment-list"></label>
      <label>Từ ngày<input type="date" name="from_date" aria-controls="assignment-list"></label>
      <label>Đến ngày<input type="date" name="to_date" aria-controls="assignment-list"></label>
    </form><div id="assignment-list"></div><div id="list-pagination" class="list-pagination" role="status"></div>`);
  const form = $("#nurse-assignment-search"), request = new AbortController();
  form.elements.from_date.value = range?.from || "";
  form.elements.to_date.value = range?.to || "";
  let items = [], active = true, currentPage = 1;
  function stop() { active = false; request.abort(); items = []; $("#page-body").replaceChildren(); }
  window.addEventListener("pagehide", stop, { once: true });
  window.addEventListener("neu:auth-change", stop, { once: true });
  function render(page = 1) {
    currentPage = page;
    if (!active) return;
    try { range = nurseFormRange(form); }
    catch {
      $("#assignment-list").innerHTML = '<p class="scope-note" role="status">Vui lòng chọn khoảng ngày hợp lệ: đến ngày phải bằng hoặc sau từ ngày.</p>';
      $("#list-pagination").replaceChildren();
      return;
    }
    const queryCode = normalizeSearch(form.elements.room_code.value.trim()).replace(/[\s_-]/g, "");
    const queryRoom = normalizeSearch(form.elements.room_name.value.trim());
    const matches = items.filter(a => inNurseRange(a, range) && normalizeSearch(code("PH", a.room_id)).replace(/[\s_-]/g, "").includes(queryCode)
      && normalizeSearch(a.room_name).includes(queryRoom));
    const result = localPage(matches, page, 8);
    $("#assignment-list").innerHTML = nurseAssignmentTable(result.items, range);
    pagination(result, render);
  }
  form.addEventListener("submit", event => event.preventDefault());
  for (const input of [form.elements.room_code, form.elements.room_name]) input.addEventListener("input", () => render());
  for (const input of [form.elements.from_date, form.elements.to_date]) {
    input.addEventListener("input", () => render());
    input.addEventListener("change", () => render());
  }
  const assignments = await allAssignments({ signal: request.signal });
  if (!active) return;
  items = assignments.sort((a, b) => `${a.work_date}${a.start_time}`.localeCompare(`${b.work_date}${b.start_time}`));
  render();
  startAutoRefresh(async () => {
    const assignments = await allAssignments({ signal: request.signal });
    if (!active) return;
    items = assignments.sort((a, b) => `${a.work_date}${a.start_time}`.localeCompare(`${b.work_date}${b.start_time}`));
    render(currentPage);
  }, { canRefresh: () => active });
}
