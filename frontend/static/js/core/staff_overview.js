import { clearSession } from "./session.js";
import { startAutoRefresh } from "./auto_refresh.js";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// referenceDate is already a calendar date in Vietnam, supplied by the page.
export function overviewRange(period, referenceDate, from = referenceDate, to = referenceDate) {
  if (period === "custom") return { from, to };
  const reference = new Date(`${referenceDate}T00:00:00Z`);
  if (period === "week") {
    reference.setUTCDate(reference.getUTCDate() - (reference.getUTCDay() + 6) % 7);
    const first = reference.toISOString().slice(0, 10);
    reference.setUTCDate(reference.getUTCDate() + 6);
    return { from: first, to: reference.toISOString().slice(0, 10) };
  }
  if (period === "month") {
    const last = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0));
    return { from: `${referenceDate.slice(0, 7)}-01`, to: last.toISOString().slice(0, 10) };
  }
  return { from: referenceDate, to: referenceDate };
}

// Staff dashboards show today's existing data without a shared time filter.
export async function initTodayOverview(render) {
  const content=document.querySelector("#page-body"), feedback=document.querySelector("#page-status");
  const request=new AbortController();
  let active=true;
  const stop=()=>{active=false;request.abort();};
  window.addEventListener("pagehide",stop,{once:true});
  window.addEventListener("neu:auth-change",stop,{once:true});
  async function load() {
    content.setAttribute("aria-busy","true");
    if(feedback){feedback.hidden=false;feedback.dataset.error="false";feedback.textContent="Đang tải…";}
    try {
      const day=today();
      const html=await render({from:day,to:day},{signal:request.signal,period:"today"});
      if(!active)return;
      content.innerHTML=html;
      if(feedback){feedback.hidden=true;feedback.dataset.error="false";feedback.textContent="";}
    } catch(error) {
      if(!active)return;
      if(error.status===401||error.status===403){content.innerHTML="";if(error.status===401)clearSession();}
      if(feedback){feedback.hidden=false;feedback.dataset.error="true";feedback.textContent=error.message||"Không tải được dữ liệu tổng quan. Vui lòng tải lại trang.";}
    } finally {
      if(active)content.setAttribute("aria-busy","false");
    }
  }
  await load();
  startAutoRefresh(load,{canRefresh:()=>active});
}



// Reuse existing paginated readers, with only the date filters they support.
export async function overviewRows(reader, params, range, options = {}) {
  const items = [];
  for (let page = 1; ; page++) {
    const result = await reader({ ...params, page, page_size: 100 }, options);
    items.push(...result.items.filter(row => row.work_date >= range.from && row.work_date <= range.to));
    if (page * result.page_size >= result.total) return items;
  }
}
export const overviewDayParams = ({ from, to }) => from === to ? { work_date: from } : {};


