import { ApiError } from "./api.js";
import { thumbnailUrl } from "./articles.js";
import { money } from "./booking.js";

export function element(tag, text = "", className = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function doctorPage(result) {
  if (!Array.isArray(result?.items) || !Number.isInteger(result.total) || result.total < 0 ||
      !Number.isInteger(result.page) || result.page < 1 || !Number.isInteger(result.page_size) || result.page_size < 1)
    throw new ApiError("Phản hồi danh sách không hợp lệ. Vui lòng thử lại.");
  return result;
}
export const experience = doctor => doctor.experience_years == null
  ? "Kinh nghiệm đang cập nhật" : `${doctor.experience_years} năm kinh nghiệm`;

export function profileSections(introduction = "") {
  const result = { introduction: [], education: [], work: [], sample: false };
  let section = "introduction";
  for (const line of String(introduction || "").split(/\r?\n/).map(value => value.trim()).filter(Boolean)) {
    if (line === "Quá trình đào tạo:") section = "education";
    else if (line === "Quá trình công tác:") section = "work";
    else if (line === "Hồ sơ đào tạo và công tác mẫu phục vụ đồ án.") result.sample = true;
    else result[section].push(line.replace(/^[-•]\s*/, ""));
  }
  return result;
}

export function currentWeek(date = new Date()) {
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Saigon", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const monday = new Date(`${local}T12:00:00+07:00`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from_date: monday.toISOString().slice(0, 10), to_date: sunday.toISOString().slice(0, 10) };
}
export function portrait(doctor) {
  const holder = element("div", "", "doctor-portrait");
  const missing = element("span", "Chưa có ảnh", "doctor-photo-missing"); holder.append(missing);
  const src = thumbnailUrl(doctor.avatar_url);
  if (src) {
    const image = document.createElement("img"); image.alt = `Ảnh ${doctor.full_name}`;
    image.loading = "lazy"; image.referrerPolicy = "no-referrer";
    image.addEventListener("load", () => { missing.hidden = true; });
    image.addEventListener("error", () => { image.remove(); missing.hidden = false; });
    image.src = src; holder.append(image);
  }
  return holder;
}
export function doctorCard(doctor, { showFee = false } = {}) {
  const detail = `doctor_detail.html?id=${encodeURIComponent(doctor.doctor_profile_id)}`;
  const card = element("article", "", "directory-card");
  const photo = element("a", "", "directory-photo"); photo.href = detail; photo.append(portrait(doctor));
  const body = element("div", "", "directory-card-body");
  const name = element("h2"), link = element("a", doctor.full_name); link.href = detail; name.append(link);
  const facts = element("ul");
  facts.append(element("li", doctor.academic_degree || "Học vị đang cập nhật"),
    element("li", experience(doctor)));
  if (showFee) facts.append(element("li", `Phí khám: ${money(doctor.consultation_fee)}`));
  const schedule = element("a", "▦ Đặt lịch khám", "directory-schedule");
  schedule.href = `../(patient)/booking.html?doctor=${encodeURIComponent(doctor.doctor_profile_id)}`;
  const more = element("a", "Xem hồ sơ chi tiết →", "directory-detail"); more.href = detail;
  body.append(element("p", doctor.department_name, "directory-specialty"), name, facts, schedule, more);
  card.append(photo, body); profileCard(card, more); return card;
}

export function profileCard(card, link) {
  card.classList.toggle("profile-card-link", true);
  card.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
        event.target.closest("a, button, input, select, textarea, [role='button']") || window.getSelection?.()?.toString()) return;
    link.click();
  });
}
