import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { staffRoles, mountStaffWorkspace } from "../static/js/core/staff_shell.js";
import { returnUrl, workspaceUrl } from "../static/js/core/session.js";
import "../static/js/core/staff_workspace.js";

test("nurse navigation follows the agreed order and keeps profile and logout in the sidebar", () => {
  assert.deepEqual(staffRoles.nurse.pages.map(([, label]) => label), ["Tổng quan", "Danh sách khám", "Phòng được phân công", "Hồ sơ bệnh nhân", "Lịch làm việc"]);
  const original = ["document", "matchMedia", "location"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const node = () => ({ innerHTML: "", addEventListener() {}, after() {}, setAttribute() {}, querySelector: () => ({}), focus() {} });
  const sidebar = node(), topbar = node(), toggle = node();
  try {
    globalThis.document = { body: { dataset: { role: "nurse", page: "records" } }, querySelector: selector => ({ "#staff-sidebar": sidebar, "#staff-topbar": topbar, "#staff-menu-toggle": toggle })[selector], createElement: node, addEventListener() {} };
    globalThis.matchMedia = () => ({ addEventListener() {} });
    globalThis.location = workspaceUrl("NURSE");
    mountStaffWorkspace();
    assert.match(sidebar.innerHTML, /Hồ sơ cá nhân/);
    assert.match(sidebar.innerHTML, /id="staff-signout"/);
    assert.doesNotMatch(sidebar.innerHTML, /Phạm vi hỗ trợ|support\.html/);
    assert.match(sidebar.innerHTML, /records\.html" aria-current="page"/);
    assert.equal((sidebar.innerHTML + topbar.innerHTML).match(/id="staff-signout"/g).length, 1);
    for (const file of ["records", "work_calendar"]) {
      const url = new URL(`${file}.html`, workspaceUrl("NURSE"));
      assert.equal(returnUrl(url.href, "NURSE").href, url.href);
      assert.notEqual(returnUrl(url.href, "DOCTOR").href, url.href);
    }
    assert.deepEqual(staffRoles.doctor.pages.map(([key]) => key), ["overview", "work_calendar", "schedule", "encounters", "clinical", "history"]);
    assert.deepEqual(staffRoles.reception.pages.map(([key]) => key), ["overview", "work_calendar", "encounters", "walk_in", "patients", "coordination"]);
  } finally {
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});

test("nurse dashboard defaults to today and applies week, month and custom dates to statistics and shifts", async () => {
  class Node {
    innerHTML = ""; textContent = ""; value = ""; dataset = {}; listeners = {}; validity = "";
    addEventListener(type, callback) { this.listeners[type] = callback; }
    setAttribute(key, value) { this[key] = value; }
    setCustomValidity(text) { this.validity = text; }
    reportValidity() { return Object.values(this.elements || {}).every(el => !el.validity); }
  }
  const nodes = new Map(["#page-body", "#page-status", "#staff-dialog-close", "#overview-period-control", "#overview-filter", "#overview-custom", "#overview-feedback"].map(key => [key, new Node()]));
  const fields = Object.fromEntries(["period", "from_date", "to_date"].map(key => [key, new Node()]));
  nodes.get("#overview-filter").elements = fields;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const rows = ["CHECKED_IN", "IN_PROGRESS", "COMPLETED"].map((encounter_status, index) => ({ encounter_id: index + 1, encounter_status, work_date: today }));
  const keys = ["document", "window", "fetch"], originals = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const requests = [];
  const tick = async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); };
  try {
    Object.assign(globalThis, {
      document: { body: { dataset: { role: "nurse", page: "overview" } }, querySelector: selector => nodes.get(selector) || null },
      window: { addEventListener() {} },
      fetch: async (url, options) => {
        const parsed = new URL(url); requests.push({ path: parsed.pathname, method: options.method, params: Object.fromEntries(parsed.searchParams) });
        const items = parsed.pathname === "/nurse/assignments" ? [] : rows;
        return Response.json({ items, total: items.length, page: 1, page_size: 100 });
      },
    });
    const file = new URL("../static/js/pages/nurse.js", import.meta.url);
    const source = (await readFile(file, "utf8"))
      .replace('import { staffReady } from "../core/staff_workspace.js";', 'const staffReady = Promise.resolve({ role_name: "NURSE" });')
      .replace(/from "(\.\.[^"]+)"/g, (_, path) => `from ${JSON.stringify(new URL(path, file).href)}`);
    await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
    assert.equal(fields.period.value, "today");
    assert.equal(requests.at(-1).params.work_date, today);
    assert.match(nodes.get("#page-body").innerHTML, /Chờ khám/);
    assert.match(nodes.get("#page-body").innerHTML, /Đang khám/);
    assert.match(nodes.get("#page-body").innerHTML, /Đã khám/);
    for (const [period, label] of [["week", "tuần này"], ["month", "tháng này"]]) {
      fields.period.value = period; fields.period.listeners.change(); await tick();
      assert.equal(requests.at(-1).params.work_date, undefined);
      assert.match(nodes.get("#page-body").innerHTML, new RegExp(label));
      assert.match(nodes.get("#page-body").innerHTML, /<strong>1<\/strong>/);
    }
    fields.period.value = "custom"; fields.to_date.value = "2000-01-01";
    const before = requests.length;
    fields.period.listeners.change(); await tick();
    assert.equal(nodes.get("#overview-custom").hidden, false);
    assert.match(fields.to_date.validity, /ngày kết thúc/i);
    assert.equal(requests.length, before);
    assert.match(nodes.get("#page-body").innerHTML, /Chờ khám/);
    assert.match(nodes.get("#overview-feedback").textContent, /hợp lệ/);
    fields.to_date.value = today; fields.to_date.listeners.change(); await tick();
    assert.equal(fields.to_date.validity, "");
    assert.ok(requests.every(r => r.method === "GET" && !Object.hasOwn(r.params, "user_id") && !Object.hasOwn(r.params, "nurse_id")));
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});
