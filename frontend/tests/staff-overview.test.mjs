import test from "node:test";
import assert from "node:assert/strict";
import { overviewRange, getOverviewCounts } from "../static/js/core/staff_overview.js";

test("overview ranges use Monday to Sunday and the complete calendar month", () => {
  assert.deepEqual(overviewRange("today", "2026-10-17"), { from: "2026-10-17", to: "2026-10-17" });
  assert.deepEqual(overviewRange("week", "2026-10-18"), { from: "2026-10-12", to: "2026-10-18" });
  assert.deepEqual(overviewRange("week", "2026-01-01"), { from: "2025-12-29", to: "2026-01-04" });
  assert.deepEqual(overviewRange("month", "2028-02-15"), { from: "2028-02-01", to: "2028-02-29" });
  assert.deepEqual(overviewRange("month", "2026-12-15"), { from: "2026-12-01", to: "2026-12-31" });
  assert.deepEqual(overviewRange("custom", "2026-10-17", "2026-09-01", "2026-10-15"), { from: "2026-09-01", to: "2026-10-15" });
});

test("range statistics read every authorized page and exclude other dates and statuses", async () => {
  const original = globalThis.fetch;
  const calls = [];
  const items = [
    { work_date: "2026-10-01", encounter_status: "CHECKED_IN" },
    { work_date: "2026-10-31", encounter_status: "COMPLETED" },
    { work_date: "2026-09-30", encounter_status: "COMPLETED" },
    { work_date: "2026-11-01", encounter_status: "IN_PROGRESS" },
    { work_date: "2026-10-17", encounter_status: "IN_PROGRESS" },
    { work_date: "2026-10-18", encounter_status: "CANCELLED" },
  ];
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url); calls.push(parsed);
    assert.equal(options.method, "GET");
    const page = Number(parsed.searchParams.get("page"));
    return Response.json({ items: items.slice((page - 1) * 2, page * 2), total: items.length, page, page_size: 2 });
  };
  try {
    assert.deepEqual(await getOverviewCounts({ from: "2026-10-01", to: "2026-10-31" }), { CHECKED_IN: 1, IN_PROGRESS: 1, COMPLETED: 1 });
    assert.deepEqual(calls.map(c => c.searchParams.get("page")), ["1", "2", "3"]);
    assert.ok(calls.every(c => c.pathname === "/encounters" && !c.searchParams.has("from_date") && !c.searchParams.has("user_id")));
  } finally { globalThis.fetch = original; }
});

test("an exact day uses the existing work_date filter; failed later pages never return partial totals", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async url => {
    const parsed = new URL(url); calls++;
    assert.equal(parsed.searchParams.get("work_date"), "2026-10-17");
    if (calls === 2) throw new Error("offline");
    return Response.json({ items: [{ work_date: "2026-10-17", encounter_status: "COMPLETED" }], total: 2, page: 1, page_size: 1 });
  };
  try {
    await assert.rejects(getOverviewCounts({ from: "2026-10-17", to: "2026-10-17" }), /Không thể kết nối/);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});
