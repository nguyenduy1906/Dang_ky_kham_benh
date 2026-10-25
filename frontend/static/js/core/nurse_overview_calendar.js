import { date } from "./staff_ui.js";

export function nurseOverviewCalendar(shifts, day) {
  const [year, month] = day.split("-").map(Number);
  const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const count = new Date(year, month, 0).getDate();
  const dates = new Set(shifts.filter(s => s.schedule_status !== "UNAVAILABLE").map(s => s.work_date));
  return `<div class="doctor-calendar-heading"><strong>Tháng ${month}/${year}</strong><span>${shifts.filter(s => s.work_date === day && s.schedule_status !== "UNAVAILABLE").length} ca hôm nay</span></div><div class="doctor-month-grid">${["T2","T3","T4","T5","T6","T7","CN"].map(d => `<strong>${d}</strong>`).join("")}${'<span></span>'.repeat(offset)}${Array.from({length:count}, (_,i) => { const key = `${day.slice(0,7)}-${String(i+1).padStart(2,"0")}`; return `<span class="doctor-calendar-day${key === day ? ' is-today' : ''}${dates.has(key) ? ' has-shift' : ''}" ${key === day ? 'aria-current="date"' : ''} aria-label="${i+1}/${month}${dates.has(key) ? ', có ca làm việc' : ''}">${i+1}</span>`; }).join("")}</div><div class="doctor-calendar-legend"><span><i aria-hidden="true"></i>Có ca làm việc</span><span class="doctor-calendar-today-label">Hôm nay · ${date(day)}</span></div>`;
}
