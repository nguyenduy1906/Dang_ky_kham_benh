import { listEncounters } from "../api/encounter.js";
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
    if(feedback){feedback.hidden=false;feedback.textContent="Đang tải…";}
    try {
      const day=today();
      const html=await render({from:day,to:day},{signal:request.signal,period:"today"});
      if(!active)return;
      content.innerHTML=html;
      if(feedback){feedback.hidden=true;feedback.textContent="";}
    } catch(error) {
      if(!active)return;
      if(error.status===401){content.innerHTML="";clearSession();}
      if(feedback){feedback.hidden=false;feedback.textContent=error.message||"Không tải được dữ liệu tổng quan. Vui lòng tải lại trang.";}
    } finally {
      if(active)content.setAttribute("aria-busy","false");
    }
  }
  await load();
  startAutoRefresh(load,{canRefresh:()=>active});
}

// Keep existing content mounted while loading and discard stale responses.
export async function initOverviewPeriod(render, { storageKey = null } = {}) {
  document.querySelector("#overview-period-control").innerHTML = `<form id="overview-filter" class="overview-period-filter">
          <label>Thời gian<select name="period"><option value="today" selected>Hôm nay</option><option value="week">Tuần này</option><option value="month">Tháng này</option><option value="custom">Khoảng ngày tùy chọn</option></select></label>
          <div id="overview-custom" class="overview-period-custom" hidden inert><label>Từ ngày<input type="date" name="from_date" required></label><label>Đến ngày<input type="date" name="to_date" required></label></div>
          <p id="overview-feedback" class="overview-period-feedback" role="status"></p>
        </form>`;
  const form = document.querySelector("#overview-filter");
  const custom = document.querySelector("#overview-custom");
  const feedback = document.querySelector("#overview-feedback");
  const content = document.querySelector("#page-body");
  const { period, from_date, to_date } = form.elements;
  period.value = "today";
  from_date.value = to_date.value = today();
  if (storageKey) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      const validDate = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
      const validDates = validDate(saved?.from) && validDate(saved?.to) && saved.from <= saved.to;
      if (["today", "week", "month", "custom"].includes(saved?.period) && (saved.period !== "custom" || validDates)) {
        period.value = saved.period;
        if (validDates) { from_date.value = saved.from; to_date.value = saved.to; }
      }
    } catch { /* Missing or unavailable preference storage keeps the default. */ }
  }
  let version = 0, active = true, request;
  window.addEventListener("pagehide", () => { active = false; version++; request?.abort(); }, { once: true });
  async function load() {
    if (!active) return;
    const current = ++version;
    request?.abort();
    const showCustom = period.value === "custom";
    custom.hidden = custom.inert = !showCustom;
    from_date.disabled = to_date.disabled = !showCustom;
    to_date.setCustomValidity("");
    const range = overviewRange(period.value, today(), from_date.value, to_date.value);
    if (showCustom && (!range.from || !range.to || range.to < range.from)) {
      to_date.setCustomValidity("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.");
      feedback.textContent = "Vui lòng chọn khoảng ngày hợp lệ.";
      content.setAttribute("aria-busy", "false");
      form.reportValidity();
      return;
    }
    request = new AbortController();
    if (storageKey) {
      try { sessionStorage.setItem(storageKey, JSON.stringify({ period: period.value, from: from_date.value, to: to_date.value })); }
      catch { /* Filtering still works if browser storage is unavailable. */ }
    }
    content.setAttribute("aria-busy", "true");
    feedback.textContent = "Đang tải…";
    try {
      const html = await render(range, { signal: request.signal, period: period.value });
      if (!active || current !== version) return;
      content.innerHTML = html;
      feedback.textContent = "";
    } catch (error) {
      if (active && current === version) {
        if (error.status === 401) { clearSession(); content.innerHTML = ""; }
        feedback.textContent = error.message || "Không tải được dữ liệu. Vui lòng chọn lại thời gian.";
      }
    } finally {
      if (active && current === version) content.setAttribute("aria-busy", "false");
    }
  }
  form.addEventListener("submit", event => event.preventDefault());
  period.addEventListener("change", load);
  for (const field of [from_date, to_date]) field.addEventListener("change", () => { if (period.value === "custom") return load(); });
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

export async function getOverviewCounts({ from, to }, options = {}) {
  const counts = { CHECKED_IN: 0, IN_PROGRESS: 0, COMPLETED: 0 };
  // The existing endpoint accepts an exact day, not a date range. Read every
  // authorized page before counting a longer range; never count just page one.
  const params = { page_size: 100, ...(from === to ? { work_date: from } : {}) };
  for (let page = 1; ; page++) {
    const result = await listEncounters({ ...params, page }, options);
    for (const encounter of result.items) {
      if (encounter.work_date >= from && encounter.work_date <= to && Object.hasOwn(counts, encounter.encounter_status)) counts[encounter.encounter_status]++;
    }
    if (page * result.page_size >= result.total) return counts;
  }
}
