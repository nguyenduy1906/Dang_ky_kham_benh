import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { clearSession, profileUrl, loginUrl } from "../static/js/core/session.js";

class Element {
  children = []; listeners = {}; hidden = false; inert = false; textContent = "";
  value = ""; disabled = false; dataset = {}; attributes = {}; validationMessage = ""; focused = false;
  classList = { add() {}, remove() {} };
  constructor(tag = "div") { this.tag = tag; }
  querySelector(tag) { return this.children.find(node => node.tag === tag); }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  setAttribute(name, value) { this.attributes[name] = value; }
  setCustomValidity(text) { this.validationMessage = text; }
  focus() { this.focused = true; }
}
let nodes, stored, calls, respond, redirects, instance = 0;
const user = { user_id: 42, role_name: "USER", full_name: "Tên từ database <b>giữ nguyên văn bản</b>",
  phone: "0912345678", email: "patient@example.test", email_verified: true,
  account_status: "ACTIVE", created_at: "2026-09-01T18:00:00Z" };
const tick = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
beforeEach(() => {
  nodes = new Map(); stored = new Map(); calls = []; redirects = [];
  for (const key of ["main", "profile-auth-status", "profile-details", "profile-edit", "profile-form", "profile-message",
    "profile-save", "profile-cancel", "profile-edit-actions", "profile-edit-full-name", "profile-edit-phone", "profile-edit-email",
    "profile-id", "profile-full-name", "profile-phone", "profile-email", "profile-created", "profile-status"]) nodes.set(key, new Element());
  nodes.get("profile-auth-status").children.push(new Element("p"), new Element("button"));
  nodes.get("profile-form").reportValidity = () => ["full-name", "phone", "email"].every(key => !nodes.get(`profile-edit-${key}`).validationMessage);
  globalThis.document = { body: new Element(), querySelector: selector => nodes.get(selector.slice(1)) };
  globalThis.window = new EventTarget();
  globalThis.location = { href: profileUrl.href + "?user_id=999", replace: href => redirects.push(new URL(href)) };
  globalThis.sessionStorage = { getItem: key => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
  stored.set("neu-medical.auth", JSON.stringify({ token: "patient-token", expiresAt: Date.now() + 60000 }));
  respond = () => Response.json({ user });
  globalThis.fetch = async (url, options) => { calls.push({ url: new URL(url), options }); return respond(options); };
});
async function controller() {
  const file = new URL("../static/js/pages/profile.js", import.meta.url);
  const source = (await readFile(file, "utf8")).replace(/from "(\.\.[^"]+)"/g,
    (_, path) => `from ${JSON.stringify(new URL(path, file).href)}`);
  await import(`data:text/javascript;base64,${Buffer.from(source + `\n// instance ${instance++}`).toString("base64")}`);
  await tick();
}
const edit = () => nodes.get("profile-edit").listeners.click();
const input = (field, value) => { const node = nodes.get(`profile-edit-${field}`); node.value = value; node.listeners.input(); };
const submit = () => nodes.get("profile-form").listeners.submit({ preventDefault() {} });

test("authorized /me supplies account values as plain text without accepting a URL account ID", async () => {
  await controller();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, "/me");
  assert.equal(calls[0].url.search, "");
  assert.equal(calls[0].options.headers.get("Authorization"), "Bearer patient-token");
  assert.equal(nodes.get("profile-full-name").textContent, user.full_name);
  assert.equal(nodes.get("profile-id").textContent, "42");
  assert.equal(nodes.get("profile-phone").textContent, user.phone);
  assert.equal(nodes.get("profile-email").textContent, user.email);
  assert.match(nodes.get("profile-created").textContent, /2.*9.*2026/);
  assert.equal(nodes.get("profile-details").hidden, false);
  assert.equal(nodes.get("main").inert, false);
  assert.deepEqual(Object.keys(JSON.parse(stored.get("neu-medical.auth"))).sort(), ["expiresAt", "token"]);
  const html = await readFile(new URL("../templates/(patient)/profile.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /profile-summary|profile-avatar|Tải lại thông tin|profile-refresh|Xác minh email|profile-email-state/);
  assert.match(html, /Chỉnh sửa thông tin/);
});
test("editing and cancelling do not write; cancelling restores backend values", async () => {
  await controller(); edit();
  assert.equal(nodes.get("profile-edit-actions").hidden, false);
  assert.equal(nodes.get("profile-edit-full-name").focused, true);
  input("full-name", "Thông tin chưa lưu");
  nodes.get("profile-cancel").listeners.click();
  assert.equal(calls.length, 1);
  assert.equal(nodes.get("profile-full-name").textContent, user.full_name);
  assert.equal(nodes.get("profile-edit-full-name").value, user.full_name);
  assert.equal(nodes.get("profile-edit-actions").hidden, true);
});
test("save PATCHes only changed supported fields with authorization and displays the backend response", async () => {
  await controller(); edit();
  input("full-name", "  Nguyễn Văn Mới  "); input("email", "NEW@EXAMPLE.TEST"); input("phone", "+84 912.345.678");
  respond = () => Response.json({ user: { ...user, full_name: "Nguyễn Văn Mới (server)", email: "new@example.test", email_verified: false } });
  await submit();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url.pathname, "/me");
  assert.equal(calls[1].options.method, "PATCH");
  assert.equal(calls[1].options.headers.get("Authorization"), "Bearer patient-token");
  assert.deepEqual(JSON.parse(calls[1].options.body), { full_name: "Nguyễn Văn Mới", email: "new@example.test" });
  assert.equal(nodes.get("profile-full-name").textContent, "Nguyễn Văn Mới (server)");
  assert.equal(nodes.get("profile-email").textContent, "new@example.test");
  assert.equal(nodes.get("profile-edit-email").value, "new@example.test");
  assert.equal(nodes.get("profile-edit-actions").hidden, true);
  assert.match(nodes.get("profile-message").textContent, /Đã lưu/);
});
test("absent identity fields have neutral empty states and are omitted when saving another field", async () => {
  respond = () => Response.json({ user: { ...user, phone: null, email: null, created_at: null } });
  await controller();
  assert.equal(nodes.get("profile-phone").textContent, "Chưa cập nhật");
  assert.equal(nodes.get("profile-email").textContent, "Chưa cập nhật");
  edit(); await submit(); assert.equal(calls.length, 1);
  edit(); input("full-name", "Đổi tên"); await submit();
  assert.deepEqual(JSON.parse(calls[1].options.body), { full_name: "Đổi tên" });
});
test("unchanged or invalid values do not send PATCH; existing email and phone cannot be cleared", async () => {
  await controller(); edit(); await submit(); assert.equal(calls.length, 1);
  edit();
  for (const [field, badValue] of [["full-name", " "], ["phone", ""], ["phone", "123"], ["email", ""], ["email", "x@y"]]) {
    nodes.get("profile-cancel").listeners.click(); edit(); input(field, badValue); await submit();
    assert.equal(calls.length, 1, `${field}: ${badValue}`);
    assert.notEqual(nodes.get(`profile-edit-${field}`).validationMessage, "");
  }
});
test("backend conflict preserves edits and original values, and retry saves the same changes", async () => {
  await controller(); edit(); input("email", "duplicate@example.test");
  respond = () => Response.json({ error: { code: "DUPLICATE", message: "Email đã được sử dụng" } }, { status: 409 });
  await submit();
  assert.equal(nodes.get("profile-edit-email").value, "duplicate@example.test");
  assert.equal(nodes.get("profile-email").textContent, user.email);
  assert.equal(nodes.get("profile-edit-actions").hidden, false);
  assert.equal(nodes.get("profile-save").disabled, false);
  assert.equal(nodes.get("profile-message").dataset.state, "error");
  assert.match(nodes.get("profile-message").textContent, /Email đã được sử dụng/);
  respond = () => Response.json({ user: { ...user, email: "duplicate@example.test", email_verified: false } });
  await submit();
  assert.equal(nodes.get("profile-email").textContent, "duplicate@example.test");
  assert.equal(calls.length, 3);
});
test("offline loading conceals personal information, preserves the session and supports retry", async () => {
  respond = () => { throw new Error("offline"); };
  await controller();
  const retry = nodes.get("profile-auth-status").querySelector("button");
  assert.equal(retry.hidden, false);
  assert.equal(nodes.get("profile-details").hidden, true);
  assert.equal(stored.size, 1);
  respond = () => Response.json({ user });
  retry.listeners.click(); await tick();
  assert.equal(nodes.get("profile-details").hidden, false);
});
test("guest and expired sessions cannot display personal data and return to profile after signing in", async () => {
  stored.clear(); await controller();
  assert.equal(calls.length, 0);
  assert.equal(nodes.get("profile-details").hidden, true);
  assert.equal(new URL(redirects.at(-1).searchParams.get("next")).pathname.endsWith("/profile.html"), true);
  stored.set("neu-medical.auth", JSON.stringify({ token: "expired-on-server", expiresAt: Date.now() + 60000 }));
  respond = () => Response.json({ error: { message: "Hết hạn" } }, { status: 401 });
  await controller();
  assert.equal(stored.size, 0);
  assert.equal(nodes.get("profile-full-name").textContent, "");
});
test("a session expiring during editing cannot write or retain visible private input", async () => {
  await controller(); edit(); input("full-name", "Đang nhập");
  stored.set("neu-medical.auth", JSON.stringify({ token: "patient-token", expiresAt: Date.now() - 1 }));
  await submit();
  assert.equal(calls.length, 1);
  assert.equal(nodes.get("profile-edit-full-name").value, "");
  assert.equal(nodes.get("profile-details").hidden, true);
  assert.equal(redirects.length, 1);
});
test("PATCH authentication failure clears private information and the expired session", async () => {
  await controller(); edit(); input("full-name", "Đổi tên");
  respond = () => Response.json({ error: { message: "Hết hạn" } }, { status: 401 });
  await submit();
  assert.equal(stored.size, 0);
  assert.equal(nodes.get("profile-details").hidden, true);
  assert.equal(nodes.get("profile-edit-full-name").value, "");
});
test("late GET cannot repopulate a hidden page, while a restored page reads fresh backend values", async () => {
  let finish;
  respond = () => new Promise(resolve => { finish = resolve; });
  await controller(); window.dispatchEvent(new Event("pagehide"));
  finish(Response.json({ user })); await tick();
  assert.equal(nodes.get("profile-details").hidden, true);
  assert.equal(nodes.get("profile-full-name").textContent, "");
  respond = () => Response.json({ user: { ...user, full_name: "Đọc lại từ database" } });
  window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true })); await tick();
  assert.equal(nodes.get("profile-full-name").textContent, "Đọc lại từ database");
  clearSession(); await tick();
  assert.equal(nodes.get("profile-details").hidden, true);
  assert.equal(nodes.get("profile-full-name").textContent, "");
});
test("saving prevents duplicate submissions and a late PATCH cannot restore private data after navigation", async () => {
  await controller(); edit(); input("full-name", "Đổi tên");
  let finish;
  respond = () => new Promise(resolve => { finish = resolve; });
  const pending = submit(); await tick(); await submit();
  assert.equal(calls.length, 2);
  assert.equal(nodes.get("profile-save").disabled, true);
  assert.equal(nodes.get("profile-edit-full-name").disabled, true);
  nodes.get("profile-cancel").listeners.click();
  assert.equal(nodes.get("profile-edit-actions").hidden, false);
  window.dispatchEvent(new Event("pagehide"));
  assert.equal(calls[1].options.signal.aborted, true);
  finish(Response.json({ user: { ...user, full_name: "Đổi tên" } })); await pending;
  assert.equal(nodes.get("profile-details").hidden, true);
  assert.equal(nodes.get("profile-full-name").textContent, "");
  assert.equal(nodes.get("profile-edit-full-name").value, "");
});
test("a late PATCH cannot restore private data after logout", async () => {
  await controller(); edit(); input("email", "new@example.test");
  let finish;
  respond = () => new Promise(resolve => { finish = resolve; });
  const pending = submit(); await tick(); clearSession();
  finish(Response.json({ user: { ...user, email: "new@example.test" } })); await pending;
  assert.equal(nodes.get("profile-details").hidden, true);
  assert.equal(nodes.get("profile-edit-email").value, "");
  assert.equal(nodes.get("profile-message").textContent, "");
});
test("a mismatched backend account response is not rendered or reported as saved", async () => {
  await controller(); edit(); input("full-name", "Đổi tên");
  respond = () => Response.json({ user: { ...user, user_id: 999, full_name: "Tài khoản khác" } });
  await submit();
  assert.equal(nodes.get("profile-full-name").textContent, user.full_name);
  assert.equal(nodes.get("profile-edit-full-name").value, "Đổi tên");
  assert.equal(nodes.get("profile-message").dataset.state, "error");
});
test("staff accounts cannot display their private information on the patient profile page", async () => {
  respond = () => Response.json({ user: { ...user, role_name: "ADMIN" } });
  await controller();
  assert.equal(nodes.get("profile-details").hidden, true);
  assert.equal(nodes.get("profile-full-name").textContent, "");
  assert.equal(stored.size, 0);
  assert.equal(loginUrl(profileUrl).searchParams.get("next"), profileUrl.href);
});
