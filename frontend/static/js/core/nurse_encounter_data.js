import { listEncounters } from "../api/encounter.js";

export const activeStatuses = Object.freeze(["CONFIRMED", "CHECKED_IN", "IN_PROGRESS"]);
export const historyStatuses = Object.freeze(["COMPLETED", "NO_SHOW"]);

// Merge complete result sets before searching/paging; the API accepts one status at a time.
// Every request still uses the authenticated nurse's server-side assignment scope.
export async function allPages(fetchPage, options = {}) {
  const first = await fetchPage({ page: 1, page_size: 100 }, options);
  const items = [...first.items];
  for (let page = 2; (page - 1) * first.page_size < first.total; page++) {
    options.signal?.throwIfAborted();
    const result = await fetchPage({ page, page_size: first.page_size }, options);
    items.push(...result.items);
  }
  return items;
}

export async function nurseEncounters(statuses, filters = {}, options = {}) {
  const results = await Promise.all(statuses.map(encounter_status =>
    allPages((paging, request) => listEncounters({ ...filters, ...paging, encounter_status }, request), options)));
  const unique = new Map();
  for (const row of results.flat()) if (statuses.includes(row.encounter_status)) unique.set(String(row.encounter_id), row);
  return [...unique.values()];
}

export function localPage(items, page = 1, size = 12) {
  page = Math.max(1, Math.min(page, Math.ceil(items.length / size) || 1));
  return { items: items.slice((page - 1) * size, page * size), total: items.length, page, page_size: size };
}

export const shiftEnd = row => Date.parse(`${row.work_date}T${row.end_time || "23:59:59"}+07:00`);
export function attendance(row) {
  if (row.encounter_status === "NO_SHOW") return '<span class="badge amber">Không đến</span>';
  if (row.checked_in_at || ["CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(row.encounter_status)) return '<span class="badge green">Đã đến</span>';
  return '<span class="badge blue">Chưa đến</span>';
}
export const normalizeSearch = text => String(text || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
