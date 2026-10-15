// Local presentation only. No API, session or persistent storage.
const search = document.querySelector("#search");
const typeFilter = document.querySelector("#type-filter");
const statusFilter = document.querySelector("#status-filter");
const rows = [...document.querySelectorAll("#encounter-list tr")];
let activeRoom = "";
const roomSection = document.querySelector("#coordination");
const encounterSection = document.querySelector("#encounters");
encounterSection.before(roomSection);
rows.forEach((row, index) => { row.dataset.room = index < 2 ? "201" : "202"; });
document.querySelectorAll("[data-room]").forEach((button) => {
  button.addEventListener("click", () => {
    activeRoom = button.dataset.room;
    search.value = ""; typeFilter.value = ""; statusFilter.value = "";
    roomSection.hidden = true;
    encounterSection.hidden = false;
    document.querySelector("#selected-room").textContent = `PHÒNG ${activeRoom} / CA SÁNG 08:00 – 11:30 / NỘI TỔNG QUÁT`;
    filterRows();
    document.querySelector("#encounters-title").focus();
  });
});
document.querySelector("#back-to-rooms").addEventListener("click", () => {
  encounterSection.hidden = true;
  roomSection.hidden = false;
  const previousRoom = activeRoom;
  activeRoom = "";
  filterRows();
  document.querySelector(`[data-room="${previousRoom || "201"}"]`).focus();
});
document.querySelector('.sidebar a[href="#coordination"]').addEventListener("click", () => {
  document.querySelector("#back-to-rooms").click();
});
function normalizeText(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d").toLowerCase().trim();
}
function filterRows() {
  let count = 0;
  const keyword = normalizeText(search.value);
  rows.forEach((row) => {
    const visible = normalizeText(`${row.cells[0].textContent} ${row.cells[1].textContent}`).includes(keyword)
      && row.dataset.room === activeRoom
      && (!typeFilter.value || row.dataset.type === typeFilter.value)
      && (!statusFilter.value || row.dataset.status === statusFilter.value);
    row.hidden = !visible;
    if (visible) count += 1;
  });
  document.querySelector("#search-result").textContent = count
    ? `Hiển thị ${count} lượt khám minh họa.` : "Không tìm thấy lượt khám phù hợp.";
  document.querySelector("#no-results").hidden = count !== 0;
}
search.addEventListener("input", filterRows);
typeFilter.addEventListener("change", filterRows);
statusFilter.addEventListener("change", filterRows);
document.querySelector("#reset-filters").addEventListener("click", () => {
  search.value = ""; typeFilter.value = ""; statusFilter.value = "";
  filterRows(); search.focus();
});
const dialog = document.querySelector("#preview-dialog");
function openPreview(title, entries, note = "") {
  document.querySelector("#dialog-title").textContent = title;
  const content = document.querySelector("#dialog-content");
  content.replaceChildren();
  const list = document.createElement("dl");
  list.className = "patient-details";
  entries.forEach(([label, value]) => {
    const group = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value.trim() || "Chưa cung cấp";
    group.append(term, description); list.append(group);
  });
  content.append(list);
  if (note) {
    const paragraph = document.createElement("p");
    paragraph.className = "scope-note";
    paragraph.textContent = note;
    content.append(paragraph);
  }
  dialog.showModal();
}
document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());
rows.forEach((row) => {
  const entries = () => ["Mã phiếu / hồ sơ", "Bệnh nhân", "Hình thức", "Khung giờ / phòng", "Trạng thái"]
    .map((label, index) => [label, row.cells[index].innerText]);
  row.querySelector(".detail-button").setAttribute("aria-label", `Chi tiết ${row.cells[1].textContent}`);
  row.querySelector(".detail-button").addEventListener("click", () => openPreview("Chi tiết lượt khám minh họa", entries()));
  const checkin = row.querySelector(".checkin-button");
  if (checkin) {
    checkin.setAttribute("aria-label", `Xem check-in ${row.cells[1].textContent}`);
    checkin.addEventListener("click", () => openPreview("Xem trước check-in online", entries(), "Đối chiếu người đến khám với đúng hồ sơ và lịch hẹn đã có. Bản xem trước không check-in và không tạo lượt WALK_IN mới."));
  }
});
for (const [id, title] of [["walkin-form", "Xem trước tiếp nhận trực tiếp"], ["profile-form", "Xem trước hồ sơ bệnh nhân"]]) {
  document.querySelector(`#${id}`).addEventListener("submit", (event) => {
    event.preventDefault();
    const entries = [...new FormData(event.currentTarget)].map(([key, value]) => {
      if (key === "Ngày sinh" && value) {
        const [year, month, day] = value.split("-");
        return [key, `${day}/${month}/${year}`];
      }
      return [key, value];
    });
    openPreview(title, entries);
  });
}
const links = document.querySelectorAll(".sidebar nav a");
const observer = new IntersectionObserver((entries) => {
  const visible = entries.find((entry) => entry.isIntersecting);
  if (!visible) return;
  links.forEach((link) => {
    if (link.hash === `#${visible.target.id}`) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}, { rootMargin: "-10% 0px -60% 0px" });
document.querySelectorAll("main section[id]").forEach((section) => observer.observe(section));
filterRows();

// Hidden room views must be entered through a room card first.
document.querySelectorAll('.sidebar nav a').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.hash);
    if (target?.hidden) {
      event.preventDefault();
      document.querySelector('#coordination').hidden = false;
      document.querySelector('#coordination').scrollIntoView({ block: 'start' });
      document.querySelector('[data-room]').focus({ preventScroll: true });
    }
  });
});
