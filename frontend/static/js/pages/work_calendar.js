import { startAutoRefresh } from "../core/auto_refresh.js";
import { code } from "../core/business_codes.js";
import { staffReady, sessionError } from "../core/staff_workspace.js";
import { hasSession } from "../core/session.js";
import * as api from "../api/staff_leave.js";
import { enhanceDialogDismiss } from "../core/dialog_dismiss.js";

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const parseDate = iso => new Date(`${iso}T00:00:00Z`);
const addDays = (iso, count) => { const d = parseDate(iso); d.setUTCDate(d.getUTCDate() + count); return d.toISOString().slice(0, 10); };
const mondayOf = iso => addDays(iso, -((parseDate(iso).getUTCDay() + 6) % 7));
const formatDate = iso => iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";
const shortDate = iso => formatDate(iso).slice(0, 5);
const shortTime = value => String(value || "").slice(0, 5);
const weekdays = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"];
const periods = { MORNING: "Ca sáng", AFTERNOON: "Ca chiều", FULL_DAY: "Cả ngày" };
const periodValues = { full: "FULL_DAY", morning: "MORNING", afternoon: "AFTERNOON" };
const statuses = { PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", REJECTED: "Từ chối", CANCELLED: "Đã rút" };
const clinicalStatuses = { OPEN: "Đang mở", FULL: "Đã đủ chỗ", CLOSED: "Đã đóng", UNAVAILABLE: "Bác sĩ nghỉ" };

const user = await staffReady;
if (user) await initialize();

async function initialize() {
  const currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  let weekStart = mondayOf(currentDate), calendar = [], shifts = [], requestPage = 1;
  let active = true, weekVersion = 0, listVersion = 0, detailVersion = 0, selectedShift, selectedRequest;
  let weekRequest, listRequest, detailRequest, createRequest, cancelRequest, cancelling = false;
  const dialog = $("#calendar-dialog"), form = $("#leave-form"), feedback = $("#leave-feedback");
  const submitButton = $("#leave-submit"), cancelButton = $("#dialog-cancel-request");
  if (user.role_name === "NURSE") enhanceDialogDismiss(dialog, { closeButtons: [$("#calendar-dialog-close")] });

  function message(node, text = "", error = false) {
    if (!active) return;
    node.textContent = text; node.dataset.error = String(error);
  }
  function reportError(node, error) {
    if (!active || error.code === "CLIENT_ABORTED") return;
    message(node, sessionError(error), true);
  }
  function suspend() {
    if (!active) return;
    active = false; weekVersion++; listVersion++; detailVersion++;
    for (const request of [weekRequest, listRequest, detailRequest, createRequest, cancelRequest]) request?.abort();
    $("#main-content").inert = true; document.body.classList.add("staff-auth-pending");
    $("#calendar-grid").innerHTML = ""; $("#leave-requests").innerHTML = "";
    $("#calendar-dialog-body").innerHTML = "";
    form.elements.reason.value = ""; form.elements.handover.value = "";
    dialog.close(); calendar = []; shifts = []; selectedRequest = null;
  }
  window.addEventListener("pagehide", suspend);
  window.addEventListener("neu:auth-change", () => { if (!hasSession()) suspend(); });

  function updateWeekHeading() {
    $("#week-title").textContent = `${shortDate(weekStart)} – ${formatDate(addDays(weekStart, 6))}`;
    $("#week-picker").value = weekStart;
  }
  function renderWeek() {
    if (!active) return;
    updateWeekHeading();
    const filter = $("#shift-filter").value;
    shifts = calendar.flatMap(day => (day.shifts || []).map(shift => ({ ...shift, date: day.work_date,
      id: `${day.work_date}-${shift.period}`, clinical: (day.clinical_schedules || []).filter(s =>
        shift.period === "MORNING" ? shortTime(s.start_time) < "12:00" : shortTime(s.end_time) > "12:00") })));
    const visible = shifts.filter(s => filter === "all" || periodValues[filter] === s.period);
    $("#calendar-grid").innerHTML = weekdays.map((day, index) => {
      const date = addDays(weekStart, index);
      return `<section class="calendar-day${date === currentDate ? " is-today" : ""}${index > 4 ? " is-weekend" : ""}" aria-label="${day}, ${formatDate(date)}">
        <header class="calendar-day-heading"><span>${day}</span><time datetime="${date}"${date === currentDate ? ' aria-current="date"' : ""}>${shortDate(date)}</time></header>
        ${["MORNING", "AFTERNOON"].map(period => {
          const shift = visible.find(s => s.date === date && s.period === period);
          const state = shift?.status === "ON_LEAVE" ? "Đã duyệt nghỉ" : shift?.pending_leave ? "Chờ duyệt nghỉ · Vẫn làm việc" : "Làm việc";
          const rooms = shift ? [...new Set(shift.clinical.map(s => s.room_name || `Phòng ${code("PH", s.room_id)}`))].join(", ") : "";
          return `<div class="calendar-slot"><span class="calendar-slot-label">${periods[period]}</span>${shift
            ? `<button type="button" class="calendar-shift${period === "AFTERNOON" ? " is-afternoon" : ""}${shift.status === "ON_LEAVE" ? " is-leave" : shift.pending_leave ? " is-pending" : ""}" data-shift="${escape(shift.id)}"><strong>${escape(shortTime(shift.start_time))} – ${escape(shortTime(shift.end_time))}</strong><span>${state}</span><span class="calendar-shift-place">${escape(rooms || (shift.status === "ON_LEAVE" ? "Nghỉ theo đơn đã duyệt" : user.role_name === "RECEPTIONIST" ? "Theo lịch làm việc" : "Chưa có phân công phòng"))}</span></button>`
            : `<p class="calendar-free">${filter !== "all" && periodValues[filter] !== period ? "Đã ẩn theo bộ lọc" : "Không có ca"}</p>`}</div>`;
        }).join("")}</section>`;
    }).join("");
    const working = visible.filter(s => s.status !== "ON_LEAVE").length;
    message($("#calendar-announcement"), `Từ ${formatDate(weekStart)} đến ${formatDate(addDays(weekStart, 6))}: ${working} ca làm việc, ${visible.length - working} ca đã duyệt nghỉ.`);
  }
  async function loadWeek() {
    const version = ++weekVersion;
    weekRequest?.abort(); weekRequest = new AbortController();
    calendar = []; shifts = []; updateWeekHeading(); $("#calendar-grid").innerHTML = "";
    $("#calendar-grid").setAttribute("aria-busy", "true"); message($("#calendar-status"), "Đang tải lịch làm việc…");
    try {
      const result = await api.getWorkSchedules({ from_date: weekStart, to_date: addDays(weekStart, 6) }, { signal: weekRequest.signal });
      if (!active || version !== weekVersion) return;
      if (result?.user_id !== user.user_id || !Array.isArray(result.items)) throw new Error("Không nhận được lịch hợp lệ của tài khoản hiện tại.");
      calendar = result.items; renderWeek(); message($("#calendar-status"));
    } catch (error) { if (version === weekVersion) reportError($("#calendar-status"), error); }
    finally { if (active && version === weekVersion) $("#calendar-grid").setAttribute("aria-busy", "false"); }
  }

  function showDialog(title, entries, note, allowLeave = false) {
    $("#calendar-dialog-title").textContent = title;
    $("#calendar-dialog-body").innerHTML = `<dl class="calendar-dialog-facts">${entries.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value ?? "—")}</dd></div>`).join("")}</dl><p class="calendar-dialog-note">${escape(note)}</p>`;
    $("#dialog-use-date").hidden = !allowLeave; cancelButton.hidden = true; message($("#dialog-feedback"));
    if (!dialog.open) dialog.showModal();
  }
  function canRequestShiftLeave(shift) {
    if (!shift || shift.status === "ON_LEAVE" || shift.pending_leave) return false;
    const start = Date.parse(`${shift.date}T${shortTime(shift.start_time)}:00+07:00`);
    return Number.isFinite(start) && Date.now() < start;
  }
  $("#calendar-grid").addEventListener("click", event => {
    const button = event.target.closest("[data-shift]");
    if (!button || !active) return;
    detailVersion++; detailRequest?.abort(); selectedRequest = null;
    selectedShift = shifts.find(s => s.id === button.dataset.shift);
    if (!selectedShift) return;
    const s = selectedShift;
    const assigned = s.clinical.map(c => `${c.room_name || `Phòng ${code("PH", c.room_id)}`} · ${shortTime(c.start_time)}–${shortTime(c.end_time)} · ${clinicalStatuses[c.schedule_status] || c.schedule_status}`).join("\n");
    showDialog("Chi tiết ca làm việc", [["Ngày làm việc", formatDate(s.date)], ["Ca", periods[s.period]],
      ["Thời gian", `${shortTime(s.start_time)} – ${shortTime(s.end_time)}`],
      ["Trạng thái", s.status === "ON_LEAVE" ? "Đã duyệt nghỉ" : s.pending_leave ? "Chờ duyệt nghỉ; lịch làm việc giữ nguyên" : "Làm việc"],
      ["Phân công phòng khám", assigned || "Chưa có phân công phòng khám"],
      ["Mã đơn nghỉ liên quan", (s.leave_request_ids || []).map(id=>code("NP", id)).join(", ") || "Không có"]],
      user.role_name === "NURSE" ? "Lịch làm việc được cập nhật theo phân công của quản trị viên." : "Lịch đi làm mặc định từ thứ Hai đến thứ Sáu. Phân công phòng khám được quản lý riêng.",
      canRequestShiftLeave(s));
  });
  $("#dialog-use-date").addEventListener("click", () => {
    if (!active || !canRequestShiftLeave(selectedShift)) { $("#dialog-use-date").hidden = true; return; }
    form.elements.start_date.value = selectedShift.date; form.elements.end_date.value = selectedShift.date;
    form.elements.period.value = selectedShift.period === "MORNING" ? "morning" : "afternoon";
    updateDateRange(); dialog.close();
    $("#leave-section").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    form.elements.reason.focus({ preventScroll: true });
  });
  $("#calendar-dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { detailVersion++; detailRequest?.abort(); selectedRequest = null; });

  async function loadRequests(page = 1) {
    const version = ++listVersion;
    listRequest?.abort(); listRequest = new AbortController(); requestPage = page;
    $("#leave-requests").innerHTML = ""; $("#requests-page").textContent = "";
    $("#requests-previous").disabled = true; $("#requests-next").disabled = true;
    message($("#leave-list-status"), "Đang tải đơn xin nghỉ…");
    try {
      const result = await api.listLeaveRequests({ page, page_size: 10, status: $("#leave-status-filter").value }, { signal: listRequest.signal });
      if (!active || version !== listVersion) return;
      if (!Array.isArray(result?.items) || result.items.some(r => r.user_id !== user.user_id)) throw new Error("Danh sách đơn nghỉ không hợp lệ.");
      $("#leave-requests").innerHTML = result.items.length ? `<div class="table-wrapper"><table><thead><tr><th>Ngày nghỉ</th><th>Buổi</th><th>Lý do</th><th>Trạng thái</th><th>${user.role_name === "NURSE" ? '<span class="leave-detail-title">Chi tiết</span>' : "Thao tác"}</th></tr></thead><tbody>${result.items.map(r => `<tr><td>${formatDate(r.from_date)} – ${formatDate(r.to_date)}</td><td>${escape(periods[r.period] || r.period)}</td><td class="leave-reason">${escape(r.reason)}</td><td><span class="leave-state state-${escape(r.status)}">${escape(statuses[r.status] || r.status)}</span></td><td><div class="leave-row-actions"><button type="button" class="secondary" data-request="${escape(r.request_id)}">Chi tiết</button>${r.status === "PENDING" ? `<button type="button" class="secondary" data-request="${escape(r.request_id)}" data-action="cancel">Rút đơn</button>` : ""}</div></td></tr>`).join("")}</tbody></table></div>` : '<p class="calendar-empty">Chưa có đơn xin nghỉ phù hợp.</p>';
      const pages = Math.max(1, Math.ceil(result.total / result.page_size));
      $("#requests-page").textContent = `${user.role_name === "NURSE" ? "" : `${result.total} đơn · `}Trang ${result.page}/${pages}`;
      $("#requests-previous").disabled = result.page <= 1; $("#requests-next").disabled = result.page >= pages;
      message($("#leave-list-status"));
    } catch (error) { if (version === listVersion) reportError($("#leave-list-status"), error); }
  }
  async function openRequest(requestId, withdrawing = false) {
    const version = ++detailVersion;
    detailRequest?.abort(); detailRequest = new AbortController(); selectedRequest = null;
    showDialog("Chi tiết đơn xin nghỉ", [], "Đang tải nội dung đơn…");
    try {
      const result = await api.getLeaveRequest(requestId, { signal: detailRequest.signal });
      if (!active || version !== detailVersion) return;
      const r = result.leave_request;
      if (!r || r.user_id !== user.user_id) throw new Error("Không nhận được đơn nghỉ hợp lệ của tài khoản hiện tại.");
      selectedRequest = r;
      showDialog(withdrawing && r.status === "PENDING" ? "Xác nhận rút đơn xin nghỉ" : "Chi tiết đơn xin nghỉ", [
        ["Mã đơn", code("NP", r.request_id)], ["Từ ngày", formatDate(r.from_date)], ["Đến ngày", formatDate(r.to_date)],
        ["Buổi nghỉ", periods[r.period]], ["Lý do và bàn giao", r.reason], ["Trạng thái", statuses[r.status]],
        ["Ngày gửi", formatDate(r.created_at)], ["Ý kiến admin", r.review_note || "Chưa có"],
        ["Ngày xử lý", formatDate(r.reviewed_at || r.cancelled_at)], ["Lượt khám bị ảnh hưởng", result.affected_encounters ?? 0]],
        r.status === "PENDING" ? "Đơn đang chờ admin duyệt, lịch làm việc vẫn giữ nguyên. Bạn có thể rút đơn nếu không còn nhu cầu nghỉ." : "Kết quả xử lý được lưu trên hệ thống.");
      cancelButton.hidden = r.status !== "PENDING";
    } catch (error) { if (version === detailVersion) reportError($("#dialog-feedback"), error); }
  }
  $("#leave-requests").addEventListener("click", event => {
    const button = event.target.closest("[data-request]");
    if (button && active && !cancelling) openRequest(button.dataset.request, button.dataset.action === "cancel");
  });
  cancelButton.addEventListener("click", async () => {
    if (!active || cancelling || !selectedRequest || selectedRequest.status !== "PENDING") return;
    const id = selectedRequest.request_id;
    cancelling = true; cancelButton.disabled = true; cancelRequest = new AbortController();
    try {
      const result = await api.cancelLeaveRequest(id, { signal: cancelRequest.signal });
      if (!active) return;
      if (result?.leave_request?.status !== "CANCELLED" || result.leave_request.request_id !== id || result.leave_request.user_id !== user.user_id) throw new Error("Chưa xác nhận được kết quả rút đơn.");
      dialog.close(); await Promise.all([loadWeek(), loadRequests(requestPage)]);
      message($("#leave-list-status"), `Đã rút đơn ${code("NP", id)}.`);
    } catch (error) { reportError($("#dialog-feedback"), error); }
    finally { cancelling = false; cancelButton.disabled = false; }
  });
  $("#leave-status-filter").addEventListener("change", () => loadRequests());
  $("#requests-previous").addEventListener("click", () => { if (requestPage > 1) loadRequests(requestPage - 1); });
  $("#requests-next").addEventListener("click", () => loadRequests(requestPage + 1));

  function clearValidation() {
    for (const key of ["start_date", "end_date", "reason", "handover"]) form.elements[key].setCustomValidity("");
    message(feedback);
  }
  function updateDateRange() {
    form.elements.end_date.min = form.elements.start_date.value || currentDate; clearValidation();
  }
  function resetFields({ clearDates = false } = {}) {
    form.elements.start_date.value = clearDates ? "" : currentDate; form.elements.end_date.value = clearDates ? "" : currentDate;
    form.elements.period.value = "full"; form.elements.reason.value = ""; form.elements.handover.value = ""; updateDateRange();
  }
  for (const key of ["start_date", "end_date"]) form.elements[key].min = currentDate;
  resetFields();
  form.addEventListener("input", clearValidation);
  form.elements.start_date.addEventListener("change", updateDateRange);
  form.addEventListener("reset", event => { event.preventDefault(); if (form.dataset.busy !== "true") resetFields({ clearDates: true }); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!active || form.dataset.busy === "true" || cancelling) return;
    clearValidation();
    const from = form.elements.start_date.value, to = form.elements.end_date.value;
    const handover = form.elements.handover.value.trim();
    const reason = form.elements.reason.value.trim() + (handover ? `\n\nGhi chú bàn giao: ${handover}` : "");
    if (from < currentDate) form.elements.start_date.setCustomValidity("Không thể xin nghỉ cho ngày đã qua.");
    if (to < from || (parseDate(to) - parseDate(from)) / 86400000 > 30) form.elements.end_date.setCustomValidity("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu; tối đa 31 ngày.");
    if (!form.elements.reason.value.trim()) form.elements.reason.setCustomValidity("Vui lòng nhập lý do xin nghỉ.");
    if (reason.length > 1000) form.elements.handover.setCustomValidity("Tổng lý do và ghi chú bàn giao tối đa 1.000 ký tự.");
    if (!form.reportValidity()) { message(feedback, "Vui lòng kiểm tra ngày nghỉ và nội dung đã nhập.", true); return; }
    form.dataset.busy = "true"; form.setAttribute("aria-busy", "true");
    const controls = [...form.querySelectorAll("input, select, textarea, button")];
    const states = controls.map(el => el.disabled); controls.forEach(el => el.disabled = true);
    submitButton.textContent = "Đang gửi…"; message(feedback, "Đang gửi đơn xin nghỉ…"); createRequest = new AbortController();
    try {
      const result = await api.createLeaveRequest({ from_date: from, to_date: to, period: periodValues[form.elements.period.value], reason }, { signal: createRequest.signal });
      if (!active) return;
      const r = result.leave_request;
      if (!r?.request_id || r.user_id !== user.user_id || r.status !== "PENDING") throw new Error("Chưa nhận được xác nhận đơn nghỉ từ hệ thống.");
      resetFields(); await Promise.all([loadWeek(), loadRequests()]);
      message(feedback, `Đã gửi đơn ${code("NP", r.request_id)}, đang chờ admin duyệt. Lịch làm việc chưa thay đổi.`);
    } catch (error) { reportError(feedback, error); }
    finally {
      controls.forEach((el, i) => el.disabled = states[i]); form.dataset.busy = "false";
      form.setAttribute("aria-busy", "false"); submitButton.textContent = "Gửi đơn xin nghỉ";
    }
  });
  $("#week-previous").addEventListener("click", () => { weekStart = addDays(weekStart, -7); loadWeek(); });
  $("#week-next").addEventListener("click", () => { weekStart = addDays(weekStart, 7); loadWeek(); });
  $("#week-current").addEventListener("click", () => { weekStart = mondayOf(currentDate); loadWeek(); });
  $("#week-picker").addEventListener("change", event => {
    if (!event.target.value) { event.target.value = weekStart; return; }
    weekStart = mondayOf(event.target.value); loadWeek();
  });
  $("#shift-filter").addEventListener("change", renderWeek);
  submitButton.disabled = false;
  await Promise.all([loadWeek(), loadRequests()]);
  startAutoRefresh(() => Promise.all([loadWeek(), loadRequests(requestPage)]), { canRefresh: () => active });
}
