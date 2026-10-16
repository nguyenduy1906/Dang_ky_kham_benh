import { listDepartments } from "../api/catalog.js";
import { listDoctors } from "../api/doctor.js";
import { allPages } from "../core/booking.js";
import { element, doctorPage, profileCard } from "../core/doctors.js";
import { thumbnailUrl } from "../core/articles.js";
const search = document.querySelector("#specialty-search"), grid = document.querySelector(".specialty-grid");
const status = document.querySelector("#specialty-status"), retry = document.querySelector("#specialty-retry");
const pager = document.querySelector("#specialty-pagination"), pages = document.querySelector("#specialty-pages");
const previous = document.querySelector("#specialty-prev"), next = document.querySelector("#specialty-next");
const pageSize = 8;
let departments = [], group = "all", request, page = 1, totalPages = 1;
const normalize = value => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").trim();
function render() {
  const items = departments.filter(d => (group === "all" || d.group_type === (group === "clinical" ? "CLINICAL" : "PARACLINICAL")) && normalize(d.name).includes(normalize(search.value)));
  totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  page = Math.min(page, totalPages);
  grid.replaceChildren(...items.slice((page - 1) * pageSize, page * pageSize).map(department => {
    const card = element("article", "", "specialty-card specialty-api-card"), url = `department_detail.html?id=${encodeURIComponent(department.department_id)}`;
    const photo = element("a", "", "department-card-photo"); photo.href = url;
    const src = thumbnailUrl(department.cover_image_url);
    if (src) { const image = document.createElement("img"); image.src = src; image.alt = `Khoa ${department.name}`; image.loading = "lazy"; image.addEventListener("error", () => { image.remove(); photo.textContent = "Chưa có ảnh"; }, { once: true }); photo.append(image); }
    else photo.textContent = "Chưa có ảnh";
    const body = element("div", "", "department-card-body"), title = element("h3"), link = element("a", /^khoa\b/i.test(department.name) ? department.name : `Khoa ${department.name}`); link.href = url; title.append(link);
    const more = element("a", "Xem hồ sơ khoa →"); more.href = url;
    body.append(element("span", department.group_type === "PARACLINICAL" ? "KHỐI CẬN LÂM SÀNG" : "KHỐI LÂM SÀNG", "specialty-label"), title, element("p", department.description || "Thông tin đang cập nhật."), element("p", `${department.doctor_count || 0} bác sĩ`), more);
    card.append(photo, body); profileCard(card, more); return card;
  }));
  document.querySelector("#specialty-result").textContent = `${items.length} chuyên khoa`;
  document.querySelector("#specialty-empty").hidden = items.length !== 0;
  pager.hidden = totalPages <= 1;
  previous.disabled = page <= 1;
  next.disabled = page >= totalPages;
  pages.replaceChildren();
  for (let number = Math.max(1, page - 2); number <= Math.min(totalPages, page + 2); number++) {
    const button = element("button", String(number)); button.type = "button";
    button.setAttribute("aria-label", `Trang ${number}`);
    if (number === page) button.setAttribute("aria-current", "page");
    button.addEventListener("click", () => changePage(number));
    pages.append(button);
  }
}
function changePage(number) {
  if (number < 1 || number > totalPages || number === page) return;
  page = number; render();
}
async function load() {
  request?.abort(); request = new AbortController(); const signal = request.signal;
  status.textContent = "Đang tải chuyên khoa…"; retry.hidden = true; pager.hidden = true; grid.setAttribute("aria-busy", "true");
  try {
    const result = await listDepartments({}, { auth: false, signal });
    if (signal.aborted) return;
    if (!Array.isArray(result.items)) throw new Error("Phản hồi chuyên khoa không hợp lệ.");
    // Backend cũ chưa trả doctor_count: đếm từ toàn bộ bác sĩ công khai, không coi trường thiếu là 0.
    let items = result.items;
    if (items.some(item => !Number.isInteger(item.doctor_count) || item.doctor_count < 0)) {
      const doctors = await allPages(async (params, options) => doctorPage(await listDoctors(params, options)), {}, { auth: false, signal });
      if (signal.aborted) return;
      const counts = new Map();
      for (const doctor of doctors) counts.set(String(doctor.department_id), (counts.get(String(doctor.department_id)) || 0) + 1);
      items = items.map(item => ({ ...item, doctor_count: counts.get(String(item.department_id)) || 0 }));
    }
    departments = items; render(); status.textContent = "";
    document.querySelector("#specialty-total").textContent = departments.length;
    document.querySelector("#specialty-doctors").textContent = departments.reduce((count, d) => count + (d.doctor_count || 0), 0);
  } catch (error) { if (!signal.aborted) { departments = []; grid.replaceChildren(); status.textContent = error.message; retry.hidden = false; document.querySelector("#specialty-empty").hidden = true; } }
  finally { if (!signal.aborted) grid.setAttribute("aria-busy", "false"); }
}
search.addEventListener("input", () => { page = 1; render(); });
document.querySelectorAll("[data-specialty-filter]").forEach(button => button.addEventListener("click", () => {
  group = button.dataset.specialtyFilter;
  page = 1;
  document.querySelectorAll("[data-specialty-filter]").forEach(item => { item.classList.toggle("selected", item === button); item.setAttribute("aria-pressed", String(item === button)); }); render();
}));
previous.addEventListener("click", () => changePage(page - 1));
next.addEventListener("click", () => changePage(page + 1));
retry.addEventListener("click", load);
window.addEventListener("pagehide", () => request?.abort());
window.addEventListener("pageshow", event => { if (event.persisted) load(); });
load();
