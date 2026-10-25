import {replaceAdminRegion} from "./admin_render.js";
import * as reports from "../api/statistics.js";
import { startAutoRefresh } from "./auto_refresh.js";
import * as notifications from "../api/notification.js";
import {notificationRow} from "./admin_notification_data.js";
import {notificationDetail} from "./admin_feedback_presentation.js";
import { $, esc, money, metrics, panel, today } from "./admin_ui.js";
import { resources } from "./admin_resources.js";
import { encounterDailyChart, encounterWeekValue, encounterWeekRange } from "./admin_encounter_chart.js";
import { overviewEncounterTable } from "./admin_overview_encounters.js";
import { adminOverviewSupportCards } from "./admin_overview_support.js";
import { loadAdminOverview, loadOverviewSchedules, loadOverviewNotifications, overviewReport, overviewSection } from "./admin_overview_data.js";

export function adminOverviewMarkup(data) {
  const {encounter,payment,notices,week,day}=data;
  const summary=metrics([
    ["Tổng lượt khám",encounter.summary.total,"Theo ngày ca khám"],
    ["Đã hoàn thành",encounter.by_status.find(row=>row.encounter_status==="COMPLETED")?.count??0,"Lượt khám hoàn tất"],
    ["Thu ròng",money(payment.summary.net_received),"Thu thành công trừ số hoàn thực tế"],
    ["Thông báo",notices.error?"—":notices.unreadCount,notices.error?"Không tải được thông báo":"Thông báo chưa đọc"],
  ]);
  return `<div id="admin-overview-summary">${summary}</div>`+`<div id="admin-weekly-chart">${encounterDailyChart(data.weekly.items,encounterWeekRange(week),{week})}</div>`
    +`<div id="admin-overview-recent">${panel("Lượt khám hôm nay",overviewEncounterTable(data.recent,resources.encounters),'<a href="encounters.html">Xem danh sách →</a>')}</div>`
    +`<div id="admin-overview-support">${adminOverviewSupportCards({day,calendar:data.calendar,notices})}</div>`;
}

export async function initAdminOverview(ctx) {
  const body=$("#page-body");
  let data, week=encounterWeekValue(today()), weekVersion=0, noticeVersion=0, scheduleVersion=0;
  let weekRequest, noticeRequest, scheduleRequest;
  const stop=()=>{weekVersion++;noticeVersion++;weekRequest?.abort();noticeRequest?.abort();scheduleVersion++;scheduleRequest?.abort();};
  window.addEventListener("pagehide",stop,{once:true});
  window.addEventListener("neu:auth-change",stop,{once:true});

  async function changeWeek(value) {
    const host=$("#admin-weekly-chart");if(!ctx.active||!host)return;
    const range=encounterWeekRange(value);week=value;
    weekRequest?.abort();const version=++weekVersion,request=new AbortController();weekRequest=request;
    host.setAttribute("aria-busy","true");
    host.querySelector(".admin-chart-week-feedback")?.remove();
    host.insertAdjacentHTML("beforeend",'<p class="admin-note admin-chart-week-feedback" role="status">Đang tải thống kê tuần…</p>');
    try {
      const report=await overviewReport(reports.getEncounterStatistics,{from_date:range.from,to_date:range.to},request.signal);
      if(!ctx.active||version!==weekVersion||!host.isConnected)return;
      const focus=host.querySelector("[data-chart-week]:focus")?.dataset.chartWeek;
      host.innerHTML=encounterDailyChart(report.items,range,{week:value});
      if(focus)host.querySelector(`[data-chart-week="${focus}"]`)?.focus();
    } catch(error) {
      if(!ctx.active||version!==weekVersion||!host.isConnected)return;
      if(error.status===401||error.status===403){ctx.handle(error);return;}
      host.innerHTML=encounterDailyChart([],range,{week:value});
      host.querySelector(".admin-daily-chart-layout")?.remove();
      host.insertAdjacentHTML("beforeend",`<p class="admin-note" role="status">${esc(error.message||"Không tải được thống kê. Vui lòng chọn lại tuần.")}</p>`);
    } finally {
      if(ctx.active&&version===weekVersion&&host.isConnected){host.setAttribute("aria-busy","false");host.querySelector(".admin-chart-week-feedback")?.remove();}
    }
  }

  async function refreshNotifications() {
    if(!ctx.active||!data)return;
    noticeRequest?.abort();const version=++noticeVersion,request=new AbortController();noticeRequest=request;
    const host=$("#admin-overview-support");
    host?.querySelector(".admin-overview-notifications")?.setAttribute("aria-busy","true");
    try {
      const result=await overviewSection(()=>loadOverviewNotifications(request.signal));
      if(!ctx.active||version!==noticeVersion||!host?.isConnected)return;
      data.notices=result;
      replaceAdminRegion(host,adminOverviewSupportCards({day:data.day,calendar:data.calendar,notices:result}));
      const metric=body.querySelector(".admin-summary .admin-metric:last-child");
      metric.querySelector("strong").textContent=result.error?"—":String(result.unreadCount);
      metric.querySelector("small").textContent=result.error?"Không tải được thông báo":"Thông báo chưa đọc";
    } catch(error) {
      if(ctx.active&&version===noticeVersion)ctx.handle(error);
    } finally {
      if(ctx.active&&version===noticeVersion&&host?.isConnected){
        host.querySelector(".admin-overview-notifications").setAttribute("aria-busy","false");
      }
    }
  }

  body.addEventListener("change",async event=>{
    const input=event.target.closest("[data-overview-schedule-day]");
    if(!ctx.active||!data||!input||!input.value||input.validity?.valid===false)return;
    const day=input.value,host=$("#admin-overview-support");
    scheduleRequest?.abort();const version=++scheduleVersion,request=new AbortController();scheduleRequest=request;
    host.querySelector(".admin-overview-schedules")?.setAttribute("aria-busy","true");
    try {
      const calendar=await loadOverviewSchedules(day,request.signal);
      if(!ctx.active||version!==scheduleVersion||!host.isConnected)return;
      data.day=day;data.calendar=calendar;
      replaceAdminRegion(host,adminOverviewSupportCards({day,calendar,notices:data.notices}));
    } catch(error) {
      if(ctx.active&&version===scheduleVersion)ctx.handle(error);
    } finally {
      if(ctx.active&&version===scheduleVersion&&host.isConnected)host.querySelector(".admin-overview-schedules")?.setAttribute("aria-busy","false");
    }
  });

  body.addEventListener("click",event=>{
    if(!ctx.active||!data)return;
    const weekButton=event.target.closest("[data-chart-week]");
    if(weekButton) {
      let next=encounterWeekValue(today());
      if(weekButton.dataset.chartWeek!=="current") {
        const day=new Date(`${encounterWeekRange(week).from}T00:00:00Z`);
        day.setUTCDate(day.getUTCDate()+(weekButton.dataset.chartWeek==="previous"?-7:7));
        next=encounterWeekValue(day.toISOString().slice(0,10));
      }
      changeWeek(next).catch(error=>ctx.handle(error));return;
    }
    const notification=event.target.closest("[data-overview-notification]");
    if(!notification)return;
    const row=data.notices.items?.find(item=>String(item.notification_id)===notification.dataset.overviewNotification);
    if(!row)return;
    ctx.show("Chi tiết thông báo",async signal=>{
      const result=await notifications.markRead(row.notification_id,{signal});
      await refreshNotifications();
      return notificationDetail(notificationRow(result.notification));
    });
  });
  await ctx.load(signal=>loadAdminOverview(today(),week,signal),result=>{data=result;body.innerHTML=adminOverviewMarkup(result);});
  startAutoRefresh(async()=>{
    const selectedDay=data?.day, selectedWeek=week, version=weekVersion, calendarVersion=scheduleVersion;
    await ctx.load(async signal=>{
      const result=await loadAdminOverview(today(),selectedWeek,signal);
      if(selectedDay&&selectedDay!==result.day){result.calendar=await loadOverviewSchedules(selectedDay,signal);result.day=selectedDay;}
      return result;
    },result=>{
      if(version!==weekVersion||calendarVersion!==scheduleVersion)return;
      data=result;
      const template=document.createElement('template');template.innerHTML=adminOverviewMarkup(result);
      for(const id of ['admin-overview-summary','admin-weekly-chart','admin-overview-recent','admin-overview-support']) {
        const current=body.querySelector('#'+id),next=template.content.querySelector('#'+id);
        if(current&&next)replaceAdminRegion(current,next.innerHTML);
      }
    });
  },{canRefresh:()=>ctx.active});
}
