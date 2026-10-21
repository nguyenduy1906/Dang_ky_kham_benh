import { startAutoRefresh } from "../core/auto_refresh.js";
import { getDepartment } from "../api/catalog.js";
import { element, portrait, doctorCard } from "../core/doctors.js";
import { thumbnailUrl } from "../core/articles.js";
import { enableDragScroll } from "../core/booking.js";
import { displayText } from "../core/display_text.js";
const $ = selector => document.querySelector(selector);
const id = Number(new URLSearchParams(location.search).get("id"));
let request;
enableDragScroll($("#department-gallery"));
function photo(url, caption) {
  const holder = element("div", "", "department-image"), missing = element("span", "Chưa có ảnh", "department-image-missing"); holder.append(missing);
  const src = thumbnailUrl(url);
  if (src) { const image = document.createElement("img"); image.src = src; image.alt = caption; image.loading = "lazy";
    image.addEventListener("load", () => { missing.hidden = true; }); image.addEventListener("error", () => { image.remove(); missing.hidden = false; }, { once: true }); holder.append(image); }
  return holder;
}
function paragraphs(target, value) {
  target.replaceChildren(...displayText(value || "Thông tin đang cập nhật.").split(/\n\s*\n/).map(text => element("p", text)));
}
function list(values) {
  const ul = element("ul"); ul.append(...(values || []).map(value => element("li", displayText(value))));
  if (!ul.children.length) ul.append(element("li", "Thông tin đang cập nhật.")); return ul;
}
function leader(doctor, position, department) {
  const card = element("article", "", "department-leader-card"), link = element("a");
  link.href = `doctor_detail.html?id=${encodeURIComponent(doctor.doctor_profile_id)}`; link.append(portrait(doctor));
  const body = element("div"), name = element("h3"), nameLink = element("a", doctor.full_name); nameLink.href = link.href; name.append(nameLink);
  const more = element("a", "Xem hồ sơ bác sĩ →"); more.href = link.href;
  body.append(element("p", position, "department-leader-role"), name, element("p", doctor.academic_degree || "Học vị đang cập nhật"), element("p", doctor.specialization || department.name), more);
  card.append(link, body); return card;
}
function render(department, doctors) {
  const name = /^khoa\b/i.test(department.name) ? department.name : `Khoa ${department.name}`;
  document.title = `${name} | NEU Medical`; $("#department-page-title").textContent = name; $("#department-name").textContent = name;
  $("#department-description").textContent = department.description || "Thông tin đang cập nhật.";
  $("#department-group").textContent = department.group_type === "PARACLINICAL" ? "KHỐI CẬN LÂM SÀNG" : "KHỐI LÂM SÀNG";
  $("#department-doctor-count").textContent = `${doctors.length} bác sĩ · NEU Medical`;
  $("#department-booking").href = `../(patient)/booking.html?department=${encodeURIComponent(department.department_id)}`;
  $("#department-directory").href = `doctors.html?department_id=${encodeURIComponent(department.department_id)}`;
  $("#department-cover").replaceChildren(photo(department.cover_image_url, name));
  paragraphs($("#department-overview-text"), department.overview);
  $("#department-mission-text").textContent = department.mission || "Thông tin đang cập nhật.";
  const leadership = department.leadership || {}, leaders = [];
  if (leadership.head) leaders.push(leader(leadership.head, "Trưởng khoa", department));
  else leaders.push(element("p", "Chưa phân công trưởng khoa.", "department-vacancy"));
  if (leadership.deputies?.length) leaders.push(...leadership.deputies.map(doctor => leader(doctor, "Phó trưởng khoa", department)));
  else leaders.push(element("p", "Chưa phân công phó trưởng khoa.", "department-vacancy"));
  $("#department-leaders").replaceChildren(...leaders);
  $("#department-facts").replaceChildren(...[["Chuyên môn", "specialties"],["Dịch vụ khám", "clinical_services"],["Trang thiết bị", "equipment"],["Hoạt động và thành tích", "achievements"]].map(([title,key]) => {
    const card = element("article", "", "department-fact"); card.append(element("h3", title), list(department[key])); return card;
  }));
  $("#department-extra-sections").replaceChildren(...(department.extra_sections || []).map(item => {
    const section = element("section", "", "department-panel"), body = element("div"); paragraphs(body, item.content); section.append(element("h2", item.title), body); return section;
  }));
  const gallery = department.gallery || [];
  $("#department-gallery-section").hidden = !gallery.length;
  $("#department-gallery").replaceChildren(...gallery.map(item => { const figure = element("figure"), caption = displayText(item.caption); figure.append(photo(item.url, caption || `Ảnh ${name}`), element("figcaption", caption)); return figure; }));
  $("#department-team").replaceChildren(...doctors.map(doctor => doctorCard(doctor)));
  if (!doctors.length) $("#department-team").append(element("p", "Chưa có bác sĩ đang hoạt động tại khoa này."));
  $("#department-guide").replaceChildren(...(department.patient_guide || []).map(text => element("li", text)));
  $("#department-guide-section").hidden = !department.patient_guide?.length;
}
async function load() {
  request?.abort(); request = new AbortController(); const signal = request.signal;
  $("#department-content").hidden = true; $("#department-retry").hidden = true; $("#department-status").textContent = "Đang tải hồ sơ chuyên khoa…";
  if (!Number.isInteger(id) || id < 1) { $("#department-status").textContent = "Mã chuyên khoa không hợp lệ. Hãy chọn khoa từ trang Chuyên khoa."; return; }
  try {
    const result = await getDepartment(id, { auth: false, signal });
    if (signal.aborted) return;
    if (!result.department || !Array.isArray(result.doctors)) throw new Error("Phản hồi hồ sơ khoa không hợp lệ.");
    render(result.department, result.doctors); $("#department-content").hidden = false; $("#department-status").textContent = "";
  } catch (error) { if (!signal.aborted) { $("#department-status").textContent = error.message; $("#department-retry").hidden = error.status === 404; } }
}
$("#department-retry").addEventListener("click", load);
window.addEventListener("pagehide", () => request?.abort());
window.addEventListener("pageshow", event => { if (event.persisted) load(); });
load();
startAutoRefresh(load);
