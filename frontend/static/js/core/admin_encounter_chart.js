const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const number = value => new Intl.NumberFormat("vi-VN").format(value);
const count = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;

export function encounterWeekValue(day) {
  const date = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) throw new RangeError("Ngày không hợp lệ.");
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const year = date.getUTCFullYear();
  const week = Math.ceil(((date - new Date(Date.UTC(year, 0, 1))) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function encounterWeekRange(value) {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match || Number(match[1]) < 1000 || Number(match[2]) < 1 || Number(match[2]) > 53) throw new RangeError("Vui lòng chọn tuần hợp lệ.");
  const date = new Date(Date.UTC(Number(match[1]), 0, 4));
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7 + (Number(match[2]) - 1) * 7);
  const from = date.toISOString().slice(0, 10);
  if (encounterWeekValue(from) !== value) throw new RangeError("Vui lòng chọn tuần hợp lệ.");
  date.setUTCDate(date.getUTCDate() + 6);
  return { from, to: date.toISOString().slice(0, 10) };
}

// Five integer intervals, rounded up to a readable scale; never cap daily counts.
export function encounterChartScale(maximum) {
  const target = Math.max(1, count(maximum)) / 5;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = Math.max(1, Math.ceil(([1, 2, 2.5, 5, 10].find(value => value * magnitude >= target) || 10) * magnitude));
  return { maximum: step * 5, step };
}

export function encounterDailyChart(items, range, { week = "", showRange = true, title = "Thống kê lượt khám" } = {}) {
  const days = new Map();
  for (const row of items) {
    const day = String(row.group_value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < range.from || day > range.to) continue;
    const entry = days.get(day) || { day, online: 0, walkIn: 0 };
    entry.online += count(row.online_count);
    entry.walkIn += count(row.walk_in_count);
    days.set(day, entry);
  }
  // Include zero-visit days in ordinary ranges; avoid an enormous empty chart
  // for a custom range spanning many years.
  const start = Date.parse(`${range.from}T00:00:00Z`), end = Date.parse(`${range.to}T00:00:00Z`);
  if (Number.isFinite(start) && Number.isFinite(end) && end >= start && (end - start) / 86400000 < 366) {
    for (let time = start; time <= end; time += 86400000) {
      const day = new Date(time).toISOString().slice(0, 10);
      if (!days.has(day)) days.set(day, { day, online: 0, walkIn: 0 });
    }
  }
  const rows = [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
  const fromParts=range.from.split("-"), toParts=range.to.split("-");
  const dateRange=fromParts[0]===toParts[0] ? `${fromParts[2]}/${fromParts[1]} – ${toParts[2]}/${toParts[1]}/${toParts[0]}` : `${fromParts.reverse().join("/")} – ${toParts.reverse().join("/")}`;
  const weekPicker = week ? `<div class="admin-chart-week-controls"><strong class="admin-chart-week-range">${esc(dateRange)}</strong><div class="admin-chart-week-buttons"><button type="button" class="secondary" data-chart-week="previous" aria-label="Tuần trước">‹</button><button type="button" class="secondary" data-chart-week="next" aria-label="Tuần sau">›</button><button type="button" class="secondary" data-chart-week="current">Tuần này</button></div></div>` : "";
  const heading = `<div class="admin-daily-chart-heading"><div><h2>${esc(title)}</h2><p>${week || !showRange ? "Theo hình thức tiếp nhận" : esc(dateRange)+" · Theo hình thức tiếp nhận"}</p></div><div class="admin-daily-chart-tools">${weekPicker}<ul class="admin-daily-chart-legend" aria-label="Chú giải"><li><span class="online"></span>Online</li><li><span class="walk-in"></span>Walk-in</li></ul></div></div>`;
  if (!rows.length) return `<section class="admin-card admin-daily-chart">${heading}<p class="admin-empty">Chưa có dữ liệu lượt khám trong khoảng đã chọn.</p></section>`;
  let largest = 0;
  for (const row of rows) largest = Math.max(largest, row.online, row.walkIn);
  const scale = encounterChartScale(largest);
  const axisWidth = Math.max(44, String(number(scale.maximum)).length * 7 + 12);
  const grid = Array.from({ length: 6 }, (_, index) => {
    const value = index * scale.step;
    return `<span class="chart-grid" style="bottom:${index * 20}%"></span>`;
  }).join("");
  const axis = Array.from({ length: 6 }, (_, index) => `<span style="bottom:${index * 20}%">${number(index * scale.step)}</span>`).join("");
  const bars = rows.map(row => `<div class="admin-chart-day-bars">${[["Online",row.online,"online"],["Walk-in",row.walkIn,"walk-in"]].map(([label,value,className]) => {
    const description=`${row.day.split("-").reverse().join("/")} · ${label}: ${number(value)} lượt khám`;
    return `<div class="chart-column ${className}" style="height:${value / scale.maximum * 100}%" tabindex="0" role="img" aria-label="${esc(description)}" title="${esc(description)}"><span class="chart-value${value===0 ? " chart-value-zero" : ""}">${number(value)}</span></div>`;
  }).join("")}</div>`).join("");
  const labels = rows.map(row => {
    const weekday = new Date(`${row.day}T00:00:00Z`).getUTCDay();
    return `<div><span class="chart-day">${weekday === 0 ? "CN" : `Thứ ${weekday+1}`}</span><span class="chart-date">${row.day.slice(8,10)}/${row.day.slice(5,7)}</span></div>`;
  }).join("");
  return `<section class="admin-card admin-daily-chart">${heading}<div class="admin-daily-chart-layout" style="--chart-axis-width:${axisWidth}px;--chart-days:${rows.length}"><div class="admin-chart-axis" aria-hidden="true">${axis}</div><div class="admin-daily-chart-scroll" tabindex="0" role="region" aria-label="Biểu đồ lượt khám theo ngày, có thể cuộn ngang"><div class="admin-chart-canvas" style="min-width:${rows.length*104}px"><div class="admin-chart-plot" role="group" aria-label="Thống kê lượt khám theo ngày. Mỗi ngày gồm hai cột Online và Walk-in; đơn vị lượt khám."><div class="admin-chart-grid" aria-hidden="true">${grid}</div>${bars}</div><div class="admin-chart-dates">${labels}</div></div></div></div></section>`;
}
