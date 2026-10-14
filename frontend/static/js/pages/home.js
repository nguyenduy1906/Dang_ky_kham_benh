import { listDoctors } from "../api/doctor.js";
import { listDepartments } from "../api/catalog.js";
import { allPages } from "../core/booking.js";
import { doctorPage, element } from "../core/doctors.js";
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
    .forEach((row, index) => (row.hidden = !expanded && index >= 5));
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
      link.href = `department-detail.html?id=${encodeURIComponent(department.department_id)}`;
      link.append(element("span", department.name), element("span", "→"));
      link.hidden = index >= 5 && allDepartments.getAttribute("aria-expanded") !== "true"; return link;
    }));
    allDepartments.hidden = result.items.length <= 5;
    if (!result.items.length) holder.append(element("p", "Chưa có chuyên khoa đang hoạt động."));
  } catch {
    holder.replaceChildren(element("p", "Không tải được chuyên khoa."));
    const retry = element("button", "Thử lại", "outline-button"); retry.type = "button";
    retry.addEventListener("click", loadHomeDepartments, { once: true }); holder.append(retry); allDepartments.hidden = true;
  }
}
loadHomeDepartments();
const doctorTrack = document.querySelector("#doctor-track");
const previousDoctor = document.querySelector(".slider-prev");
const nextDoctor = document.querySelector(".slider-next");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
function moveDoctors(direction) {
  const card = doctorTrack.querySelector(".doctor-card");
  if (!card) return;
  const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(doctorTrack).gap);
  doctorTrack.scrollBy({
    left: direction * step,
    behavior: reducedMotion.matches ? "instant" : "smooth",
  });
}
function updateDoctorSlider() {
  const card = doctorTrack.querySelector(".doctor-card");
  const count = doctorTrack.querySelectorAll(".doctor-card").length;
  if (!card) { previousDoctor.disabled = nextDoctor.disabled = true; return; }
  const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(doctorTrack).gap);
  const first = Math.round(doctorTrack.scrollLeft / step) + 1;
  const visible = Math.max(
    1,
    Math.round((doctorTrack.clientWidth + parseFloat(getComputedStyle(doctorTrack).gap)) / step),
  );
  previousDoctor.disabled = doctorTrack.scrollLeft <= 1;
  nextDoctor.disabled =
    doctorTrack.scrollLeft >= doctorTrack.scrollWidth - doctorTrack.clientWidth - 2;
  document.querySelector(".slider-status").textContent =
    `Bác sĩ ${first}–${Math.min(count, first + visible - 1)} / ${count}`;
}

async function loadHomeDoctors() {
  const status = document.querySelector(".slider-status");
  status.textContent = "Đang tải bác sĩ…";
  doctorTrack.setAttribute("aria-busy", "true");
  try {
    const doctors = await allPages(async (params, options) => doctorPage(await listDoctors(params, options)), {}, { auth: false });
    const cards = doctors.map(doctor => {
      const card = element("a", "", "doctor-card");
      card.href = `doctor-detail.html?id=${encodeURIComponent(doctor.doctor_profile_id)}`;
      const src = thumbnailUrl(doctor.avatar_url);
      const missing = element("span", "Chưa có ảnh");
      if (src) {
        const image = document.createElement("img");
        image.src = src; image.alt = `Ảnh ${doctor.full_name}`; image.loading = "lazy";
        image.addEventListener("error", () => image.replaceWith(missing), { once: true });
        card.append(image);
      } else card.append(missing);
      card.append(element("span", doctor.department_name), element("strong", doctor.full_name));
      return card;
    });
    doctorTrack.replaceChildren(...cards);
    doctorTrack.scrollLeft = 0;
    status.textContent = doctors.length ? "" : "Chưa có hồ sơ bác sĩ.";
    updateDoctorSlider();
  } catch {
    status.textContent = "Không tải được bác sĩ. ";
    const retry = element("button", "Thử lại", "outline-button"); retry.type = "button";
    retry.addEventListener("click", loadHomeDoctors, { once: true }); status.append(retry);
  } finally { doctorTrack.setAttribute("aria-busy", "false"); }
}
loadHomeDoctors();
previousDoctor.addEventListener("click", () => moveDoctors(-1));
nextDoctor.addEventListener("click", () => moveDoctors(1));
doctorTrack.addEventListener("scroll", updateDoctorSlider, { passive: true });
doctorTrack.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    event.preventDefault();
    moveDoctors(event.key === "ArrowRight" ? 1 : -1);
  }
});
window.addEventListener("resize", updateDoctorSlider);
updateDoctorSlider();

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
enableMouseDrag(document.querySelector(".event-track"));


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
