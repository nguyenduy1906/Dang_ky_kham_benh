import { listDoctors } from "../api/doctor.js";
import { listDepartments } from "../api/catalog.js";
import { listDoctorSchedules } from "../api/schedule.js";
import { listPatients, createPatient } from "../api/patient.js";
import { getMe } from "../api/auth.js";
import { verifySession, hasSession, clearSession, loginUrl } from "../core/session.js";
import { thumbnailUrl } from "../core/articles.js";
import { allPages, availableSchedules, money, clock, dateLabel, todayVN, patientPayload, enableDragScroll } from "../core/booking.js";
import { readDraft, saveDraft } from "../core/booking_draft.js";

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
  from: $("#schedule-from"), to: $("#schedule-to"), reviewSubmit: $("#appointment-review-submit"),
};
enableDragScroll(ui.days);
let doctors = [], departments = [], patients = [], schedules = [], selectedDoctor, selectedDate = "", selectedSlot, actor;
let loading = false, checking = false, scheduleVersion = 0, scheduleAbort;
const registrationEntries = new Map();
function errorMessage(error) {
  if (error.status === 401) {
    for (const dialog of document.querySelectorAll("dialog[open]")) dialog.close();
    clearSession();
    location.replace(loginUrl(new URL(location.href)).href);
    return "Phiên đăng nhập đã hết hạn.";
  }
  return error.message || "Không thể kết nối hệ thống. Vui lòng thử lại.";
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
const selectedPatient = () => ui.patients.value === "self" ? actor : patients.find(p => String(p.patient_id) === ui.patients.value);
function renderPatients(preferred = ui.patients.value) {
  const self = patients.find(p => p.relationship === "SELF" && String(p.user_id) === String(actor.user_id));
  const selfValue = self ? String(self.patient_id) : "self";
  const label = person => {
    const detail = person.dob ? dateLabel(person.dob) : person.phone;
    return `${person.full_name || "Thông tin tài khoản"}${detail ? ` — ${detail}` : ""}`;
  };
  ui.patients.replaceChildren(new Option(`${label(self || actor)} (Bản thân)`, selfValue));
  for (const p of patients) {
    if (p === self) continue;
    ui.patients.add(new Option(label(p), p.patient_id));
  }
  if (patients.some(p => String(p.patient_id) === String(preferred))) ui.patients.value = String(preferred);
  else ui.patients.value = selfValue;
  $("#relative-status").textContent = "";
  updateReviewState();
}
const normalize = value => value.toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
const specialtyImages = {
  "co xuong khop": "khoa_xuong_khop.png",
  "da lieu": "khoa_da_lieu.png",
  "mat": "khoa_mat.png",
  "nhi": "khoa_nhi.png",
  "noi tong quat": "khoa_moi_tong_quat.png",
  "rang ham mat": "khoa_rang_ham_mat.png",
  "san phu khoa": "khoa_phu_san.png",
  "tai mui hong": "khoa_tai_mui_hong.png",
  "than kinh": "khoa_than_kinh.png",
  "tim mach": "khoa_tim_mach.png",
};
function renderDepartments() {
  const term = normalize($("#department-search").value.trim());
  const holder = $("#booking-departments");
  const choices = [{ department_id: "", name: "Tất cả chuyên khoa" }, ...departments]
    .filter(department => normalize(department.name).includes(term));
  holder.replaceChildren(...choices.map(department => {
    const id = String(department.department_id);
    const button = el("button", "", "booking-department");
    button.type = "button";
    button.dataset.departmentId = id;
    button.setAttribute("aria-pressed", String(ui.departments.value === id));
    const label = el("span");
    const count = doctors.filter(doctor => !id || String(doctor.department_id) === id).length;
    label.append(el("strong", department.name), el("small", `${count} bác sĩ`));
    const icon = el("span", "", "booking-department-icon"); icon.setAttribute("aria-hidden", "true");
    const image = el("img");
    const specialtyImage = specialtyImages[normalize(department.name).trim()];
    image.src = specialtyImage ? `../../static/assets/medical_specialty/${specialtyImage}` : "../../static/assets/bieu_trung_neu.png";
    image.alt = ""; image.width = 40; image.height = 40;
    icon.append(image);
    button.append(icon, label);
    button.addEventListener("click", () => {
      ui.departments.value = id;
      holder.querySelectorAll("button").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
      renderDoctors();
    });
    return button;
  }));
  $("#department-empty").hidden = choices.length > 0;
}
function renderDoctors() {
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
    if (doctor.academic_degree) info.append(el("span", doctor.academic_degree));
    if (doctor.experience_years != null) info.append(el("span", `${doctor.experience_years} năm kinh nghiệm`));
    const profileUrl = `../public/doctor_detail.html?id=${encodeURIComponent(doctor.doctor_profile_id)}`;
    const profile = el("a", "Xem hồ sơ bác sĩ →", "booking-profile-link");
    profile.href = profileUrl;
    info.append(profile);
    const photoLink = el("a", "", "booking-portrait-link");
    photoLink.href = profileUrl;
    photoLink.setAttribute("aria-label", `Xem hồ sơ ${doctor.full_name}`);
    photoLink.append(portrait(doctor));
    const price = el("div", "", "booking-price");
    price.append(el("strong", money(doctor.consultation_fee)));
    const button = el("button", chosen ? "Bỏ chọn" : "Chọn", "solid-button");
    button.type = "button";
    button.setAttribute("aria-pressed", String(chosen));
    button.setAttribute("aria-expanded", String(chosen));
    if (chosen) button.setAttribute("aria-controls", "chosen-schedule");
    button.addEventListener("click", () => selectDoctor(doctor));
    card.append(photoLink, info, price, button);
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
  updateReviewState();
}
function clearDoctor() {
  scheduleVersion++;
  scheduleAbort?.abort();
  selectedDoctor = undefined;
  selectedDate = "";
  $("#appointment-date").value = "";
  schedules = [];
  ui.days.replaceChildren();
  ui.slots.replaceChildren();
  ui.days.scrollLeft = 0;
  clearSlot();
  ui.schedule.hidden = false;
  ui.scheduleStatus.textContent = "Chọn bác sĩ để xem lịch khám còn trống.";
  ui.slots.append(el("p", "Các khung giờ có thể đặt sẽ hiển thị sau khi chọn bác sĩ.", "field-note"));
  ui.schedule.setAttribute("aria-busy", "false");
}
async function selectDoctor(doctor, { scrollToDoctor = false } = {}) {
  if (selectedDoctor?.doctor_profile_id === doctor.doctor_profile_id) {
    clearDoctor();
    renderDoctors();
    ui.doctors.querySelector(`[data-booking-id="${doctor.doctor_profile_id}"] > button`).focus({ preventScroll: true });
    return;
  }
  selectedDoctor = doctor;
  selectedDate = "";
  ui.days.scrollLeft = 0;
  clearSlot();
  ui.schedule.hidden = false;
  renderDoctors();
  await loadSchedules();
  if (scrollToDoctor && selectedDoctor?.doctor_profile_id === doctor.doctor_profile_id && !ui.main.inert) {
    // Keep the calendar in the right column when opening a preselected doctor.
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (selectedDoctor?.doctor_profile_id === doctor.doctor_profile_id && !ui.main.inert) {
      ui.schedule.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }
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
    const count = schedules.filter(schedule => schedule.work_date === day).reduce((total, schedule) => total + schedule.slots.length, 0);
    button.append(el("small", `${count} khung giờ`));
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
    const shiftName = Number(schedule.start_time.slice(0, 2)) < 12 ? "Buổi sáng" : "Buổi chiều";
    group.append(el("h3", `${shiftName} (${schedule.start_time.slice(0, 5)}–${schedule.end_time.slice(0, 5)}) · ${schedule.room_name}`));
    const grid = el("div", "", "time-slot-grid");
    for (const slot of schedule.slots) {
      const key = `${schedule.schedule_id}/${slot.appointment_time}`;
      const active = selectedSlot?.key === key;
      const button = el("button", `${clock(slot.starts_at)}–${clock(slot.ends_at)}`, active ? "selected" : "");
      button.type = "button";
      button.setAttribute("aria-pressed", String(active));
      shift.add(new Option(button.textContent, key));
      button.append(el("small", active ? "Đang chọn" : "Còn trống"));
      button.addEventListener("click", () => { selectedSlot = { schedule, slot, key }; renderSlots(); updateReviewState(); });
      grid.append(button);
    }
    group.append(grid);
    ui.slots.append(group);
  }
  shift.value = selectedSlot?.key || "";
}
function updateReviewState() {
  ui.reviewSubmit.disabled = false;
  $("#booking-total-fee").textContent = selectedDoctor ? money(selectedDoctor.consultation_fee) : "Chưa chọn bác sĩ";
  $("#booking-selection-summary").textContent = selectedSlot
    ? `${selectedDoctor.full_name} · ${dateLabel(selectedSlot.schedule.work_date)} · ${clock(selectedSlot.slot.starts_at)}–${clock(selectedSlot.slot.ends_at)} · ${selectedSlot.schedule.room_name}`
    : (selectedDoctor ? `${selectedDoctor.full_name} · Vui lòng chọn khung giờ khám.` : "Bạn chưa chọn khung giờ khám.");
  $("#booking-selection-fee").textContent = selectedSlot ? `Phí khám: ${money(selectedDoctor.consultation_fee)}` : "";
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
    doctors = results[0].value; patients = results[1].value; departments = results[2].value.items; actor = results[3].value.user;
    ui.departments.replaceChildren(new Option("Tất cả chuyên khoa", ""));
    for (const department of results[2].value.items) ui.departments.add(new Option(department.name, department.department_id));
    renderPatients(); renderDepartments(); renderDoctors();
    ui.data.textContent = "";
    ui.patients.disabled = false;
    $("#add-relative").disabled = false;
    const query = new URLSearchParams(location.search);
    if (!query.get("doctor") && results[2].value.items.some(department => String(department.department_id) === query.get("department"))) {
      ui.departments.value = query.get("department");
      renderDepartments(); renderDoctors();
    }
    const key = query.get("draft"), draft = readDraft(key, actor.user_id);
    if (draft) { ui.from.value = draft.from_date || draft.work_date; ui.to.value = draft.to_date || ""; }
    const doctor = doctors.find(d => String(d.doctor_profile_id) === query.get("doctor"));
    if (doctor) {
      ui.departments.value = String(doctor.department_id);
      renderDepartments();
      await selectDoctor(doctor, { scrollToDoctor: !query.get("encounter") });
    }
    if (draft && doctor && String(draft.doctor_profile_id) === String(doctor.doctor_profile_id)) {
      if (draft.registration_details) registrationEntries.set(draft.patient_type === "SELF" ? "self" : draft.patient_id, draft.registration_details);
      renderPatients(draft.patient_id); $("#appointment-symptoms").value = draft.symptoms;
      const schedule = schedules.find(s => String(s.schedule_id) === String(draft.schedule_id));
      const slot = schedule?.slots.find(s => s.appointment_time === draft.appointment_time);
      if (slot) { selectedDate = schedule.work_date; selectedSlot = { schedule, slot, key: `${schedule.schedule_id}/${slot.appointment_time}` }; renderDays(); renderSlots(); updateReviewState(); }
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

ui.form.noValidate = true;
function clearBookingErrors() {
  if (ui.form.querySelector(".booking-validation-error")) $("#appointment-status").textContent = "";
  ui.form.querySelectorAll(".booking-validation-error").forEach(node => node.classList.remove("booking-validation-error"));
  ui.form.querySelectorAll('[aria-invalid="true"]').forEach(node => node.removeAttribute("aria-invalid"));
  ui.form.querySelectorAll(".booking-validation-message").forEach(node => node.remove());
}
function showBookingError(target, message, focusTarget = target) {
  clearBookingErrors();
  target.classList.add("booking-validation-error");
  target.setAttribute("aria-invalid", "true");
  const note = el("p", message, "booking-validation-message");
  note.setAttribute("role", "alert");
  target.append(note);
  $("#appointment-status").textContent = message;
  if (!focusTarget.matches("input, select, textarea, button, a")) focusTarget.tabIndex = -1;
  focusTarget.focus({ preventScroll: true });
  target.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
}
ui.form.addEventListener("input", clearBookingErrors);
ui.form.addEventListener("change", clearBookingErrors);
ui.form.addEventListener("click", event => {
  if (event.target.closest(".booking-doctor, .time-slot-grid button")) clearBookingErrors();
});
ui.form.addEventListener("submit", event => {
  event.preventDefault();
  if (loading) return;
  const patient = selectedPatient(), symptoms = $("#appointment-symptoms").value.trim();
  if (!selectedDoctor) { showBookingError($(".booking-doctors-step"), "Vui lòng chọn bác sĩ phụ trách.", $("#appointment-search")); return; }
  if (!selectedSlot) { showBookingError(ui.slots.closest(".booking-step"), "Vui lòng chọn khung giờ khám còn trống.", ui.slots.querySelector("button") || ui.slots); return; }
  if (!patient) { showBookingError(ui.patients.closest(".appointment-field"), "Vui lòng chọn người tới khám.", ui.patients); return; }
  if (!symptoms) { showBookingError($("#appointment-symptoms").closest(".appointment-field"), "Vui lòng mô tả vấn đề sức khỏe gặp phải.", $("#appointment-symptoms")); return; }
  const invalid = [...ui.form.elements].find(control => control.willValidate && !control.validity.valid);
  if (invalid) {
    const details = invalid.closest("details"); if (details) details.open = true;
    showBookingError(invalid.closest(".appointment-field, .booking-step") || ui.form, invalid.validationMessage, invalid);
    return;
  }
  clearBookingErrors();
  try {
    const selfPreview = ui.patients.value === "self";
    const registrationDetails = selfPreview
      ? registrationEntries.get("self") ?? Object.fromEntries(["full_name", "phone", "dob", "id_card", "gender", "address", "health_insurance"].map(key => [key, actor[key] ?? null]))
      : registrationEntries.get(patient.patient_id);
    const key = saveDraft({ user_id: actor.user_id, patient_id: patient.patient_id ?? null,
      ...(selfPreview ? { patient_type: "SELF" } : {}),
      doctor_profile_id: selectedDoctor.doctor_profile_id, schedule_id: selectedSlot.schedule.schedule_id,
      work_date: selectedSlot.schedule.work_date, from_date: ui.from.value, to_date: ui.to.value,
      appointment_time: selectedSlot.slot.appointment_time, symptoms, registration_details: registrationDetails });
    location.assign(`booking_review.html?draft=${encodeURIComponent(key)}`);
  } catch { $("#appointment-status").textContent = "Trình duyệt không cho phép lưu thông tin tạm. Vui lòng bật lưu trữ để tiếp tục."; }
});

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
    const { confirm_shared_phone, relationship, ...entry } = payload;
    registrationEntries.set(result.patient.patient_id, entry);
    patients = await allPages(listPatients); renderPatients(result.patient.patient_id);
    $("#relative-dialog").close(); $("#relative-status").textContent = "Đã thêm người khám để đặt lịch. Lễ tân sẽ đối chiếu khi người bệnh đến viện.";
  } catch (error) {
    status.textContent = errorMessage(error);
    if (error.code === "CONFIRM_SHARED_PHONE") $("#shared-phone-confirmation").hidden = false;
  } finally { delete form.dataset.busy; form.querySelectorAll("input,select,button").forEach(node => { node.disabled = false; }); }
});
$("#department-search").addEventListener("input", renderDepartments);
$("#booking-day-prev").addEventListener("click", () => ui.days.scrollBy({ left: -300, behavior: "smooth" }));
$("#booking-day-next").addEventListener("click", () => ui.days.scrollBy({ left: 300, behavior: "smooth" }));
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
  scheduleVersion++; scheduleAbort?.abort();
});
window.addEventListener("pageshow", event => { if (event.persisted) checkAccess(); });
const resumeId = new URLSearchParams(location.search).get("encounter");
if (resumeId && /^[1-9]\d*$/.test(resumeId)) location.replace(`booking_review.html?encounter=${resumeId}`);
else checkAccess();
