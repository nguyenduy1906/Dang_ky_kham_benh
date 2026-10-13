import { listDoctors } from "../api/doctor.js";
import { listDepartments } from "../api/catalog.js";
import { listDoctorSchedules } from "../api/schedule.js";
import { listPatients, createPatient, updatePatient } from "../api/patient.js";
import { createOnline, getEncounter, getTicket, listEncounters, cancel } from "../api/encounter.js";
import { createIntent, listEncounterPayments, setDemoResult } from "../api/payment.js";
import { getMe } from "../api/auth.js";
import { verifySession, hasSession, clearSession, loginUrl } from "../core/session.js";
import { thumbnailUrl } from "../core/articles.js";
import { allPages, availableSchedules, money, clock, dateLabel, todayVN, matchingBooking, patientPayload } from "../core/booking.js";

const $ = selector => document.querySelector(selector);
function el(tag, text = "", className = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}
const ui = {
  main: $("#main"), auth: $("#booking-auth-status"), form: $("#appointment-form"),
  patients: $("#appointment-patient"), departments: $("#appointment-department"),
  doctors: $(".booking-doctor-list"), count: $("#appointment-count"),
  data: $("#booking-data-status"), retry: $("#booking-data-retry"),
  schedule: $("#chosen-schedule"), scheduleStatus: $("#schedule-status"),
  days: $("#appointment-day-buttons"), slots: $("#booking-slots"),
  from: $("#schedule-from"), to: $("#schedule-to"), summary: $("#appointment-summary-list"),
  dialog: $("#booking-dialog"), review: $("#booking-review"), dialogStatus: $("#booking-dialog-status"),
  confirm: $("#booking-confirm"), payment: $("#booking-payment"), method: $("#booking-payment-method"),
  paymentCreate: $("#booking-payment-create"), paymentResult: $("#booking-payment-result"),
  refresh: $("#booking-refresh"), cancel: $("#booking-cancel"),
};
let doctors = [], patients = [], schedules = [], selectedDoctor, selectedDate = "", selectedSlot, actor;
let loading = false, checking = false, scheduleVersion = 0, scheduleAbort, busy = false;
let encounter, payment, ticket, countdown, reviewRequest, requestedEncounterId, submissionUncertain = false;
const resume = el("button", "Tiếp tục xem lịch đã đăng ký", "add-relative-button");
resume.type = "button";
resume.hidden = true;
ui.data.parentElement.append(resume);
resume.addEventListener("click", () => { ui.dialog.showModal(); refreshBooking(); });

function errorMessage(error) {
  if (error.status === 401) {
    for (const dialog of document.querySelectorAll("dialog[open]")) dialog.close();
    clearSession();
    location.replace(loginUrl(new URL(location.href)).href);
    return "Phiên đăng nhập đã hết hạn.";
  }
  return error.message || "Không thể kết nối hệ thống. Vui lòng thử lại.";
}
function details(target, pairs) {
  const list = target.tagName === "DL" ? target : el("dl", "", "booking-review-list");
  list.replaceChildren();
  for (const [label, value] of pairs) list.append(el("dt", label), el("dd", String(value ?? "Chưa cung cấp")));
  if (list !== target) target.replaceChildren(list);
}
function portrait(doctor) {
  const holder = el("span", "", "booking-portrait");
  const fallback = el("span", "Chưa có ảnh", "booking-portrait-missing");
  holder.append(fallback);
  const src = thumbnailUrl(doctor.avatar_url);
  if (src) {
    const image = el("img");
    image.alt = `Ảnh ${doctor.full_name}`;
    image.loading = "lazy";
    image.addEventListener("load", () => { fallback.hidden = true; });
    image.addEventListener("error", () => { image.remove(); fallback.hidden = false; });
    image.src = src;
    holder.append(image);
  }
  return holder;
}
const selectedPatient = () => patients.find(p => String(p.patient_id) === ui.patients.value);
function renderPatients(preferred = ui.patients.value) {
  ui.patients.replaceChildren(new Option(patients.length ? "Chọn người tới khám" : "Chưa có hồ sơ người khám", ""));
  for (const p of patients) {
    ui.patients.add(new Option(`${p.full_name}${p.dob ? ` — ${dateLabel(p.dob)}` : ""}${p.relationship === "SELF" ? " (Bản thân)" : ""}`, p.patient_id));
  }
  if (patients.some(p => String(p.patient_id) === String(preferred))) ui.patients.value = String(preferred);
  else if (patients.length === 1) ui.patients.value = String(patients[0].patient_id);
  $("#relative-status").textContent = patients.length ? "" : "Thêm hồ sơ bản thân hoặc người thân để đặt lịch khám.";
  updateInsurance();
}
function updateInsurance() {
  const patient = selectedPatient();
  $("#appointment-insurance-code").value = patient?.health_insurance || "";
  $("#edit-insurance").disabled = !patient || patient.user_id !== actor?.user_id;
  $("#insurance-local-status").textContent = patient && patient.user_id !== actor?.user_id
    ? "Bạn có quyền đặt khám cho hồ sơ này. Chỉ chủ hồ sơ có thể cập nhật thông tin BHYT."
    : "Mã thẻ được lưu trong hồ sơ; quyền lợi BHYT cần được bệnh viện đối chiếu.";
  updateSummary();
}
function renderDoctors() {
  $(".appointment-results").prepend(ui.schedule);
  const normalize = value => value.toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  const term = normalize($("#appointment-search").value.trim());
  const department = ui.departments.value;
  const visible = doctors.filter(d => (!department || String(d.department_id) === department) && normalize(d.full_name).includes(term));
  ui.doctors.replaceChildren();
  for (const doctor of visible) {
    const chosen = doctor.doctor_profile_id === selectedDoctor?.doctor_profile_id;
    const card = el("article", "", `booking-doctor${chosen ? " selected" : ""}`);
    card.dataset.bookingId = doctor.doctor_profile_id;
    const info = el("div", "", "booking-doctor-info");
    info.append(el("h2", doctor.full_name), el("p", `Chuyên khoa: ${doctor.department_name}`));
    if (doctor.specialization) info.append(el("span", doctor.specialization));
    const price = el("div", "", "booking-price");
    price.append(el("span", "Giá khám"), el("strong", money(doctor.consultation_fee)));
    const button = el("button", chosen ? "Đã chọn" : "Chọn", "solid-button");
    button.type = "button";
    button.setAttribute("aria-pressed", String(chosen));
    button.addEventListener("click", () => selectDoctor(doctor));
    card.append(portrait(doctor), info, price, button);
    if (chosen) card.append(ui.schedule);
    ui.doctors.append(card);
  }
  if (selectedDoctor && !visible.includes(selectedDoctor)) clearDoctor();
  ui.count.textContent = `${visible.length} bác sĩ`;
  $("#appointment-empty").hidden = visible.length > 0;
}
function clearSlot() {
  selectedSlot = undefined;
  $("#appointment-shift").value = "";
  $("#appointment-status").textContent = "";
  updateSummary();
}
function clearDoctor() {
  scheduleVersion++;
  scheduleAbort?.abort();
  selectedDoctor = undefined;
  clearSlot();
  ui.schedule.hidden = true;
}
function selectDoctor(doctor) {
  if (selectedDoctor?.doctor_profile_id === doctor.doctor_profile_id) return;
  selectedDoctor = doctor;
  selectedDate = "";
  clearSlot();
  ui.schedule.hidden = false;
  renderDoctors();
  loadSchedules();
}
async function loadSchedules() {
  if (!selectedDoctor) return;
  scheduleAbort?.abort();
  scheduleAbort = new AbortController();
  const version = ++scheduleVersion, doctorId = selectedDoctor.doctor_profile_id;
  clearSlot();
  schedules = [];
  ui.days.replaceChildren();
  ui.slots.replaceChildren();
  $("#appointment-date").replaceChildren(new Option("Chọn ngày khám", ""));
  ui.scheduleStatus.textContent = "Đang tải lịch khám còn trống…";
  $("#schedule-retry").hidden = true;
  ui.schedule.setAttribute("aria-busy", "true");
  try {
    const rows = await allPages((params, options) => listDoctorSchedules(doctorId, params, options),
      { from_date: ui.from.value, to_date: ui.to.value }, { signal: scheduleAbort.signal });
    if (version !== scheduleVersion) return;
    schedules = availableSchedules(rows);
    const dates = [...new Set(schedules.map(s => s.work_date))];
    if (!dates.includes(selectedDate)) selectedDate = dates[0] || "";
    const dateSelect = $("#appointment-date");
    for (const day of dates) dateSelect.add(new Option(dateLabel(day), day));
    dateSelect.value = selectedDate;
    ui.scheduleStatus.textContent = dates.length
      ? "Chọn ngày và khung giờ còn trống. Đặt online cần trước giờ bắt đầu ca ít nhất 5 tiếng."
      : "Chưa có khung giờ có thể đặt online trong khoảng ngày này. Bạn có thể đổi ngày hoặc chọn bác sĩ khác.";
    renderDays();
    renderSlots();
  } catch (error) {
    if (version !== scheduleVersion) return;
    ui.scheduleStatus.textContent = errorMessage(error);
    $("#schedule-retry").hidden = false;
  } finally { if (version === scheduleVersion) ui.schedule.setAttribute("aria-busy", "false"); }
}
function renderDays() {
  ui.days.replaceChildren();
  for (const day of [...new Set(schedules.map(s => s.work_date))]) {
    const date = new Date(`${day}T12:00:00+07:00`);
    const button = el("button", "", day === selectedDate ? "selected" : "");
    button.type = "button";
    button.setAttribute("aria-pressed", String(day === selectedDate));
    button.append(el("strong", new Intl.DateTimeFormat("vi-VN", { weekday: "short", timeZone: "Asia/Saigon" }).format(date)), el("span", dateLabel(day)));
    button.addEventListener("click", () => {
      if (selectedDate === day) return;
      selectedDate = day;
      $("#appointment-date").value = day;
      clearSlot(); renderDays(); renderSlots();
    });
    ui.days.append(button);
  }
}
function renderSlots() {
  ui.slots.replaceChildren();
  const shift = $("#appointment-shift");
  shift.replaceChildren(new Option("Chọn khung giờ", ""));
  for (const schedule of schedules.filter(s => s.work_date === selectedDate)) {
    const group = el("div", "", "booking-time-slots");
    group.append(el("h3", `${schedule.start_time.slice(0, 5)}–${schedule.end_time.slice(0, 5)} · ${schedule.room_name}`));
    const grid = el("div", "", "time-slot-grid");
    for (const slot of schedule.slots) {
      const key = `${schedule.schedule_id}/${slot.appointment_time}`;
      const active = selectedSlot?.key === key;
      const button = el("button", `${clock(slot.starts_at)}–${clock(slot.ends_at)}`, active ? "selected" : "");
      button.type = "button";
      button.setAttribute("aria-pressed", String(active));
      shift.add(new Option(button.textContent, key));
      button.addEventListener("click", () => { selectedSlot = { schedule, slot, key }; renderSlots(); updateSummary(); });
      grid.append(button);
    }
    group.append(grid);
    ui.slots.append(group);
  }
  shift.value = selectedSlot?.key || "";
}
function updateSummary() {
  $("#appointment-summary-empty").hidden = Boolean(selectedDoctor);
  $("#appointment-summary-content").hidden = !selectedDoctor;
  if (!selectedDoctor) return;
  $("#summary-doctor-name").textContent = selectedDoctor.full_name;
  $("#summary-doctor-specialty").textContent = selectedDoctor.department_name;
  $("#summary-doctor-photo").replaceChildren(portrait(selectedDoctor));
  details(ui.summary, [
    ["Người khám", selectedPatient()?.full_name || "Chưa chọn"],
    ["Ngày khám", selectedSlot ? dateLabel(selectedSlot.schedule.work_date) : "Chưa chọn"],
    ["Khung giờ", selectedSlot ? `${clock(selectedSlot.slot.starts_at)}–${clock(selectedSlot.slot.ends_at)}` : "Chưa chọn"],
    ["Phòng khám", selectedSlot?.schedule.room_name || "Chưa chọn"],
    ["Giá khám", money(selectedDoctor.consultation_fee)],
  ]);
  $('#appointment-summary-content > button[type="submit"]').disabled = !selectedSlot;
}
async function loadData() {
  if (loading) return;
  loading = true;
  clearDoctor();
  ui.doctors.replaceChildren();
  ui.doctors.setAttribute("aria-busy", "true");
  ui.data.textContent = "Đang tải bác sĩ và hồ sơ người khám…";
  ui.retry.hidden = true;
  ui.patients.disabled = true;
  $("#add-relative").disabled = true;
  const results = await Promise.allSettled([
    allPages(listDoctors, {}, { auth: false }), allPages(listPatients), listDepartments({}, { auth: false }), getMe(),
  ]);
  try {
    const failed = results.find(result => result.status === "rejected");
    if (failed) throw failed.reason;
    doctors = results[0].value; patients = results[1].value; actor = results[3].value.user;
    ui.departments.replaceChildren(new Option("Tất cả chuyên khoa", ""));
    for (const department of results[2].value.items) ui.departments.add(new Option(department.name, department.department_id));
    renderPatients(); renderDoctors();
    ui.data.textContent = "Thông tin bác sĩ, giá khám và hồ sơ được lấy từ hệ thống.";
    ui.patients.disabled = false;
    $("#add-relative").disabled = false;
    const query = new URLSearchParams(location.search);
    const doctor = doctors.find(d => String(d.doctor_profile_id) === query.get("doctor"));
    if (doctor) selectDoctor(doctor);
    const id = query.get("encounter");
    if (id && /^[1-9]\d*$/.test(id)) {
      $("#booking-dialog-title").textContent = "Thông tin lịch khám";
      ui.confirm.hidden = true;
      $("#booking-confirm-note").hidden = true;
      ui.payment.hidden = true;
      ui.dialog.showModal();
      await refreshBooking(Number(id));
    }
  } catch (error) { ui.data.textContent = errorMessage(error); ui.retry.hidden = false; }
  finally { loading = false; ui.doctors.setAttribute("aria-busy", "false"); }
}
async function checkAccess() {
  if (checking) return;
  checking = true;
  document.body.classList.add("auth-pending");
  ui.main.inert = true;
  ui.auth.hidden = false;
  ui.auth.querySelector("button").hidden = true;
  try {
    if (!await verifySession()) { location.replace(loginUrl(new URL(location.href)).href); return; }
    document.body.classList.remove("auth-pending"); ui.main.inert = false; ui.auth.hidden = true;
    await loadData();
  } catch (error) { ui.auth.querySelector("p").textContent = errorMessage(error); ui.auth.querySelector("button").hidden = false; }
  finally { checking = false; }
}

function busyDialog(value) {
  busy = value;
  ui.dialog.setAttribute("aria-busy", String(value));
  ui.dialog.querySelectorAll("button,select").forEach(node => { node.disabled = value; });
  if (!value && payment?.transaction_status === "PENDING") ui.method.disabled = true;
}
function rememberEncounter() {
  requestedEncounterId = encounter.encounter_id;
  const url = new URL(location.href);
  url.searchParams.set("encounter", encounter.encounter_id);
  history.replaceState(null, "", url);
  resume.hidden = false;
}
function showBooking() {
  clearInterval(countdown);
  countdown = undefined;
  rememberEncounter();
  const status = encounter.encounter_status;
  const confirmed = ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(status);
  $("#booking-dialog-title").textContent = confirmed ? "Thông tin lịch khám" : status === "HOLDING" ? "Hoàn tất đăng ký khám" : "Trạng thái lịch khám";
  ui.confirm.hidden = true;
  $("#booking-confirm-note").hidden = true;
  ui.payment.hidden = status !== "HOLDING";
  ui.refresh.hidden = false; ui.cancel.hidden = status !== "HOLDING";
  const labels = { HOLDING: "Đang giữ chỗ — chưa xác nhận", CONFIRMED: "Đã xác nhận", CHECKED_IN: "Đã check-in",
    IN_PROGRESS: "Đang khám", COMPLETED: "Đã khám xong", EXPIRED: "Đã hết hạn giữ chỗ", CANCELLED: "Đã hủy", NO_SHOW: "Không tới khám" };
  details(ui.review, [
    ["Trạng thái", labels[status] || status], ["Mã phiếu", ticket?.ticket_code || encounter.ticket_code || "Chưa được cấp"],
    ["Người khám", encounter.patient_name], ["Bác sĩ", encounter.doctor_name], ["Ngày khám", dateLabel(encounter.work_date)],
    ["Khung giờ", `${clock(encounter.estimated_exam_at)}–${clock(encounter.appointment_end_at)}`], ["Phòng khám", encounter.room_name],
    ["Giá khám đã chốt", money(encounter.consultation_fee_snapshot)],
    [confirmed ? "Tiền cọc đã thanh toán" : status === "HOLDING" ? "Tiền cần thanh toán" : "Tiền cọc ban đầu", money(encounter.deposit_amount_snapshot)],
    ["Vấn đề sức khỏe", encounter.symptoms || "Chưa cung cấp"],
  ]);
  ui.dialogStatus.textContent = confirmed ? "Lịch khám đã được hệ thống xác nhận. Vui lòng đến làm thủ tục trước khung giờ đã chọn ít nhất 30 phút."
    : status === "HOLDING" ? "Thanh toán trước khi giữ chỗ hết hạn để được cấp phiếu khám."
      : "Lượt khám này không còn giữ chỗ. Bạn có thể đóng cửa sổ và chọn lịch mới.";
  ui.paymentResult.hidden = payment?.transaction_status !== "PENDING";
  ui.paymentCreate.hidden = payment?.transaction_status === "PENDING";
  ui.method.disabled = payment?.transaction_status === "PENDING";
  if (payment) ui.method.value = payment.payment_method;
  if (status === "HOLDING") {
    let expirationChecked = new Date(encounter.hold_expires_at) <= new Date();
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((new Date(encounter.hold_expires_at) - Date.now()) / 1000));
      $("#booking-countdown").textContent = seconds > 0
        ? `Thời gian giữ chỗ còn lại: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
        : "Đã tới thời hạn giữ chỗ. Bấm cập nhật trạng thái để đối chiếu hệ thống.";
      if (!seconds && !expirationChecked && !busy) {
        expirationChecked = true;
        clearInterval(countdown); countdown = undefined; refreshBooking();
      }
    };
    tick();
    if (!expirationChecked) countdown = setInterval(tick, 1000);
  }
}
async function readBooking(id) {
  const result = await getEncounter(id);
  const payments = await allPages((params, options) => listEncounterPayments(id, params, options));
  let fetchedTicket;
  if (result.encounter.ticket_code) fetchedTicket = (await getTicket(id)).ticket;
  encounter = result.encounter;
  payment = payments.find(p => p.payment_type === "DEPOSIT" && p.transaction_status === "PENDING") ||
    payments.find(p => p.payment_type === "DEPOSIT");
  ticket = fetchedTicket;
  submissionUncertain = false;
  showBooking();
}
async function recoverSubmission() {
  const items = await allPages(listEncounters, {
    patient_id: reviewRequest.patient_id, schedule_id: reviewRequest.schedule_id, encounter_type: "ONLINE",
  });
  const match = matchingBooking(items, reviewRequest);
  if (match) { await readBooking(match.encounter_id); return; }
  submissionUncertain = false;
  ui.confirm.disabled = false; ui.refresh.hidden = true;
  ui.dialogStatus.textContent = "Hệ thống chưa có lượt khám khớp thông tin này. Bạn có thể bấm xác nhận để gửi lại.";
}
async function refreshBooking(id = encounter?.encounter_id || requestedEncounterId) {
  if (busy) return;
  if (id) requestedEncounterId = id;
  busyDialog(true);
  ui.dialogStatus.textContent = "Đang cập nhật trạng thái từ hệ thống…";
  try {
    if (id) await readBooking(id);
    else if (submissionUncertain) await recoverSubmission();
    else throw new Error("Chưa có lượt khám để cập nhật.");
  } catch (error) { ui.dialogStatus.textContent = errorMessage(error); ui.refresh.hidden = false; }
  finally { busyDialog(false); if (submissionUncertain) ui.confirm.disabled = true; }
}
ui.form.addEventListener("submit", event => {
  event.preventDefault();
  if (busy || loading) return;
  if (encounter?.encounter_status === "HOLDING" || submissionUncertain) { ui.dialog.showModal(); refreshBooking(); return; }
  const patient = selectedPatient();
  if (!patient || !selectedSlot) { $("#appointment-status").textContent = "Vui lòng chọn hồ sơ người khám và khung giờ còn trống."; return; }
  const symptoms = $("#appointment-symptoms").value.trim();
  if (!symptoms) { $("#appointment-status").textContent = "Vui lòng mô tả vấn đề sức khỏe."; return; }
  reviewRequest = { patient_id: patient.patient_id, schedule_id: selectedSlot.schedule.schedule_id,
    appointment_time: selectedSlot.slot.appointment_time, symptoms };
  encounter = payment = ticket = requestedEncounterId = undefined;
  resume.hidden = true;
  const url = new URL(location.href);
  url.searchParams.delete("encounter");
  history.replaceState(null, "", url);
  details(ui.review, [
    ["Người khám", patient.full_name], ["Bác sĩ", selectedDoctor.full_name], ["Ngày khám", dateLabel(selectedSlot.schedule.work_date)],
    ["Khung giờ", `${clock(selectedSlot.slot.starts_at)}–${clock(selectedSlot.slot.ends_at)}`],
    ["Phòng khám", selectedSlot.schedule.room_name], ["Giá khám", money(selectedDoctor.consultation_fee)], ["Vấn đề sức khỏe", symptoms],
  ]);
  $("#booking-dialog-title").textContent = "Xác nhận thông tin đặt khám";
  $("#booking-confirm-note").hidden = false;
  ui.confirm.hidden = false; ui.confirm.disabled = false;
  ui.payment.hidden = ui.refresh.hidden = ui.cancel.hidden = true;
  ui.dialogStatus.textContent = ""; ui.dialog.showModal();
});
ui.confirm.addEventListener("click", async () => {
  if (busy || encounter || submissionUncertain || !reviewRequest) return;
  busyDialog(true);
  ui.dialogStatus.textContent = "Đang gửi yêu cầu giữ chỗ…";
  try {
    const result = await createOnline(reviewRequest);
    encounter = result.encounter;
    rememberEncounter();
    await readBooking(encounter.encounter_id);
    loadSchedules();
  } catch (error) {
    ui.dialogStatus.textContent = errorMessage(error);
    if (encounter) {
      ui.confirm.hidden = true; ui.refresh.hidden = false;
      ui.dialogStatus.textContent += " Lượt khám đã được tạo; bấm cập nhật trạng thái để tiếp tục.";
    } else if (error.status === 0 || error.code === "DUPLICATE_ENCOUNTER") {
      submissionUncertain = true; ui.refresh.hidden = false;
      ui.dialogStatus.textContent += " Bấm cập nhật trạng thái để kiểm tra yêu cầu trước khi gửi lại.";
    } else if (error.status === 409 || error.code === "SCHEDULE_NOT_FOUND") {
      ui.confirm.hidden = true;
      ui.dialogStatus.textContent += " Hãy đóng cửa sổ và chọn lại khung giờ.";
      loadSchedules();
    }
  } finally { busyDialog(false); if (submissionUncertain) ui.confirm.disabled = true; }
});
async function paymentAction(action) {
  if (busy || encounter?.encounter_status !== "HOLDING") return;
  busyDialog(true);
  ui.dialogStatus.textContent = "Đang xử lý thanh toán trên hệ thống…";
  try {
    await action();
    await readBooking(encounter.encounter_id);
    if (payment?.transaction_status === "FAILED" && encounter.encounter_status === "HOLDING") {
      ui.dialogStatus.textContent = "Thanh toán thất bại. Bạn có thể tạo phiên mới khi thời gian giữ chỗ còn hiệu lực.";
    }
  } catch (error) {
    try { await readBooking(encounter.encounter_id); } catch { /* No mutation retry after an uncertain result. */ }
    ui.dialogStatus.textContent = errorMessage(error) + " Bấm cập nhật trạng thái để đối chiếu trước khi thử lại.";
  } finally { busyDialog(false); }
}
ui.paymentCreate.addEventListener("click", () => paymentAction(() => createIntent(encounter.encounter_id, { payment_method: ui.method.value })));
$("#booking-payment-success").addEventListener("click", () => {
  if (payment?.transaction_status === "PENDING") paymentAction(() => setDemoResult(payment.payment_id, { result: "SUCCESS" }));
});
$("#booking-payment-failed").addEventListener("click", () => {
  if (payment?.transaction_status === "PENDING") paymentAction(() => setDemoResult(payment.payment_id, { result: "FAILED" }));
});
ui.cancel.addEventListener("click", async () => {
  if (busy || encounter?.encounter_status !== "HOLDING") return;
  busyDialog(true);
  try {
    await cancel(encounter.encounter_id, { reason: "Người đặt khám hủy giữ chỗ trên giao diện" });
    await readBooking(encounter.encounter_id); loadSchedules();
  } catch (error) { ui.dialogStatus.textContent = errorMessage(error); }
  finally { busyDialog(false); }
});
ui.refresh.addEventListener("click", () => refreshBooking());
$("#booking-dialog-close").addEventListener("click", () => { if (!busy) ui.dialog.close(); });
ui.dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
ui.dialog.addEventListener("close", () => { clearInterval(countdown); countdown = undefined; });

$("#add-relative").addEventListener("click", () => {
  $("#relative-form").reset(); $("#relative-form-status").textContent = "";
  $("#shared-phone-confirmation").hidden = true; $("#relative-dob").max = todayVN();
  $("#relative-dialog").showModal();
});
$("#relative-close").addEventListener("click", () => { if (!$("#relative-form").dataset.busy) $("#relative-dialog").close(); });
$("#relative-dialog").addEventListener("cancel", event => { if ($("#relative-form").dataset.busy) event.preventDefault(); });
$("#relative-form").addEventListener("input", event => {
  if (event.target.id !== "confirm-shared-phone") {
    $("#shared-phone-confirmation").hidden = true; $("#confirm-shared-phone").checked = false;
  }
});
$("#relative-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget, status = $("#relative-form-status");
  if (form.dataset.busy) return;
  let payload;
  try {
    if (!$("#shared-phone-confirmation").hidden && !$("#confirm-shared-phone").checked) throw new Error("Vui lòng xác nhận dùng chung số điện thoại trước khi lưu.");
    payload = patientPayload(new FormData(form), !$("#shared-phone-confirmation").hidden && $("#confirm-shared-phone").checked);
  } catch (error) { status.textContent = error.message; return; }
  form.dataset.busy = "true";
  form.querySelectorAll("input,select,button").forEach(node => { node.disabled = true; });
  status.textContent = "Đang lưu hồ sơ…";
  try {
    const result = await createPatient(payload);
    patients = await allPages(listPatients); renderPatients(result.patient.patient_id);
    $("#relative-dialog").close(); $("#relative-status").textContent = "Đã lưu hồ sơ người khám.";
  } catch (error) {
    status.textContent = errorMessage(error);
    if (error.code === "CONFIRM_SHARED_PHONE") $("#shared-phone-confirmation").hidden = false;
  } finally { delete form.dataset.busy; form.querySelectorAll("input,select,button").forEach(node => { node.disabled = false; }); }
});
$("#edit-insurance").addEventListener("click", () => {
  const patient = selectedPatient();
  if (!patient || patient.user_id !== actor.user_id) return;
  $("#insurance-form").dataset.patientId = patient.patient_id;
  $("#insurance-document").value = patient.health_insurance || "";
  $("#insurance-form-status").textContent = ""; $("#insurance-dialog").showModal();
});
$("#insurance-close").addEventListener("click", () => { if (!$("#insurance-form").dataset.busy) $("#insurance-dialog").close(); });
$("#insurance-dialog").addEventListener("cancel", event => { if ($("#insurance-form").dataset.busy) event.preventDefault(); });
$("#insurance-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.dataset.busy) return;
  form.dataset.busy = "true"; form.querySelector("button").disabled = true;
  const code = $("#insurance-document").value.trim().toUpperCase() || null;
  $("#insurance-form-status").textContent = "Đang lưu mã thẻ…";
  try {
    await updatePatient(form.dataset.patientId, { health_insurance: code });
    patients = await allPages(listPatients); renderPatients(); $("#insurance-dialog").close();
  } catch (error) { $("#insurance-form-status").textContent = errorMessage(error); }
  finally { delete form.dataset.busy; form.querySelector("button").disabled = false; }
});
ui.patients.addEventListener("change", updateInsurance);
document.querySelectorAll('[name="insurance"]').forEach(radio => radio.addEventListener("change", () => {
  $("#insurance-field").hidden = $('[name="insurance"]:checked').value !== "yes";
}));
document.querySelectorAll("[data-booking-mode]").forEach(button => button.addEventListener("click", () => {
  const departmentMode = button.dataset.bookingMode === "department";
  document.querySelectorAll("[data-booking-mode]").forEach(item => {
    const active = item === button; item.classList.toggle("selected", active); item.setAttribute("aria-pressed", String(active));
  });
  $("#appointment-department-field").hidden = !departmentMode;
  if (!departmentMode) { ui.departments.value = ""; renderDoctors(); }
}));
$("#appointment-search").addEventListener("input", renderDoctors);
ui.departments.addEventListener("change", renderDoctors);
function changeRange() {
  const invalid = ui.from.value && ui.to.value && ui.from.value > ui.to.value;
  $("#schedule-range-error").textContent = invalid ? "Ngày kết thúc phải từ ngày bắt đầu trở đi." : "";
  if (invalid || !ui.from.validity.valid || !ui.to.validity.valid) {
    scheduleVersion++; scheduleAbort?.abort(); clearSlot();
    ui.days.replaceChildren(); ui.slots.replaceChildren(); ui.scheduleStatus.textContent = "Vui lòng chọn khoảng ngày hợp lệ.";
    return;
  }
  selectedDate = ""; loadSchedules();
}
ui.from.min = ui.to.min = todayVN(); ui.from.value = todayVN();
ui.from.addEventListener("change", changeRange); ui.to.addEventListener("change", changeRange);
$("#schedule-retry").addEventListener("click", loadSchedules);
ui.retry.addEventListener("click", loadData); ui.auth.querySelector("button").addEventListener("click", checkAccess);
window.addEventListener("neu:auth-change", () => {
  if (!hasSession()) {
    for (const dialog of document.querySelectorAll("dialog[open]")) dialog.close();
    ui.main.inert = true; document.body.classList.add("auth-pending");
    location.replace(loginUrl(new URL(location.href)).href);
  }
});
window.addEventListener("pagehide", () => {
  ui.main.inert = true; document.body.classList.add("auth-pending");
  clearInterval(countdown); scheduleVersion++; scheduleAbort?.abort();
});
window.addEventListener("pageshow", event => { if (event.persisted) checkAccess(); });
checkAccess();
