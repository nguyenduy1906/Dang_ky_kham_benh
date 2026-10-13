// Exercise the actual page controller with a minimal DOM and fetch doubles in tests only.
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { homeUrl, portalUrl } from "../static/js/core/session.js";

class Node {
  value = ""; textContent = ""; disabled = false; hidden = false;
  dataset = {}; listeners = {}; attributes = {}; children = []; open = false;
  classes = new Set();
  classList = { toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name) };
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  querySelector() { return this.submit; }
  querySelectorAll() { return this.children; }
  focus() {}
  reset() { this.children.forEach(node => { node.value = ""; }); }
  showModal() { this.open = true; }
  close() { this.open = false; this.listeners.close?.forEach(callback => callback()); }
}
let nodes, controls, calls, response, stored, destination, importCount = 0;
const file = new URL("../static/js/pages/auth.js", import.meta.url);
const source = (await readFile(file, "utf8")).replace(/from "(\.\.[^"]+)"/g,
  (_, path) => `from ${JSON.stringify(new URL(path, file).href)}`);
beforeEach(async () => {
  nodes = new Map(); controls = [new Node(), new Node()]; calls = []; stored = new Map(); destination = null;
  const ids = ["auth-card", "login-panel", "register-panel", "login-title", "register-title",
    "login-form", "login-status", "login-identifier", "login-password", "forgot-password",
    "register-form", "register-status", "register-name", "register-email", "register-phone",
    "register-password", "register-confirm", "recovery-dialog", "recovery-form", "recovery-close",
    "recovery-status", "recovery-identifier", "recovery-otp", "recovery-password",
    "recovery-identity-field", "recovery-otp-field", "recovery-password-field", "recovery-restart"];
  ids.forEach(id => nodes.set(id, new Node()));
  for (const form of ["login", "register", "recovery"]) {
    const node = nodes.get(`${form}-form`); node.submit = new Node();
    node.children = ids.filter(id => id.startsWith(`${form}-`) &&
      ["identifier", "password", "name", "email", "phone", "confirm", "otp", "restart"].includes(id.split("-").at(-1)))
      .map(id => nodes.get(id));
    node.children.push(node.submit);
  }
  controls[0].dataset.authMode = "login"; controls[1].dataset.authMode = "register";
  globalThis.document = {
    querySelector: selector => nodes.get(selector.slice(1)),
    getElementById: id => nodes.get(id),
    querySelectorAll: selector => selector === "[data-auth-mode]" ? controls : [],
  };
  globalThis.window = new EventTarget();
  globalThis.location = new URL(homeUrl);
  location.searchParams.set("next", portalUrl.href);
  location.replace = value => { destination = value; };
  globalThis.history = { replaceState() {} };
  globalThis.sessionStorage = { getItem: key => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
  globalThis.FormData = class {
    constructor() { this.values = ["full_name", "phone", "email", "password"].map(name =>
      [name, nodes.get(`register-${name === "full_name" ? "name" : name}`).value]); }
    [Symbol.iterator]() { return this.values[Symbol.iterator](); }
  };
  response = () => Response.json({ message: "Thành công" });
  globalThis.fetch = async (url, options) => {
    calls.push({ path: new URL(url).pathname, data: JSON.parse(options.body), options });
    return response(url, options);
  };
  await import(`data:text/javascript;base64,${Buffer.from(source + `\n// test instance ${importCount++}`).toString("base64")}`);
});
const submit = name => nodes.get(`${name}-form`).listeners.submit[0]({ preventDefault() {} });
const click = id => nodes.get(id).listeners.click[0]();
function validRegistration() {
  for (const [id, value] of Object.entries({ name: "Kiểm thử", phone: "0931234567", email: "",
    password: "Test-password-123", confirm: "Test-password-123" })) nodes.get(`register-${id}`).value = value;
}

test("login blocks duplicate submits and preserves the backend error", async () => {
  nodes.get("login-identifier").value = "0931234567"; nodes.get("login-password").value = "Wrong-password-123";
  let finish; response = () => new Promise(resolve => { finish = resolve; });
  const first = submit("login"); await submit("login"); assert.equal(calls.length, 1);
  finish(Response.json({ error: { code: "INVALID_CREDENTIALS", message: "Thông tin đăng nhập không đúng" } }, { status: 401 }));
  await first;
  assert.equal(nodes.get("login-status").textContent, "Thông tin đăng nhập không đúng");
  assert.equal(nodes.get("login-form").submit.disabled, false); assert.equal(destination, null);
});
test("successful login uses the backend token and returns to the requested portal", async () => {
  nodes.get("login-identifier").value = "0931234567"; nodes.get("login-password").value = "Test-password-123";
  response = () => Response.json({ access_token: "test-token", token_type: "Bearer", expires_in: 7200,
    user: { user_id: 1, role_name: "USER" } });
  await submit("login"); assert.equal(destination, portalUrl.href);
  assert.equal(nodes.get("login-password").value, "");
  assert.equal(JSON.parse(stored.get("neu-medical.auth")).token, "test-token");
});
test("staff login stays on the login form with a clear message and no saved token", async () => {
  nodes.get("login-identifier").value = "staff@example.test";
  nodes.get("login-password").value = "Test-password-123";
  for (const role of ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"]) {
    response = () => Response.json({ access_token: "staff-token", token_type: "Bearer", expires_in: 7200,
      user: { user_id: 2, role_name: role } });
    await submit("login");
    assert.match(nodes.get("login-status").textContent, /chỉ hỗ trợ đăng nhập bằng tài khoản bệnh nhân/);
    assert.equal(stored.size, 0); assert.equal(destination, null);
    assert.equal(nodes.get("login-form").submit.disabled, false);
  }
});
test("registration validates contact/confirmation and does not sign in automatically", async () => {
  validRegistration(); nodes.get("register-confirm").value = "Mismatch-123";
  await submit("register"); assert.equal(calls.length, 0);
  nodes.get("register-confirm").value = "Test-password-123";
  await submit("register"); assert.equal(calls[0].path, "/auth/register");
  assert.deepEqual(Object.keys(calls[0].data).sort(), ["email", "full_name", "password", "phone"]);
  assert.equal(nodes.get("login-identifier").value, "0931234567");
  assert.match(nodes.get("login-status").textContent, /Đăng ký thành công/);
  assert.equal(stored.size, 0); assert.equal(destination, null);
});
test("duplicate registration errors remain visible in the existing register panel", async () => {
  validRegistration(); response = () => Response.json({ error: { code: "DUPLICATE_IDENTITY", message: "Số điện thoại đã được sử dụng" } }, { status: 409 });
  await submit("register"); assert.equal(nodes.get("register-status").textContent, "Số điện thoại đã được sử dụng");
});
test("recovery calls all three existing APIs in order and clears secrets after success", async () => {
  click("forgot-password"); nodes.get("recovery-identifier").value = "0931234567";
  await submit("recovery"); assert.equal(nodes.get("recovery-otp-field").hidden, false);
  nodes.get("recovery-otp").value = "123456";
  response = () => Response.json({ reset_token: "test-reset-token", expires_in: 600 });
  await submit("recovery"); assert.equal(nodes.get("recovery-password-field").hidden, false);
  nodes.get("recovery-password").value = "Changed-password-123";
  response = () => Response.json({ message: "Đã đặt lại mật khẩu, hãy đăng nhập lại" });
  await submit("recovery");
  assert.deepEqual(calls.map(call => call.path), ["/auth/forgot-password", "/auth/verify-otp", "/auth/reset-password"]);
  assert.deepEqual(calls[2].data, { reset_token: "test-reset-token", new_password: "Changed-password-123" });
  assert.equal(nodes.get("recovery-dialog").open, false);
  assert.equal(nodes.get("recovery-password").value, ""); assert.equal(stored.size, 0);
  assert.match(nodes.get("login-status").textContent, /Đã đặt lại mật khẩu/);
});
test("invalid OTP stays on the OTP step and closing cancels a late recovery response", async () => {
  click("forgot-password"); nodes.get("recovery-identifier").value = "0931234567";
  await submit("recovery"); nodes.get("recovery-otp").value = "000000";
  response = () => Response.json({ error: { code: "INVALID_OTP", message: "OTP không hợp lệ hoặc đã hết hạn" } }, { status: 400 });
  await submit("recovery"); assert.equal(nodes.get("recovery-password-field").hidden, true);
  assert.match(nodes.get("recovery-status").textContent, /OTP không hợp lệ/);
  click("recovery-restart"); nodes.get("recovery-identifier").value = "0931234567";
  let finish; response = () => new Promise(resolve => { finish = resolve; });
  const pending = submit("recovery"); click("recovery-close");
  finish(Response.json({ message: "Thành công" })); await pending;
  assert.equal(nodes.get("recovery-dialog").open, false);
  assert.equal(nodes.get("recovery-otp-field").hidden, true);
  assert.equal(nodes.get("recovery-form").submit.disabled, false);
});
