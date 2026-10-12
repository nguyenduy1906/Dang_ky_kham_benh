const doctorFilter = document.querySelector("#doctor-filter");
if (doctorFilter) {
  const search = document.querySelector("#doctor-search");
  const department = document.querySelector("#doctor-department");
  const normalize = (value) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .toLowerCase()
      .trim();
  function filterDoctors() {
    let count = 0;
    document.querySelectorAll(".doctor-profile").forEach((card) => {
      const matches =
        normalize(card.dataset.name).includes(normalize(search.value)) &&
        (!department.value || card.dataset.department === department.value);
      card.hidden = !matches;
      if (matches) count++;
    });
    document.querySelector("#doctor-result").textContent = `${count} bác sĩ minh họa`;
    document.querySelector("#doctor-empty").hidden = count !== 0;
  }
  const requestedDepartment = new URLSearchParams(location.search).get("department");
  if ([...department.options].some((option) => option.value === requestedDepartment))
    department.value = requestedDepartment;
  doctorFilter.addEventListener("submit", (event) => {
    event.preventDefault();
    filterDoctors();
  });
  department.addEventListener("change", filterDoctors);
  search.addEventListener("input", filterDoctors);
  filterDoctors();
  document.querySelectorAll("[data-doctor]").forEach((button) =>
    button.addEventListener("click", () => {
      document.querySelector("#dialog-title").textContent =
        `Bác sĩ ${button.dataset.doctor.padStart(2, "0")}`;
      const content = document.querySelector("#dialog-content");
      content.replaceChildren();
      const text = document.createElement("p");
      text.textContent = `Chuyên khoa: ${button.dataset.specialty}. Đây là hồ sơ minh họa, thông tin chuyên môn thực tế sẽ được bổ sung sau.`;
      const link = document.createElement("a");
      link.className = "solid-button";
      link.href = `../(patient)/portal.html?doctor=${button.dataset.doctor}`;
      link.textContent = "Xem giao diện đặt lịch";
      content.append(text, link);
      dialog.showModal();
    }),
  );
}
document.querySelectorAll("[data-news-filter]").forEach((button) =>
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-news-filter]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("selected", active);
      item.setAttribute("aria-pressed", String(active));
    });
    document
      .querySelectorAll("[data-news-category]")
      .forEach(
        (card) =>
          (card.hidden =
            button.dataset.newsFilter !== "all" &&
            card.dataset.newsCategory !== button.dataset.newsFilter),
      );
  }),
);
const bookingForm = document.querySelector("#booking-form");
if (bookingForm) {
  const doctor = document.querySelector("#booking-doctor");
  const department = document.querySelector("#booking-department");
  const date = document.querySelector("#booking-date");
  const today = new Date();
  date.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  function alignDepartment() {
    department.selectedIndex = Number(doctor.value) - 1;
  }
  const requestedDoctor = new URLSearchParams(location.search).get("doctor");
  if ([...doctor.options].some((option) => option.value === requestedDoctor))
    doctor.value = requestedDoctor;
  alignDepartment();
  doctor.addEventListener("change", alignDepartment);
  department.addEventListener("change", () => {
    const index = department.selectedIndex;
    [...doctor.options].forEach((option) => (option.hidden = Number(option.value) - 1 !== index));
    const match = [...doctor.options].find((option) => !option.hidden);
    doctor.value = match ? match.value : "";
    doctor.required = true;
  });
  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.querySelector("#patient-name");
    name.setCustomValidity(name.value.trim() ? "" : "Vui lòng nhập họ tên.");
    if (!bookingForm.reportValidity()) return;
    const values = new FormData(bookingForm);
    const entries = [
      ["Người được khám", values.get("patientName").trim()],
      ["Hồ sơ", values.get("relation")],
      ["Chuyên khoa", values.get("department")],
      ["Bác sĩ", doctor.selectedOptions[0].textContent],
      ["Ngày khám", values.get("date").split("-").reverse().join("/")],
      ["Ca khám", values.get("shift")],
      ["Lý do khám", values.get("symptoms") || "Chưa cung cấp"],
    ];
    const dl = document.createElement("dl");
    entries.forEach(([label, value]) => {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      dl.append(dt, dd);
    });
    document.querySelector("#summary-content").replaceChildren(dl);
    const summary = document.querySelector("#booking-summary");
    summary.hidden = false;
    summary.setAttribute("tabindex", "-1");
    summary.focus();
    summary.scrollIntoView({ block: "start" });
  });
  document
    .querySelector("#patient-name")
    .addEventListener("input", (event) => event.target.setCustomValidity(""));
  document.querySelector("#edit-booking").addEventListener("click", () => {
    document.querySelector("#booking-summary").hidden = true;
    document.querySelector("#patient-name").focus();
  });
}
