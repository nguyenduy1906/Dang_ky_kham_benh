import { sessionError } from "./staff_workspace.js";

export const $ = selector => document.querySelector(selector);
export const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const date = value => value ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value)) : "—";
export const time = value => value ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : "—";
export const money = value => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(value || 0));
export const labels = { HOLDING: "Chờ thanh toán", CONFIRMED: "Đã xác nhận", CHECKED_IN: "Đã check-in", IN_PROGRESS: "Đang khám", COMPLETED: "Hoàn tất", CANCELLED: "Đã hủy", NO_SHOW: "Vắng mặt", EXPIRED: "Hết hạn", OPEN: "Đang mở", FULL: "Đã đầy", CLOSED: "Đã đóng", UNAVAILABLE: "Bác sĩ báo nghỉ", ACTIVE: "Hoạt động", LOCKED: "Đã khóa", APPROVED: "Đã duyệt", PENDING: "Chờ duyệt", REJECTED: "Từ chối" };
export const badge = status => `<span class="status ${["COMPLETED", "OPEN", "APPROVED", "ACTIVE"].includes(status) ? "done" : ["IN_PROGRESS", "CHECKED_IN"].includes(status) ? "examining" : "waiting"}">${esc(labels[status] || status || "—")}</span>`;
export const empty = (text = "Chưa có dữ liệu phù hợp.") => `<div class="empty-state"><span class="empty-symbol" aria-hidden="true">—</span><h3>${esc(text)}</h3><p>Thử thay đổi bộ lọc hoặc tải lại dữ liệu.</p></div>`;
export const facts = entries => `<dl class="doctor-facts">${entries.map(([key, value]) => `<div><dt>${esc(key)}</dt><dd>${esc(value || "—")}</dd></div>`).join("")}</dl>`;
export const stats = entries => `<div class="summary-grid">${entries.map(([label, value, note]) => `<article class="summary-card"><span>${esc(label)}</span><strong>${esc(value)}</strong><p>${esc(note || "")}</p></article>`).join("")}</div>`;
export const panel = (title, body, extra = "") => `<section class="panel"><div class="section-heading"><h2>${esc(title)}</h2>${extra}</div>${body}</section>`;
export function status(text = "", error = false) {
  const node = $("#page-status"); if (!node) return;
  node.textContent = text; node.dataset.error = String(error); node.hidden = !text;
}
export function showError(error) { status(sessionError(error), true); }
export async function run(action) {
  status("Đang tải dữ liệu…");
  try { await action(); if ($("#page-status")?.dataset.error !== "true") status(); } catch (error) { showError(error); }
}
export function dialog(title, html) {
  const modal = $("#staff-dialog");
  $("#staff-dialog-title").textContent = title; $("#staff-dialog-content").innerHTML = html;
  if (!modal.open) modal.showModal();
}
export function bindDialog() { $("#staff-dialog-close")?.addEventListener("click", () => $("#staff-dialog").close()); }
export async function submit(form, action, message = "Đã lưu thay đổi.") {
  if (form.dataset.busy === "true") return;
  form.dataset.busy = "true";
  const controls = [...form.querySelectorAll("button, input, select, textarea")];
  const states = controls.map(el => el.disabled); controls.forEach(el => el.disabled = true);
  const feedback = form.querySelector("[role=status]") || $("#page-status");
  feedback.hidden = false; feedback.textContent = "Đang xử lý…"; feedback.dataset.error = "false";
  try { await action(); feedback.textContent = message; }
  catch (error) { feedback.textContent = sessionError(error); feedback.dataset.error = "true"; }
  finally { controls.forEach((el, i) => el.disabled = states[i]); form.dataset.busy = "false"; }
}
export function pagination(result, onPage, node = $("#list-pagination")) {
  if (!node) return;
  const pages = Math.max(1, Math.ceil(result.total / result.page_size));
  node.innerHTML = `<span>${result.total} kết quả · Trang ${result.page}/${pages}</span><div class="actions"><button class="secondary" type="button" ${result.page <= 1 ? "disabled" : ""} data-step="-1">Trang trước</button><button class="secondary" type="button" ${result.page >= pages ? "disabled" : ""} data-step="1">Trang sau</button></div>`;
  node.querySelectorAll("button").forEach(button => button.addEventListener("click", () => onPage(result.page + Number(button.dataset.step))));
}
export const encounterSummary = e => facts([["Bệnh nhân", e.patient_name], ["Mã lượt khám", e.encounter_id], ["Mã phiếu", e.ticket_code], ["Bác sĩ", e.doctor_name], ["Phòng", e.room_name], ["Ngày khám", date(e.work_date)], ["Khung giờ", `${time(e.estimated_exam_at)} – ${time(e.appointment_end_at)}`], ["Hình thức", e.encounter_type === "ONLINE" ? "Đặt trực tuyến" : "Khám trực tiếp"], ["Trạng thái", labels[e.encounter_status]], ["Triệu chứng", e.symptoms], ["Phí khám", money(e.consultation_fee_snapshot)]]);
export function table(headers, rows) { return rows.length ? `<div class="table-wrap"><table><thead><tr>${headers.map(text => `<th scope="col">${esc(text)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>` : empty(); }
export const encounterColumns = e => `<td><strong>${esc(e.patient_name)}</strong><small class="cell-subtitle">#${e.encounter_id} · ${esc(e.ticket_code || "Chưa phát phiếu")}</small></td><td>${date(e.work_date)}<small class="cell-subtitle">${time(e.estimated_exam_at)} – ${time(e.appointment_end_at)}</small></td><td>${esc(e.room_name)}<small class="cell-subtitle">${esc(e.doctor_name)}</small></td><td>${badge(e.encounter_status)}</td>`;
export const statusOptions = (all = true) => `${all ? '<option value="">Tất cả trạng thái</option>' : ""}${Object.entries(labels).filter(([key]) => ["HOLDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW", "EXPIRED"].includes(key)).map(([key, value]) => `<option value="${key}">${value}</option>`).join("")}`;
