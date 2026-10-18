import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { staffRoles, mountStaffWorkspace } from "../static/js/core/staff_shell.js";
import { returnUrl, workspaceUrl } from "../static/js/core/session.js";
import "../static/js/core/staff_workspace.js";

test("assigned rooms search all pages live by code and room, keeping date scope and eight-card pagination", async () => {
  class Node {
    innerHTML = ""; textContent = ""; value = ""; dataset = {}; listeners = {}; buttons = [];
    addEventListener(type, callback) { this.listeners[type] = callback; }
    querySelectorAll() { return this.buttons; }
    replaceChildren() { this.innerHTML = ""; }
  }
  const originals = ["document", "window", "fetch", "location"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const shifts = Array.from({ length: 23 }, (_, i) => ({ schedule_id: i + 1, room_id: i + 101, room_name: `Phòng ${i + 1}`, work_date: i % 2 ? "2026-10-19" : "2026-10-18", start_time: "08:00:00", end_time: "11:30:00" }));
  try {
    for (const range of ["", "?from_date=2026-10-18&to_date=2026-10-18"]) {
      const nodes = new Map(["#page-body", "#page-status", "#staff-dialog-close", "#assignment-list", "#list-pagination", "#nurse-assignment-search"].map(id => [id, new Node()]));
      const search = nodes.get("#nurse-assignment-search");
      search.elements = { room_code: new Node(), room_name: new Node(), from_date: new Node(), to_date: new Node() };
      const previous = new Node(), next = new Node(); previous.dataset.step = "-1"; next.dataset.step = "1";
      nodes.get("#list-pagination").buttons = [previous, next];
      const calls = [];
      Object.assign(globalThis, {
        document: { body: { dataset: { role: "nurse", page: "assignments" } }, querySelector: id => nodes.get(id) || null },
        location: new URL(`http://localhost/assignments.html${range}`),
        window: { addEventListener() {} },
        fetch: async url => {
          const u = new URL(url); assert.equal(u.pathname, "/nurse/assignments");
          const page = Number(u.searchParams.get("page")), size = Math.min(10, Number(u.searchParams.get("page_size")));
          calls.push({ page, size });
          return Response.json({ items: shifts.slice((page - 1) * size, page * size), total: shifts.length, page, page_size: size });
        },
      });
      const file = new URL("../static/js/pages/nurse.js", import.meta.url);
      const source = (await readFile(file, "utf8"))
        .replace('import { staffReady } from "../core/staff_workspace.js";', 'const staffReady = Promise.resolve({role_name:"NURSE"});')
        .replace(/from "(\.\.[^"]+)"/g, (_, path) => `from ${JSON.stringify(new URL(path, file).href)}`);
      await import(`data:text/javascript;base64,${Buffer.from(source + `\n// assignments range ${range}`).toString("base64")}`);
      const count = () => (nodes.get("#assignment-list").innerHTML.match(/<tr><td><strong>/g) || []).length;
      assert.equal(count(), 8);
      await next.listeners.click();
      assert.equal(count(), range ? 4 : 8);
      if (!range) { await next.listeners.click(); assert.equal(count(), 7); }
      if (range) assert.doesNotMatch(nodes.get("#assignment-list").innerHTML, /19\/10\/2026/);
      assert.equal(calls.length, 3);
      search.elements.room_code.value = "ph 123"; search.elements.room_code.listeners.input();
      assert.equal(count(), 1);
      assert.match(nodes.get("#assignment-list").innerHTML, /PH_123/);
      search.elements.room_name.value = "PHONG 23"; search.elements.room_name.listeners.input();
      assert.equal(count(), 1);
      search.elements.room_name.value = "phong 22"; search.elements.room_name.listeners.input();
      assert.equal(count(), 0);
      search.elements.room_code.value = ""; search.elements.room_code.listeners.input();
      assert.equal(count(), range ? 0 : 1);
      search.elements.room_name.value = ""; search.elements.room_name.listeners.input();
      assert.equal(count(), 8);
      assert.match(nodes.get("#list-pagination").innerHTML, /Trang 1\//);
      assert.doesNotMatch(nodes.get("#list-pagination").innerHTML, /kết quả/);
      search.elements.from_date.value = "2026-10-19";
      search.elements.to_date.value = "2026-10-19";
      search.elements.to_date.listeners.change();
      assert.equal(count(), 8);
      assert.doesNotMatch(nodes.get("#assignment-list").innerHTML, /18\/10\/2026/);
      await next.listeners.click(); assert.equal(count(), 3);
      search.elements.to_date.value = "2026-10-18";
      search.elements.to_date.listeners.input();
      assert.equal(count(), 0);
      assert.match(nodes.get("#assignment-list").innerHTML, /khoảng ngày hợp lệ/);
      search.elements.from_date.value = ""; search.elements.to_date.value = "";
      search.elements.from_date.listeners.input();
      assert.equal(count(), 8);
      assert.match(nodes.get("#list-pagination").innerHTML, /Trang 1\/3/);
      assert.equal(calls.length, 3);
    }
  } finally {
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});

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
  const rows = ["CHECKED_IN", "IN_PROGRESS", "COMPLETED"].map((encounter_status, index) => ({ encounter_id: index + 1, schedule_id: 1, encounter_status, work_date: today }));
  const keys = ["document", "window", "fetch"], originals = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const requests = [];
  const tick = async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); };
  try {
    Object.assign(globalThis, {
      document: { body: { dataset: { role: "nurse", page: "overview" } }, querySelector: selector => nodes.get(selector) || null },
      window: { addEventListener() {} },
      fetch: async (url, options) => {
        const parsed = new URL(url); requests.push({ path: parsed.pathname, method: options.method, params: Object.fromEntries(parsed.searchParams) });
        const items = parsed.pathname === "/nurse/assignments" ? [{ schedule_id: 1, work_date: today, start_time: "08:00:00", end_time: "11:30:00" }] : parsed.pathname === "/patients" ? [] : rows;
        return Response.json({ items, total: items.length, page: 1, page_size: 100 });
      },
    });
    const file = new URL("../static/js/pages/nurse.js", import.meta.url);
    const source = (await readFile(file, "utf8"))
      .replace('import { staffReady } from "../core/staff_workspace.js";', 'const staffReady = Promise.resolve({ role_name: "NURSE" });')
      .replace(/from "(\.\.[^"]+)"/g, (_, path) => `from ${JSON.stringify(new URL(path, file).href)}`);
    await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
    assert.equal(fields.period.value, "today");
    assert.equal(requests.find(r => r.path === "/encounters").params.work_date, today);
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
