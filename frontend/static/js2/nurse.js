// Presentation only: filter existing HTML and open read-only details.
const searchInput = document.querySelector("#patient-search");
const shiftFilter = document.querySelector("#shift-filter");
const statusFilter = document.querySelector("#status-filter");
const rows = [...document.querySelectorAll("#patient-list tr")];
let activeShift = "";
const assignmentSection = document.querySelector("#assignments");
const patientSection = document.querySelector("#patients");
document.querySelectorAll("[data-show-shift]").forEach((button) => {
  button.textContent = button.dataset.showShift === "morning" ? "Vào phòng 201 · Ca sáng" : "Vào phòng 202 · Ca chiều";
});

function normalizeText(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d").toLowerCase().trim();
}

function filterPatients() {
  const keyword = normalizeText(searchInput.value);
  let count = 0;
  rows.forEach((row) => {
    const matches = normalizeText(`${row.cells[0].textContent} ${row.cells[1].textContent}`).includes(keyword)
      && row.dataset.shift === activeShift
      && (!statusFilter.value || row.dataset.status === statusFilter.value);
    row.hidden = !matches;
    if (matches) count += 1;
  });
  document.querySelector("#search-result").textContent = count
    ? `Hiển thị ${count} lượt khám minh họa.` : "Không tìm thấy lượt khám phù hợp.";
  document.querySelector("#no-results").hidden = count !== 0;
}
searchInput.addEventListener("input", filterPatients);
shiftFilter.addEventListener("change", filterPatients);
statusFilter.addEventListener("change", filterPatients);
document.querySelector("#reset-filters").addEventListener("click", () => {
  searchInput.value = "";
  shiftFilter.value = activeShift;
  statusFilter.value = "";
  filterPatients();
  searchInput.focus();
});
document.querySelectorAll("[data-show-shift]").forEach((button) => {
  button.addEventListener("click", () => {
    searchInput.value = "";
    statusFilter.value = "";
    activeShift = button.dataset.showShift;
    shiftFilter.value = activeShift;
    assignmentSection.hidden = true;
    patientSection.hidden = false;
    document.querySelector("#selected-room").textContent = activeShift === "morning"
      ? "PHÒNG 201 / CA SÁNG 08:00 – 11:30 / BÁC SĨ MINH HỌA A"
      : "PHÒNG 202 / CA CHIỀU 13:30 – 17:00 / BÁC SĨ MINH HỌA B";
    filterPatients();
    document.querySelector("#patients").scrollIntoView({ block: "start" });
    document.querySelector("#patients-title").focus({ preventScroll: true });
  });
});
document.querySelector("#back-to-rooms").addEventListener("click", () => {
  patientSection.hidden = true;
  assignmentSection.hidden = false;
  const previousShift = activeShift;
  activeShift = "";
  filterPatients();
  document.querySelector(`[data-show-shift="${previousShift || "morning"}"]`).focus();
});
document.querySelector('.sidebar a[href="#assignments"]').addEventListener("click", () => {
  document.querySelector("#back-to-rooms").click();
});
filterPatients();

const dialog = document.querySelector("#patient-dialog");
const details = document.querySelector("#patient-details");
document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());
rows.forEach((row) => {
  row.querySelector(".detail-button").addEventListener("click", () => {
    details.replaceChildren();
    const labels = ["Mã phiếu", "Bệnh nhân", "Khung giờ", "Phòng khám", "Trạng thái"];
    const entries = labels.map((label, index) => [label, row.cells[index].textContent.trim()]);
    entries.push(["Bác sĩ phụ trách", row.dataset.shift === "morning" ? "Bác sĩ minh họa A" : "Bác sĩ minh họa B"]);
    entries.push(["Chuyên khoa", "Nội tổng quát"], ["Triệu chứng / thông tin liên quan", "Chưa có dữ liệu thật"]);
    entries.forEach(([label, value]) => {
      const group = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = label;
      description.textContent = value;
      group.append(term, description);
      details.append(group);
    });
    dialog.showModal();
  });
});

const navLinks = document.querySelectorAll(".sidebar nav a");
const observer = new IntersectionObserver((entries) => {
  const visible = entries.find((entry) => entry.isIntersecting);
  if (!visible) return;
  navLinks.forEach((link) => {
    if (link.hash === `#${visible.target.id}`) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}, { rootMargin: "-10% 0px -60% 0px" });
document.querySelectorAll("main section[id]").forEach((section) => observer.observe(section));

// Hidden room views must be entered through a room card first.
document.querySelectorAll('.sidebar nav a').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.hash);
    if (target?.hidden) {
      event.preventDefault();
      document.querySelector('#assignments').hidden = false;
      document.querySelector('#assignments').scrollIntoView({ block: 'start' });
      document.querySelector('[data-show-shift]').focus({ preventScroll: true });
    }
  });
});
