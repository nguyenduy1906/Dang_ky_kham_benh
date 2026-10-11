const allDepartments = document.querySelector("#all-departments");
allDepartments.addEventListener("click", () => {
  const expanded = allDepartments.getAttribute("aria-expanded") !== "true";
  document
    .querySelectorAll(".department-row")
    .forEach((row, index) => (row.hidden = !expanded && index >= 5));
  allDepartments.setAttribute("aria-expanded", String(expanded));
  allDepartments.textContent = expanded ? "Thu gọn" : "Xem tất cả";
});
document.querySelectorAll("[data-filter]").forEach((button) =>
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("selected", active);
      item.setAttribute("aria-pressed", String(active));
    });
    document
      .querySelectorAll("[data-category]")
      .forEach(
        (card) =>
          (card.hidden =
            button.dataset.filter !== "all" && card.dataset.category !== button.dataset.filter),
      );
  }),
);
const doctorTrack = document.querySelector("#doctor-track");
const previousDoctor = document.querySelector(".slider-prev");
const nextDoctor = document.querySelector(".slider-next");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
function moveDoctors(direction) {
  const card = doctorTrack.querySelector(".doctor-card");
  const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(doctorTrack).gap);
  doctorTrack.scrollBy({
    left: direction * step,
    behavior: reducedMotion.matches ? "instant" : "smooth",
  });
}
function updateDoctorSlider() {
  const card = doctorTrack.querySelector(".doctor-card");
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
    `Bác sĩ ${first}–${Math.min(8, first + visible - 1)} / 8`;
}
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
