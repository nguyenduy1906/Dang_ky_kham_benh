import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { requireAdmin } from "../static/js/core/admin_access.js";
import { workspaceUrl } from "../static/js/core/session.js";

let main, status, classes, redirects, requests, response, storage;
beforeEach(() => {
  main = { inert: true };
  status = { hidden: false, textContent: "", children: [], append(node) { this.children.push(node); } };
  classes = new Set(["staff-auth-pending"]);
  storage = new Map([["neu-medical.auth", JSON.stringify({ token: "admin-test", expiresAt: Date.now() + 60000 })]]);
  redirects = []; requests = [];
  globalThis.window = new EventTarget();
  globalThis.location = new URL(workspaceUrl("ADMIN"));
  location.replace = url => redirects.push(new URL(url));
  globalThis.document = {
    body: { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } },
    querySelector: selector => selector === "#main-content" ? main : status,
    createElement: () => ({ addEventListener(name, handler) { this[name] = handler; } }),
  };
  globalThis.sessionStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  response = () => Response.json({ user: { user_id: 1, role_name: "ADMIN", full_name: "Admin kiểm thử" } });
  globalThis.fetch = async (url, options) => { requests.push({ path: new URL(url).pathname, method: options.method }); return response(); };
});

test("admin entry uses the backend role and enables the existing preview without business writes", async () => {
  const user = await requireAdmin();
  assert.equal(user.role_name, "ADMIN");
  assert.equal(main.inert, false);
  assert.equal(status.hidden, true);
  assert.equal(classes.has("staff-auth-pending"), false);
  assert.deepEqual(requests, [{ path: "/me", method: "GET" }]);
  assert.equal(redirects.length, 0);
});

test("guest and expired sessions go to login while keeping admin content hidden", async () => {
  storage.clear();
  assert.equal(await requireAdmin(), null);
  assert.equal(main.inert, true);
  assert.equal(classes.has("staff-auth-pending"), true);
  assert.equal(requests.length, 0);
  assert.equal(new URL(redirects[0].searchParams.get("next")).pathname, workspaceUrl("ADMIN").pathname);
});

test("patient and other staff roles cannot open admin by changing the URL role", async () => {
  location.searchParams.set("role", "admin");
  for (const role of ["USER", "DOCTOR", "NURSE", "RECEPTIONIST"]) {
    response = () => Response.json({ user: { user_id: 2, role_name: role } });
    assert.equal(await requireAdmin(), null);
    assert.equal(redirects.at(-1).href, workspaceUrl(role).href);
    assert.equal(main.inert, true);
  }
});

test("verification failure leaves a retry and does not expose or mutate admin data", async () => {
  response = () => { throw new Error("offline"); };
  assert.equal(await requireAdmin(), null);
  assert.equal(main.inert, true);
  assert.equal(classes.has("staff-auth-pending"), true);
  assert.equal(status.children[0].textContent, "Thử lại");
  assert.equal(redirects.length, 0);
  assert.ok(storage.has("neu-medical.auth"));
  assert.equal(requests.every(call => call.method === "GET"), true);
});

test("a late admin verification cannot reveal a page after navigation", async () => {
  let finish;
  response = () => new Promise(resolve => { finish = resolve; });
  const pending = requireAdmin();
  window.dispatchEvent(new Event("pagehide"));
  finish(Response.json({ user: { user_id: 1, role_name: "ADMIN" } }));
  assert.equal(await pending, null);
  assert.equal(main.inert, true);
  assert.equal(classes.has("staff-auth-pending"), true);
});
