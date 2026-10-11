const appointmentForm = document.querySelector("#appointment-form");
const appointmentCards = [...document.querySelectorAll("[data-booking-id]")];
const appointmentSearch = document.querySelector("#appointment-search");
const appointmentDepartment = document.querySelector("#appointment-department");
const appointmentDate = document.querySelector("#appointment-date");
const appointmentShift = document.querySelector("#appointment-shift");
const appointmentName = { value: "Tài khoản mẫu" };
const scheduleFrom = document.querySelector("#schedule-from"),
  scheduleTo = document.querySelector("#schedule-to");
const schedulePanel = document.querySelector("#chosen-schedule");
const insuranceDialog = document.querySelector("#insurance-dialog");
let selectedAppointmentDoctor = null,
  selectedTime = "",
  insurancePreviewData = null;
const bookingNormalize = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
const dateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Saigon",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).formatToParts(new Date());
const part = (type) => dateParts.find((p) => p.type === type).value;
const today = `${part("year")}-${part("month")}-${part("day")}`;
appointmentDate.min = today;
scheduleFrom.min = today;
scheduleTo.min = today;
// Preview duration configuration per specialty; not a backend scheduling rule.
const specialtyMinutes = { 0: 30, 1: 30, 2: 15, 3: 30, 4: 30, 5: 15, 6: 15, 7: 15 };
const mockSchedules = new Map();
for (const card of appointmentCards) {
  const dates = [];
  for (let offset = 1; offset <= 60; offset++)
    if (offset % 7 === (Number(card.dataset.bookingId) - 1) % 7) {
      const date = new Date(`${today}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + offset);
      dates.push(date.toISOString().slice(0, 10));
    }
  mockSchedules.set(card.dataset.bookingId, dates);
}
const slotsHost = document.createElement("div");
slotsHost.className = "booking-time-slots";
schedulePanel.append(slotsHost);
const facility = document.createElement("div");
facility.className = "booking-facility";
facility.textContent = "Cơ sở: NEU Medical — 207 Giải Phóng, phường Bạch Mai, Hà Nội. ";
schedulePanel.insertBefore(facility, slotsHost);
function inRange(date) {
  return (
    (!scheduleFrom.value || date >= scheduleFrom.value) &&
    (!scheduleTo.value || date <= scheduleTo.value)
  );
}
function renderSlots() {
  selectedTime = "";
  slotsHost.replaceChildren();
  appointmentShift.value = "";
  if (!selectedAppointmentDoctor || !appointmentDate.value) {
    updateAppointmentSummary();
    return;
  }
  const minutes = specialtyMinutes[selectedAppointmentDoctor.dataset.khoa];

  for (const [label, start, end] of [
    ["Sáng", 480, 720],
    ["Chiều", 810, 1020],
  ]) {
    const heading = document.createElement("h3");
    heading.textContent = label;
    const grid = document.createElement("div");
    grid.className = "time-slot-grid";
    for (let time = start; time + minutes <= end; time += minutes) {
      const value = `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`;
      const button = document.createElement("button");
      button.type = "button";
      const finish = time + minutes;
      const endValue = `${String(Math.floor(finish / 60)).padStart(2, "0")}:${String(finish % 60).padStart(2, "0")}`;
      button.textContent = `${value}–${endValue}`;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        selectedTime = `${value}–${endValue}`;
        appointmentShift.value = label === "Sáng" ? "Ca sáng" : "Ca chiều";
        slotsHost.querySelectorAll("button").forEach((item) => {
          const active = item === button;
          item.classList.toggle("selected", active);
          item.setAttribute("aria-pressed", String(active));
        });
        updateAppointmentSummary();
      });
      grid.append(button);
    }
    slotsHost.append(heading, grid);
  }
  updateAppointmentSummary();
}
function populateSchedules() {
  appointmentDate.replaceChildren(new Option("Chọn ngày khám", ""));
  const dayButtons = document.querySelector("#appointment-day-buttons");
  dayButtons.replaceChildren();
  selectedTime = "";
  appointmentShift.value = "";
  slotsHost.replaceChildren();
  schedulePanel.hidden = !selectedAppointmentDoctor;
  if (!selectedAppointmentDoctor) {
    updateAppointmentSummary();
    return;
  }
  const dates = mockSchedules.get(selectedAppointmentDoctor.dataset.bookingId).filter(inRange);
  for (const date of dates) {
    appointmentDate.add(new Option(date.split("-").reverse().join("/"), date));
    const button = document.createElement("button");
    button.type = "button";
    const weekday = document.createElement("strong");
    weekday.textContent = new Intl.DateTimeFormat("vi-VN", {
      weekday: "short",
      timeZone: "Asia/Saigon",
    }).format(new Date(`${date}T12:00:00+07:00`));
    const label = document.createElement("span");
    label.textContent = date.slice(8, 10) + "-" + date.slice(5, 7);
    button.append(weekday, label);
    button.dataset.date = date;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      appointmentDate.value = date;
      markDay();
      renderSlots();
    });
    dayButtons.append(button);
  }
  function markDay() {
    dayButtons.querySelectorAll("button").forEach((button) => {
      const active = button.dataset.date === appointmentDate.value;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  appointmentDate.value = dates[0] || "";
  markDay();
  renderSlots();
}
function selectAppointmentDoctor(card) {
  if (selectedAppointmentDoctor === card && !schedulePanel.hidden) {
    schedulePanel.hidden = true;
    card.querySelector("[data-select-doctor]").textContent = "Xem lịch";
    return;
  }
  selectedAppointmentDoctor = card;
  card.append(schedulePanel);
  populateSchedules();
  appointmentCards.forEach((item) => {
    const active = item === card;
    item.classList.toggle("selected", active);
    const b = item.querySelector("[data-select-doctor]");
    b.textContent = active ? "Ẩn lịch" : "Chọn";
    b.setAttribute("aria-pressed", String(active));
  });
}
function filterAppointmentDoctors() {
  const invalid = scheduleFrom.value && scheduleTo.value && scheduleFrom.value > scheduleTo.value;
  document.querySelector("#schedule-range-error").textContent = invalid
    ? "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu."
    : "";
  let count = 0;
  appointmentCards.forEach((card) => {
    card.hidden =
      Boolean(invalid) ||
      !(
        bookingNormalize(card.dataset.name).includes(bookingNormalize(appointmentSearch.value)) &&
        (!appointmentDepartment.value || card.dataset.khoa === appointmentDepartment.value) &&
        mockSchedules.get(card.dataset.bookingId).some(inRange)
      );
    if (!card.hidden) count++;
  });
  if (selectedAppointmentDoctor?.hidden) {
    selectedAppointmentDoctor = null;
    schedulePanel.hidden = true;
    appointmentDate.value = "";
    selectedTime = "";
    appointmentCards.forEach((card) => {
      card.classList.remove("selected");
      const b = card.querySelector("[data-select-doctor]");
      b.textContent = "Chọn";
      b.setAttribute("aria-pressed", "false");
    });
  }
  document.querySelector("#appointment-count").textContent = `${count} bác sĩ phù hợp`;
  document.querySelector("#appointment-empty").hidden = count !== 0;
  updateAppointmentSummary();
}
function updateAppointmentSummary() {
  document.querySelector("#appointment-status").textContent = "";
  const complete = selectedAppointmentDoctor && appointmentDate.value && selectedTime;
  document.querySelector("#appointment-summary-empty").hidden = Boolean(complete);
  document.querySelector("#appointment-summary-content").hidden = !complete;
  if (!complete) return;
  const entries = [
    [
      "Người tới khám",
      appointmentName.value.trim() ||
        document.querySelector("#appointment-patient").selectedOptions[0].textContent,
    ],
    ["Bác sĩ", selectedAppointmentDoctor.dataset.name],
    [
      "Chuyên khoa",
      selectedAppointmentDoctor
        .querySelector(".booking-doctor-info p")
        .textContent.replace("Chuyên khoa: ", ""),
    ],
    ["Cơ sở", "NEU Medical — 207 Giải Phóng"],
    ["Ngày khám", appointmentDate.value.split("-").reverse().join("/")],
    ["Giờ khám", selectedTime],
    ["Ca khám", appointmentShift.value],
    ["Giá khám", "Đang cập nhật"],
  ];
  document.querySelector("#summary-doctor-photo").src =
    selectedAppointmentDoctor.querySelector("img").src;
  document.querySelector("#summary-doctor-name").textContent =
    selectedAppointmentDoctor.dataset.name;
  document.querySelector("#summary-doctor-specialty").textContent =
    selectedAppointmentDoctor.querySelector(".booking-doctor-info p").textContent;
  const list = document.querySelector("#appointment-summary-list");
  list.replaceChildren();
  entries.forEach(([label, value]) => {
    const dt = document.createElement("dt"),
      dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    list.append(dt, dd);
  });
}
appointmentCards.forEach((card) =>
  card
    .querySelector("[data-select-doctor]")
    .addEventListener("click", () => selectAppointmentDoctor(card)),
);
appointmentSearch.addEventListener("input", filterAppointmentDoctors);
appointmentDepartment.addEventListener("change", filterAppointmentDoctors);
for (const input of [scheduleFrom, scheduleTo])
  input.addEventListener("change", () => {
    filterAppointmentDoctors();
    populateSchedules();
  });
appointmentDate.addEventListener("change", renderSlots);
document.querySelectorAll("[data-booking-mode]").forEach((button) =>
  button.addEventListener("click", () => {
    const byDepartment = button.dataset.bookingMode === "department";
    document.querySelector("#appointment-department-field").hidden = !byDepartment;
    document.querySelectorAll("[data-booking-mode]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("selected", active);
      item.setAttribute("aria-pressed", String(active));
    });
    if (!byDepartment) appointmentDepartment.value = "";
    filterAppointmentDoctors();
  }),
);
appointmentForm.addEventListener("input", () => {
  updateAppointmentSummary();
});
appointmentForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!appointmentForm.reportValidity() || !selectedTime) return;
  if (
    appointmentForm.querySelector('input[name="insurance"]:checked').value === "yes" &&
    !insurancePreviewData
  ) {
    openInsuranceDialog();
    return;
  }
  document.querySelector("#appointment-status").textContent =
    "Đã xem lại thông tin mẫu. Chưa gửi yêu cầu, giữ chỗ hoặc thanh toán.";
});
filterAppointmentDoctors();
const initialDoctor = new URLSearchParams(location.search).get("doctor");
const initialCard = appointmentCards.find((card) => card.dataset.bookingId === initialDoctor);
if (initialCard) selectAppointmentDoctor(initialCard);

const relativeDialog = document.querySelector("#relative-dialog");
const relativeForm = document.querySelector("#relative-form");
const previewRelatives = new Map();
document.querySelector("#relative-dob").max = appointmentDate.min;
document.querySelector("#add-relative").addEventListener("click", () => relativeDialog.showModal());
document.querySelector("#relative-close").addEventListener("click", () => relativeDialog.close());
relativeForm.addEventListener("input", () =>
  document.querySelector("#relative-name").setCustomValidity(""),
);
relativeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const nameField = document.querySelector("#relative-name");
  nameField.setCustomValidity(nameField.value.trim() ? "" : "Vui lòng nhập họ tên.");
  if (!relativeForm.reportValidity()) return;
  const values = Object.fromEntries(new FormData(relativeForm));
  values.full_name = values.full_name.trim();
  const id = `relative-${previewRelatives.size + 1}`;
  previewRelatives.set(id, values);
  const option = document.createElement("option");
  option.value = id;
  option.textContent = `${values.full_name} (người thân)`;
  const patientSelect = document.querySelector("#appointment-patient");
  patientSelect.append(option);
  patientSelect.value = id;
  applyPreviewPatient();
  relativeDialog.close();
  relativeForm.reset();
  document.querySelector("#relative-status").textContent = "Đã thêm vào danh sách tạm.";
  patientSelect.focus();
});
function applyPreviewPatient() {
  const relative = previewRelatives.get(document.querySelector("#appointment-patient").value);
  appointmentName.value = relative ? relative.full_name : "Tài khoản mẫu";
  const code = document.querySelector("#appointment-insurance-code");
  code.value = relative ? relative.health_insurance : "";
  const hasInsurance = Boolean(code.value);
  appointmentForm.querySelector(
    `input[name="insurance"][value="${hasInsurance ? "yes" : "no"}"]`,
  ).checked = true;
  code.required = false;
  insurancePreviewData = null;
  document.querySelector("#insurance-field").hidden = !hasInsurance;

  updateAppointmentSummary();
}
document.querySelector("#appointment-patient").addEventListener("change", applyPreviewPatient);

const insuranceForm = document.querySelector("#insurance-form");
const insuranceDocument = document.querySelector("#insurance-document");
document.querySelector("#insurance-dob").max = today;
function openInsuranceDialog() {
  document.querySelector("#insurance-full-name").value = appointmentName.value;
  const person = previewRelatives.get(document.querySelector("#appointment-patient").value);
  document.querySelector("#insurance-dob").value = person?.dob || "";
  document.querySelector("#insurance-gender").value = person?.gender || "";
  insuranceDialog.showModal();
}
insuranceForm.querySelectorAll('input[name="document-method"]').forEach((input) =>
  input.addEventListener("change", () => {
    const cccd = input.value === "cccd";
    document.querySelector("#insurance-document-label").textContent = cccd
      ? "Số CCCD *"
      : "Mã thẻ BHYT *";
    insuranceDocument.pattern = cccd ? "(?:[0-9]{9}|[0-9]{12})" : "[A-Za-z0-9]{10,15}";
    insuranceDocument.maxLength = cccd ? 12 : 15;
    insuranceDocument.inputMode = cccd ? "numeric" : "text";
    insuranceDocument.title = cccd ? "Nhập 9 hoặc 12 chữ số" : "Nhập 10–15 chữ hoặc số";
    insuranceDocument.value = "";
  }),
);
appointmentForm.querySelectorAll('input[name="insurance"]').forEach((input) =>
  input.addEventListener("change", () => {
    const enabled = input.value === "yes";
    document.querySelector("#insurance-field").hidden = !enabled;
    if (enabled) openInsuranceDialog();
    else {
      insurancePreviewData = null;
      document.querySelector("#appointment-insurance-code").value = "";
      document.querySelector("#insurance-local-status").textContent = "";
    }
  }),
);
document.querySelector("#edit-insurance").addEventListener("click", openInsuranceDialog);
document.querySelector("#insurance-close").addEventListener("click", () => insuranceDialog.close());
insuranceForm.addEventListener("input", () =>
  document.querySelector("#insurance-full-name").setCustomValidity(""),
);
insuranceForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#insurance-full-name");
  name.setCustomValidity(name.value.trim() ? "" : "Vui lòng nhập họ tên.");
  if (!insuranceForm.reportValidity()) return;
  insurancePreviewData = {
    method: insuranceForm.querySelector('input[name="document-method"]:checked').value,
    document: insuranceDocument.value.trim(),
    full_name: name.value.trim(),
    dob: document.querySelector("#insurance-dob").value,
    gender: document.querySelector("#insurance-gender").value,
  };
  document.querySelector("#appointment-insurance-code").value =
    insurancePreviewData.method === "bhyt" ? insurancePreviewData.document : "";
  document.querySelector("#insurance-local-status").textContent = "Thông tin hợp lệ về định dạng.";
  insuranceDialog.close();
  updateAppointmentSummary();
});
