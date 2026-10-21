// Delegate to the page container so freshly rendered date ranges remain draggable.
export function initDragScroll(root, selector) {
  let drag = null, blockedClick = null;
  root.addEventListener("pointerdown", event => {
    blockedClick = null;
    const rail = event.target.closest(selector);
    if (event.pointerType !== "mouse" || event.button !== 0 || !rail || rail.scrollWidth <= rail.clientWidth) return;
    drag = { rail, pointerId: event.pointerId, x: event.clientX, scroll: rail.scrollLeft, moved: false };
  });
  root.addEventListener("pointermove", event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.x;
    if (!drag.moved && Math.abs(distance) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.rail.classList.add("is-dragging");
      drag.rail.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    drag.rail.scrollLeft = drag.scroll - distance;
  });
  function finish(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const { rail, pointerId, moved } = drag;
    drag = null;
    if (moved) blockedClick = rail;
    rail.classList.remove("is-dragging");
    if (rail.hasPointerCapture(pointerId)) rail.releasePointerCapture(pointerId);
  }
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) root.addEventListener(type, finish);
  root.addEventListener("click", event => {
    if (!blockedClick || !event.detail || event.target.closest(selector) !== blockedClick) return;
    blockedClick = null;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  root.addEventListener("dragstart", event => {
    if (event.target.closest(selector)) event.preventDefault();
  });
}
