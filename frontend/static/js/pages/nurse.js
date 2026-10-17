import { initOverviewPeriod, getOverviewCounts } from "../core/staff_overview.js";
import { staffReady } from "../core/staff_workspace.js";
import * as schedules from "../api/schedule.js";
import { initEncounterList } from "../core/staff_encounters.js";
import { initNurseRecords } from "../core/nurse_records.js";
import { $, esc, today, date, badge, facts, stats, panel, empty, pagination, bindDialog, run } from "../core/staff_ui.js";

const user = await staffReady;
if (user) {
  bindDialog();
  await run(async () => {
    const page = document.body.dataset.page;
    if (page === "overview") await overview();
    if (page === "assignments") await assignmentsPage();
    if (page === "records") await initNurseRecords();
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
  return items.length ? `<div class="shift-grid">${items.map(a => `<article class="shift-card"><div class="section-heading"><h3>${esc(a.room_name)}</h3>${badge(a.schedule_status)}</div><p class="doctor-shift-time">${esc(a.start_time.slice(0,5))} — ${esc(a.end_time.slice(0,5))}</p>${facts([["Ngày làm việc", date(a.work_date)], ["Mã ca", a.schedule_id], ["Ghi chú phân công", a.note]])}<a class="button-link" href="patients.html?schedule_id=${a.schedule_id}">Mở danh sách khám →</a></article>`).join("")}</div>` : empty("Chưa có phân công phù hợp.");
}
async function overview() {
  const assignments = await allAssignments();
  await initOverviewPeriod(async (range, options) => {
    const counts = await getOverviewCounts(range, options);
    const shifts = assignments.filter(a => a.work_date >= range.from && a.work_date <= range.to);
    const title = ({ today: "Ca làm việc hôm nay", week: "Ca làm việc tuần này", month: "Ca làm việc tháng này", custom: "Ca làm việc trong khoảng đã chọn" })[options.period];
    return stats([["Chờ khám", counts.CHECKED_IN, "Đã check-in, chờ bác sĩ khám"], ["Đang khám", counts.IN_PROGRESS, "Bác sĩ đã bắt đầu khám"], ["Đã khám", counts.COMPLETED, "Lượt khám đã hoàn tất"]])
      + panel(title, `<p class="muted">${date(range.from)}${range.to !== range.from ? ` – ${date(range.to)}` : ""}</p>${cards(shifts)}`, '<a href="assignments.html">Tất cả phân công →</a>')
      + panel("Truy cập nhanh", '<div class="doctor-shortcuts"><a href="patients.html"><h3>Danh sách khám</h3><p>Theo dõi lượt khám và trạng thái người bệnh trong ca.</p></a><a href="records.html"><h3>Hồ sơ bệnh nhân</h3><p>Tra cứu thông tin, bệnh án và đơn thuốc trong phạm vi được phép xem.</p></a><a href="work_calendar.html"><h3>Lịch làm việc</h3><p>Xem lịch cá nhân và đơn xin nghỉ.</p></a></div>');
  });
}
async function assignmentsPage() {
  $("#page-body").innerHTML = panel("Phân công còn hiệu lực", '<div id="assignment-list"></div><div id="list-pagination" class="list-pagination"></div>');
  async function load(page = 1) { await run(async () => { const result = await schedules.listOwnNurseAssignments({ page, page_size: 12 }); $("#assignment-list").innerHTML = cards(result.items); pagination(result, load); }); }
  await load();
}
