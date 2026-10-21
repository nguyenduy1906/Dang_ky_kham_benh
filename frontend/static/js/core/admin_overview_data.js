import * as reports from "../api/statistics.js";
import * as schedules from "../api/schedule.js";
import * as encounters from "../api/encounter.js";
import * as notifications from "../api/notification.js";
import { allPages } from "./admin_ui.js";
import { encounterWeekRange } from "./admin_encounter_chart.js";

export async function overviewReport(reader, params, signal) {
  const first=await reader({...params,page:1,page_size:100},{signal});
  const items=[...first.items];
  for(let page=2;(page-1)*first.page_size<first.total;page++) {
    items.push(...(await reader({...params,page,page_size:first.page_size},{signal})).items);
  }
  return {...first,items};
}

export async function overviewSection(task) {
  try { return await task(); }
  catch(error) {
    if(error.status===401||error.status===403||error.code==="CLIENT_ABORTED")throw error;
    return {error:error.message||"Không tải được dữ liệu. Vui lòng thử lại."};
  }
}

export async function loadOverviewNotifications(signal) {
  // The unread list's total is the server's complete unread count, not its page size.
  const unread=await notifications.listNotifications({unread_only:true,page:1,page_size:5},{signal});
  let items=[...unread.items];
  if(unread.total<5) {
    const recent=await notifications.listNotifications({page:1,page_size:5},{signal});
    const seen=new Set(items.map(row=>String(row.notification_id)));
    items.push(...recent.items.filter(row=>!seen.has(String(row.notification_id))));
  }
  return {items:items.slice(0,5),unreadCount:unread.total};
}

export async function loadAdminOverview(day, week, signal) {
  const params={from_date:day,to_date:day}, range=encounterWeekRange(week);
  const [encounter,payment,weekly,recent,calendar,notices]=await Promise.all([
    reports.getEncounterStatistics({...params,page:1,page_size:1},{signal}),
    reports.getPaymentStatistics({...params,page:1,page_size:1},{signal}),
    overviewReport(reports.getEncounterStatistics,{from_date:range.from,to_date:range.to},signal),
    allPages(encounters.listEncounters,{work_date:day},signal),
    loadOverviewSchedules(day,signal),
    overviewSection(()=>loadOverviewNotifications(signal)),
  ]);
  return {day,week,encounter,payment,weekly,recent,calendar,notices};
}

export function loadOverviewSchedules(day, signal) {
  return overviewSection(async()=>({items:await allPages(schedules.listAdminSchedules,{from_date:day,to_date:day},signal)}));
}
