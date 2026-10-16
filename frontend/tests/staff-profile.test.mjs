import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setAccessToken } from "../static/js/core/api.js";
import "../static/js/core/staff_workspace.js";

class Element {
  value = ""; defaultValue = ""; textContent = ""; innerHTML = "";
  dataset = {}; listeners = {}; children = []; disabled = false; files = [];
  constructor(id = "") { this.id = id; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  replaceChildren(...children) { this.children = children; this.textContent = ""; }
  setCustomValidity(value) { this.validationMessage = value; }
  querySelector() { return this.feedback; }
  querySelectorAll() { return Object.values(this.elements || {}); }
  reportValidity() { return Object.values(this.elements || {}).every(el => !el.validationMessage); }
  reset() { for (const el of Object.values(this.elements)) { el.value = el.defaultValue; el.files = []; } }
}
let nodes, calls, user, doctor, missing, instance = 0;
const tick = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
beforeEach(() => {
  nodes = new Map(); calls = []; missing = false;
  user = { user_id: 6, role_name: "DOCTOR", full_name: "Bác sĩ kiểm thử", phone: "0902000001", email: "doctor@example.test", account_status: "ACTIVE", approval_status: "APPROVED", email_verified: true, created_at: "2026-09-01T00:00:00Z" };
  doctor = { academic_degree: "Thạc sĩ", experience_years: 0, specialization: "Nội tổng quát", introduction: "Giới thiệu đã lưu", department_name: "Khoa Nội", consultation_fee: 380000, is_active: true, avatar_url: null };
  for (const id of ["page-refresh", "page-status", "page-body", "staff-profile-description", "staff-profile-avatar", "staff-profile-name", "staff-account-name", "staff-profile-facts", "staff-profile-verification", "professional-facts", "staff-dialog-close"])
    nodes.set(`#${id}`, new Element(id));
  nodes.set(".staff-initials", new Element());
  for (const [id, fields] of [["staff-profile-form", ["full_name", "phone", "email"]], ["professional-form", ["academic_degree", "experience_years", "specialization", "introduction"]], ["avatar-form", ["file"]]]) {
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
  globalThis.FormData = class {
    constructor(form) { this.values = new Map(Object.entries(form?.elements || {}).map(([key, el]) => [key, el.value])); }
    append(key, value) { this.values.set(key, value); }
    [Symbol.iterator]() { return this.values.entries(); }
  };
  setAccessToken("staff-profile-test");
  globalThis.fetch = async (url, options) => {
    const path = new URL(url).pathname, body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
    calls.push({ path, method: options.method, body });
    if (path === "/doctor/profile" && options.method === "GET") return missing
      ? Response.json({ error: { code: "DOCTOR_NOT_FOUND", message: "Chưa có hồ sơ" } }, { status: 404 })
      : Response.json({ doctor });
    if (path === "/doctor/profile" && options.method === "PATCH") { doctor = { ...doctor, ...body }; return Response.json({ doctor }); }
    if (path === "/me" && options.method === "PATCH") { user = { ...user, ...body }; return Response.json({ user }); }
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

test("one doctor profile renders personal data, professional data and photo upload without writes on entry", async () => {
  await load();
  assert.match(nodes.get("#page-body").innerHTML, /Thông tin cá nhân & liên hệ/);
  assert.match(nodes.get("#page-body").innerHTML, /Thông tin chuyên môn/);
  assert.match(nodes.get("#page-body").innerHTML, /id="avatar-form"/);
  assert.doesNotMatch(nodes.get("#page-body").innerHTML, /professional\.html/);
  assert.equal(nodes.get("#staff-profile-form").elements.full_name.value, user.full_name);
  assert.equal(nodes.get("#professional-form").elements.experience_years.value, 0);
  assert.deepEqual(calls.map(({ path, method }) => [method, path]), [["GET", "/doctor/profile"]]);
});

test("professional saves use the existing endpoint and preserve unsaved personal fields", async () => {
  await load();
  nodes.get("#staff-profile-form").elements.full_name.value = "Tên chưa lưu";
  nodes.get("#professional-form").elements.introduction.value = "Giới thiệu mới";
  await save("professional-form");
  assert.equal(calls.at(-1).path, "/doctor/profile");
  assert.equal(calls.at(-1).method, "PATCH");
  assert.deepEqual(Object.keys(calls.at(-1).body).sort(), ["academic_degree", "experience_years", "introduction", "specialization"]);
  assert.equal(calls.at(-1).body.introduction, "Giới thiệu mới");
  assert.equal(nodes.get("#staff-profile-form").elements.full_name.value, "Tên chưa lưu");
  assert.equal(nodes.get("#professional-form").feedback.dataset.error, "false");
});

test("personal saves update the account name without clearing a professional draft", async () => {
  await load();
  nodes.get("#professional-form").elements.introduction.value = "Chuyên môn chưa lưu";
  nodes.get("#staff-profile-form").elements.full_name.value = "Tên đã đổi";
  await save("staff-profile-form");
  assert.deepEqual(calls.at(-1).body, { full_name: "Tên đã đổi" });
  assert.equal(calls.at(-1).path, "/me");
  assert.equal(nodes.get("#staff-account-name").textContent, "Tên đã đổi");
  assert.equal(nodes.get("#professional-form").elements.introduction.value, "Chuyên môn chưa lưu");
});

test("invalid photos never upload; valid photos refresh both avatars without clearing form drafts", async () => {
  await load();
  const photo = nodes.get("#professional-photo");
  photo.files = [{ type: "image/svg+xml", size: 100 }]; await save("avatar-form");
  assert.equal(calls.length, 1);
  assert.match(photo.validationMessage, /JPEG/);
  nodes.get("#professional-form").elements.introduction.value = "Bản nháp chuyên môn";
  photo.files = [{ type: "image/jpeg", size: 100 }]; await save("avatar-form");
  assert.equal(calls.at(-1).path, "/doctor/profile/avatar");
  assert.equal(calls.at(-1).method, "POST");
  assert.equal(nodes.get("#staff-profile-avatar").children[0].src, nodes.get(".staff-initials").children[0].src);
  assert.equal(nodes.get("#professional-form").elements.introduction.value, "Bản nháp chuyên môn");
});

test("nurse profile keeps its personal form without loading or showing doctor-only fields", async () => {
  user.role_name = "NURSE";
  await load();
  assert.equal(calls.length, 0);
  assert.doesNotMatch(nodes.get("#page-body").innerHTML, /professional-form|avatar-form/);
  assert.equal(nodes.get("#staff-profile-form").elements.phone.value, user.phone);
});

test("a doctor without a professional profile can still edit personal information", async () => {
  missing = true; await load();
  assert.match(nodes.get("#page-body").innerHTML, /Chưa có hồ sơ chuyên môn/);
  assert.equal(nodes.get("#staff-profile-form").elements.full_name.value, user.full_name);
  assert.doesNotMatch(nodes.get("#page-body").innerHTML, /id="professional-form"/);
});
