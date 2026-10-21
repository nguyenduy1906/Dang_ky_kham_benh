import { searchAdminEncounters } from "./admin_encounter_search.js";
import { resources } from "./admin_resources.js";
import { esc, panel, table } from "./admin_ui.js";

export function scheduleEncounterTable(rows) {
  const config = resources.encounters;
  return table([...config.columns, "Thao tác"], rows.map(row => [
    ...config.cells(row),
    `<button type="button" class="row-action" data-schedule-encounter="${esc(row.encounter_id)}">Chi tiết</button>`,
  ]), "Các lượt khám trong ca");
}

export function openScheduleDetail({ ctx, body, row, information, showEncounter, trigger }) {
  const previous = [...body.children].map(node => [node, node.hidden]);
  const add = document.querySelector("#add-record");
  const addHidden = add?.hidden;
  previous.forEach(([node]) => { node.hidden = true; });
  if (add) add.hidden = true;
  const view = document.createElement("section");
  view.className = "admin-schedule-detail";
  view.innerHTML = `<div class="admin-schedule-detail-heading"><button type="button" class="secondary" data-schedule-back>← Quay lại danh sách</button><h2 tabindex="-1">Chi tiết ca ${esc(row.schedule_code || `CA_${String(row.schedule_id).padStart(3, "0")}`)}</h2></div>`
    + panel("Thông tin ca làm việc", `<div class="admin-schedule-information">${information}</div>`)
    + panel("Các lượt khám trong ca", '<div data-schedule-results></div><div data-schedule-pages></div>');
  body.append(view);
  view.querySelector("h2").focus();
  let page = 1, version = 0;
  const records = new Map();
  async function load() {
    const current = ++version;
    const results = view.querySelector("[data-schedule-results]");
    results.innerHTML = '<p class="admin-search-status" role="status">Đang tải lượt khám…</p>';
    view.querySelector("[data-schedule-pages]").innerHTML = "";
    await ctx.load(signal => searchAdminEncounters({ schedule_id: row.schedule_id }, page, 12, signal), result => {
      if (!view.isConnected) return;
      page=result.page;records.clear(); result.items.forEach(item => records.set(String(item.encounter_id), item));
      results.innerHTML = scheduleEncounterTable(result.items);
      const pages = Math.max(1, Math.ceil(result.total / result.page_size));
      view.querySelector("[data-schedule-pages]").innerHTML = `<div class="admin-pagination"><span>${esc(result.total)} lượt khám · Trang ${page} / ${pages}</span><div><button type="button" class="secondary" data-schedule-page="-1" ${page <= 1 ? "disabled" : ""}>Trang trước</button><button type="button" class="secondary" data-schedule-page="1" ${page >= pages ? "disabled" : ""}>Trang sau</button></div></div>`;
    });
    if (current === version && ctx.active && view.isConnected && results.querySelector('[role="status"]')) {
      results.innerHTML = '<p class="admin-search-status">Không thể tải danh sách lượt khám. <button type="button" class="secondary" data-schedule-retry>Thử lại</button></p>';
    }
  }
  view.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-schedule-back")) {
      ctx.cancelLoad(); view.remove();
      previous.forEach(([node, hidden]) => { node.hidden = hidden; });
      if (add) add.hidden = addHidden;
      trigger?.focus();
    } else if (button.hasAttribute("data-schedule-page")) {
      page += Number(button.dataset.schedulePage); load();
    } else if (button.hasAttribute("data-schedule-retry")) load();
    else if (button.hasAttribute("data-schedule-encounter")) showEncounter(records.get(button.dataset.scheduleEncounter));
  });
  load();
}
