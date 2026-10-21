import { checkInInstruction } from "../core/encounter_policy.js";
import { getMe } from "../api/auth.js";
import { getEncounter, getTicket, cancel } from "../api/encounter.js";
import { startAutoRefresh } from "../core/auto_refresh.js";
import { createIntent, listEncounterPayments, setDemoResult } from "../api/payment.js";
import { verifySession, hasSession, clearSession, loginUrl } from "../core/session.js";
import { readDraft } from "../core/booking_draft.js";
import { allPages, money, dateLabel, clock } from "../core/booking.js";
import { renderDemoQr } from "../core/payment_qr.js";

const $ = selector => document.querySelector(selector);
const ui = {
  page: $("#payment-page"), auth: $("#payment-auth-status"), layout: $("#payment-layout"),
  payment: $("#booking-payment"), method: $("#booking-payment-method"), qr: $("#booking-qr"),
  create: $("#booking-payment-create"), result: $("#booking-payment-result"), status: $("#booking-payment-status"),
  success: $("#booking-success"), refresh: $("#payment-refresh"), cancel: $("#payment-cancel"), back: $("#payment-back"),
};
const query = new URLSearchParams(location.search);
const draftKey = query.get("draft");
let draft, actor, encounter, payment, ticket, timer;
let active = true, busy = false, checking = false, version = 0;
const current = run => active && version === run && hasSession();
function errorText(error) {
  if (error.status === 401) { clearSession(); location.replace(loginUrl(new URL(location.href)).href); }
  return error.message || "Không thể kết nối hệ thống. Vui lòng thử lại.";
}
function setBusy(value) {
  busy = value;
  ui.page.setAttribute("aria-busy", String(value));
  ui.page.querySelectorAll("button,select").forEach(node => { node.disabled = value; });
  if (!value && payment?.transaction_status === "PENDING") ui.method.disabled = true;
}
function renderSummary(row) {
  const target = $("#payment-summary"); target.replaceChildren();
  const pairs = [
    ["Người khám", row.patient_name || draft?.registration_details?.full_name || actor.full_name],
    ["Bác sĩ", row.doctor_name], ["Chuyên khoa", row.department_name],
    ["Ngày khám", dateLabel(row.work_date)],
    ["Khung giờ", `${clock(row.estimated_exam_at)}–${clock(row.appointment_end_at)}`],
    ["Phòng khám", row.room_name],
  ];
  if (ticket?.ticket_code || row.ticket_code) pairs.push(["Mã phiếu", ticket?.ticket_code || row.ticket_code]);
  for (const [label, value] of pairs) {
    const term = document.createElement("dt"); term.textContent = label;
    const description = document.createElement("dd"); description.textContent = value || "Chưa cung cấp";
    target.append(term, description);
  }
  $("#payment-total").textContent = money(row.deposit_amount_snapshot ?? row.consultation_fee_snapshot);
}
function showSuccess() {
  ui.layout.hidden = true; ui.success.hidden = false;
  $("#booking-success-title").textContent = "Đăng ký khám thành công";
  $("#booking-success-description").textContent = "Thanh toán đã được hệ thống xác nhận và lịch khám đã được đăng ký. Bạn có thể xem mã phiếu trong lịch đã đăng ký.";
}
function showBooking() {
  clearInterval(timer); timer = undefined;
  const status = encounter.encounter_status;
  const confirmed = ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(status);
  ui.layout.hidden = confirmed; ui.success.hidden = !confirmed;
  ui.payment.hidden = status !== "HOLDING";
  ui.refresh.hidden = false; ui.cancel.hidden = status !== "HOLDING";
  renderSummary(encounter);
  renderDemoQr(ui.qr, status === "HOLDING" ? payment : null);
  ui.result.hidden = status !== "HOLDING" || payment?.transaction_status !== "PENDING";
  ui.create.hidden = status !== "HOLDING" || payment?.transaction_status === "PENDING";
  ui.method.disabled = payment?.transaction_status === "PENDING";
  if (payment) ui.method.value = payment.payment_method;
  $("#booking-payment-result-note").textContent = "Chọn kết quả để cập nhật trạng thái giao dịch trên hệ thống.";
  if (confirmed) {
    showSuccess();
    ui.status.textContent = "Lịch khám đã được hệ thống xác nhận. "+checkInInstruction(encounter);
  } else if (status === "HOLDING") {
    ui.status.textContent = payment?.transaction_status === "FAILED"
      ? "Thanh toán không thành công. Bạn có thể tạo phiên mới khi thời gian giữ chỗ còn hiệu lực."
      : payment?.transaction_status === "SUCCESS"
        ? "Hệ thống đã nhận giao dịch nhưng lịch chưa được xác nhận. Bấm cập nhật trạng thái để đối chiếu."
        : "Thanh toán trước khi giữ chỗ hết hạn để được cấp phiếu khám.";
    let checked = new Date(encounter.hold_expires_at) <= new Date();
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((new Date(encounter.hold_expires_at) - Date.now()) / 1000));
      $("#booking-countdown").textContent = seconds > 0
        ? `Thời gian giữ chỗ còn lại: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
        : "Đã tới thời hạn giữ chỗ. Bấm cập nhật trạng thái để đối chiếu hệ thống.";
      if (!seconds && !checked && !busy) { checked = true; clearInterval(timer); timer = undefined; refresh(); }
    };
    tick(); if (!checked) timer = setInterval(tick, 1000);
  } else {
    ui.status.textContent = "Lượt khám này không còn giữ chỗ. Bạn có thể quay lại chọn lịch khác.";
  }
}
async function readBooking(id, run = version) {
  const result = await getEncounter(id);
  const payments = await allPages((params, options) => listEncounterPayments(id, params, options));
  const fetchedTicket = result.encounter.ticket_code ? (await getTicket(id)).ticket : null;
  if (!current(run)) return;
  encounter = result.encounter; ticket = fetchedTicket;
  payment = payments.find(row => row.payment_type === "DEPOSIT" && row.transaction_status === "PENDING") || payments.find(row => row.payment_type === "DEPOSIT");
  showBooking();
}
async function refresh() {
  if (busy || !encounter || !active) return;
  const run = version; setBusy(true); ui.status.textContent = "Đang cập nhật trạng thái…";
  try { await readBooking(encounter.encounter_id, run); }
  catch (error) { if (current(run)) ui.status.textContent = errorText(error); }
  finally { if (current(run)) setBusy(false); }
}
async function paymentAction(action) {
  if (busy || !active || encounter?.encounter_status !== "HOLDING") return;
  const run = version; setBusy(true); ui.status.textContent = "Đang xử lý thanh toán trên hệ thống…";
  try {
    if (!current(run)) return;
    await action();
    if (!current(run)) return;
    await readBooking(encounter.encounter_id, run);
  } catch (error) {
    if (!current(run)) return;
    try { await readBooking(encounter.encounter_id, run); } catch { /* Read back only; never retry a mutation automatically. */ }
    if (current(run)) ui.status.textContent = errorText(error) + " Bấm cập nhật trạng thái để đối chiếu trước khi thử lại.";
  } finally { if (current(run)) setBusy(false); }
}
ui.create.addEventListener("click", () => {
  if (!active || !hasSession()) return;
  return paymentAction(() => createIntent(encounter.encounter_id, { payment_method: ui.method.value }));
});
$("#booking-payment-success").addEventListener("click", () => {
  if (!active || !hasSession()) return;
  if (payment?.transaction_status === "PENDING") return paymentAction(() => setDemoResult(payment.payment_id, { result: "SUCCESS" }));
});
$("#booking-payment-failed").addEventListener("click", () => {
  if (!active || !hasSession()) return;
  if (payment?.transaction_status === "PENDING") return paymentAction(() => setDemoResult(payment.payment_id, { result: "FAILED" }));
});
ui.refresh.addEventListener("click", refresh);
startAutoRefresh(refresh, { canRefresh: () => active && hasSession() && !busy && !checking && Boolean(encounter) });
ui.cancel.addEventListener("click", () => paymentAction(() => cancel(encounter.encounter_id, { reason: "Người đặt khám hủy giữ chỗ trên giao diện" })));
function suspend() { active = false; version++; ui.page.hidden = true; clearInterval(timer); timer = undefined; }
async function start() {
  if (checking) return;
  checking = true; active = true; busy = false;
  clearInterval(timer); timer = undefined;
  const run = ++version;
  encounter = payment = ticket = undefined;
  ui.page.hidden = true; ui.auth.hidden = false; ui.auth.querySelector("button").hidden = true;
  ui.auth.querySelector("p").textContent = "Đang tải thông tin thanh toán…";
  try {
    if (!await verifySession()) { location.replace(loginUrl(new URL(location.href)).href); return; }
    actor = (await getMe()).user;
    if (!current(run)) return;
    draft = readDraft(draftKey, actor.user_id);
    const reviewUrl = new URL("booking_review.html", location.href);
    if (draft) reviewUrl.searchParams.set("draft", draftKey);
    const requested = query.get("encounter");
    if (requested && !/^[1-9]\d*$/.test(requested)) throw new Error("Mã lượt khám không hợp lệ.");
    const encounterId = requested ? Number(requested) : draft?.encounter_id;
    if (encounterId) { reviewUrl.searchParams.set("encounter", encounterId); await readBooking(encounterId, run); }
    else if (draft) { location.replace(reviewUrl.href); return; }
    else throw new Error("Chưa có thông tin thanh toán hoặc bản nhập đã hết hạn. Vui lòng quay lại kiểm tra thông tin đặt khám.");
    if (!current(run)) return;
    ui.back.href = reviewUrl.href;
    ui.auth.hidden = true; ui.page.hidden = false;
    document.body.classList.remove("auth-pending");
  } catch (error) {
    if (!active || run !== version) return;
    ui.auth.querySelector("p").textContent = errorText(error); ui.auth.querySelector("button").hidden = false;
  } finally { checking = false; }
}
ui.auth.querySelector("button").addEventListener("click", start);
window.addEventListener("pagehide", suspend);
window.addEventListener("pageshow", event => { if (event.persisted) start(); });
window.addEventListener("neu:auth-change", () => { suspend(); if (!hasSession()) location.replace(loginUrl(new URL(location.href)).href); });
start();
