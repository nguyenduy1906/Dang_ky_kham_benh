import { listEncounters } from "../api/encounter.js";
import { table, encounterColumns } from "./staff_ui.js";

// The full list and today's overview share these eligibility rules and markup.
export const doctorEncounterStatuses = Object.freeze(["CONFIRMED","CHECKED_IN","IN_PROGRESS","COMPLETED","NO_SHOW"]);
export function doctorEncounterMatches(row, filters = {}) {
  return row.payment_confirmed === true && doctorEncounterStatuses.includes(row.encounter_status)
    && (!filters.work_date || row.work_date === filters.work_date)
    && (!filters.schedule_id || String(row.schedule_id) === String(filters.schedule_id))
    && (!filters.encounter_status || row.encounter_status === filters.encounter_status);
}
export async function loadDoctorEncounterRows(filters = {}, options = {}) {
  const rows = [];let page = 1, result;
  do {
    options.signal?.throwIfAborted();
    result = await listEncounters({...filters,page,page_size:100},options);
    rows.push(...result.items);page++;
  } while (result.items.length && rows.length < result.total);
  return rows.filter(row => doctorEncounterMatches(row,filters));
}
export function doctorEncounterTable(rows) {
  return `<div class="doctor-encounter-table">${table(["Người bệnh / phiếu khám","Khung giờ","Phòng / bác sĩ","Trạng thái","Thao tác"],rows.map(e=>`<tr>${encounterColumns(e)}<td><div class="actions"><a class="button-link secondary" href="clinical.html?encounter_id=${encodeURIComponent(e.encounter_id)}&mode=${e.encounter_status === "IN_PROGRESS" ? "edit" : "view"}">Mở bệnh án</a></div></td></tr>`))}</div>`;
}
export function fitFiveEncounterRows(root) {
  const viewport=root.querySelector(".doctor-overview-visits .table-wrap");
  if (!viewport) return;
  const header=viewport.querySelector("thead");
  const rows=Array.from(viewport.querySelectorAll("tbody tr")).slice(0,5);
  const height=(header?.getBoundingClientRect().height || 0)+rows.reduce((sum,row)=>sum+row.getBoundingClientRect().height,0);
  if(height>0) viewport.style.maxHeight=`${Math.ceil(height)+1}px`;
  viewport.tabIndex=0;viewport.setAttribute("role","region");viewport.setAttribute("aria-label","Lượt khám hôm nay, cuộn để xem thêm");
}
export function observeOverviewEncounters(root) {
  let frame;
  const resize=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>fitFiveEncounterRows(root));};
  const observer=new MutationObserver(resize);observer.observe(root,{childList:true,subtree:true});
  window.addEventListener("resize",resize);
  const stop=()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener("resize",resize);};
  window.addEventListener("pagehide",stop,{once:true});window.addEventListener("neu:auth-change",stop,{once:true});
  resize();
}
