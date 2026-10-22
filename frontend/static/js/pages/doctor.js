import { loadDoctorEncounterRows, doctorEncounterTable, observeOverviewEncounters } from "../core/doctor_encounter_list.js";
import { loadClinicalProfile, loadClinicalRows } from "../core/doctor_clinical_profile.js";
import { initNurseRecords as initDoctorPatientRecords } from "../core/nurse_records.js";
import { renderClinicalDesign } from "../core/doctor_clinical_design.js";
import { initTodayOverview, overviewRows } from "../core/staff_overview.js";
import { staffReady } from "../core/staff_workspace.js";
import * as schedules from "../api/schedule.js";
import { initEncounterList } from "../core/staff_encounters.js";
import { $, esc, today, date, panel, stats, empty, bindDialog, run } from "../core/staff_ui.js";

const user = await staffReady;
if (user) {
  bindDialog({ dismissible: document.body.dataset.page === "records" });
  const page = document.body.dataset.page;
  if (page === "overview") await run(overview);
  if (page === "schedule" || page === "encounters") await assignedWorkspace();
  if (page === "history") await initEncounterList({ role: "doctor", completed: page === "history", compact: true });
  if (page === "clinical") await run(clinical);
  if (page === "records") await run(initDoctorPatientRecords);
}

async function overview() {
  observeOverviewEncounters($("#page-body"));
  await initTodayOverview(async (range, options) => {
    const rangeLabel = `${date(range.from)}${range.to !== range.from ? ` – ${date(range.to)}` : ""}`;
    const [shifts, upcoming] = await Promise.all([
      overviewRows(schedules.listOwnSchedules, { from_date: `${range.from.slice(0,7)}-01`, to_date: `${range.from.slice(0, 7)}-${new Date(Number(range.from.slice(0,4)), Number(range.from.slice(5,7)), 0).getDate()}` }, { from: `${range.from.slice(0,7)}-01`, to: `${range.from.slice(0,7)}-31` }, options),
      loadDoctorEncounterRows({work_date:range.from},options),
    ]);
    return stats([["Lượt khám", upcoming.length, rangeLabel], ["Đã check-in", upcoming.filter(e => e.encounter_status === "CHECKED_IN").length, "Sẵn sàng chờ khám"], ["Đang khám", upcoming.filter(e => e.encounter_status === "IN_PROGRESS").length, "Trong phạm vi được giao"], ["Đã khám xong hôm nay", upcoming.filter(e => e.encounter_status === "COMPLETED").length, rangeLabel]]) +
    `<div class="doctor-overview-grid">${panel("Lịch làm việc", overviewCalendar(shifts, range.from))}${panel("Ca làm việc hôm nay", overviewShifts(shifts.filter(s => s.work_date === range.from)), '<a href="work_calendar.html">Xem lịch làm việc →</a>')}</div>` +
    `<div class="doctor-overview-visits">${panel("Lượt khám hôm nay", doctorEncounterTable(upcoming), '<a href="encounters.html">Tất cả lượt được giao →</a>')}</div>`;
  });
}
function overviewShifts(items) {
  return items.length ? `<div class="doctor-overview-shifts">${items.map(s => `<article><div><strong>${esc(s.department_name)}</strong><p>${esc(s.room_name)}</p></div><div><strong>${esc(s.start_time.slice(0,5))} – ${esc(s.end_time.slice(0,5))}</strong><a class="button-link secondary" href="encounters.html?schedule_id=${encodeURIComponent(s.schedule_id)}">Xem danh sách bệnh nhân</a></div></article>`).join("")}</div>` : empty("Không có ca làm việc hôm nay.");
}
function overviewCalendar(shifts, day) {
  const [year, month] = day.split("-").map(Number);
  const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const count = new Date(year, month, 0).getDate();
  const dates = new Set(shifts.filter(s => s.schedule_status !== "UNAVAILABLE").map(s => s.work_date));
  return `<div class="doctor-calendar-heading"><strong>Tháng ${month}/${year}</strong><span>${shifts.filter(s => s.work_date === day && s.schedule_status !== "UNAVAILABLE").length} ca hôm nay</span></div><div class="doctor-month-grid">${["T2","T3","T4","T5","T6","T7","CN"].map(d => `<strong>${d}</strong>`).join("")}${'<span></span>'.repeat(offset)}${Array.from({length:count}, (_,i) => { const key = `${day.slice(0,7)}-${String(i+1).padStart(2,"0")}`; return `<span class="doctor-calendar-day${key === day ? ' is-today' : ''}${dates.has(key) ? ' has-shift' : ''}" ${key === day ? 'aria-current="date"' : ''} aria-label="${i+1}/${month}${dates.has(key) ? ', có ca làm việc' : ''}">${i+1}</span>`; }).join("")}</div><div class="doctor-calendar-legend"><span><i aria-hidden="true"></i>Có ca làm việc</span><span class="doctor-calendar-today-label">Hôm nay · ${date(day)}</span></div>`;
}
async function assignedWorkspace() {
  document.body.classList.add("doctor-assigned-workspace");
  await initEncounterList({ role: "doctor", compact: true });
}
async function clinical() {
  const params = new URLSearchParams(location.search);
  const requested = params.get("encounter_id");
  if (!requested) {
    const profiles = await loadClinicalRows(today());
    renderClinicalDesign({profiles,loadDay:loadClinicalRows,loadProfile:loadClinicalProfile});
    return;
  }
  if (!/^\d+$/.test(requested)) throw new Error("Mã lượt khám không hợp lệ.");
  const profile = await loadClinicalProfile(requested);
  renderClinicalDesign({profiles:[profile],initialId:profile.id,mode:params.get("mode"),loadDay:loadClinicalRows,loadProfile:loadClinicalProfile});
}
