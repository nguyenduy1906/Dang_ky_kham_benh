import test from "node:test";
import assert from "node:assert/strict";
import { bindLiveSearch } from "../static/js/core/live_search.js";

test("live search combines quick typing, waits for Vietnamese composition, and stops after navigation", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  globalThis.window = new EventTarget();
  try {
    const input = new EventTarget(); input.value = "";
    const searches = []; let invalidations = 0;
    const refresh = bindLiveSearch(input, () => searches.push(input.value), { invalidate: () => invalidations++ });
    input.value = "Ngu"; input.dispatchEvent(new Event("input"));
    t.mock.timers.tick(100);
    input.value = "Nguyễn"; input.dispatchEvent(new Event("input"));
    t.mock.timers.tick(251);
    assert.deepEqual(searches, ["Nguyễn"]);
    input.dispatchEvent(new Event("compositionstart")); input.value = "Đặng";
    input.dispatchEvent(new Event("input")); t.mock.timers.tick(500);
    assert.equal(searches.length, 1);
    input.dispatchEvent(new Event("compositionend")); t.mock.timers.tick(251);
    assert.deepEqual(searches, ["Nguyễn", "Đặng"]);
    input.value = ""; refresh();
    assert.equal(searches.at(-1), "");
    input.value = "late"; input.dispatchEvent(new Event("input"));
    window.dispatchEvent(new Event("pagehide")); t.mock.timers.tick(1000);
    refresh(); assert.equal(searches.length, 3);
    assert.ok(invalidations >= 5);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous); else delete globalThis.window;
  }
});
