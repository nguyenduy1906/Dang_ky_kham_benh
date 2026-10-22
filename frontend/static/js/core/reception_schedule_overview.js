import { date, panel, empty, esc } from "./staff_ui.js";

export function overviewCalendar(shifts, day) {
  const [year, month] = day.split("-").map(Number);
  const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const count = new Date(year, month, 0).getDate();
  const dates = new Set(shifts.filter(s => s.schedule_status !== "UNAVAILABLE").map(s => s.work_date));
  return `<div class="doctor-calendar-heading"><strong>Tháng ${month}/${year}</strong><span>${shifts.filter(s => s.work_date === day && s.schedule_status !== "UNAVAILABLE").length} ca hôm nay</span></div><div class="doctor-month-grid">${["T2","T3","T4","T5","T6","T7","CN"].map(d => `<strong>${d}</strong>`).join("")}${'<span></span>'.repeat(offset)}${Array.from({length:count}, (_,i) => { const key = `${day.slice(0,7)}-${String(i+1).padStart(2,"0")}`; return `<span class="doctor-calendar-day${key === day ? ' is-today' : ''}${dates.has(key) ? ' has-shift' : ''}" ${key === day ? 'aria-current="date"' : ''} aria-label="${i+1}/${month}${dates.has(key) ? ', có ca làm việc' : ''}">${i+1}</span>`; }).join("")}</div><div class="doctor-calendar-legend"><span><i aria-hidden="true"></i>Có ca làm việc</span><span class="doctor-calendar-today-label">Hôm nay · ${date(day)}</span></div>`;
}


// Local presentation data only; never used as backend schedule identifiers.
export function previewReceptionShifts(day) {
  const [year, month] = day.split("-").map(Number);
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const work_date = `${day.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`;
    return [["morning", "08:00", "11:30"], ["afternoon", "13:30", "17:00"]].map(([period, start_time, end_time]) => ({
      work_date, period, start_time, end_time, department_name: "Nội tổng quát", room_name: "Phòng Nội 101", schedule_status: "OPEN",
    }));
  }).flat();
}
export function receptionScheduleOverview(day, shifts = previewReceptionShifts(day)) {
  const active = shifts.filter(s => s.schedule_status !== "UNAVAILABLE");
  const items = active.filter(s => s.work_date === day);
  const cards = items.length ? `<div class="doctor-overview-shifts">${items.map(s => `<article><div><strong>${esc(s.department_name)}</strong><p>${esc(s.room_name)}</p></div><div><strong>${esc(s.start_time.slice(0,5))} – ${esc(s.end_time.slice(0,5))}</strong><button type="button" class="button-link secondary" data-reception-preview-shift="${esc(s.period)}">Xem danh sách bệnh nhân</button></div></article>`).join("")}</div>` : empty("Không có ca làm việc hôm nay.");
  return `<div class="doctor-overview-grid">${panel("Lịch làm việc", overviewCalendar(shifts, day))}${panel("Ca làm việc hôm nay", cards, '<a href="work_calendar.html">Xem lịch làm việc →</a>')}</div><p class="scope-note">Lịch và ca làm việc minh họa giao diện.</p>`;
}
