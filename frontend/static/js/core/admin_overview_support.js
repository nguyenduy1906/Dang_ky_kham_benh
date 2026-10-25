import { esc, date, stamp, today } from "./admin_ui.js";

const calendarIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 11h18M7 15h3M14 15h3"/></svg>';
const bell = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 21h4"/></svg>';

const empty = (icon,title,description) => `<div class="admin-support-empty"><span class="admin-support-empty-icon">${icon}</span><h3>${esc(title)}</h3><p>${esc(description)}</p></div>`;

export function overviewShiftStatus(row, now = new Date()) {
  if(row.move) return {text:"Đã chuyển ca",tone:"moved"};
  if(row.pending_leave&&!row.move&&!['OFF','CLOSED','MOVED'].includes(row.work_status)
    &&!['UNAVAILABLE','CLOSED'].includes(row.schedule_status))return {text:"Đang xin nghỉ",tone:"leave-pending"};
  const statuses={UPCOMING:["Chưa đến giờ làm","pending"],WORKING:["Đang làm","working"],COMPLETED:["Hoàn thành","done"],OFF:["Nghỉ làm","off"],MOVED:["Đã chuyển ca","moved"],CLOSED:["Đã đóng ca","closed"]};
  if(statuses[row.work_status]) {const [text,tone]=statuses[row.work_status];return {text,tone};}
  if(row.schedule_status === "UNAVAILABLE") return {text:"Nghỉ làm",tone:"off"};
  if(row.schedule_status === "CLOSED") return {text:"Đã đóng ca",tone:"closed"};
  const start=new Date(`${row.work_date}T${row.start_time}+07:00`);
  const end=new Date(`${row.work_date}T${row.end_time}+07:00`);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())) return {text:"Chưa có giờ làm",tone:"pending"};
  if(now < start) return {text:"Chưa đến giờ làm",tone:"pending"};
  if(now >= end) return {text:"Hoàn thành",tone:"done"};
  return {text:"Đang làm",tone:"working"};
}

export function adminOverviewSupportCards({ day, calendar, notices }) {
  const rows=[...(calendar.items||[])].sort((a,b)=>`${a.start_time}${a.doctor_name}`.localeCompare(`${b.start_time}${b.doctor_name}`));
  const doctorTotal=new Set(rows.map(row=>row.doctor_profile_id)).size;
  const roomTotal=new Set(rows.map(row=>row.room_id)).size;
  const scheduleBody=calendar.error
    ? empty(calendarIcon,"Không tải được lịch làm việc",calendar.error)
    : rows.length ? `<div class="admin-support-schedule-list">${rows.map(row=>{
      const status=overviewShiftStatus(row);
      return `<article class="admin-support-schedule-row"><div><strong>${esc(row.doctor_name)}</strong><small>${esc(row.department_name)} · ${esc(row.room_name)}</small></div><div class="admin-support-shift-line"><span class="admin-support-shift-time">${esc(row.start_time?.slice(0,5))} – ${esc(row.end_time?.slice(0,5))}</span><span class="admin-support-shift-status is-${status.tone}">${esc(status.text)}</span></div></article>`;
    }).join("")}</div>` : empty(calendarIcon,"Chưa có ca làm việc trong ngày đã chọn","Bạn có thể xem hoặc bố trí ca tại trang Quản lý lịch.");
  const notificationBody=notices.error
    ? empty(bell,"Không tải được thông báo",notices.error)
    : notices.items?.length ? `<div class="admin-support-notification-list">${notices.items.map(row=>`<button type="button" class="admin-support-notification-item${row.is_read?"":" is-unread"}" data-overview-notification="${esc(row.notification_id)}"><span class="admin-support-notification-icon">${bell}</span><span class="admin-support-notification-copy"><strong>${esc(row.title)}</strong><span>${esc(row.content)}</span><small>${esc(stamp(row.created_at))}</small></span>${row.is_read?"":'<span class="admin-support-unread-dot" aria-label="Chưa đọc"></span>'}</button>`).join("")}</div>`
    : empty(bell,"Chưa có thông báo","Thông báo gửi đến tài khoản của bạn sẽ xuất hiện tại đây.");
  const unread=notices.error?"—":String(notices.unreadCount);
  return `<div class="admin-overview-support-grid">
    <section class="admin-card admin-overview-schedules" aria-labelledby="overview-schedules-title">
      <div class="admin-support-heading"><div><h2 id="overview-schedules-title">Lịch làm việc bác sĩ</h2></div><a href="schedule.html">Quản lý lịch <span aria-hidden="true">→</span></a></div>
      <div class="admin-support-schedule-summary"><span class="admin-support-day"><label class="admin-support-day-picker" title="Chọn ngày xem lịch làm việc bác sĩ">${calendarIcon}<input type="date" value="${esc(day)}" data-overview-schedule-day data-native-date-picker aria-label="Chọn ngày xem lịch làm việc bác sĩ"></label><strong>${day===today()?"Hôm nay · ":""}${esc(date(day))}</strong></span><span>${calendar.error?"Chưa tải được số ca":`${doctorTotal} bác sĩ · ${roomTotal} phòng có lịch`}</span></div>
      <div class="admin-support-schedule-body">${scheduleBody}</div>
      <div class="admin-support-footer"><span class="admin-support-status-dot" aria-hidden="true"></span><span>${calendar.error?"Dữ liệu lịch tạm thời không khả dụng":`${rows.length} ca · Sắp theo giờ bắt đầu`}</span></div>
    </section>
    <section class="admin-card admin-overview-notifications" aria-labelledby="overview-notifications-title">
      <div class="admin-support-heading"><div><h2 id="overview-notifications-title">Thông báo</h2></div><a href="notifications.html">Xem tất cả <span aria-hidden="true">→</span></a></div>
      <div class="admin-support-notification-summary"><span class="admin-support-unread">${bell}<span>Chưa đọc</span><strong>${esc(unread)}</strong></span><span>Ưu tiên chưa đọc</span></div>
      <div class="admin-support-notification-body">${notificationBody}</div>
      <div class="admin-support-footer"><span class="admin-support-status-dot" aria-hidden="true"></span><span>Cuộn để xem thêm · Chọn thông báo để xem nội dung đầy đủ</span></div>
    </section>
  </div>`;
}
