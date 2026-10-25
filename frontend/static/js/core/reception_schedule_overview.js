import { date, panel, empty, esc } from "./staff_ui.js";

export function overviewCalendar(shifts, day) {
  const [year, month] = day.split("-").map(Number);
  const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const count = new Date(year, month, 0).getDate();
  const dates = new Set(shifts.filter(s => s.schedule_status !== "UNAVAILABLE").map(s => s.work_date));
  return `<div class="doctor-calendar-heading"><strong>Tháng ${month}/${year}</strong><span>${shifts.filter(s => s.work_date === day && s.schedule_status !== "UNAVAILABLE").length} ca hôm nay</span></div><div class="doctor-month-grid">${["T2","T3","T4","T5","T6","T7","CN"].map(d => `<strong>${d}</strong>`).join("")}${'<span></span>'.repeat(offset)}${Array.from({length:count}, (_,i) => { const key = `${day.slice(0,7)}-${String(i+1).padStart(2,"0")}`; return `<span class="doctor-calendar-day${key === day ? ' is-today' : ''}${dates.has(key) ? ' has-shift' : ''}" ${key === day ? 'aria-current="date"' : ''} aria-label="${i+1}/${month}${dates.has(key) ? ', có ca làm việc' : ''}">${i+1}</span>`; }).join("")}</div><div class="doctor-calendar-legend"><span><i aria-hidden="true"></i>Có ca làm việc</span><span class="doctor-calendar-today-label">Hôm nay · ${date(day)}</span></div>`;
}


export function receptionScheduleOverview(day, shifts = [], error = null) {
  const link = '<a href="work_calendar.html">Xem lịch làm việc →</a>';
  if (error) {
    const message = `<p class="scope-note" role="status">${esc(error)}</p>`;
    return `<div class="doctor-overview-grid">${panel("Lịch làm việc", message, link)}${panel("Ca làm việc hôm nay", message)}</div>`;
  }
  const periods = {MORNING: "Ca sáng", AFTERNOON: "Ca chiều", FULL_DAY: "Cả ngày"};
  const items = shifts.filter(s => s.work_date === day).sort((a,b) => String(a.start_time).localeCompare(String(b.start_time)));
  const cards = items.length ? `<div class="doctor-overview-shifts">${items.map(s => {
    const state = s.status === "ON_LEAVE" ? "Đã duyệt nghỉ" : s.pending_leave ? "Đang xin nghỉ · Vẫn làm việc" : "Làm việc";
    return `<article><div><strong>${esc(periods[s.period] || s.period)}</strong><p>${esc(s.workstation_name ? s.workstation_name : state)}</p>${s.workstation_name?`<small>${esc(state)}</small>`:""}</div><div><strong>${esc(String(s.start_time || "").slice(0,5))} – ${esc(String(s.end_time || "").slice(0,5))}</strong></div></article>`;
  }).join("")}</div>` : empty("Không có ca làm việc hôm nay.");
  return `<div class="doctor-overview-grid">${panel("Lịch làm việc", overviewCalendar(shifts, day), link)}${panel("Ca làm việc hôm nay", cards)}</div>`;
}
