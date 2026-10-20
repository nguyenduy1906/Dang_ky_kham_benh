import { startAutoRefresh } from "../core/auto_refresh.js";
import { listDoctors } from "../api/doctor.js";
import { listDepartments } from "../api/catalog.js";
import { allPages } from "../core/booking.js";
import { doctorPage, element, experience, profileSections } from "../core/doctors.js";
import { thumbnailUrl } from "../core/articles.js";

// Keep the header, banner and service tiles together in the first desktop view.
const homeHeader = document.querySelector("body > header");
const homeIntro = document.querySelector(".home-intro");
const homeServices = homeIntro.querySelector(".services");
const measureHomeIntro = () => {
  homeIntro.style.setProperty("--home-header-height", `${homeHeader.getBoundingClientRect().height}px`);
  homeIntro.style.setProperty("--home-services-overlap", `${homeServices.getBoundingClientRect().height / 2}px`);
};
const homeIntroObserver = new ResizeObserver(measureHomeIntro);
homeIntroObserver.observe(homeHeader);
homeIntroObserver.observe(homeServices);
measureHomeIntro();

const allDepartments = document.querySelector("#all-departments");
allDepartments.addEventListener("click", () => {
  const expanded = allDepartments.getAttribute("aria-expanded") !== "true";
  document
    .querySelectorAll(".department-row")
    .forEach((row, index) => (row.hidden = !expanded && index >= 6));
  allDepartments.setAttribute("aria-expanded", String(expanded));
  allDepartments.textContent = expanded ? "Thu gọn" : "Xem tất cả";
});
async function loadHomeDepartments() {
  const holder = document.querySelector(".department-list");
  try {
    const result = await listDepartments({}, { auth: false });
    if (!Array.isArray(result.items)) throw new Error("Phản hồi chuyên khoa không hợp lệ.");
    holder.replaceChildren(...result.items.map((department, index) => {
      const link = element("a", "", "department-row");
      link.href = `department_detail.html?id=${encodeURIComponent(department.department_id)}`;
      link.append(element("span", department.name), element("span", "→"));
      link.hidden = index >= 6 && allDepartments.getAttribute("aria-expanded") !== "true"; return link;
    }));
    allDepartments.hidden = result.items.length <= 6;
    if (!result.items.length) holder.append(element("p", "Chưa có chuyên khoa đang hoạt động."));
  } catch {
    holder.replaceChildren(element("p", "Không tải được chuyên khoa."));
    const retry = element("button", "Thử lại", "outline-button"); retry.type = "button";
    retry.addEventListener("click", loadHomeDepartments, { once: true }); holder.append(retry); allDepartments.hidden = true;
  }
}
loadHomeDepartments();
const doctorTrack = document.querySelector("#doctor-track");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let doctorTimer;
function runDoctorTimer() {
  clearInterval(doctorTimer);
  if (reducedMotion.matches || document.hidden) return;
  doctorTimer = setInterval(() => {
    const keyboardFocus = doctorTrack.closest(".doctor-slider").contains(document.activeElement)
      && document.activeElement.matches(":focus-visible");
    if (keyboardFocus || doctorTrack.querySelector(".doctor-card:hover")
      || doctorTrack.classList.contains("is-dragging")
      || doctorTrack.getAttribute("aria-busy") === "true"
      || doctorTrack.scrollWidth <= doctorTrack.clientWidth + 2) return;
    if (doctorTrack.scrollLeft >= doctorTrack.scrollWidth - doctorTrack.clientWidth - 2) doctorTrack.scrollTo({ left: 0, behavior: "smooth" });
    else moveDoctors(1);
  }, 10000);
}
function moveDoctors(direction) {
  const card = doctorTrack.querySelector(".doctor-card");
  if (!card) return;
  const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(doctorTrack).gap);
  doctorTrack.scrollBy({
    left: direction * step,
    behavior: reducedMotion.matches ? "instant" : "smooth",
  });
}
async function loadHomeDoctors() {
  const status = document.querySelector(".slider-status");
  status.textContent = "Đang tải bác sĩ…";
  doctorTrack.setAttribute("aria-busy", "true");
  try {
    const doctors = await allPages(async (params, options) => doctorPage(await listDoctors(params, options)), {}, { auth: false });
    const cards = doctors.map(doctor => {
      const card = element("a", "", "doctor-card");
      card.href = `doctor_detail.html?id=${encodeURIComponent(doctor.doctor_profile_id)}`;
      const photo = element("div", "", "doctor-photo");
      const src = thumbnailUrl(doctor.avatar_url);
      const missing = element("span", "Chưa có ảnh", "doctor-photo-placeholder");
      if (src) {
        const image = document.createElement("img");
        image.src = src; image.alt = `Ảnh ${doctor.full_name}`; image.loading = "lazy";
        image.addEventListener("error", () => image.replaceWith(missing), { once: true });
        photo.append(image);
      } else photo.append(missing);
      const highlights = element("div", "", "doctor-highlights");
      const sections = profileSections(doctor.introduction);
      const facts = [
        doctor.academic_degree,
        doctor.experience_years == null ? null : experience(doctor),
        doctor.specialization,
        ...sections.education,
        ...sections.work,
      ].filter(Boolean);
      const list = element("ul");
      list.append(...(facts.length ? facts : ["Thông tin thành tích đang cập nhật."])
        .map(fact => element("li", fact)));
      highlights.append(element("p", "Thành tích nổi bật", "doctor-highlights-title"), list);
      photo.append(highlights);
      card.append(photo, element("span", doctor.department_name), element("strong", doctor.full_name));
      return card;
    });
    doctorTrack.replaceChildren(...cards);
    doctorTrack.scrollLeft = 0;
    status.textContent = doctors.length ? "" : "Chưa có hồ sơ bác sĩ.";
    runDoctorTimer();
  } catch {
    status.textContent = "Không tải được bác sĩ. ";
    const retry = element("button", "Thử lại", "outline-button"); retry.type = "button";
    retry.addEventListener("click", loadHomeDoctors, { once: true }); status.append(retry);
  } finally { doctorTrack.setAttribute("aria-busy", "false"); }
}
loadHomeDoctors();
doctorTrack.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    event.preventDefault();
    moveDoctors(event.key === "ArrowRight" ? 1 : -1);
  }
});
document.addEventListener("visibilitychange", runDoctorTimer);
reducedMotion.addEventListener("change", runDoctorTimer);
window.addEventListener("pagehide", () => clearInterval(doctorTimer));
window.addEventListener("pageshow", runDoctorTimer);

// Share mouse-drag scrolling between both home carousels.
function enableMouseDrag(track) {
  let drag = null;
  let suppressClick = false;
  track.addEventListener("dragstart", (event) => event.preventDefault());
  track.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    suppressClick = false;
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScroll: track.scrollLeft,
      moved: false,
    };
  });
  window.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const distance = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(distance) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      suppressClick = true;
      track.classList.add("is-dragging");
      track.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    track.scrollLeft = drag.startScroll - distance;
  });
  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const pointerId = drag.pointerId;
    drag = null;
    track.classList.remove("is-dragging");
    if (track.hasPointerCapture(pointerId)) track.releasePointerCapture(pointerId);
  }
  window.addEventListener("pointerup", finishDrag);
  window.addEventListener("pointercancel", finishDrag);
  track.addEventListener("lostpointercapture", finishDrag);
  track.addEventListener(
    "click",
    (event) => {
      if (!suppressClick || event.detail === 0) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    },
    true,
  );
}
enableMouseDrag(doctorTrack);
const eventTrack = document.querySelector(".event-track");
enableMouseDrag(eventTrack);

let eventTimer;
function moveEvents(direction) {
  const card = eventTrack.querySelector(".article-card");
  if (!card) return;
  const step = card.getBoundingClientRect().width + (parseFloat(getComputedStyle(eventTrack).gap) || 0);
  eventTrack.scrollBy({ left: direction * step, behavior: reducedMotion.matches ? "instant" : "smooth" });
}
function runEventTimer() {
  clearInterval(eventTimer);
  if (reducedMotion.matches || document.hidden) return;
  eventTimer = setInterval(() => {
    const keyboardFocus = eventTrack.contains(document.activeElement)
      && document.activeElement.matches(":focus-visible");
    if (keyboardFocus || eventTrack.querySelector(".article-card:hover")
      || eventTrack.classList.contains("is-dragging")
      || eventTrack.scrollWidth <= eventTrack.clientWidth + 2) return;
    if (eventTrack.scrollLeft >= eventTrack.scrollWidth - eventTrack.clientWidth - 2) {
      eventTrack.scrollTo({ left: 0, behavior: "smooth" });
    } else moveEvents(1);
  }, 10000);
}
eventTrack.addEventListener("keydown", event => {
  if (!["ArrowRight", "ArrowLeft"].includes(event.key)) return;
  event.preventDefault();
  moveEvents(event.key === "ArrowRight" ? 1 : -1);
});
document.addEventListener("visibilitychange", runEventTimer);
reducedMotion.addEventListener("change", runEventTimer);
window.addEventListener("pagehide", () => clearInterval(eventTimer));
window.addEventListener("pageshow", runEventTimer);
runEventTimer();


// Four full-size banner photos: automatic every five seconds, mouse/touch dragging.
const heroTrack = document.querySelector("#hero-slides");
const heroSlides = [...heroTrack.children];
const heroRegion = document.querySelector(".hero");
let heroIndex = 0, heroMoving = false, heroTimer, heroSettleTimer, heroDrag = null;
let heroSuppressClick = false;
heroSlides.forEach((slide, index) => {
  slide.dataset.bannerSlide = String(index);
  slide.querySelector("img").draggable = false;
});
const heroClone = heroSlides[0].cloneNode(true);
heroClone.removeAttribute("data-banner-slide");
heroClone.setAttribute("aria-hidden", "true");
heroClone.inert = true;
heroTrack.append(heroClone);
// The leading clone allows a rightward drag from the first image to the last.
const heroLeadingClone = heroSlides.at(-1).cloneNode(true);
heroLeadingClone.removeAttribute("data-banner-slide");
heroLeadingClone.setAttribute("aria-hidden", "true");
heroLeadingClone.inert = true;
heroTrack.prepend(heroLeadingClone);
function settleHero() {
  clearTimeout(heroSettleTimer);
  heroTrack.classList.add("no-transition");
  heroTrack.style.transform = `translateX(-${(heroIndex + 1) * 100}%)`;
  heroMoving = false;
}
function markHero() {
  heroSlides.forEach((slide, index) => {
    slide.setAttribute("aria-hidden", String(index !== heroIndex));
    slide.dataset.active = String(index === heroIndex);
  });
}
function showHero(target, position = target + 1) {
  if (heroMoving) return;
  heroIndex = (target + heroSlides.length) % heroSlides.length;
  heroTrack.classList.remove("no-transition");
  heroTrack.style.transform = `translateX(-${position * 100}%)`;
  markHero();
  if (reducedMotion.matches) settleHero();
  else { heroMoving = true; heroSettleTimer = setTimeout(settleHero, 800); }
}
function runHeroTimer() {
  clearInterval(heroTimer);
  const keyboardFocus = heroRegion.contains(document.activeElement) && document.activeElement.matches(":focus-visible");
  if (reducedMotion.matches || heroDrag || document.hidden || keyboardFocus) return;
  heroTimer = setInterval(() => showHero(heroIndex + 1, heroIndex + 2), 5000);
}
heroTrack.addEventListener("transitionend", (event) => {
  if (event.target === heroTrack && event.propertyName === "transform") settleHero();
});
heroRegion.addEventListener("pointerdown", (event) => {
  if (heroMoving || !event.isPrimary || event.button !== 0 || event.target.closest("button, a, input, textarea")) return;
  heroDrag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, distance: 0, moved: false };
  clearInterval(heroTimer);
});
window.addEventListener("pointermove", (event) => {
  if (!heroDrag || event.pointerId !== heroDrag.id) return;
  const distance = event.clientX - heroDrag.startX;
  if (!heroDrag.moved) {
    if (Math.abs(distance) < 8 || Math.abs(distance) < Math.abs(event.clientY - heroDrag.startY)) return;
    heroDrag.moved = true;
    heroRegion.setPointerCapture(event.pointerId);
    heroRegion.classList.add("is-dragging");
    heroTrack.classList.add("no-transition");
  }
  event.preventDefault();
  heroDrag.distance = Math.max(-heroRegion.clientWidth, Math.min(heroRegion.clientWidth, distance));
  heroTrack.style.transform = `translateX(calc(-${(heroIndex + 1) * 100}% + ${heroDrag.distance}px))`;
}, { passive: false });
function finishHeroDrag(event) {
  if (!heroDrag || event.pointerId !== heroDrag.id) return;
  const drag = heroDrag;
  heroDrag = null;
  heroRegion.classList.remove("is-dragging");
  if (heroRegion.hasPointerCapture(event.pointerId)) heroRegion.releasePointerCapture(event.pointerId);
  if (drag.moved) {
    heroSuppressClick = true;
    const direction = event.type !== "pointercancel" && Math.abs(drag.distance) > Math.min(90, heroRegion.clientWidth * .12)
      ? (drag.distance < 0 ? 1 : -1) : 0;
    showHero(heroIndex + direction, heroIndex + 1 + direction);
  }
  runHeroTimer();
}
window.addEventListener("pointerup", finishHeroDrag);
window.addEventListener("pointercancel", finishHeroDrag);
heroRegion.addEventListener("lostpointercapture", finishHeroDrag);
heroRegion.addEventListener("click", (event) => {
  if (heroSuppressClick && event.detail > 0) { event.preventDefault(); event.stopPropagation(); heroSuppressClick = false; }
}, true);
heroRegion.addEventListener("keydown", (event) => {
  if (event.target !== heroRegion || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  const direction = event.key === "ArrowRight" ? 1 : -1;
  showHero(heroIndex + direction, heroIndex + 1 + direction);
});
heroRegion.addEventListener("focusin", runHeroTimer);
heroRegion.addEventListener("focusout", () => setTimeout(runHeroTimer, 0));
document.addEventListener("visibilitychange", runHeroTimer);
reducedMotion.addEventListener("change", () => { settleHero(); runHeroTimer(); });
window.addEventListener("pagehide", () => { clearInterval(heroTimer); clearTimeout(heroSettleTimer); heroDrag = null; });
window.addEventListener("pageshow", (event) => { if (event.persisted) settleHero(); runHeroTimer(); });
settleHero();
markHero();
runHeroTimer();
startAutoRefresh(() => Promise.all([loadHomeDepartments(), loadHomeDoctors()]));
