import test from "node:test";
import assert from "node:assert/strict";
import { enhanceDialogDismiss } from "../static/js/core/dialog_dismiss.js";

function fixture(canClose) {
  const events = {}, close = { textContent: "Đóng ×", dataset: {} };
  const dialog = { count: 0, getBoundingClientRect: () => ({ left: 100, right: 500, top: 100, bottom: 400 }),
    addEventListener: (type, callback) => { events[type] = callback; }, close() { this.count++; } };
  enhanceDialogDismiss(dialog, { closeButtons: [close], canClose });
  const event = (x, y, target = dialog) => ({ target, clientX: x, clientY: y });
  return { dialog, close, events, event };
}

test("close labels omit the cross and a click on the backdrop closes the dialog", () => {
  const { close, dialog, events, event } = fixture();
  assert.equal(close.textContent, "Đóng");
  assert.equal(close.dataset.dialogDismiss, "true");
  events.pointerdown(event(50, 150)); events.click(event(50, 150));
  assert.equal(dialog.count, 1);
});

test("clicking dialog padding, its content or dragging from inside to outside does not close it", () => {
  const { dialog, events, event } = fixture();
  events.pointerdown(event(120, 120)); events.click(event(120, 120));
  events.pointerdown(event(200, 200, {})); events.click(event(200, 200, {}));
  events.pointerdown(event(200, 200)); events.click(event(50, 150));
  assert.equal(dialog.count, 0);
});

test("busy forms retain their existing close guard and become dismissible when ready", () => {
  let busy = true;
  const { dialog, events, event } = fixture(() => !busy);
  events.pointerdown(event(50, 150)); events.click(event(50, 150));
  assert.equal(dialog.count, 0);
  busy = false;
  events.pointerdown(event(50, 150)); events.click(event(50, 150));
  assert.equal(dialog.count, 1);
});
