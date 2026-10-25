const states={OPEN:['Đang hoạt động','#e6f4ea','#218849'],FULL:['Đã đầy','#fcf3d9','#a87919'],CLOSED:['Đã đóng','#e8edf4','#637086'],UNAVAILABLE:['Báo nghỉ','#f8e8e9','#c94c4c']};
export const isScheduleStatus=value=>Object.hasOwn(states,value);
export function scheduleStatusBadge(value) {
 const [title,background,color]=states[value];
 return `<span class="badge status schedule-status" data-schedule-status="${value}" style="background:${background};color:${color};border-radius:5px">${title}</span>`;
}
