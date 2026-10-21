import { startAutoRefresh } from "../core/auto_refresh.js";
import { getDoctor } from "../api/doctor.js";
import { listDoctorSchedules } from "../api/schedule.js";
import { listDoctorReviews, createReview } from "../api/medical_record.js";
import { listEncounters } from "../api/encounter.js";
import { verifySession, hasSession } from "../core/session.js";
import { portrait, experience, element, doctorPage, profileSections, currentWeek } from "../core/doctors.js";
import { money, dateLabel, allPages } from "../core/booking.js";
import { publishedDate } from "../core/articles.js";

const $ = selector => document.querySelector(selector);
const id = new URLSearchParams(location.search).get("id");
const status = $("#detail-status"), retry = $("#detail-retry"), layout = $(".doctor-detail-layout");
const scheduleStatus = $("#schedule-status"), schedules = $("#detail-schedules");
const reviewForm = $("#doctor-review-form"), reviewList = $("#doctor-reviews");
let request, scheduleRequest, reviewRequest, accessRequest;
let version = 0, scheduleVersion = 0, reviewVersion = 0, accessVersion = 0;
let reviewPage = 0, reviewTotal = 0, reviewsLoading = false, submitting = false;
let eligibleEncounter;

async function loadSchedules() {
  const current = ++scheduleVersion;
  scheduleRequest?.abort(); scheduleRequest = new AbortController();
  const week = currentWeek();
  $("#schedule-week").textContent = `${dateLabel(week.from_date)}–${dateLabel(week.to_date)}`;
  schedules.replaceChildren(); schedules.setAttribute("aria-busy", "true");
  scheduleStatus.textContent = "Đang tải lịch tuần này…"; $("#schedule-retry").hidden = true;
  try {
    const rows = await allPages((params, options) => listDoctorSchedules(id, params, options),
      { ...week, current_week: true }, { signal: scheduleRequest.signal });
    if (current !== scheduleVersion) return;
    const days = new Map();
    for (const row of rows.filter(row => row.work_date >= week.from_date && row.work_date <= week.to_date)) {
      if (!days.has(row.work_date)) days.set(row.work_date, new Set());
      const shift = Number(row.start_time.slice(0, 2)) < 12 ? "Sáng" : "Chiều";
      days.get(row.work_date).add(`${shift}${row.schedule_status === "UNAVAILABLE" ? " (báo nghỉ)" : row.schedule_status === "FULL" ? " (đã đầy)" : ""}`);
    }
    for (const [day, shifts] of [...days].sort(([a], [b]) => a.localeCompare(b))) {
      const weekday = new Intl.DateTimeFormat("vi-VN", { weekday: "long", timeZone: "Asia/Saigon" }).format(new Date(`${day}T12:00:00+07:00`));
      const row = element("li"); row.append(element("strong", `${weekday} · ${dateLabel(day)}`), element("span", [...shifts].join(" · ")));
      schedules.append(row);
    }
    scheduleStatus.textContent = days.size ? "" : "Bác sĩ chưa có lịch khám trong tuần này.";
  } catch (error) {
    if (current !== scheduleVersion || error.code === "CLIENT_ABORTED") return;
    scheduleStatus.textContent = error.message; $("#schedule-retry").hidden = false;
  } finally { if (current === scheduleVersion) schedules.setAttribute("aria-busy", "false"); }
}
function reviewCard(review) {
  const card = element("article", "", "doctor-review-card");
  const heading = element("div", "", "doctor-review-meta");
  heading.append(element("strong", "Người bệnh"), element("span", `${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)} · ${review.rating}/5`, "review-stars"));
  card.append(heading, element("time", publishedDate(review.created_at)), element("p", review.comment || "Người bệnh đã đánh giá mức độ hài lòng."));
  return card;
}
async function loadReviews(reset = false) {
  if (reviewsLoading && !reset) return;
  const current = ++reviewVersion;
  reviewRequest?.abort(); reviewRequest = new AbortController(); reviewsLoading = true;
  if (reset) { reviewPage = 0; reviewList.replaceChildren(); $("#doctor-reviews-scroll").scrollTop = 0; }
  const next = reviewPage + 1;
  $("#review-status").textContent = "Đang tải đánh giá…";
  $("#review-more").hidden = true; $("#review-retry").hidden = true;
  try {
    const result = doctorPage(await listDoctorReviews(id, { page: next, page_size: 4 }, { signal: reviewRequest.signal }));
    if (current !== reviewVersion) return;
    reviewPage = result.page; reviewTotal = result.total;
    reviewList.append(...result.items.map(reviewCard));
    const summary = reviewTotal && result.average_rating != null ? `★ ${result.average_rating}/5 (${reviewTotal} đánh giá)` : "Chưa có đánh giá";
    $("#detail-rating").textContent = summary; $("#review-rating").textContent = summary;
    $("#review-status").textContent = reviewTotal ? `Đã tải ${reviewList.children.length} / ${reviewTotal} đánh giá` : "Chưa có đánh giá từ người bệnh.";
    $("#review-more").hidden = reviewList.children.length >= reviewTotal;
  } catch (error) {
    if (current !== reviewVersion || error.code === "CLIENT_ABORTED") return;
    $("#review-status").textContent = error.message; $("#review-retry").hidden = false;
    if (!reviewPage) { $("#detail-rating").textContent = "Chưa tải được đánh giá"; $("#review-rating").textContent = ""; }
  } finally { if (current === reviewVersion) reviewsLoading = false; }
}
async function refreshReviewAccess() {
  const current = ++accessVersion;
  accessRequest?.abort(); accessRequest = new AbortController();
  reviewForm.hidden = true; $("#review-fields").disabled = true; $("#review-fields").hidden = true;
  eligibleEncounter = undefined;
  if (!hasSession()) return;
  try {
    if (!await verifySession() || current !== accessVersion) return;
    reviewForm.hidden = false; $("#review-eligibility").textContent = "Đang kiểm tra lượt khám…";
    $("#review-access-retry").hidden = true;
    const rows = await allPages(listEncounters, { doctor_profile_id: id, encounter_status: "COMPLETED" }, { signal: accessRequest.signal });
    if (current !== accessVersion || !hasSession()) return;
    const choices = rows.sort((a, b) =>
      `${b.work_date} ${b.estimated_exam_at || ""}`.localeCompare(`${a.work_date} ${a.estimated_exam_at || ""}`) || b.encounter_id - a.encounter_id);
    eligibleEncounter = choices[0]?.encounter_id;
    $("#review-fields").hidden = !eligibleEncounter;
    $("#review-fields").disabled = !eligibleEncounter || submitting;
    $("#review-eligibility").textContent = eligibleEncounter ? "" : "Bạn có thể đánh giá sau khi hoàn tất lượt khám với bác sĩ.";
  } catch (error) {
    if (current !== accessVersion || error.code === "CLIENT_ABORTED") return;
    if (!hasSession()) { reviewForm.hidden = true; return; }
    reviewForm.hidden = false; $("#review-eligibility").textContent = error.message;
    $("#review-access-retry").hidden = false;
  }
}
reviewForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (submitting || !hasSession() || !eligibleEncounter || !reviewForm.reportValidity()) return;
  const data = new FormData(reviewForm), encounterId = eligibleEncounter;
  submitting = true; $("#review-fields").disabled = true;
  $("#review-submit-status").textContent = "Đang gửi đánh giá…";
  try {
    await createReview(encounterId, { rating: Number(data.get("rating")), comment: $("#review-comment").value.trim() || null });
    reviewForm.reset();
    $("#review-submit-status").textContent = "Đã gửi đánh giá. Cảm ơn bạn đã chia sẻ.";
    loadReviews(true); refreshReviewAccess();
  } catch (error) {
    $("#review-submit-status").textContent = error.message;
    if ([401, 403, 409].includes(error.status)) refreshReviewAccess();
  } finally {
    submitting = false;
    $("#review-fields").disabled = !eligibleEncounter || !hasSession();
  }
});
$("#review-more").addEventListener("click", () => loadReviews());
$("#review-retry").addEventListener("click", () => loadReviews());
$("#review-access-retry").addEventListener("click", refreshReviewAccess);

async function load() {
  const current = ++version;
  request?.abort(); request = new AbortController();
  layout.hidden = true; status.textContent = "Đang tải hồ sơ bác sĩ…"; retry.hidden = true; $("#detail-feedback").hidden = false;
  if (!/^[1-9]\d*$/.test(id || "")) { status.textContent = "Đường dẫn bác sĩ không hợp lệ. Vui lòng chọn bác sĩ từ danh sách."; return; }
  try {
    const { doctor } = await getDoctor(id, { auth: false, signal: request.signal });
    if (current !== version) return;
    if (!doctor || String(doctor.doctor_profile_id) !== id) throw new Error("Phản hồi hồ sơ bác sĩ không hợp lệ.");
    $("#detail-name").textContent = doctor.full_name; document.title = `${doctor.full_name} | NEU Medical`;
    $("#detail-photo").replaceChildren(portrait(doctor));
    $("#detail-specialty").textContent = `Chuyên khoa: ${doctor.department_name}`;
    $("#schedule-specialty").textContent = doctor.department_name;
    $("#detail-degree").textContent = doctor.academic_degree || "Bác sĩ";
    $("#detail-experience").textContent = experience(doctor);
    $("#detail-specialization").textContent = doctor.specialization || "Chuyên môn đang cập nhật";
    const sections = profileSections(doctor.introduction);
    $("#detail-introduction").textContent = sections.introduction.join("\n");
    $("#detail-education").replaceChildren(...(sections.education.length ? sections.education : ["Thông tin đào tạo đang cập nhật."]).map(line => element("li", line)));
    $("#detail-work").replaceChildren(...(sections.work.length ? sections.work : [experience(doctor)]).map(line => element("li", line)));
    $("#detail-fee").textContent = `Phí khám: ${money(doctor.consultation_fee)}`;
    $("#detail-booking").href = `../(patient)/booking.html?doctor=${encodeURIComponent(id)}`;
    status.textContent = ""; $("#detail-feedback").hidden = true; layout.hidden = false;
    loadSchedules(); loadReviews(true); refreshReviewAccess();
  } catch (error) {
    if (current !== version || error.code === "CLIENT_ABORTED") return;
    status.textContent = error.status === 404 ? "Không tìm thấy bác sĩ hoặc hồ sơ đã ngừng hoạt động." : error.message; retry.hidden = error.status === 404;
  }
}
retry.addEventListener("click", load); $("#schedule-retry").addEventListener("click", loadSchedules);
window.addEventListener("neu:auth-change", refreshReviewAccess);
window.addEventListener("pagehide", () => {
  version++; scheduleVersion++; reviewVersion++; accessVersion++;
  request?.abort(); scheduleRequest?.abort(); reviewRequest?.abort(); accessRequest?.abort(); reviewForm.hidden = true;
});
window.addEventListener("pageshow", event => { if (event.persisted) load(); });
load();
startAutoRefresh(loadSchedules);
