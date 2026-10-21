import { checkInInstruction } from "../core/encounter_policy.js";
import { listDoctors } from "../api/doctor.js";
import { listPatients, createPatient } from "../api/patient.js";
import { listDoctorSchedules } from "../api/schedule.js";
import { createOnline, getEncounter, getTicket, listEncounters, cancel, updateRegistration } from "../api/encounter.js";
import { createIntent, listEncounterPayments } from "../api/payment.js";
import { getMe } from "../api/auth.js";
import { verifySession, hasSession, clearSession, loginUrl } from "../core/session.js";
import { thumbnailUrl } from "../core/articles.js";
import { allPages, availableSchedules, money, clock, dateLabel, matchingBooking, patientPayload } from "../core/booking.js";
import { readDraft, saveDraft, draftRequest } from "../core/booking_draft.js";
const $ = selector => document.querySelector(selector);
function el(tag, text = "", className = "") {
  const node = document.createElement(tag); node.textContent = text;
  if (className) node.className = className; return node;
}
const ui = {
  dialog: $("#booking-review-page"), review: $("#booking-review"), dialogStatus: $("#booking-dialog-status"),
  confirm: $("#booking-confirm"), refresh: $("#booking-refresh"), cancel: $("#booking-cancel"),
};
let doctors = [], patients = [], selectedDoctor, selectedSlot, actor, busy = false;
let encounter, payment, ticket, reviewRequest, requestedEncounterId, submissionUncertain = false;
let draft;
let pageVersion = 0;
let active = true;
let registrationForm;
let draftKey = new URLSearchParams(location.search).get("draft");
const selfPreview = () => draft?.patient_type === "SELF" && draft.patient_id == null && !encounter;
const selectedPatient = () => selfPreview() ? actor : patients.find(p => String(p.patient_id) === String(draft?.patient_id));
function errorMessage(error) {
  if (error.status === 401) { clearSession(); location.replace(loginUrl(new URL(location.href)).href); return "Phiên đăng nhập đã hết hạn."; }
  return error.message || "Không thể kết nối hệ thống. Vui lòng thử lại.";
}
function backUrl() {
  const url = new URL("booking.html", location.href);
  if (draft) { url.searchParams.set("doctor", draft.doctor_profile_id); url.searchParams.set("draft", draftKey); }
  return url.href;
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
function busyDialog(value) {
  busy = value;
  ui.dialog.setAttribute("aria-busy", String(value));
  ui.dialog.querySelectorAll("button,select,input,textarea").forEach(node => { node.disabled = value; });

}
function renderReview() {
  clearRegistrationForm();
  const patient = encounter ? patients.find(p => String(p.patient_id) === String(encounter.patient_id)) : selectedPatient();
  const doctor = encounter ? doctors.find(d => String(d.doctor_profile_id) === String(encounter.doctor_profile_id)) : selectedDoctor;
  const fields = el("div", "", "booking-patient-fields");
  const editable = !submissionUncertain && (!encounter || encounter.encounter_status === "HOLDING");
  const intake = draft?.registration_details || encounter?.registration_details || patient || {};
  const form = el("form"); form.id = "booking-patient-form"; form.noValidate = true;
  const status = el("p", "", "booking-review-hint"); status.id = "booking-patient-status"; status.setAttribute("role", "status");
  const symptomsEditable = !submissionUncertain && (!encounter || encounter.encounter_status === "HOLDING");
  const autosave = { form, status, editable, symptomsEditable, patientId: patient?.patient_id, version: pageVersion, controls: [] };
  registrationForm = autosave;
  const keys = ["full_name", "id_card", "health_insurance", "phone", "dob", "gender", "address", "symptoms"];
  const patientValues = [
    ["Họ và tên người khám", Object.hasOwn(intake, "full_name") ? intake.full_name : encounter?.patient_name], ["Số CCCD / Mã định danh", intake.id_card],
    ["Số thẻ BHYT", intake.health_insurance], ["Số điện thoại liên hệ", intake.phone],
    ["Ngày sinh", intake.dob], ["Giới tính", intake.gender], ["Địa chỉ", intake.address],
    ["Vấn đề sức khỏe / Triệu chứng", draft?.symptoms ?? encounter?.symptoms ?? reviewRequest?.symptoms],
  ];
  for (const [index, [label, value]] of patientValues.entries()) {
    const holder = el("div", "", index >= 6 ? "booking-patient-full" : "");
    const name = el("label", label); name.htmlFor = `booking-review-field-${index}`;
    const input = el(index === 7 ? "textarea" : "input");
    input.id = name.htmlFor; input.name = keys[index]; input.value = value || "";
    input.placeholder = "Chưa cung cấp";
    input.readOnly = index === 7 ? !symptomsEditable : !editable;
    input.maxLength = [150, 12, 15, 20, 10, 20, 255, 5000][index];
    if ([0, 1, 3, 7].includes(index)) { input.required = true; name.textContent += " *"; }
    if (index === 1) input.pattern = "[0-9]{9}|[0-9]{12}";
    if (index === 2) input.pattern = "[A-Za-z0-9]{10,15}";
    if (index === 4) { input.type = "date"; input.max = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Saigon" }); }
    if (index === 3) input.type = "tel";
    const error = el("p", "", "booking-field-error");
    error.id = `${input.id}-error`; error.hidden = true;
    input.setAttribute("aria-describedby", error.id);
    autosave.controls.push({ input, error, label });
    if (index === 7) input.rows = 3;
    if (!input.readOnly) {
      input.addEventListener("input", () => {
        if (autosave.validationShown) validatePatientForm(autosave, false);
        saveRegistrationDraft(autosave);
      });
      const flush = () => saveRegistrationDraft(autosave);
      input.addEventListener("change", flush);
      input.addEventListener("blur", flush);
    }
    holder.append(name, input, error);
    fields.append(holder);
  }
  form.append(el("p", "Các mục có * là bắt buộc: họ tên, CCCD / mã định danh, số điện thoại và triệu chứng.", "booking-required-hint"));
  form.append(fields, status);
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (busy || !validatePatientForm(autosave)) return;
    saveRegistrationDraft(autosave);
  });
  $("#booking-review-patient").replaceChildren(form);
  ui.review.replaceChildren();
  const card = el("div", "", "booking-review-doctor");
  if (doctor) card.append(portrait(doctor));
  const info = el("div");
  info.append(el("h4", encounter?.doctor_name || doctor?.full_name), el("p", encounter?.department_name || doctor?.department_name));
  card.append(info); ui.review.append(card);
  const pairs = [
    ["Ngày khám", dateLabel(encounter?.work_date || selectedSlot?.schedule.work_date)],
    ["Khung giờ", `${clock(encounter?.estimated_exam_at || selectedSlot?.slot.starts_at)}–${clock(encounter?.appointment_end_at || selectedSlot?.slot.ends_at)}`],
    ["Phòng khám", encounter?.room_name || selectedSlot?.schedule.room_name],
    ["Giá khám", money(encounter?.consultation_fee_snapshot ?? doctor?.consultation_fee)],
  ];
  if (encounter) {
    const labels = { HOLDING: "Đang giữ chỗ", CONFIRMED: "Đã xác nhận", CHECKED_IN: "Đã check-in", IN_PROGRESS: "Đang khám", COMPLETED: "Đã khám xong", EXPIRED: "Đã hết hạn", CANCELLED: "Đã hủy", NO_SHOW: "Không tới khám" };
    pairs.push(["Trạng thái", labels[encounter.encounter_status] || encounter.encounter_status], ["Mã phiếu", ticket?.ticket_code || encounter.ticket_code || "Chưa được cấp"]);
  }
  const list = el("dl", "", "booking-review-list"); details(list, pairs); ui.review.append(list);
  if (patient?.health_insurance) ui.review.append(el("p", "Quyền lợi BHYT được đối chiếu khi tiếp nhận tại bệnh viện.", "booking-review-hint"));
  $("#booking-review-total").textContent = money(encounter?.deposit_amount_snapshot ?? doctor?.consultation_fee);
}
function currentPatientForm(context) {
  return active && context === registrationForm && context.version === pageVersion;
}
function normalizedPhone(value) {
  const phone = value.replace(/[\s.-]/g, "");
  return /^\+?84[35789]\d{8}$/.test(phone) ? `0${phone.replace(/^\+?84/, "")}` : phone;
}
function patientFieldError(context, input, label) {
  const value = input.value.trim();
  if (input.required && !value) return input.readOnly ? `Vui lòng nhờ chủ hồ sơ bổ sung ${label.toLocaleLowerCase("vi")}.` : `Vui lòng nhập ${label.toLocaleLowerCase("vi")}.`;
  if (input.name === "phone" && !/^\+?\d{9,15}$/.test(normalizedPhone(value))) return "Số điện thoại cần có từ 9 đến 15 chữ số.";
  if (!input.checkValidity()) {
    return ({ id_card: "CCCD / mã định danh phải gồm 9 hoặc 12 chữ số.", health_insurance: "Số thẻ BHYT phải gồm 10–15 chữ hoặc số.", dob: "Ngày sinh không hợp lệ hoặc ở tương lai." })[input.name] || `Vui lòng kiểm tra ${label.toLocaleLowerCase("vi")}.`;
  }
  return "";
}
function validatePatientForm(context = registrationForm, focus = true) {
  if (!context) return false;
  context.validationShown = true;
  let first;
  for (const control of context.controls) {
    const message = patientFieldError(context, control.input, control.label);
    control.error.textContent = message; control.error.hidden = !message;
    control.input.setAttribute("aria-invalid", String(Boolean(message)));
    if (message && !first) first = control;
  }
  if (first) {
    ui.dialogStatus.textContent = `Chưa thể thanh toán. ${first.error.textContent}`;
    if (focus) {
      first.input.scrollIntoView({ block: "center", behavior: "auto" });
      first.input.focus({ preventScroll: true });
    }
    return false;
  }
  if (ui.dialogStatus.textContent.startsWith("Chưa thể thanh toán.")) ui.dialogStatus.textContent = "";
  return true;
}
function clearRegistrationForm() {
  registrationForm = undefined;
}
function registrationValues(context) {
  return Object.fromEntries(context.controls.filter(({ input }) => input.name !== "symptoms").map(({ input }) =>
    [input.name, (input.name === "phone" ? normalizedPhone(input.value.trim()) : input.value.trim()) || null]));
}
function saveRegistrationDraft(context = registrationForm) {
  if (!context || !currentPatientForm(context) || !context.editable) return;
  if (!draft) return;
  draft.registration_details = registrationValues(context);
  draft.symptoms = context.form.elements.namedItem("symptoms").value.trim();
  if (reviewRequest) Object.assign(reviewRequest, draftRequest(draft));
  try {
    saveDraft(draft, draftKey);
    context.status.textContent = "Thông tin đang nhập được giữ tạm cho lần đặt khám này.";
  } catch { context.status.textContent = "Trình duyệt không lưu được bản nhập tạm. Hãy giữ trang mở và thử lại."; }
}
async function saveRegistration(context = registrationForm) {
  if (!context || !currentPatientForm(context)) return;
  saveRegistrationDraft(context);
  if (!encounter || !context.editable) return;
  const registration_details = registrationValues(context);
  const symptoms = context.form.elements.namedItem("symptoms").value.trim();
  context.status.textContent = "Đang lưu thông tin đăng ký…";
  const result = await updateRegistration(encounter.encounter_id, { registration_details, symptoms });
  if (!currentPatientForm(context) || !hasSession()) return;
  if (result.encounter?.encounter_id !== encounter.encounter_id) throw new Error("Chưa nhận được thông tin đăng ký từ hệ thống.");
  encounter = result.encounter;
  if (draft) {
    draft.registration_details = encounter.registration_details;
    draft.symptoms = encounter.symptoms;
    saveDraft(draft, draftKey);
  }
  context.status.textContent = "Đã lưu thông tin đăng ký của lần khám này.";
}
function rememberEncounter() {
  requestedEncounterId = encounter.encounter_id;
  if (!draft) {
    draft = { user_id: actor.user_id, patient_id: encounter.patient_id, doctor_profile_id: encounter.doctor_profile_id,
      schedule_id: encounter.schedule_id, registration_details: encounter.registration_details, symptoms: encounter.symptoms };
    draftKey = saveDraft(draft);
  }
  const url = new URL(location.href);
  url.searchParams.set("encounter", encounter.encounter_id);
  url.searchParams.set("draft", draftKey);
  history.replaceState(null, "", url);
  if (draft) { draft.encounter_id = encounter.encounter_id; draft.uncertain = false; saveDraft(draft, draftKey); }
}
function showBooking() {
  if (!active) return;
  rememberEncounter();
  const status = encounter.encounter_status;
  const confirmed = ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(status);
  $("#booking-dialog-title").textContent = confirmed ? "Thông tin lịch khám" : status === "HOLDING" ? "Hoàn tất đăng ký khám" : "Trạng thái lịch khám";
  ui.confirm.hidden = status !== "HOLDING" && !confirmed;
  ui.confirm.textContent = confirmed ? "Xem thanh toán →" : "Thanh toán →";
  $("#booking-confirm-note").hidden = status !== "HOLDING";
  ui.refresh.hidden = false; ui.cancel.hidden = status !== "HOLDING";
  renderReview();
  ui.dialogStatus.textContent = confirmed ? "Lịch khám đã được hệ thống xác nhận. "+checkInInstruction(encounter)
    : status === "HOLDING" ? "Thanh toán trước khi giữ chỗ hết hạn để được cấp phiếu khám."
      : "Lượt khám này không còn giữ chỗ. Bạn có thể quay lại và chọn lịch mới.";
}
async function readBooking(id) {
  const version = pageVersion;
  const result = await getEncounter(id);
  const payments = await allPages((params, options) => listEncounterPayments(id, params, options));
  let fetchedTicket;
  if (result.encounter.ticket_code) fetchedTicket = (await getTicket(id)).ticket;
  if (!active || version !== pageVersion || !hasSession()) return;
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
  if (draft) { draft.uncertain = false; saveDraft(draft, draftKey); }
  ui.confirm.disabled = false; ui.refresh.hidden = true;
  ui.dialogStatus.textContent = "Hệ thống chưa có lượt khám khớp thông tin này. Bạn có thể bấm xác nhận để gửi lại.";
}
async function refreshBooking(id = encounter?.encounter_id || requestedEncounterId) {
  if (busy) return;
  if (id) requestedEncounterId = id;
  const version = pageVersion;
  busyDialog(true);
  ui.dialogStatus.textContent = "Đang cập nhật trạng thái từ hệ thống…";
  try {
    saveRegistrationDraft();
    if (!active || version !== pageVersion || !hasSession()) return;
    if (id) await readBooking(id);
    else if (submissionUncertain) await recoverSubmission();
    else throw new Error("Chưa có lượt khám để cập nhật.");
  } catch (error) { if (active && version === pageVersion) { ui.dialogStatus.textContent = errorMessage(error); ui.refresh.hidden = false; } }
  finally { if (active && version === pageVersion) { busyDialog(false); if (submissionUncertain) ui.confirm.disabled = true; } }
}
function openPayment() {
  const url = new URL("payment.html", location.href);
  if (draftKey) url.searchParams.set("draft", draftKey);
  if (encounter) url.searchParams.set("encounter", encounter.encounter_id);
  location.assign(url.href);
}
async function ensureSelfPatient(version) {
  if (!selfPreview()) return;
  const form = new FormData();
  for (const [key, value] of Object.entries(draft.registration_details || {})) {
    if (value != null) form.set(key, value);
  }
  form.set("relationship", "SELF");
  ui.dialogStatus.textContent = "Đang lưu hồ sơ người khám…";
  const result = await createPatient(patientPayload(form));
  if (!active || version !== pageVersion || !hasSession()) return;
  const patient = result?.patient;
  if (!Number.isSafeInteger(patient?.patient_id) || patient.patient_id <= 0) throw new Error("Hệ thống chưa trả về mã hồ sơ người khám hợp lệ.");
  draft.patient_id = patient.patient_id;
  if (!patients.some(row => row.patient_id === patient.patient_id)) patients.push(patient);
  reviewRequest = draftRequest(draft);
  saveDraft(draft, draftKey);
}
ui.confirm.addEventListener("click", async () => {
  if (busy || !active || !hasSession()) return;
  if (encounter && ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(encounter.encounter_status)) { openPayment(); return; }
  if (submissionUncertain || (!encounter && !reviewRequest && !selfPreview()) || (encounter && encounter.encounter_status !== "HOLDING")) return;
  if (!validatePatientForm()) return;
  busyDialog(true);
  const version = pageVersion;
  try {
    await saveRegistration();
    if (active && version === pageVersion && hasSession()) await ensureSelfPatient(version);
  } catch (error) {
    if (active && version === pageVersion) ui.dialogStatus.textContent = `Chưa lưu được thông tin đăng ký. ${errorMessage(error)}`;
    busyDialog(false);
    return;
  }
  if (!active || version !== pageVersion || !hasSession()) { busyDialog(false); return; }
  ui.dialogStatus.textContent = "Đang gửi yêu cầu giữ chỗ…";
  try {
    if (!encounter) {
      draft.uncertain = true; saveDraft(draft, draftKey);
      const result = await createOnline(reviewRequest);
      encounter = result.encounter;
      rememberEncounter();

    }
    await readBooking(encounter.encounter_id);
    if (encounter.encounter_status === "HOLDING") {
      if (payment?.transaction_status !== "PENDING") await createIntent(encounter.encounter_id, { payment_method: "BANK" });
      await readBooking(encounter.encounter_id);
      if (active && version === pageVersion && hasSession()) openPayment();
    }
  } catch (error) {
    ui.dialogStatus.textContent = errorMessage(error);
    if (encounter) {
      ui.confirm.hidden = true; ui.refresh.hidden = false;
      ui.dialogStatus.textContent += " Lượt khám đã được tạo; bấm cập nhật trạng thái để tiếp tục.";
    } else if (error.status === 0 || error.status >= 500 || error.code === "DUPLICATE_ENCOUNTER") {
      submissionUncertain = true; ui.refresh.hidden = false;
      ui.dialogStatus.textContent += " Bấm cập nhật trạng thái để kiểm tra yêu cầu trước khi gửi lại.";
    } else if (error.status === 409 || error.code === "SCHEDULE_NOT_FOUND") {
      ui.confirm.hidden = true;
      ui.dialogStatus.textContent += " Hãy quay lại và chọn khung giờ khác.";

    }
    if (!encounter && !submissionUncertain && draft) { draft.uncertain = false; saveDraft(draft, draftKey); }
  } finally { busyDialog(false); if (submissionUncertain) ui.confirm.disabled = true; }
});
ui.cancel.addEventListener("click", async () => {
  if (busy || encounter?.encounter_status !== "HOLDING") return;
  const version = pageVersion;
  busyDialog(true);
  try {
    saveRegistrationDraft();
    if (!active || version !== pageVersion || !hasSession()) return;
    await cancel(encounter.encounter_id, { reason: "Người đặt khám hủy giữ chỗ trên giao diện" });
    await readBooking(encounter.encounter_id);
  } catch (error) { if (active && version === pageVersion) ui.dialogStatus.textContent = errorMessage(error); }
  finally { if (active && version === pageVersion) busyDialog(false); }
});
ui.refresh.addEventListener("click", () => refreshBooking());
async function leaveReview(destination) {
  if (busy) return;
  busyDialog(true);
  const version = pageVersion;
  try {
    saveRegistrationDraft();
    if (active && version === pageVersion && hasSession()) location.assign(destination);
  } catch (error) {
    if (active && version === pageVersion) ui.dialogStatus.textContent = `Chưa lưu được thông tin người khám. ${errorMessage(error)}`;
  } finally { busyDialog(false); }
}
$("#booking-back").addEventListener("click", () => leaveReview(backUrl()));
document.addEventListener?.("click", event => {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest?.("a[href]");
  if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
  const destination = new URL(link.href, location.href), current = new URL(location.href);
  if (destination.origin !== current.origin || (destination.pathname === current.pathname && destination.search === current.search)) return;
  event.preventDefault();
  leaveReview(destination.href);
}, true);
window.addEventListener("pagehide", () => {
  clearRegistrationForm();
  active = false; pageVersion++; ui.dialog.hidden = true;
});

async function start() {
  clearRegistrationForm();
  busy = false;
  active = true;
  const version = ++pageVersion;
  const auth = $("#booking-auth-status");
  auth.hidden = false; auth.querySelector("button").hidden = true;
  ui.dialog.hidden = true;
  try {
    if (!await verifySession()) { location.replace(loginUrl(new URL(location.href)).href); return; }
    actor = (await getMe()).user;
    if (version !== pageVersion) return;
    draft = readDraft(draftKey, actor.user_id);
    const queryId = new URLSearchParams(location.search).get("encounter");
    requestedEncounterId = queryId && /^[1-9]\d*$/.test(queryId) ? Number(queryId) : draft?.encounter_id;
    if (!draft && !requestedEncounterId) throw new Error("Chưa có thông tin để xem lại hoặc thông tin đã hết hạn. Vui lòng quay lại chọn lịch khám.");
    [doctors, patients] = await Promise.all([allPages(listDoctors, {}, { auth: false }), allPages(listPatients)]);
    if (version !== pageVersion) return;
    if (requestedEncounterId) await readBooking(requestedEncounterId);
    else {
      reviewRequest = selfPreview() ? null : draftRequest(draft);
      selectedDoctor = doctors.find(d => String(d.doctor_profile_id) === String(draft.doctor_profile_id));
      if (!selectedPatient() || !selectedDoctor) throw new Error("Hồ sơ hoặc bác sĩ không còn khả dụng. Vui lòng quay lại chọn lịch.");
      const rows = await allPages((params, options) => listDoctorSchedules(draft.doctor_profile_id, params, options), { from_date: draft.work_date, to_date: draft.work_date });
      if (version !== pageVersion) return;
      const schedule = availableSchedules(rows).find(s => String(s.schedule_id) === String(draft.schedule_id));
      const slot = schedule?.slots.find(s => s.appointment_time === draft.appointment_time);
      // An uncertain POST must be reconciled even if its slot is now unavailable.
      submissionUncertain = Boolean(draft.uncertain);
      if (submissionUncertain) await recoverSubmission();
      if (!encounter) {
        if (!slot) throw new Error("Khung giờ đã hết chỗ hoặc không còn nhận đặt online. Vui lòng quay lại chọn lịch khác.");
        selectedSlot = { schedule, slot };
        renderReview(); ui.confirm.hidden = false;
        if (selfPreview()) {
          ui.confirm.textContent = "Thanh toán →";
          $("#booking-confirm-note").textContent = "Vui lòng kiểm tra thông tin người khám trước khi thanh toán.";
        }
      }
    }
    if (version !== pageVersion || !hasSession()) return;
    ui.dialog.hidden = false; auth.hidden = true;
    document.body.classList.remove("auth-pending");
  } catch (error) {
    if (version !== pageVersion) return;
    auth.querySelector("p").textContent = errorMessage(error);
    auth.querySelector("button").hidden = false;
  }
}
$("#booking-auth-status button").addEventListener("click", start);
window.addEventListener("neu:auth-change", () => {
  clearRegistrationForm();
  active = false; pageVersion++; ui.dialog.hidden = true;
  if (!hasSession()) location.replace(loginUrl(new URL(location.href)).href);
});
window.addEventListener("pageshow", event => { if (event.persisted) start(); });
start();
