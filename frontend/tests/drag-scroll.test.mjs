import test from "node:test";
import assert from "node:assert/strict";
import { initDragScroll } from "../static/js/core/drag_scroll.js";

function fixture() {
  const handlers = {}, classes = new Set();
  let captured = false;
  const rail = { scrollLeft: 0, scrollWidth: 2000, clientWidth: 800,
    classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
    setPointerCapture: () => { captured = true; }, hasPointerCapture: () => captured,
    releasePointerCapture: () => { captured = false; } };
  const root = { addEventListener: (name, callback) => { handlers[name] = callback; } };
  initDragScroll(root, ".rail");
  const event = (overrides = {}) => ({ target: { closest: () => rail }, pointerType: "mouse", button: 0, pointerId: 1, clientX: 500, detail: 1, prevented: false, stopped: false,
    preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...overrides });
  return { handlers, rail, classes, event };
}

test("drag scroll moves horizontally and suppresses the release click, while normal link clicks work", () => {
  const { handlers, rail, classes, event } = fixture();
  handlers.pointerdown(event());
  handlers.pointermove(event({ clientX: 497 }));
  assert.equal(rail.scrollLeft, 0);
  handlers.pointermove(event({ clientX: 250 }));
  assert.equal(rail.scrollLeft, 250);
  assert.equal(classes.has("is-dragging"), true);
  handlers.pointerup(event({ clientX: 250 }));
  assert.equal(classes.has("is-dragging"), false);
  const release = event(); handlers.click(release);
  assert.equal(release.prevented, true); assert.equal(release.stopped, true);
  handlers.pointerdown(event()); handlers.pointerup(event());
  const click = event(); handlers.click(click);
  assert.equal(click.prevented, false);
});

test("touch remains native and canceled drags release capture without blocking keyboard links", () => {
  const { handlers, rail, classes, event } = fixture();
  handlers.pointerdown(event({ pointerType: "touch" }));
  const touch = event({ pointerType: "touch", clientX: 200 }); handlers.pointermove(touch);
  assert.equal(touch.prevented, false); assert.equal(rail.scrollLeft, 0);
  handlers.pointerdown(event()); handlers.pointermove(event({ clientX: 200 }));
  handlers.pointercancel(event());
  assert.equal(classes.has("is-dragging"), false);
  assert.equal(rail.hasPointerCapture(), false);
  const keyboard = event({ detail: 0 }); handlers.click(keyboard);
  assert.equal(keyboard.prevented, false);
});
