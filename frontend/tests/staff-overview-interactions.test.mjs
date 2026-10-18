import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initOverviewPeriod, overviewRows } from "../static/js/core/staff_overview.js";
import { NURSE_OVERVIEW_STORAGE_KEY } from "../static/js/core/overview_preferences.js";
// Load existing staff helpers before installing the test DOM.
import "../static/js/core/staff_ui.js";

class Node {
  innerHTML = ""; textContent = ""; value = ""; dataset = {}; listeners = {}; validity = "";
  addEventListener(type, callback) { this.listeners[type] = callback; }
  setCustomValidity(value) { this.validity = value; }
  reportValidity() { return false; }
  setAttribute(key, value) { this[key] = value; }
}
function fixture(role = "doctor") {
  const nodes = new Map(["#overview-period-control", "#overview-filter", "#overview-custom", "#overview-feedback", "#page-body", "#page-status", "#staff-dialog-close"].map(id => [id, new Node()]));
  const fields = Object.fromEntries(["period", "from_date", "to_date"].map(key => [key, new Node()]));
  nodes.get("#overview-filter").elements = fields;
  const saved = ["document", "window", "fetch", "sessionStorage"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  Object.assign(globalThis, { document: { body: { dataset: { role, page: "overview" } }, querySelector: id => nodes.get(id) }, window: { addEventListener() {} } });
  return { nodes, fields, restore() { for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]; } } };
}

test("all four dashboards mount the same date control with an inert reserved custom row", async () => {
  for (const [role, script] of [["nurse", "nurse"], ["doctor", "doctor"], ["reception", "reception"], ["admin", "admin"]]) {
    const html = await readFile(new URL(`../templates/(${role})/home.html`, import.meta.url), "utf8");
    assert.match(html, /overview-period-header/);
    assert.match(html, /id="overview-period-control"/);
    assert.doesNotMatch(html, /<form id="overview-filter"/);
    const source = await readFile(new URL(`../static/js/pages/${script}.js`, import.meta.url), "utf8");
    assert.match(role==="admin"?await readFile(new URL("../static/js/core/admin_workspace.js",import.meta.url),"utf8"):source, /await initOverviewPeriod\(/);
  }
});

test("period loading keeps cards mounted, cancels previous work and ignores late responses", async () => {
  const { nodes, fields, restore } = fixture();
  const pending = [];
  try {
    await initOverviewPeriod((range, options) => {
      if (options.period === "today") return "today cards";
      return new Promise(resolve => pending.push({ resolve, options }));
    });
    assert.equal(fields.period.value, "today");
    assert.equal(fields.from_date.disabled, true);
    const content = nodes.get("#page-body");
    fields.period.value = "week";
    const week = fields.period.listeners.change();
    assert.equal(content.innerHTML, "today cards");
    assert.equal(content["aria-busy"], "true");
    fields.period.value = "month";
    const month = fields.period.listeners.change();
    assert.equal(pending[0].options.signal.aborted, true);
    pending[1].resolve("month cards"); await month;
    pending[0].resolve("late week cards"); await week;
    assert.equal(content.innerHTML, "month cards");
    assert.equal(content["aria-busy"], "false");
    fields.period.value = "custom"; fields.to_date.value = "2000-01-01";
    await fields.period.listeners.change();
    assert.equal(nodes.get("#overview-custom").inert, false);
    assert.equal(fields.from_date.disabled, false);
    assert.equal(content.innerHTML, "month cards");
    assert.match(nodes.get("#overview-feedback").textContent, /hợp lệ/);
  } finally { restore(); }
});

test("range readers include all pages, preserve scoped filters and exclude other dates", async () => {
  const calls = [];
  const reader = async (params, options) => {
    calls.push({ params, options });
    return { items: [{ work_date: params.page === 1 ? "2026-10-12" : "2026-10-19" }], total: 2, page_size: 1 };
  };
  const signal = new AbortController().signal;
  const rows = await overviewRows(reader, { room_id: 7 }, { from: "2026-10-12", to: "2026-10-18" }, { signal });
  assert.equal(rows.length, 1);
  assert.deepEqual(calls.map(c => c.params.page), [1, 2]);
  assert.ok(calls.every(c => c.params.room_id === 7 && c.options.signal === signal));
});

test("nurse overview restores week, month and custom dates after reload, retaining only valid selections", async () => {
  const { fields, nodes, restore } = fixture("nurse");
  const values = new Map(), rendered = [];
  try {
    globalThis.sessionStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
    const render = (range, options) => { rendered.push({ range, period: options.period }); return options.period; };
    const init = () => initOverviewPeriod(render, { storageKey: NURSE_OVERVIEW_STORAGE_KEY });
    await init(); assert.equal(fields.period.value, "today");
    for (const period of ["week", "month"]) {
      fields.period.value = period; await fields.period.listeners.change();
      await init();
      assert.equal(fields.period.value, period);
      assert.equal(nodes.get("#page-body").innerHTML, period);
    }
    fields.period.value = "custom"; fields.from_date.value = "2026-10-01"; fields.to_date.value = "2026-10-16";
    await fields.period.listeners.change(); await init();
    assert.deepEqual(rendered.at(-1), { period: "custom", range: { from: "2026-10-01", to: "2026-10-16" } });
    assert.equal(fields.from_date.value, "2026-10-01");
    assert.equal(fields.to_date.value, "2026-10-16");
    const valid = values.get(NURSE_OVERVIEW_STORAGE_KEY);
    fields.to_date.value = "2000-01-01"; await fields.to_date.listeners.change();
    assert.equal(values.get(NURSE_OVERVIEW_STORAGE_KEY), valid);
    await init(); assert.equal(fields.to_date.value, "2026-10-16");
    values.delete(NURSE_OVERVIEW_STORAGE_KEY);
    await init(); assert.equal(fields.period.value, "today");
  } finally { restore(); }
});

test("invalid saved dates or unavailable preference storage do not break overview filtering", async () => {
  const { fields, restore } = fixture("nurse");
  try {
    globalThis.sessionStorage = { getItem: () => JSON.stringify({ period: "custom", from: "2026-02-30", to: "2026-03-10" }), setItem() {} };
    await initOverviewPeriod(() => "ok", { storageKey: NURSE_OVERVIEW_STORAGE_KEY });
    assert.equal(fields.period.value, "today");
    globalThis.sessionStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
    await initOverviewPeriod(() => "ok", { storageKey: NURSE_OVERVIEW_STORAGE_KEY });
    fields.period.value = "week"; await fields.period.listeners.change();
    assert.equal(fields.period.value, "week");
  } finally { restore(); }
});

for (const role of ["doctor", "reception"]) test(`${role} overview applies period changes to counts, shifts and tickets through existing read endpoints`, async () => {
  const { nodes, fields, restore } = fixture(role);
  const requests = [];
  try {
    globalThis.fetch = async (url, options) => {
      const parsed = new URL(url); requests.push({ path: parsed.pathname, params: Object.fromEntries(parsed.searchParams), method: options.method });
      const day = fields.from_date.value;
      const items = parsed.pathname === "/encounters" ? [
        { work_date: day, encounter_status: "CHECKED_IN" },
        { work_date: day, encounter_status: "IN_PROGRESS" },
        { work_date: day, encounter_status: "CONFIRMED" },
      ] : [];
      return Response.json({ items, total: items.length, page: 1, page_size: 100 });
    };
    const file = new URL(`../static/js/pages/${role}.js`, import.meta.url);
    const source = (await readFile(file, "utf8"))
      .replace('import { staffReady } from "../core/staff_workspace.js";', `const staffReady = Promise.resolve({role_name:"${role === "doctor" ? "DOCTOR" : "RECEPTIONIST"}"});`)
      .replace(/from "(\.\.[^"]+)"/g, (_, path) => `from ${JSON.stringify(new URL(path, file).href)}`);
    await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
    assert.equal(fields.period.value, "today");
    assert.equal(requests.find(r => r.path === "/encounters").params.work_date, fields.from_date.value);
    assert.match(nodes.get("#page-body").innerHTML, /<strong>3<\/strong>/);
    for (const period of ["week", "month", "custom"]) {
      const previous = requests.length;
      fields.period.value = period;
      if (period === "custom") { fields.from_date.value = "2026-10-01"; fields.to_date.value = "2026-10-31"; }
      await fields.period.listeners.change();
      assert.ok(requests.length > previous);
      assert.equal(requests.slice(previous).find(r => r.path === "/encounters").params.work_date, undefined);
      assert.match(nodes.get("#page-body").innerHTML, /<strong>3<\/strong>/);
    }
    assert.ok(requests.every(r => r.method === "GET"));
    assert.equal(nodes.get("#overview-feedback").textContent, "");
  } finally { restore(); }
});

