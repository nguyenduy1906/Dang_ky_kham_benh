import { staffReady } from "../core/staff_workspace.js";
import * as schedules from "../api/schedule.js";
import * as encounters from "../api/encounter.js";
import { initEncounterList } from "../core/staff_encounters.js";
import { $, esc, today, date, badge, facts, stats, panel, empty, pagination, bindDialog, run } from "../core/staff_ui.js";

const user = await staffReady;
if (user) {
  bindDialog();
  await run(async () => {
    const page = document.body.dataset.page;
    if (page === "overview") await overview();
    if (page === "assignments") await assignmentsPage();
    if (page === "patients") {
      const assignments = await allAssignments();
      await initEncounterList({ role: "nurse", assignments });
    }
  });
}
async function allAssignments() {
  const first = await schedules.listOwnNurseAssignments({ page_size: 100 });
  const items = [...first.items];
  for (let page = 2; (page - 1) * first.page_size < first.total; page++) items.push(...(await schedules.listOwnNurseAssignments({ page, page_size: first.page_size })).items);
  return items;
}
function cards(items) {
  return items.length ? `<div class="shift-grid">${items.map(a => `<article class="shift-card"><div class="section-heading"><h3>${esc(a.room_name)}</h3>${badge(a.schedule_status)}</div><p class="doctor-shift-time">${esc(a.start_time.slice(0,5))} — ${esc(a.end_time.slice(0,5))}</p>${facts([["Ngày làm việc", date(a.work_date)], ["Mã ca", a.schedule_id], ["Ghi chú phân công", a.note]])}<a class="button-link" href="patients.html?schedule_id=${a.schedule_id}">Xem người bệnh trong ca →</a></article>`).join("")}</div>` : empty("Chưa có phân công phù hợp.");
}
async function overview() {
  const work_date = today();
  const [assignments, total, waiting] = await Promise.all([allAssignments(), encounters.listEncounters({ work_date, page_size: 1 }), encounters.listEncounters({ work_date, encounter_status: "CHECKED_IN", page_size: 1 })]);
  const shifts = assignments.filter(a => a.work_date === work_date);
  $("#page-body").innerHTML = stats([["Ca được giao hôm nay", shifts.length, date(work_date)], ["Lượt khám trong ca hôm nay", total.total, "Theo phân công còn hiệu lực"], ["Đã check-in", waiting.total, "Cần hướng dẫn vào phòng"]]) + panel("Ca làm việc hôm nay", cards(shifts), '<a href="assignments.html">Tất cả phân công →</a>') + panel("Hỗ trợ người bệnh", '<div class="doctor-shortcuts"><a href="patients.html"><h3>Bệnh nhân trong ca</h3><p>Tra cứu phiếu khám, xem bệnh án và đơn thuốc theo phân công.</p></a></div>');
}
async function assignmentsPage() {
  $("#page-body").innerHTML = panel("Phân công còn hiệu lực", '<div id="assignment-list"></div><div id="list-pagination" class="list-pagination"></div>');
  async function load(page = 1) { await run(async () => { const result = await schedules.listOwnNurseAssignments({ page, page_size: 12 }); $("#assignment-list").innerHTML = cards(result.items); pagination(result, load); }); }
  await load();
}
