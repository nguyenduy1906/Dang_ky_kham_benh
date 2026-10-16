import { sections, pages } from "../data/admin_preview.js";
import { initializeSidebarCollapse } from "../core/sidebar_collapse.js";

import { requireAdmin } from "../core/admin_access.js";
import { signOut, loginUrl, hasSession } from "../core/session.js";

// Management screens remain presentation-only; verify the existing session at entry.
window.addEventListener("pageshow", event => { if (event.persisted) { suspendAdmin(); location.reload(); } });
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const shapes = {
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  record: '<path d="M8 4H5v17h14V4h-3M9 2h6v4H9zM8 11h8M8 15h8"/>',
  people: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M21 21v-4a6 6 0 0 0-3-5"/>',
  person: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16"/><path d="M3 11h18M8 2v6M16 2v6"/>',
  cross: '<path d="M7 3h10v9a5 5 0 0 1-10 0zM9 8h6M12 5v6M12 17v5M8 20h8"/>',
  doctor: '<path d="M4 3v6a5 5 0 0 0 10 0V3M2 3h4M12 3h4M9 14v3a5 5 0 0 0 10 0v-3"/><circle cx="19" cy="11" r="3"/>',
  building: '<rect x="5" y="3" width="14" height="18"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M10 21v-6h4v6"/>',
  door: '<rect x="6" y="3" width="12" height="18"/><path d="M14 12h1"/>',
  card: '<rect x="2" y="5" width="20" height="14"/><path d="M2 10h20M6 15h4"/>',
  chart: '<path d="M3 21h19M5 17V9M10 17V3M15 17v-5M20 17V6"/>',
  history: '<path d="M3 11a9 9 0 1 1 2 7M3 3v8h8M12 6v6l4 2"/>',
  settings: '<path d="m12 2 3 3 4 1 1 4 2 2-2 3-1 4-4 1-3 2-3-2-4-1-1-4-2-3 2-2 1-4 4-1z"/><circle cx="12" cy="12" r="3"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  bell: '<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 21h4"/>',
};
const icon = key => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[key] || shapes.record}</svg>`;
const key = Object.hasOwn(pages, document.body.dataset.page) ? document.body.dataset.page : "home";
const page = pages[key];
const initials = text => text.replace(/^BS\. /, "").split(/\s+/).slice(-2).map(x => x[0]).join("");
const normalize = value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
const money = amount => `${new Intl.NumberFormat("vi-VN").format(amount)} ₫`;
const amount = row => Number(row[4].replace(/\D/g, ""));
const net = pages.payments.rows.filter(r => r[6] === "Thành công").reduce((sum, row) => sum + (row[3] === "Hoàn tiền" ? -1 : 1) * amount(row), 0);
function badge(value) {
  const tone = ["Đang hoạt động", "Đang mở", "Đang phân công", "Đã xuất bản", "Hoàn thành", "Thành công"].includes(value) ? "green" : ["Bản nháp", "Đang chờ", "Chờ đặt cọc"].includes(value) ? "amber" : ["Đã xác nhận", "Đã tiếp nhận", "Đang khám", "Trực tuyến", "Bác sĩ", "Quản trị viên", "Lễ tân", "Y tá", "Người dùng"].includes(value) ? "blue" : ["Trực tiếp", "Đặt cọc", "Phí khám", "Hoàn tiền"].includes(value) ? "purple" : "";
  return `<span class="badge ${tone}">${esc(value)}</span>`;
}
const dialog = $("#admin-dialog");
let dialogTrigger;
function showDialog(title, body) {
  dialogTrigger = document.activeElement;
  $("#admin-dialog-title").textContent = title;
  $("#admin-dialog-body").innerHTML = body;
  dialog.showModal();
}
dialog.addEventListener("close", () => dialogTrigger?.focus());
$("#dialog-close").addEventListener("click", () => dialog.close());
$("#staff-sidebar").innerHTML = `<a class="staff-brand" href="home.html"><img src="../../static/assets/bieu_trung_neu.png" alt="Biểu trưng NEU"><span><strong>NEU Medical</strong><small>KHÔNG GIAN QUẢN TRỊ</small></span></a><nav aria-label="Điều hướng quản trị">${sections.map(([title, items]) => `<p class="staff-nav-label">${title}</p>${items.map(([id, label, symbol]) => `<a href="${id === "home" ? "home" : id}.html" ${key === id ? 'aria-current="page"' : ""}>${icon(symbol)}<span>${label}</span>${id === "encounters" ? '<span class="admin-count">10</span>' : ""}</a>`).join("")}`).join("")}</nav><div class="staff-sidebar-bottom admin-logout"><button type="button" id="admin-signout" title="Đăng xuất"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 3H3v18h6M10 12h11M17 8l4 4-4 4"/></svg><span>Đăng xuất</span></button></div><div class="admin-sidebar-footer"><span>NEU Medical Admin</span><span>Giao diện mẫu</span></div>`;
$("#staff-topbar").innerHTML = `<div class="staff-topbar-left"><button type="button" class="staff-menu-toggle" aria-label="Mở menu quản trị" aria-expanded="false" aria-controls="staff-sidebar">${icon("menu")}</button><div class="staff-breadcrumb"><span>Quản trị hệ thống</span><span aria-hidden="true">›</span><strong>${esc(page.title)}</strong></div></div><div class="staff-topbar-right"><span class="admin-preview">Dữ liệu minh họa</span><div class="admin-account"><span class="staff-initials" aria-hidden="true">QT</span><div><strong id="admin-account-name">Quản trị viên</strong><small>Quản trị viên</small></div></div></div>`;
$("#admin-signout").addEventListener("click", async event => {
  event.currentTarget.disabled = true;
  try { await signOut(); }
  catch { /* The local session is cleared even if the backend is unavailable. */ }
  finally { location.replace(loginUrl().href); }
});
function suspendAdmin() {
  document.body.classList.add("staff-auth-pending");
  $("#main-content").inert = true;
}
window.addEventListener("neu:auth-change", () => {
  if (!hasSession()) { suspendAdmin(); location.replace(loginUrl(new URL(location.href)).href); }
});
$("#page-title").textContent = page.title;
$("#page-description").textContent = page.description;
document.title = `${page.title} | NEU Medical`;
if (page.add) $("#page-header").insertAdjacentHTML("beforeend", `<button type="button" id="add-record">＋ ${esc(page.add)}</button>`);
const menuButton = $(".staff-menu-toggle");
initializeSidebarCollapse("admin");
const backdrop = $("#menu-backdrop");
function setMenu(open, returnFocus = false) {
  document.body.classList.toggle("staff-menu-open", open);
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Đóng menu quản trị" : "Mở menu quản trị");
  backdrop.hidden = !open;
  $(".staff-main").inert = open;
  if (open) $(".staff-brand").focus();
  else if (returnFocus) menuButton.focus();
}
menuButton.addEventListener("click", () => setMenu(true));
backdrop.addEventListener("click", () => setMenu(false, true));
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && document.body.classList.contains("staff-menu-open") && !dialog.open) setMenu(false, true);
  if (event.key === "Tab" && document.body.classList.contains("staff-menu-open") && !dialog.open) {
    const items = [...$("#staff-sidebar").querySelectorAll("a, button")];
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
  }
});
matchMedia("(max-width: 960px)").addEventListener("change", event => { if (!event.matches) setMenu(false); });

// Mount the public shell first; only render page data after verifying /me.
const administrator = await requireAdmin();
if (administrator) {
$("#admin-account-name").textContent = administrator.full_name;

function cell(value, index, config) {
  const heading = config.columns[index];
  if (["Trạng thái", "Hình thức", "Vai trò", "Loại"].includes(heading)) return badge(value);
  if (["Họ và tên", "Người dùng", "Bác sĩ"].includes(heading) && ["patients", "users", "doctors"].includes(key)) return `<span class="name-cell"><span class="admin-avatar" aria-hidden="true">${esc(initials(value))}</span>${esc(value)}</span>`;
  if (heading === "Lượt đã đặt") { const [used, total] = value.split("/").map(Number); return `<strong>${esc(value)}</strong><div class="admin-bar" style="margin-top:4px"><meter min="0" max="${total}" value="${used}" aria-label="Đã đặt ${used} trên ${total} lượt">${esc(value)}</meter></div>`; }
  return esc(value);
}
function rowMarkup(row, rowIndex, config, actions = true) {
  return `<tr>${row.map((value, i) => `<td>${cell(value, i, config)}</td>`).join("")}${actions ? `<td><button type="button" class="row-action" data-row="${rowIndex}" data-action="detail">Chi tiết</button>${config.edit ? `<button type="button" class="row-action" data-row="${rowIndex}" data-action="edit">Sửa</button>` : ""}${config.revoke && row.at(-1) !== "Đã thu hồi" ? `<button type="button" class="row-action danger" data-row="${rowIndex}" data-action="revoke">Thu hồi</button>` : ""}${config.lock ? `<button type="button" class="row-action danger" data-row="${rowIndex}" data-action="lock">${row.at(-1) === "Đã khóa" ? "Mở khóa" : "Khóa"}</button>` : ""}</td>` : ""}</tr>`;
}
function tableMarkup(config, rows, actions = true) {
  return `<div class="admin-table-scroll" tabindex="0" role="region" aria-label="Bảng ${esc(config.title.toLowerCase())}"><table class="admin-table"><caption class="visually-hidden">${esc(config.title)} — dữ liệu minh họa</caption><thead><tr>${config.columns.map(title => `<th scope="col">${esc(title)}</th>`).join("")}${actions ? '<th scope="col">Thao tác</th>' : ""}</tr></thead><tbody>${rows.map(([row, i]) => rowMarkup(row, i, config, actions)).join("")}</tbody></table></div>`;
}
let currentPage = 1;
const pageSize = 6;
function renderList() {
  const needle = normalize($("#admin-search").value.trim());
  const status = $("#admin-filter")?.value || "";
  const rows = page.rows.map((row, i) => [row, i]).filter(([row]) => (!needle || normalize(row.join(" ")).includes(needle)) && (!status || row.at(-1) === status));
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);
  const offset = (currentPage - 1) * pageSize;
  $("#result-count").textContent = `${rows.length} kết quả`;
  $("#table-body").innerHTML = rows.length ? tableMarkup(page, rows.slice(offset, offset + pageSize)) : '<div class="admin-empty"><h2>Không có kết quả phù hợp</h2><p>Thử từ khóa khác hoặc xóa bộ lọc để xem lại danh sách.</p><button type="button" class="secondary" id="clear-filter">Xóa bộ lọc</button></div>';
  $("#pagination-info").textContent = rows.length ? `Hiển thị ${offset + 1}–${Math.min(offset + pageSize, rows.length)} / ${rows.length} bản ghi` : "0 bản ghi";
  $("#page-number").textContent = `${currentPage} / ${totalPages}`;
  $("#previous-page").disabled = currentPage === 1;
  $("#next-page").disabled = currentPage === totalPages;
  $("#clear-filter")?.addEventListener("click", () => { $("#admin-search").value = ""; if ($("#admin-filter")) $("#admin-filter").value = ""; currentPage = 1; renderList(); });
}
function listPage() {
  const statuses = page.columns.includes("Trạng thái") ? [...new Set(page.rows.map(row => row.at(-1)))] : [];
  $("#page-body").innerHTML = `<section class="admin-card" aria-label="Danh sách minh họa"><div class="admin-toolbar"><label>Tìm kiếm<input type="search" id="admin-search" placeholder="Tìm theo mã, tên hoặc thông tin…" autocomplete="off"></label>${statuses.length ? `<label>Trạng thái<select id="admin-filter"><option value="">Tất cả trạng thái</option>${statuses.map(s => `<option>${esc(s)}</option>`).join("")}</select></label>` : ""}<span id="result-count" role="status" aria-live="polite"></span></div><div id="table-body"></div><nav class="admin-pagination" aria-label="Phân trang danh sách"><span id="pagination-info"></span><button type="button" class="secondary" id="previous-page" aria-label="Trang trước">‹</button><span class="page-number" id="page-number" aria-live="polite"></span><button type="button" class="secondary" id="next-page" aria-label="Trang sau">›</button></nav></section>`;
  $("#admin-search").addEventListener("input", () => { currentPage = 1; renderList(); });
  $("#admin-filter")?.addEventListener("change", () => { currentPage = 1; renderList(); });
  $("#previous-page").addEventListener("click", () => { currentPage--; renderList(); });
  $("#next-page").addEventListener("click", () => { currentPage++; renderList(); });
  renderList();
}
const formFields = {
  patients: [["Họ và tên", "text"], ["Ngày sinh", "date"], ["Số điện thoại", "tel"], ["Giới tính", ["Nam", "Nữ", "Khác"]], ["Địa chỉ", "text"], ["Mã thẻ BHYT", "text"]],
  schedule: [["Bác sĩ", pages.doctors.rows.map(r => r[1])], ["Phòng", pages.rooms.rows.map(r => r[1])], ["Ngày", "date"], ["Ca khám", ["Ca sáng", "Ca chiều"]], ["Giờ bắt đầu", "time"], ["Giờ kết thúc", "time"], ["Thời lượng khung giờ", ["15 phút", "30 phút"]], ["Giới hạn tiếp nhận", "number"]],
  assignments: [["Y tá", ["Nguyễn Thị Mai", "Trần Thùy Dương", "Bùi Thu Hà"]], ["Mã ca", pages.schedule.rows.map(r => r[0])]],
  doctors: [["Tài khoản bác sĩ", ["Trần Thu Hà", "Nguyễn Đức Long", "Phạm Huyền Trang", "Lê Anh Tuấn", "Lương Hải Yến"]], ["Chuyên khoa", pages.departments.rows.map(r => r[1])], ["Học vị", "text"], ["Kinh nghiệm (năm)", "number"], ["Giá khám (VND)", "number"], ["Giới thiệu", "textarea"]],
  departments: [["Chuyên khoa", "text"], ["Mã viết tắt", "text"], ["Mô tả", "textarea"]],
  rooms: [["Phòng khám", "text"], ["Chuyên khoa", pages.departments.rows.map(r => r[1])], ["Vị trí", "text"]],
  users: [["Họ và tên", "text"], ["Email", "email"], ["Số điện thoại", "tel"], ["Vai trò nhân viên", ["Bác sĩ", "Lễ tân", "Y tá"]]],
  articles: [["Tiêu đề", "text"], ["Danh mục", ["Hướng dẫn", "Kiến thức sức khỏe", "Thông báo"]], ["Nội dung", "textarea"], ["Trạng thái", ["Bản nháp", "Đã xuất bản"]]],
};
function previewForm(row) {
  const fields = key === "users" && row ? formFields[key].filter(([name]) => name !== "Vai trò nhân viên") : formFields[key];
  const original = row ? Object.fromEntries(page.columns.map((name, i) => [name, row[i]])) : {};
  if (key === "users" && row) original["Họ và tên"] = row[1];
  if (key === "doctors" && row) original["Tài khoản bác sĩ"] = row[1].replace(/^BS\. /, "");
  if (key === "doctors" && row) { original["Kinh nghiệm (năm)"] = row[4]; original["Giá khám (VND)"] = row[5]; }
  if (key === "schedule" && row) {
    const [start, end] = row[4].split("–");
    original["Giờ bắt đầu"] = start; original["Giờ kết thúc"] = end;
    original["Ca khám"] = Number(start.slice(0, 2)) < 12 ? "Ca sáng" : "Ca chiều";
    original["Giới hạn tiếp nhận"] = row[5].split("/")[1];
    original["Thời lượng khung giờ"] = ["BS. Phạm Huyền Trang", "BS. Lê Anh Tuấn"].includes(row[1]) ? "15 phút" : "30 phút";
  }
  showDialog(row ? `Chỉnh sửa · ${row[0]}` : page.add, `<p class="dialog-intro">Biểu mẫu xem trước — các trường nhập chưa được gửi hoặc lưu.</p><form id="preview-form" class="admin-preview-form"><div class="form-grid">${fields.map(([name, type], i) => {
    let value = original[name] || "";
    if (type === "date" && value) value = value.split("/").reverse().join("-");
    if (type === "number" && value) value = value.replace(/\D/g, "");
    const id = `preview-field-${i}`;
    return `<label for="${id}" ${type === "textarea" ? 'class="full-width"' : ""}>${esc(name)}${Array.isArray(type) ? `<select id="${id}" name="${id}"><option value="">Chọn ${esc(name.toLowerCase())}</option>${type.map(v => `<option ${value === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>` : type === "textarea" ? `<textarea id="${id}" name="${id}" rows="5">${esc(value)}</textarea>` : `<input id="${id}" name="${id}" type="${type}" value="${esc(value)}" ${type === "number" ? 'min="0"' : ""}>`}</label>`;
  }).join("")}</div><p class="admin-note" style="margin-top:22px!important">Đây là giao diện mẫu. Thông tin vừa nhập chỉ nằm trong biểu mẫu và không thay đổi danh sách.</p><p id="preview-feedback" role="status" aria-live="polite"></p><div class="actions"><button type="submit">Xem nội dung đã nhập</button><button type="button" class="secondary" id="cancel-preview">Đóng</button></div></form>`);
  $("#cancel-preview").addEventListener("click", () => dialog.close());
  $("#preview-form").addEventListener("submit", event => {
    event.preventDefault();
    const entries = fields.map(([name], i) => [name, $(`#preview-field-${i}`).value || "Chưa nhập"]);
    $("#preview-feedback").innerHTML = `<strong>Nội dung xem trước — chưa lưu</strong><dl class="admin-dialog-facts">${entries.map(([name, value]) => `<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>`;
  });
}
$("#add-record")?.addEventListener("click", () => previewForm());
$("#page-body").addEventListener("click", event => {
  const target = event.target.closest("[data-row]");
  if (!target) return;
  const row = page.rows[Number(target.dataset.row)];
  if (target.dataset.action === "edit") { previewForm(row); return; }
  const title = target.dataset.action === "detail" ? `Chi tiết · ${row[0]}` : `Xem trước thao tác ${target.textContent.toLowerCase()}`;
  showDialog(title, `<p class="dialog-intro">Thông tin minh họa cho bố cục quản trị.</p><dl class="admin-dialog-facts">${page.columns.map((column, i) => `<div><dt>${esc(column)}</dt><dd>${esc(row[i])}</dd></div>`).join("")}</dl><p class="admin-note">${target.dataset.action === "detail" ? "Dữ liệu minh họa, chưa kết nối API." : "Thao tác chưa được thực hiện. Bản giao diện này không thay đổi trạng thái hoặc lưu dữ liệu."}</p>`);
});
function metrics() {
  return `<div class="admin-summary">${[["Tổng lượt khám", pages.encounters.rows.length, "record", "Trong bộ dữ liệu minh họa"], ["Đã hoàn thành", pages.encounters.rows.filter(r => r.at(-1) === "Hoàn thành").length, "calendar", "Lượt khám mẫu đã hoàn tất"], ["Không đến", pages.encounters.rows.filter(r => r.at(-1) === "Không đến").length, "history", "Lượt khám mẫu không đến"], ["Thu ròng minh họa", money(net), "card", "Khoản thu thành công trừ hoàn tiền"]].map(([label, value, symbol, hint]) => `<article class="admin-metric"><div><span>${label}</span>${icon(symbol)}</div><strong>${value}</strong><small>${hint}</small></article>`).join("")}</div>`;
}
function group(rows, column) { return [...rows.reduce((map, row) => map.set(row[column], (map.get(row[column]) || 0) + 1), new Map())]; }
function chart(title, description, entries) {
  const max = Math.max(1, ...entries.map(([, count]) => count));
  return `<section class="admin-card admin-chart"><h2>${title}</h2><p>${description}</p>${entries.map(([label, count]) => `<div class="admin-bar"><div><span>${esc(label)}</span><strong>${count}</strong></div><meter min="0" max="${max}" value="${count}" aria-label="${esc(label)}: ${count}">${count}</meter></div>`).join("")}</section>`;
}
function statisticsPage() {
  $("#page-header").insertAdjacentHTML("beforeend", '<button type="button" id="export-preview">↓ Xuất CSV minh họa</button>');
  $("#page-body").innerHTML = metrics() + `<div class="admin-grid">${chart("Theo trạng thái", "Phân bố trạng thái trong danh sách lượt khám mẫu", group(pages.encounters.rows, 7))}${chart("Theo hình thức tiếp nhận", "Lượt trực tuyến và trực tiếp trong dữ liệu mẫu", group(pages.encounters.rows, 3))}${chart("Theo bác sĩ", "Số lượt khám minh họa của từng bác sĩ", group(pages.encounters.rows, 2))}${chart("Giao dịch theo loại", "Số bản ghi trong bảng thanh toán mẫu", group(pages.payments.rows, 3))}</div>`;
  $("#export-preview").addEventListener("click", () => {
    const csv = "\uFEFF" + [["DỮ LIỆU MINH HỌA - CHƯA KẾT NỐI API"], pages.encounters.columns, ...pages.encounters.rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "neu-luot-kham-minh-hoa.csv"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
function homePage() {
  const shortcuts = [["users", "Tài khoản nhân viên", "Quản lý thông tin và trạng thái tài khoản", "people"], ["schedule", "Lịch làm việc", "Theo dõi ca khám và phòng được bố trí", "calendar"], ["articles", "Nội dung website", "Quản lý tin tức, hướng dẫn và thông báo", "record"]];
  $("#page-body").innerHTML = metrics() + `<section class="panel"><div class="section-heading"><h2>Truy cập nhanh</h2><span class="muted">Không gian làm việc của quản trị viên</span></div><div class="admin-shortcuts">${shortcuts.map(([id, title, hint, symbol]) => `<a href="${id}.html">${icon(symbol)}<strong>${title} ↗</strong><small>${hint}</small></a>`).join("")}</div></section><div class="admin-grid">${chart("Tình trạng lượt khám", "Dữ liệu tổng hợp minh họa", group(pages.encounters.rows, 7))}<section class="admin-card admin-chart"><h2>Danh mục quản lý</h2><p>Các danh sách đang được trình bày trong bản mẫu</p>${[["Bác sĩ", pages.doctors.rows.length, "doctors"], ["Chuyên khoa", pages.departments.rows.length, "departments"], ["Phòng khám", pages.rooms.rows.length, "rooms"], ["Hồ sơ bệnh nhân", pages.patients.rows.length, "patients"]].map(([label, count, id]) => `<div class="admin-setting"><a href="${id}.html">${label} ↗</a><strong>${count} bản ghi mẫu</strong></div>`).join("")}</section></div><section class="admin-card"><div class="admin-panel-heading"><h2>Lượt khám gần đây</h2><a href="encounters.html">Xem tất cả →</a></div>${tableMarkup(pages.encounters, pages.encounters.rows.slice(0, 4).map((row, i) => [row, i]), false)}</section>`;
}
function configurationPage() {
  $("#page-body").innerHTML = `<form id="configuration-form"><div class="admin-grid"><section class="admin-card admin-chart"><h2>Thông tin cơ sở</h2><p>Thông tin hiển thị trên website</p><div class="admin-contact-fields"><label>Tên cơ sở<input name="hospital" value="NEU Medical"></label><label>Điện thoại hỗ trợ<input name="phone" type="tel" placeholder="Đang cập nhật"></label><label>Email hỗ trợ<input name="email" type="email" placeholder="Đang cập nhật"></label><label>Giờ khám<textarea name="hours" rows="3" placeholder="Đang cập nhật"></textarea></label></div></section><section class="admin-card admin-chart"><h2>Thông báo & tiếp nhận</h2><p>Cách trình bày các tùy chọn</p><div class="admin-setting"><label for="reminder">Nhắc lịch trước<small>Khoảng thời gian trước giờ hẹn (giờ)</small></label><input id="reminder" name="reminder" type="number" min="1" max="168" value="24"></div><div class="admin-setting"><label for="walk-in">Tiếp nhận trực tiếp<small>Trạng thái xem trước trên giao diện</small></label><select id="walk-in" name="walk-in"><option>Bật</option><option>Tắt</option></select></div></section><section class="admin-card admin-chart"><h2>Quy tắc đặt khám đã chốt</h2><p>Thông tin tham chiếu từ tài liệu nghiệp vụ</p>${[["Giữ khung giờ", "10 phút"], ["Đặt cọc", "100% giá khám"], ["Hạn đặt trực tuyến", "Trước ca ít nhất 5 giờ"], ["Khung giờ trong ca", "15 hoặc 30 phút"]].map(([label, value]) => `<div class="admin-setting"><span>${label}</span><strong>${value}</strong></div>`).join("")}</section><section class="admin-card admin-chart"><h2>Phạm vi bản giao diện</h2><p>Thông tin dành cho người xem bản mẫu</p><p>Biểu mẫu dùng để đánh giá bố cục và cách nhập thông tin. Không gửi thông tin, tạo thông báo hay thay đổi hoạt động tiếp nhận.</p><p>Quy tắc nghiệp vụ được trình bày để tham khảo, chưa được thực thi ở màn hình này.</p></section></div><div class="actions"><button type="submit">Xem trước cấu hình</button><button type="reset" class="secondary">Đặt lại biểu mẫu</button></div></form>`;
  $("#configuration-form").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.target);
    showDialog("Xem trước cấu hình", `<dl class="admin-dialog-facts">${[["Tên cơ sở", data.get("hospital")], ["Điện thoại", data.get("phone")], ["Email", data.get("email")], ["Giờ khám", data.get("hours")], ["Nhắc lịch trước (giờ)", data.get("reminder")], ["Tiếp nhận trực tiếp", data.get("walk-in")]].map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value || "Đang cập nhật")}</dd></div>`).join("")}</dl><p class="admin-note">Chưa lưu cấu hình. Nội dung này chỉ là bản xem trước.</p>`);
  });
}
if (page.rows) listPage();
else if (key === "home") homePage();
else if (key === "statistics") statisticsPage();
else if (key === "configuration") configurationPage();

}
