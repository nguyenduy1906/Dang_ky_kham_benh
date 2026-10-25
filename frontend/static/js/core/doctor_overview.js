import {listOwnSchedules} from '../api/schedule.js';
import {loadDoctorEncounterRows,doctorEncounterTable} from './doctor_encounter_list.js';
import {overviewRows,overviewRange} from './staff_overview.js';
import {esc,date,panel,stats,empty} from './staff_ui.js';

export async function renderDoctorOverview(range,options={}) {
    const month=overviewRange('month',range.from);
    const rangeLabel = `${date(range.from)}${range.to !== range.from ? ` – ${date(range.to)}` : ""}`;
    const [calendar, upcoming] = await Promise.all([
      overviewRows(listOwnSchedules, { from_date: month.from, to_date: month.to }, month, options)
        .then(shifts=>({shifts,missingProfile:false}))
        .catch(error=>{
          if(error.code==='DOCTOR_PROFILE_MISSING'&&error.status===404)return {shifts:[],missingProfile:true};
          throw error;
        }),
      loadDoctorEncounterRows({work_date:range.from},options),
    ]);
    const {shifts,missingProfile}=calendar;
    const notice=missingProfile?'<section class="panel doctor-profile-notice" role="status"><h2>Chưa có hồ sơ bác sĩ</h2><p>Tài khoản đã được tạo nhưng chưa có hồ sơ chuyên môn. Quản trị viên cần vào mục Bác sĩ, tạo hồ sơ liên kết với tài khoản này rồi phân ca làm việc.</p></section>':'';
    return notice + stats([["Lượt khám", upcoming.length, rangeLabel], ["Đã check in", upcoming.filter(e => e.encounter_status === "CHECKED_IN").length, "Sẵn sàng chờ khám"], ["Đang khám", upcoming.filter(e => e.encounter_status === "IN_PROGRESS").length, "Trong phạm vi được giao"], ["Hoàn thành hôm nay", upcoming.filter(e => e.encounter_status === "COMPLETED").length, rangeLabel]]) +
    `<div class="doctor-overview-grid">${panel("Lịch làm việc", overviewCalendar(shifts, range.from))}${panel("Ca làm việc hôm nay", overviewShifts(shifts.filter(s => s.work_date === range.from)), '<a href="work_calendar.html">Xem lịch làm việc →</a>')}</div>` +
    `<div class="doctor-overview-visits">${panel("Lượt khám hôm nay", doctorEncounterTable(upcoming), '<a href="encounters.html">Tất cả lượt được giao →</a>')}</div>`;
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
