import { nurseOverviewCalendar } from "./nurse_overview_calendar.js";
import { listOwnNurseAssignments } from "../api/schedule.js";
import { listPatients } from "../api/patient.js";
import { allPages, nurseEncounters, activeStatuses, historyStatuses, inNurseRange, visitOrder, recentNursePatients } from "./nurse_encounter_data.js";
import { nurseVisitTable, nurseRecordTable } from "./nurse_tables.js";
import { overviewDayParams } from "./staff_overview.js";
import { code } from "./business_codes.js";
import { esc, date, badge, facts, stats, panel, empty } from "./staff_ui.js";

export function nurseOverviewLink(page, range, params = {}) {
  return `${page}.html?${new URLSearchParams({ from_date: range.from, to_date: range.to, ...params })}`;
}

export function nurseShiftCards(items, { compact = false, range = null } = {}) {
  return items.length ? `${compact && items.length > 4 ? '<p class="muted nurse-shift-scroll-hint">Giữ chuột và kéo ngang hoặc vuốt để xem thêm ca làm việc.</p>' : ""}<div class="shift-grid${compact ? " nurse-compact-shifts" : ""}"${compact ? ' tabindex="0" role="region" aria-label="Ca làm việc, cuộn ngang để xem thêm"' : ""}>${items.map(a => `<article class="shift-card"><div class="section-heading"><h3>${esc(a.room_name)}</h3>${badge(a.schedule_status)}</div><p class="doctor-shift-time">${esc(a.start_time.slice(0, 5))} — ${esc(a.end_time.slice(0, 5))}</p>${facts([["Ngày làm việc", date(a.work_date)], ["Mã ca", code("CA", a.schedule_id)], ["Ghi chú phân công", a.note]])}<a class="button-link" href="${esc(range ? nurseOverviewLink("patients", range, { schedule_id: a.schedule_id }) : `patients.html?schedule_id=${a.schedule_id}`)}">Mở danh sách khám →</a></article>`).join("")}</div>` : empty("Chưa có phân công phù hợp.");
}

export async function renderNurseOverview(range, options = {}) {
  const [assignments, encounters, patients] = await Promise.all([
    allPages((paging, request) => listOwnNurseAssignments(paging, request), options),
    nurseEncounters([...activeStatuses, ...historyStatuses], overviewDayParams(range), options),
    allPages((paging, request) => listPatients({ include_archived: true, ...paging }, request), options),
  ]);
  const assigned = new Set(assignments.map(a => String(a.schedule_id)));
  const rows = encounters.filter(e => assigned.has(String(e.schedule_id)) && inNurseRange(e, range));
  const visits = rows.filter(e => activeStatuses.includes(e.encounter_status)).sort(visitOrder);
  const records = recentNursePatients(patients, rows, range);
  const monthShifts = [...new Map(assignments
    .filter(a => !a.revoked_at && ["OPEN", "FULL"].includes(a.schedule_status) && a.work_date?.slice(0, 7) === range.from.slice(0, 7))
    .map(a => [String(a.schedule_id), a])).values()];
  const todayShifts = monthShifts.filter(a => a.work_date === range.from)
    .sort((a, b) => a.start_time.localeCompare(b.start_time) || Number(a.schedule_id) - Number(b.schedule_id));
  const todayCards = todayShifts.length ? `<div class="doctor-overview-shifts">${todayShifts.map(a => `<article><div><strong>${esc(a.department_name || (a.start_time.slice(0, 5) < "12:00" ? "Ca sáng" : "Ca chiều"))}</strong><p>${esc(a.room_name)}</p></div><div><strong>${esc(a.start_time.slice(0, 5))} – ${esc(a.end_time.slice(0, 5))}</strong><a class="button-link secondary" href="${esc(nurseOverviewLink("patients", { from: range.from, to: range.from }, { schedule_id: a.schedule_id }))}">Xem danh sách bệnh nhân</a></div></article>`).join("")}</div>` : empty("Không có ca làm việc hôm nay.");
  const suffix = ({ today: "hôm nay", week: "tuần này", month: "tháng này", custom: "trong khoảng đã chọn" })[options.period] || "trong khoảng đã chọn";
  const link = (page, label) => `<a href="${esc(nurseOverviewLink(page, range))}">Xem tất cả<span class="visually-hidden"> ${label}</span> →</a>`;
  const period = `<p class="muted">${date(range.from)}${range.to !== range.from ? ` – ${date(range.to)}` : ""}</p>`;
  return stats([["Chờ khám", rows.filter(e => e.encounter_status === "CHECKED_IN").length, "Đã check-in, chờ bác sĩ khám"], ["Đang khám", rows.filter(e => e.encounter_status === "IN_PROGRESS").length, "Bác sĩ đã bắt đầu khám"], ["Đã khám", rows.filter(e => e.encounter_status === "COMPLETED").length, "Lượt khám đã hoàn tất"]])
    + `<div class="nurse-overview-calendar">${panel("Lịch làm việc", nurseOverviewCalendar(monthShifts, range.from))}${panel("Ca làm việc hôm nay", todayCards, '<a href="work_calendar.html">Xem lịch làm việc →</a>')}</div>`
    + panel(`Danh sách khám ${suffix}`, period + nurseVisitTable(visits.slice(0, 5), e => `<a class="button-link secondary" href="${esc(nurseOverviewLink("patients", range, { encounter_id: e.encounter_id }))}">Xem chi tiết</a>`), link("patients", "danh sách khám"))
    + panel("Hồ sơ bệnh nhân gần nhất", period + nurseRecordTable(records.items.slice(0, 5), records.latest, p => `<a class="button-link secondary" href="${esc(nurseOverviewLink("records", range, { patient_id: p.patient_id }))}">Xem hồ sơ</a>`), link("records", "hồ sơ bệnh nhân"));
}
