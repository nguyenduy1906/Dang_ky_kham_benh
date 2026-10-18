import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setAccessToken } from "../static/js/core/api.js";
import "../static/js/core/staff_workspace.js";

class Element {
  value = ""; defaultValue = ""; textContent = ""; innerHTML = "";
  dataset = {}; listeners = {}; children = []; disabled = false; files = []; hidden = false; readOnly = false;
  constructor(id = "") { this.id = id; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  dispatchEvent(event) { this.listeners[event.type]?.(event); }
  replaceChildren(...children) { this.children = children; this.textContent = ""; }
  setCustomValidity(value) { this.validationMessage = value; }
  querySelector() { return this.feedback; }
  querySelectorAll() { return Object.values(this.elements || {}); }
  reportValidity() { return Object.values(this.elements || {}).every(el => !el.validationMessage); }
  reset() { for (const el of Object.values(this.elements)) { el.value = el.defaultValue; el.files = []; } }
  showModal() { this.open = true; }
  close() { this.open = false; this.listeners.close?.(); }
  focus() { this.focused = true; }
}
let nodes, calls, user, doctor, missing, saveError, stored, passwordReply, instance = 0;
const tick = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
beforeEach(() => {
  nodes = new Map(); calls = []; missing = false; saveError = false;
  stored = new Map([["neu-medical.auth", JSON.stringify({ token: "staff-profile-test", expiresAt: Date.now() + 60000 })]]);
  globalThis.sessionStorage = { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
  passwordReply = () => Response.json({ access_token: "updated-staff-token", token_type: "Bearer", expires_in: 7200 });
  user = { user_id: 6, role_name: "DOCTOR", full_name: "Bác sĩ kiểm thử", phone: "0902000001", email: "doctor@example.test", account_status: "ACTIVE", approval_status: "APPROVED", email_verified: true, created_at: "2026-09-01T00:00:00Z" };
  doctor = { academic_degree: "Thạc sĩ", experience_years: 0, specialization: "Nội tổng quát", introduction: "Giới thiệu đã lưu", department_name: "Khoa Nội", consultation_fee: 380000, is_active: true, avatar_url: null };
  for (const id of ["page-refresh", "page-status", "page-body", "staff-profile-description", "staff-profile-avatar", "staff-profile-name", "staff-account-name", "staff-profile-facts", "staff-managed-fields", "staff-profile-edit", "staff-profile-cancel", "staff-profile-actions", "staff-dialog-close", "staff-password-dialog", "staff-password-open", "staff-password-close", "staff-password-submit", "staff-password-feedback"])
    nodes.set(`#${id}`, new Element(id));
  nodes.set(".staff-initials", new Element());
  for (const [id, fields] of [["staff-profile-form", ["phone", "email"]], ["staff-password-form", ["current_password", "new_password", "confirm_password"]], ["avatar-form", ["file"]]]) {
    const form = new Element(id); form.feedback = new Element();
    form.elements = Object.fromEntries(fields.map(key => [key, new Element()]));
    nodes.set(`#${id}`, form);
  }
  nodes.set("#professional-photo", nodes.get("#avatar-form").elements.file);
  globalThis.document = {
    body: { classList: { contains: () => false } },
    querySelector: selector => nodes.get(selector) || null,
    createElement: () => new Element(),
  };
  globalThis.location = new URL("http://localhost:3000/frontend/templates/components/profile.html?role=doctor");
  globalThis.history = { replaceState(state, title, url) { location = new URL(url); } };
  globalThis.window = new Element();
  globalThis.FormData = class {
    constructor(form) { this.values = new Map(Object.entries(form?.elements || {}).map(([key, el]) => [key, el.value])); }
    append(key, value) { this.values.set(key, value); }
    [Symbol.iterator]() { return this.values.entries(); }
  };
  setAccessToken("staff-profile-test");
  globalThis.fetch = async (url, options) => {
    const path = new URL(url).pathname, body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
    calls.push({ path, method: options.method, body, authorization: options.headers.get("Authorization") });
    if (path === "/me/change-password" && options.method === "POST") return passwordReply();
    if (path === "/doctor/profile" && options.method === "GET") return missing
      ? Response.json({ error: { code: "DOCTOR_NOT_FOUND", message: "Chưa có hồ sơ" } }, { status: 404 })
      : Response.json({ doctor });
    if (path === "/doctor/profile" && options.method === "PATCH") { doctor = { ...doctor, ...body }; return Response.json({ doctor }); }
    if (path === "/me" && options.method === "PATCH") {
      if (saveError) return Response.json({ error: { code: "DUPLICATE_IDENTITY", message: "Email đã được sử dụng" } }, { status: 409 });
      user = { ...user, ...body }; return Response.json({ user });
    }
    if (path === "/doctor/profile/avatar") { doctor = { ...doctor, avatar_url: `/uploads/avatars/${"a".repeat(32)}.jpg` }; return Response.json({ doctor }); }
    throw new Error(`Unexpected request: ${options.method} ${path}`);
  };
});
async function load() {
  const file = new URL("../static/js/pages/staff_profile.js", import.meta.url);
  const source = (await readFile(file, "utf8"))
    .replace('import { staffReady, staffRoles, backendRoles, avatarUrl } from "../core/staff_workspace.js";',
      `import { staffRoles, backendRoles, avatarUrl } from "../core/staff_workspace.js"; const staffReady = Promise.resolve(${JSON.stringify(user)});`)
    .replace(/from "(\.\.[^"]+)"/g, (_, path) => `from ${JSON.stringify(new URL(path, file).href)}`);
  await import(`data:text/javascript;base64,${Buffer.from(source + `\n// instance ${instance++}`).toString("base64")}`);
}
async function save(id) { nodes.get(`#${id}`).listeners.submit({ preventDefault() {} }); await tick(); }
const edit = () => nodes.get("#staff-profile-edit").listeners.click();
const cancelEdit = () => nodes.get("#staff-profile-cancel").listeners.click();

test("doctor profile displays managed identity and professional fields as read-only, including zero experience", async () => {
  await load();
  assert.match(nodes.get("#page-body").innerHTML, /Thông tin nhân viên/);
  assert.doesNotMatch(nodes.get("#page-body").innerHTML, /<h2>Thông tin liên hệ|<h2>Thông tin chuyên môn|Được tự cập nhật|Chỉ xem/);
  assert.match(nodes.get("#page-body").innerHTML, /id="avatar-form"/);
  assert.match(nodes.get("#staff-managed-fields").innerHTML, /Số năm kinh nghiệm<input type="text" value="0" readonly/);
  assert.match(nodes.get("#staff-managed-fields").innerHTML, /Học vị \/ chức danh<input type="text" value="Thạc sĩ" readonly/);
  assert.match(nodes.get("#staff-managed-fields").innerHTML, /Họ và tên<input type="text" value="Bác sĩ kiểm thử" readonly/);
  assert.doesNotMatch(nodes.get("#page-body").innerHTML, /professional-form|Lưu thông tin chuyên môn|name="full_name"|CCCD|Lương|Xác thực 2 bước/);
  assert.deepEqual(calls.map(({ path, method }) => [method, path]), [["GET", "/doctor/profile"]]);
});

test("contact saves whitelist phone and email even when managed fields are injected into the form", async () => {
  await load();
  edit();
  const form = nodes.get("#staff-profile-form");
  form.elements.full_name = new Element(); form.elements.full_name.value = "Tên không được phép đổi";
  form.elements.academic_degree = new Element(); form.elements.academic_degree.value = "Giáo sư";
  form.elements.phone.value = " 0902000002 ";
  form.elements.email.value = "new@example.test";
  await save("staff-profile-form");
  assert.equal(calls.at(-1).path, "/me");
  assert.equal(calls.at(-1).method, "PATCH");
  assert.deepEqual(calls.at(-1).body, { phone: "0902000002", email: "new@example.test" });
  assert.equal(nodes.get("#staff-account-name").textContent, "Bác sĩ kiểm thử");
  assert.equal(form.feedback.dataset.error, "false");
  assert.equal(form.elements.phone.readOnly, true);
  assert.equal(nodes.get("#staff-profile-actions").hidden, true);
  assert.equal(nodes.get("#staff-profile-edit").hidden, false);
});

test("unchanged contact data and clearing an existing contact do not send writes", async () => {
  await load();
  edit();
  await save("staff-profile-form");
  assert.equal(calls.length, 1);
  const form = nodes.get("#staff-profile-form");
  assert.match(form.feedback.textContent, /chưa thay đổi/);
  edit();
  form.elements.email.value = " ";
  await save("staff-profile-form");
  assert.equal(calls.length, 1);
  assert.match(form.elements.email.validationMessage, /email/);
  cancelEdit();
  assert.equal(form.elements.email.validationMessage, "");
});

test("invalid doctor photos never upload; valid photos preserve unsaved contact information", async () => {
  await load();
  edit();
  const photo = nodes.get("#professional-photo");
  photo.files = [{ type: "image/svg+xml", size: 100 }]; await save("avatar-form");
  assert.equal(calls.length, 1);
  assert.match(photo.validationMessage, /JPEG/);
  nodes.get("#staff-profile-form").elements.phone.value = "0902000009";
  photo.files = [{ type: "image/jpeg", size: 100 }]; await save("avatar-form");
  assert.equal(calls.at(-1).path, "/doctor/profile/avatar");
  assert.equal(calls.at(-1).method, "POST");
  assert.equal(nodes.get("#staff-profile-avatar").children[0].src, nodes.get(".staff-initials").children[0].src);
  assert.equal(nodes.get("#staff-profile-form").elements.phone.value, "0902000009");
});

test("nurse profile keeps its personal form without loading or showing doctor-only fields", async () => {
  user.role_name = "NURSE";
  await load();
  assert.equal(calls.length, 0);
  assert.doesNotMatch(nodes.get("#page-body").innerHTML, /professional-form|avatar-form/);
  assert.equal(nodes.get("#staff-profile-form").elements.phone.value, user.phone);
  assert.match(nodes.get("#staff-profile-avatar").children[0].src, /assets\/nurses\/dieu_duong_01\.jpg$/);
  assert.match(nodes.get("#staff-profile-avatar").children[0].alt, /minh họa/);
  assert.equal(nodes.get(".staff-initials").children[0].src, nodes.get("#staff-profile-avatar").children[0].src);
  assert.match(nodes.get("#staff-managed-fields").innerHTML, /Vai trò trên hệ thống<input type="text" value="Y tá" readonly/);
});

test("admin can view its own profile without loading doctor data", async () => {
  user.role_name = "ADMIN";
  await load();
  assert.equal(calls.length, 0);
  assert.equal(nodes.get("#staff-profile-form").elements.phone.value, user.phone);
  assert.equal(nodes.get("#staff-profile-avatar").textContent, "QT");
  assert.match(nodes.get("#staff-managed-fields").innerHTML, /Quản trị viên/);
  assert.doesNotMatch(nodes.get("#page-body").innerHTML, /avatar-form|professional-form/);
});

test("reception keeps initials and has no invented doctor, identity or HR data", async () => {
  user.role_name = "RECEPTIONIST";
  await load();
  assert.equal(calls.length, 0);
  assert.equal(nodes.get("#staff-profile-avatar").textContent, "LT");
  assert.equal(nodes.get("#staff-profile-avatar").children.length, 0);
  assert.doesNotMatch(nodes.get("#page-body").innerHTML, /avatar-form|Thông tin chuyên môn|CCCD|Ngày sinh|Địa chỉ|Chứng chỉ|Hợp đồng|Mã nhân viên/);
});

test("a doctor without a professional profile can still edit contacts, with managed name read-only", async () => {
  missing = true; await load();
  assert.match(nodes.get("#staff-managed-fields").innerHTML, /Chưa có hồ sơ chuyên môn/);
  assert.match(nodes.get("#staff-managed-fields").innerHTML, /Họ và tên<input type="text" value="Bác sĩ kiểm thử" readonly/);
  assert.doesNotMatch(nodes.get("#page-body").innerHTML, /id="professional-form"/);
});

test("view mode prevents saving until edit is selected; cancel restores both contacts without a write", async () => {
  user.role_name = "NURSE";
  await load();
  const form = nodes.get("#staff-profile-form");
  assert.equal(form.elements.phone.readOnly, true);
  assert.equal(form.elements.email.readOnly, true);
  assert.equal(nodes.get("#staff-profile-actions").hidden, true);
  form.elements.phone.value = "0909999999";
  await save("staff-profile-form");
  assert.equal(calls.length, 0);
  edit();
  assert.equal(form.elements.phone.readOnly, false);
  assert.equal(form.elements.email.readOnly, false);
  assert.equal(nodes.get("#staff-profile-actions").hidden, false);
  form.elements.email.value = "draft@example.test";
  cancelEdit();
  assert.equal(form.elements.phone.value, user.phone);
  assert.equal(form.elements.email.value, user.email);
  assert.equal(form.elements.phone.readOnly, true);
  assert.equal(calls.length, 0);
});

test("failed save preserves editing and draft contacts; retry succeeds and relocks the form", async () => {
  await load();
  const form = nodes.get("#staff-profile-form");
  edit();
  form.elements.email.value = "draft@example.test";
  saveError = true;
  await save("staff-profile-form");
  assert.equal(form.elements.email.value, "draft@example.test");
  assert.equal(form.elements.email.readOnly, false);
  assert.equal(nodes.get("#staff-profile-actions").hidden, false);
  assert.match(form.feedback.textContent, /Email đã được sử dụng/);
  saveError = false;
  await save("staff-profile-form");
  assert.equal(form.elements.email.value, "draft@example.test");
  assert.equal(form.elements.email.readOnly, true);
  assert.equal(nodes.get("#staff-profile-actions").hidden, true);
});

function openPassword() {
  nodes.get("#staff-password-open").listeners.click();
  const fields = nodes.get("#staff-password-form").elements;
  fields.current_password.value = "CurrentPassword1";
  fields.new_password.value = "NewPassword123";
  fields.confirm_password.value = "NewPassword123";
  return fields;
}

for (const role of ["DOCTOR", "NURSE", "RECEPTIONIST", "ADMIN"]) {
  test(`${role} password change sends only the API fields, rotates the session and clears secrets`, async () => {
    user.role_name = role; await load();
    const fields = openPassword();
    fields.confirm_password.value = "Mismatch12345";
    await save("staff-password-form");
    assert.match(fields.confirm_password.validationMessage, /chưa khớp/);
    assert.equal(calls.some(call => call.path === "/me/change-password"), false);
    fields.confirm_password.value = "NewPassword123";
    await save("staff-password-form");
    const request = calls.find(call => call.path === "/me/change-password");
    assert.equal(request.method, "POST");
    assert.equal(request.authorization, "Bearer staff-profile-test");
    assert.deepEqual(request.body, { current_password: "CurrentPassword1", new_password: "NewPassword123" });
    assert.equal(JSON.parse(stored.get("neu-medical.auth")).token, "updated-staff-token");
    assert.match(nodes.get("#staff-password-feedback").textContent, /thành công/);
    for (const field of Object.values(fields)) assert.equal(field.value, "");
    fields.current_password.value = "MustClearOnClose";
    nodes.get("#staff-password-close").listeners.click();
    for (const field of Object.values(fields)) assert.equal(field.value, "");
  });
}

test("wrong current password displays the API error, keeps the dialog and permits retry", async () => {
  await load(); const fields = openPassword();
  passwordReply = () => Response.json({ error: { code: "WRONG_PASSWORD", message: "Mật khẩu hiện tại không đúng" } }, { status: 400 });
  await save("staff-password-form");
  assert.match(nodes.get("#staff-password-feedback").textContent, /hiện tại không đúng/);
  assert.equal(nodes.get("#staff-password-feedback").dataset.error, "true");
  assert.equal(nodes.get("#staff-password-dialog").open, true);
  assert.equal(fields.current_password.value, "CurrentPassword1");
  assert.equal(nodes.get("#staff-password-submit").disabled, false);
  assert.equal(JSON.parse(stored.get("neu-medical.auth")).token, "staff-profile-test");
  passwordReply = () => Response.json({ access_token: "retry-token", token_type: "Bearer", expires_in: 7200 });
  await save("staff-password-form");
  assert.equal(JSON.parse(stored.get("neu-medical.auth")).token, "retry-token");
  assert.match(nodes.get("#staff-password-feedback").textContent, /thành công/);
});

test("pending password request blocks duplicate submissions, closing and Escape", async () => {
  user.role_name = "NURSE";
  await load(); openPassword(); let finish;
  passwordReply = () => new Promise(resolve => { finish = resolve; });
  const form = nodes.get("#staff-password-form");
  form.listeners.submit({ preventDefault() {} });
  form.listeners.submit({ preventDefault() {} });
  await tick();
  assert.equal(calls.filter(call => call.path === "/me/change-password").length, 1);
  assert.equal(nodes.get("#staff-password-submit").disabled, true);
  nodes.get("#staff-password-close").listeners.click();
  assert.equal(nodes.get("#staff-password-dialog").open, true);
  const modal = nodes.get("#staff-password-dialog");
  modal.getBoundingClientRect = () => ({ left: 100, right: 500, top: 100, bottom: 400 });
  const outside = { target: modal, clientX: 50, clientY: 150 };
  modal.listeners.pointerdown(outside); modal.listeners.click(outside);
  assert.equal(modal.open, true);
  let prevented = false;
  nodes.get("#staff-password-dialog").listeners.cancel({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  finish(Response.json({ access_token: "new-token", token_type: "Bearer", expires_in: 7200 })); await tick();
  assert.equal(nodes.get("#staff-password-submit").disabled, false);
});

test("leaving the page clears password fields and ignores a late response", async () => {
  await load(); const fields = openPassword(); let finish;
  passwordReply = () => new Promise(resolve => { finish = resolve; });
  nodes.get("#staff-password-form").listeners.submit({ preventDefault() {} }); await tick();
  window.listeners.pagehide();
  for (const field of Object.values(fields)) assert.equal(field.value, "");
  finish(Response.json({ access_token: "late-token", token_type: "Bearer", expires_in: 7200 })); await tick();
  assert.equal(JSON.parse(stored.get("neu-medical.auth")).token, "staff-profile-test");
  assert.equal(nodes.get("#staff-password-feedback").textContent, "");
});

test("expired authorization clears the staff session and password fields", async () => {
  await load(); const fields = openPassword();
  passwordReply = () => Response.json({ error: { code: "UNAUTHORIZED", message: "Phiên đăng nhập đã hết hạn" } }, { status: 401 });
  await save("staff-password-form");
  assert.equal(stored.has("neu-medical.auth"), false);
  assert.equal(nodes.get("#staff-password-dialog").open, false);
  for (const field of Object.values(fields)) assert.equal(field.value, "");
  assert.doesNotMatch(nodes.get("#staff-password-feedback").textContent, /thành công/);
});

test("network failure preserves the session and warns about an uncertain password change", async () => {
  await load(); openPassword();
  passwordReply = () => { throw new TypeError("Failed to fetch"); };
  await save("staff-password-form");
  assert.equal(JSON.parse(stored.get("neu-medical.auth")).token, "staff-profile-test");
  assert.equal(nodes.get("#staff-password-dialog").open, true);
  assert.equal(nodes.get("#staff-password-submit").disabled, false);
  assert.match(nodes.get("#staff-password-feedback").textContent, /kiểm tra đăng nhập trước khi thử lại/);
  assert.doesNotMatch(nodes.get("#staff-password-feedback").textContent, /thành công/);
});
