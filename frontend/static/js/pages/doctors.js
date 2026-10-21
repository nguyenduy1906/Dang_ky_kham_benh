import { startAutoRefresh } from "../core/auto_refresh.js";
import { listDoctors } from "../api/doctor.js";
import { listDepartments } from "../api/catalog.js";
import { doctorPage, doctorCard, element } from "../core/doctors.js";
import { verifySession, hasSession } from "../core/session.js";

const $ = selector => document.querySelector(selector);
const search = $("#directory-search"), department = $("#directory-department");
const grid = $(".directory-grid"), status = $("#directory-result"), empty = $("#directory-empty");
const retry = $("#directory-retry"), pager = $(".directory-pagination");
const previous = $("#directory-prev"), next = $("#directory-next"), pages = $("#directory-pages");
const departmentStatus = $("#directory-department-status");
const params = new URLSearchParams(location.search);
let page = Number(params.get("page")) || 1;
if (!Number.isInteger(page) || page < 1 || page > 100000) page = 1;
search.value = (params.get("q") || "").slice(0, 100);
let departmentId = params.get("department_id") || "";
let requestedName = params.get("department_name");
let request, departmentRequest, version = 0, timer, totalPages = 1, loading = false;
let feeVisible = false, feeVersion = 0, currentDoctors = [];
function renderCards() {
  grid.replaceChildren(...currentDoctors.map(doctor => doctorCard(doctor, { showFee: feeVisible })));
}
async function refreshFeeAccess() {
  const current = ++feeVersion;
  feeVisible = false;
  renderCards();
  if (!hasSession()) return;
  try {
    const allowed = await verifySession();
    if (current !== feeVersion) return;
    feeVisible = allowed && hasSession();
    renderCards();
  } catch { /* Keep prices hidden until the existing session can be verified. */ }
}

function saveFilters() {
  const url = new URL(location.href);
  url.searchParams.delete("department"); url.searchParams.delete("department_name");
  for (const [key, value] of [["q", search.value.trim()], ["department_id", departmentId], ["page", page > 1 ? page : ""]]) {
    if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
  }
  history.replaceState(null, "", url);
  const active = $('.site-header #main-nav a[aria-current="page"]');
  if (active) active.href = url.href;
}
async function load() {
  clearTimeout(timer);
  const current = ++version;
  request?.abort(); request = new AbortController(); loading = true;
  grid.setAttribute("aria-busy", "true");
  if (!grid.children.length) status.textContent = "Đang tải bác sĩ…";
  empty.hidden = true; retry.hidden = true;
  try {
    const result = doctorPage(await listDoctors({ q: search.value.trim(), department_id: departmentId, page, page_size: 8 },
      { auth: false, signal: request.signal }));
    if (current !== version) return;
    totalPages = Math.max(1, Math.ceil(result.total / result.page_size));
    if (page > totalPages) { page = totalPages; return load(); }
    currentDoctors = result.items;
    renderCards();
    status.textContent = "";
    empty.hidden = result.total > 0;
    pager.hidden = totalPages <= 1; previous.disabled = page <= 1; next.disabled = page >= totalPages;
    pages.replaceChildren();
    for (let number = Math.max(1, page - 2); number <= Math.min(totalPages, page + 2); number++) {
      const button = element("button", String(number)); button.type = "button";
      button.setAttribute("aria-label", `Trang ${number}`);
      if (number === page) button.setAttribute("aria-current", "page");
      button.addEventListener("click", () => { if (!loading) { page = number; load(); } });
      pages.append(button);
    }
    saveFilters();
  } catch (error) {
    if (current !== version || error.code === "CLIENT_ABORTED") return;
    status.textContent = error.message; retry.hidden = false;
  } finally {
    if (current === version) { loading = false; grid.setAttribute("aria-busy", "false"); }
  }
}
async function loadDepartments() {
  departmentRequest?.abort(); departmentRequest = new AbortController();
  const signal = departmentRequest.signal;
  department.disabled = true; departmentStatus.textContent = "Đang tải chuyên khoa…";
  $("#directory-department-retry").hidden = true;
  try {
    const result = await listDepartments({}, { auth: false, signal });
    if (signal.aborted) return;
    if (!Array.isArray(result?.items)) throw new Error("Không tải được chuyên khoa.");
    if (requestedName) {
      departmentId = String(result.items.find(item => item.name === requestedName)?.department_id || "");
      requestedName = null;
    }
    if (!result.items.some(item => String(item.department_id) === departmentId)) departmentId = "";
    const all = element("option", "Tất cả chuyên khoa"); all.value = "";
    department.replaceChildren(all, ...result.items.map(item => {
      const option = element("option", item.name); option.value = String(item.department_id); return option;
    }));
    department.value = departmentId;
    department.disabled = false; departmentStatus.textContent = "";
    await load();
  } catch (error) {
    if (signal.aborted) return;
    departmentStatus.textContent = `${error.message} Bạn vẫn có thể tìm bác sĩ theo tên.`;
    $("#directory-department-retry").hidden = false;
    await load();
  }
}
search.addEventListener("input", () => {
  clearTimeout(timer); request?.abort(); version++; page = 1;
  currentDoctors = []; grid.replaceChildren(); pager.hidden = true; empty.hidden = true; retry.hidden = true;
  status.textContent = "Đang tìm bác sĩ…";
  timer = setTimeout(load, 300);
});
department.addEventListener("change", () => { departmentId = department.value; page = 1; load(); });
$("#directory-filter").addEventListener("submit", event => { event.preventDefault(); page = 1; load(); });
previous.addEventListener("click", () => { if (!loading && page > 1) { page--; load(); } });
next.addEventListener("click", () => { if (!loading && page < totalPages) { page++; load(); } });
retry.addEventListener("click", load);
$("#directory-department-retry").addEventListener("click", loadDepartments);
window.addEventListener("neu:auth-change", refreshFeeAccess);
window.addEventListener("focus", refreshFeeAccess);
window.addEventListener("pagehide", () => {
  version++; feeVersion++; feeVisible = false; renderCards();
  clearTimeout(timer); request?.abort(); departmentRequest?.abort();
});
window.addEventListener("pageshow", event => { if (event.persisted) { refreshFeeAccess(); loadDepartments(); } });
refreshFeeAccess();
loadDepartments();
startAutoRefresh(load);
