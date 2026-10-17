import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { staffRoles, resolveStaffRole, canOpenStaffPage, avatarUrl } from "../static/js/core/staff_workspace.js";
import { returnUrl, workspaceUrl, profileUrl } from "../static/js/core/session.js";
import { adminSections } from "../static/js/data/admin_navigation.js";

const templates = new URL("../templates/", import.meta.url);
test("staff permissions require the exact backend role; a query parameter grants no access", () => {
  for (const [server, local] of [["DOCTOR", "doctor"], ["NURSE", "nurse"], ["RECEPTIONIST", "reception"]]) {
    assert.equal(canOpenStaffPage(server, local, "overview"), true);
    assert.equal(canOpenStaffPage(server, "admin", "profile"), true);
    for (const other of ["doctor", "nurse", "reception", "admin"].filter(r => r !== local))
      assert.equal(canOpenStaffPage(server, other, "overview"), false);
  }
  assert.equal(canOpenStaffPage("ADMIN", "admin", "profile"), false);
  assert.equal(canOpenStaffPage("ADMIN", "admin", "home"), true);
  assert.equal(canOpenStaffPage("ADMIN", "doctor", "overview"), false);
  for (const role of ["USER", "constructor", "__proto__", "doctor", undefined])
    for (const page of ["overview", "profile"]) assert.equal(canOpenStaffPage(role, "doctor", page), false);
  for (const role of ["doctor", "nurse", "reception", "admin"]) assert.equal(resolveStaffRole(role), role);
  assert.equal(resolveStaffRole("patient"), null);
});
test("sidebar pages exist and calendars protect employee data with the shared session gate", async () => {
  for (const [role, config] of Object.entries(staffRoles)) {
    for (const [page, , filename] of config.pages) {
      const html = await readFile(new URL(`(${role})/${filename}`, templates), "utf8");
      assert.ok(html.includes(`data-role="${role}"`)); assert.ok(html.includes(`data-page="${page}"`));
      if (role !== "admin") assert.doesNotMatch(html, /id="page-refresh"|Tải lại dữ liệu/);
      if (page === "work_calendar") {
        assert.notEqual(role, "admin");
        assert.match(html, /pages\/work_calendar\.js/);
        assert.match(html, /pages\/work_calendar\.js\?[^" ]+" blocking="render"/);
        assert.match(html, /Gửi đơn xin nghỉ/);
        assert.doesNotMatch(html, /class="preview-note"|calendar-context|calendar-stats|stat-days|stat-shifts|stat-hours/);
        assert.match(html, /staff-auth-pending/); assert.match(html, /<main[^>]* inert>/);
        assert.doesNotMatch(html, /Chỉ xem trước|lịch minh họa/);
        continue;
      }
      assert.match(html, /staff-auth-pending/); assert.match(html, /<main[^>]* inert>/);
      assert.match(html, new RegExp(`type="module" src="../../static/js/pages/${role}\.js(?:\\?[^" ]*)?"`));
      if (role !== "admin") assert.doesNotMatch(html, /minh họa|MINHHOA|Bệnh nhân mẫu|chưa kết nối/i);
    }
    if (config.pages.length) {
      const script = await readFile(new URL(`../static/js/pages/${role}.js`, import.meta.url), "utf8");
      assert.match(script, role === "admin" ? /await requireAdmin/ : /await staffReady/);
      assert.doesNotMatch(script, /MINHHOA|HS-MAU|Bệnh nhân mẫu/);
    }
  }
});

test("employee calendars await authentication and use the leave API without sample assignments", async () => {
  assert.equal(staffRoles.admin.pages.some(([key]) => key === "work_calendar"), false);
  const source = await readFile(new URL("../static/js/pages/work_calendar.js", import.meta.url), "utf8");
  assert.match(source, /await staffReady/);
  assert.match(source, /api\/staff_leave\.js/);
  assert.doesNotMatch(source, /Phòng khám 201|Quầy tiếp đón 01|const pattern|Xem trước đơn/);
});
test("staff profile stays available to hospital staff while admin keeps its own workspace", async () => {
  const html = await readFile(new URL("components/profile.html", templates), "utf8");
  assert.match(html, /pages\/staff_profile.js/); assert.doesNotMatch(html, /role-picker|minh họa/i);
  assert.notEqual(profileUrl.pathname, new URL("components/profile.html", templates).pathname);
  const adminKeys = adminSections.flatMap(([, items]) => items.map(([key]) => key));
  assert.deepEqual(staffRoles.admin.pages.map(([key]) => key), adminKeys);
  assert.ok(adminKeys.includes("home") && adminKeys.includes("users"));
  for (const role of ["DOCTOR", "NURSE", "RECEPTIONIST", "ADMIN"]) {
    const shared = new URL("components/profile.html", templates);
    globalThis.location = workspaceUrl(role);
    assert.equal(returnUrl(shared.href, role).href, role === "ADMIN" ? workspaceUrl(role).href : shared.href);
    assert.equal(returnUrl(profileUrl.href, role).href, workspaceUrl(role).href);
  }
});

test("doctor navigation uses the merged personal profile and removes the retired professional page", async () => {
  assert.equal(staffRoles.doctor.pages.some(([key]) => key === "professional"), false);
  await assert.rejects(readFile(new URL("(doctor)/professional.html", templates), "utf8"), { code: "ENOENT" });
  const script = await readFile(new URL("../static/js/pages/doctor.js", import.meta.url), "utf8");
  assert.match(script, /components\/profile\.html\?role=doctor/);
  assert.doesNotMatch(script, /professional\.html|async function professional/);
  globalThis.location = workspaceUrl("DOCTOR");
  assert.equal(returnUrl(new URL("(doctor)/professional.html", templates).href, "DOCTOR").href, workspaceUrl("DOCTOR").href);
});
test("doctor avatars use only backend uploads and reject external or executable image URLs", () => {
  const path = "/uploads/avatars/" + "a".repeat(32) + ".jpg";
  assert.equal(new URL(avatarUrl(path)).pathname, path);
  assert.equal(new URL(avatarUrl(path)).origin, "http://127.0.0.1:5000");
  for (const value of ["https://elsewhere.test/photo.jpg", "javascript:alert(1)", "/static/assets/photo.jpg", "/uploads/avatars/../private.png", null, "//evil.test/a.jpg"]) assert.equal(avatarUrl(value), "");
});

// Regression for opening walk-in directly with a selected backend patient.
test("walk-in direct entry loads the selected API patient and never creates an encounter on load", async () => {
  class Node {
    innerHTML = ""; textContent = ""; hidden = false; dataset = {}; listeners = {};
    addEventListener(name, handler) { this.listeners[name] = handler; }
  }
  const selectors = ["#page-status", "#page-body", "#staff-dialog-close", "#walkin-selected", "#walkin-search", "#walkin-form", "#walkin-created"];
  const nodes = new Map(selectors.map(selector => [selector, new Node()]));
  const keys = ["document", "location", "fetch"], previous = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const requests = [];
  Object.assign(globalThis, {
    document: { body: { dataset: { role: "reception", page: "walk_in" } }, querySelector: selector => nodes.get(selector) || null },
    location: { search: "?patient_id=42" },
    fetch: async (url, options) => {
      requests.push({ path: new URL(url).pathname, method: options.method });
      if (new URL(url).pathname === "/patients/42") return Response.json({ patient: { patient_id: 42, full_name: "Người khám từ API", dob: "1990-05-20", phone: "0931234567", is_archived: false } });
      if (new URL(url).pathname === "/doctors") return Response.json({ items: [{ doctor_profile_id: 99, full_name: "Bác sĩ API", department_name: "Khoa API" }], total: 1, page: 1, page_size: 100 });
      throw new Error(`Unexpected request ${url}`);
    },
  });
  try {
    const file = new URL("../static/js/pages/reception.js", import.meta.url);
    const code = (await readFile(file, "utf8"))
      .replace('import { staffReady } from "../core/staff_workspace.js";', 'const staffReady = Promise.resolve({ role_name: "RECEPTIONIST" });')
      .replace(/from "(\.\.[^"]+)"/g, (_, path) => `from ${JSON.stringify(new URL(path, file).href)}`);
    await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
    assert.match(nodes.get("#walkin-selected").innerHTML, /Người khám từ API/);
    assert.match(nodes.get("#walkin-selected").innerHTML, /42/);
    assert.match(nodes.get("#page-body").innerHTML, /value="99"/);
    assert.doesNotMatch(nodes.get("#page-status").textContent, /initialization|Cannot access/);
    assert.deepEqual(requests, [{ path: "/patients/42", method: "GET" }, { path: "/doctors", method: "GET" }]);
    assert.equal(typeof nodes.get("#walkin-form").listeners.submit, "function");
  } finally {
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});
