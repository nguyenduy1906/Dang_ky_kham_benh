import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isUpcoming, filterAppointments, appointmentActionUrl, cancellationNotice } from "../static/js/core/appointments.js";

const now = Date.parse("2030-01-01T00:00:00Z");
const future = { encounter_id: 1, patient_id: 2, doctor_profile_id: 3, encounter_status: "CONFIRMED",
  estimated_exam_at: "2030-01-02T01:00:00Z", appointment_end_at: "2030-01-02T01:30:00Z" };
test("upcoming requires both an active state and a future interval; stale holds belong to history", () => {
  assert.equal(isUpcoming(future, now), true);
  assert.equal(isUpcoming({ ...future, encounter_status: "HOLDING", hold_expires_at: "2029-12-31T23:59:00Z" }, now), false);
  assert.equal(isUpcoming({ ...future, encounter_status: "HOLDING", hold_expires_at: "2030-01-01T00:10:00Z" }, now), true);
  for (const status of ["COMPLETED", "CANCELLED", "EXPIRED", "NO_SHOW"]) assert.equal(isUpcoming({ ...future, encounter_status: status }, now), false);
  assert.equal(isUpcoming(future, Date.parse("2030-01-03")), false);
});
test("history and upcoming preserve per-patient identity and sort in opposite time order", () => {
  const second = { ...future, encounter_id: 2, patient_id: 4, estimated_exam_at: "2030-01-03T01:00:00Z" };
  assert.deepEqual(filterAppointments([second, future], {}, now).map(e => e.encounter_id), [1, 2]);
  assert.deepEqual(filterAppointments([second, future], { patient: "2" }, now).map(e => e.encounter_id), [1]);
  assert.equal(filterAppointments([future], { status: "HOLDING" }, now).length, 0);
  assert.deepEqual(filterAppointments([second, future], { view: "history" }, Date.parse("2031-01-01")).map(e => e.encounter_id), [2, 1]);
});
test("resume uses the encounter id; a new appointment uses the doctor profile id", () => {
  assert.equal(new URL(appointmentActionUrl({ ...future, encounter_status: "HOLDING" })).searchParams.get("encounter"), "1");
  const url = new URL(appointmentActionUrl(future));
  assert.equal(url.searchParams.get("doctor"), "3");
  assert.equal(url.searchParams.has("encounter"), false);
});

class Element {
  constructor(tag = "div", text = "") {
    this.tagName = tag.toUpperCase(); this.children = []; this.listeners = {}; this.dataset = {};
    this.attributes = {}; this.value = ""; this.textContent = text;
    this.classList = { add() {}, remove() {} };
  }
  append(...nodes) { this.children.push(...nodes); }
  add(node) { this.append(node); }
  replaceChildren(...nodes) { this.children = []; this.textContent = ""; this.append(...nodes); }
  setAttribute(key, value) { this.attributes[key] = value; }
  getAttribute(key) { return this.attributes[key]; }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  querySelector(selector) { return this.children.find(e => e.tagName === selector.toUpperCase()); }
  showModal() { this.open = true; }
  close() { this.open = false; this.listeners.close?.forEach(fn => fn()); }
  focus() {}
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(""); }
}
let nodes, tabs, calls, respond, instances = 0;
const historyItem = id => ({ ...future, encounter_id: id, patient_id: id, encounter_status: "COMPLETED",
  work_date: "2026-09-20", estimated_exam_at: "2026-09-20T01:00:00Z", appointment_end_at: "2026-09-20T01:30:00Z",
  patient_name: `Người khám ${id}`, doctor_name: "Bác sĩ API", room_name: "Phòng API", ticket_code: `NEU-${id}`,
  consultation_fee_snapshot: "250000", deposit_amount_snapshot: "75000", symptoms: "Nội dung từ backend" });
const tick = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
beforeEach(() => {
  nodes = new Map(); calls = [];
  for (const id of ["main", "appointments-auth-status", "appointments-list", "appointments-status", "appointments-patient",
    "appointments-status-filter", "appointments-retry", "appointments-refresh", "appointments-empty", "appointments-pagination",
    "appointments-page", "appointments-prev", "appointments-next", "appointments-panel", "appointment-detail-dialog",
    "appointment-detail-content", "appointment-detail-status", "appointment-detail-retry", "appointment-detail-action", "appointment-detail-close"]) nodes.set(id, new Element());
  nodes.get("appointments-auth-status").append(new Element("p"), new Element("button"));
  tabs = ["upcoming", "history"].map((view, index) => {
    const tab = new Element("button"); tab.dataset.view = view; tab.id = index ? "history-tab" : "appointments-tab"; return tab;
  });
  globalThis.Option = class extends Element { constructor(label, value) { super("option", label); this.value = String(value); } };
  globalThis.document = {
    body: new Element(), querySelector: selector => nodes.get(selector.slice(1)),
    querySelectorAll: selector => selector === "[data-view]" ? tabs : [],
    createElement: tag => new Element(tag),
  };
  globalThis.window = new EventTarget();
  globalThis.location = new URL("http://127.0.0.1:3000/frontend/templates/(patient)/appointments.html");
  globalThis.history = { replaceState(state, title, url) { location.href = url.href; } };
  globalThis.sessionStorage = { getItem: () => JSON.stringify({ token: "patient-test", expiresAt: Date.now() + 7200000 }) };
  respond = url => {
    if (url.pathname === "/me") return Response.json({ user: { user_id: 4, role_name: "USER" } });
    if (url.pathname === "/patients") return Response.json({ items: [{ patient_id: 1, full_name: "Người khám 1", dob: "1998-05-12" }], total: 1 });
    if (url.pathname === "/doctors") return Response.json({ items: [{ doctor_profile_id: 3, full_name: "Bác sĩ API", department_name: "Nội tổng quát", avatar_url: null }], total: 1 });
    if (url.pathname === "/encounters") return Response.json({ items: [historyItem(1), historyItem(2)], total: 2 });
    if (url.pathname.endsWith("/ticket")) return Response.json({ ticket: { ticket_code: "NEU-1" } });
    return Response.json({ encounter: historyItem(1) });
  };
  globalThis.fetch = async (url, options) => { calls.push({ url: new URL(url), options }); return respond(new URL(url), options); };
});
async function controller() {
  const file = new URL("../static/js/pages/appointments.js", import.meta.url);
  const source = (await readFile(file, "utf8")).replace(/from "(\.\.[^"]+)"/g, (_, path) => `from ${JSON.stringify(new URL(path, file).href)}`);
  await import(`data:text/javascript;base64,${Buffer.from(source + `\n// instance ${instances++}`).toString("base64")}`);
  await tick();
}
const trigger = (node, event = "click") => node.listeners[event][0]({ preventDefault() {} });
test("history loads from the authorized API and preserves saved prices rather than current doctor fees", async () => {
  await controller();
  assert.equal(tabs[1].attributes["aria-selected"], "true");
  assert.equal(nodes.get("appointments-list").children.length, 2);
  assert.match(nodes.get("appointments-list").textContent, /Người khám 2/);
  assert.match(nodes.get("appointments-list").textContent, /250\.000/);
  assert.equal(calls.find(c => c.url.pathname === "/encounters").options.headers.has("Authorization"), true);
  assert.equal(nodes.get("appointments-patient").children.length, 3);
});
test("patient filters keep histories distinct and empty upcoming does not fall back to fake rows", async () => {
  await controller();
  nodes.get("appointments-patient").value = "1";
  trigger(nodes.get("appointments-patient"), "change");
  assert.equal(nodes.get("appointments-list").children.length, 1);
  trigger(tabs[0]);
  assert.equal(nodes.get("appointments-list").children.length, 0);
  assert.equal(nodes.get("appointments-empty").hidden, false);
  assert.match(nodes.get("appointments-empty").textContent, /Không có lịch sắp tới/);
  assert.equal(tabs[0].attributes["aria-selected"], "true");
  assert.equal(nodes.get("appointments-list").children.length, 0);
});
test("server failures show a retry; a successful retry restores only backend records", async () => {
  const original = respond;
  respond = url => url.pathname === "/encounters" ? Response.json({ error: { message: "Lỗi máy chủ" } }, { status: 500 }) : original(url);
  await controller();
  assert.equal(nodes.get("appointments-list").children.length, 0);
  assert.equal(nodes.get("appointments-retry").hidden, false);
  assert.equal(nodes.get("appointments-status").textContent, "Lỗi máy chủ");
  respond = original; trigger(nodes.get("appointments-retry")); await tick();
  assert.equal(nodes.get("appointments-list").children.length, 2);
});
test("detail and ticket use actual record ids and distinguish historical deposits", async () => {
  await controller();
  const card = nodes.get("appointments-list").children.find(e => e.dataset.encounterId === 1);
  trigger(card.children.at(-1).children[0]); await tick();
  assert.equal(nodes.get("appointment-detail-dialog").open, true);
  assert.match(nodes.get("appointment-detail-content").textContent, /NEU-1/);
  assert.match(nodes.get("appointment-detail-content").textContent, /75\.000/);
  assert.equal(calls.some(c => c.url.pathname === "/encounters/1/ticket"), true);
});
test("late responses after leaving the page cannot restore private history", async () => {
  const original = respond; let finish;
  respond = url => url.pathname === "/encounters" ? new Promise(resolve => { finish = resolve; }) : original(url);
  await controller();
  window.dispatchEvent(new Event("pagehide"));
  finish(Response.json({ items: [historyItem(1)], total: 1 })); await tick();
  assert.equal(nodes.get("appointments-list").children.length, 0);
  assert.equal(nodes.get("main").inert, true);
});

test("cancellation warns at the exact 12-hour refund boundary and blocks terminal/checked-in states", () => {
  const boundary = Date.parse(future.estimated_exam_at) - 12 * 3600000;
  assert.match(cancellationNotice(future, boundary).message, /50%/);
  assert.match(cancellationNotice(future, boundary + 1).message, /không được hoàn/);
  assert.equal(cancellationNotice(future, boundary + 1).allowed, true, "refund deadline is not a cancellation ban");
  for (const status of ["CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "EXPIRED", "NO_SHOW"])
    assert.equal(cancellationNotice({ ...future, encounter_status: status }, now).allowed, false);
  assert.equal(cancellationNotice(future, Date.parse("2031-01-01")).allowed, false);
  assert.match(cancellationNotice({ ...future, encounter_status: "HOLDING", hold_expires_at: "2030-01-01T01:00:00Z" }, now).message, /chưa xác nhận thanh toán/);
});

function descendants(node) { return [node, ...node.children.flatMap(descendants)]; }
function buttonIn(node, text) { return descendants(node).find(child => child.tagName === "BUTTON" && child.textContent === text); }
function setupUpcoming(status = "CONFIRMED") {
  const encounter = { ...historyItem(1), ...future, work_date: "2030-01-02", encounter_status: status, hold_expires_at: "2030-01-01T00:10:00Z" };
  const original = respond;
  respond = (url, options) => {
    if (url.pathname === "/encounters") return Response.json({ items: [encounter], total: 1 });
    if (url.pathname === "/encounters/1") return Response.json({ encounter });
    if (url.pathname === "/encounters/1/cancel") { encounter.encounter_status = "CANCELLED"; return Response.json({ encounter }); }
    return original(url, options);
  };
  return encounter;
}
async function openCancel() {
  trigger(buttonIn(nodes.get("appointments-list"), "Hủy lịch")); await tick();
  return nodes.get("appointment-detail-content");
}
test("opening cancellation and keeping the appointment never sends a mutation", async () => {
  setupUpcoming(); await controller();
  const content = await openCancel();
  assert.match(content.textContent, /Bạn có chắc muốn hủy/);
  assert.match(content.textContent, /50%/);
  assert.equal(calls.some(c => c.options.method === "POST"), false);
  trigger(buttonIn(content, "Giữ lịch khám"));
  assert.equal(nodes.get("appointment-detail-dialog").open, false);
  assert.equal(calls.some(c => c.options.method === "POST"), false);
});
test("confirm sends one authorized cancellation, blocks duplicates and refreshes backend history", async () => {
  const encounter = setupUpcoming();
  const original = respond; let finish;
  respond = (url, options) => url.pathname === "/encounters/1/cancel" ? new Promise(resolve => { finish = resolve; }) : original(url, options);
  await controller(); const content = await openCancel();
  descendants(content).find(n => n.tagName === "TEXTAREA").value = "Thay đổi kế hoạch";
  const confirm = buttonIn(content, "Xác nhận hủy lịch");
  trigger(confirm); trigger(confirm); await tick();
  const posts = calls.filter(c => c.url.pathname.endsWith("/cancel"));
  assert.equal(posts.length, 1);
  assert.equal(posts[0].options.method, "POST");
  assert.equal(posts[0].options.headers.has("Authorization"), true);
  assert.deepEqual(JSON.parse(posts[0].options.body), { reason: "Thay đổi kế hoạch", cancel_origin: "PATIENT" });
  assert.equal(confirm.disabled, true);
  encounter.encounter_status = "CANCELLED"; finish(Response.json({ encounter })); await tick();
  assert.match(nodes.get("appointment-detail-status").textContent, /hủy lịch thành công/);
  assert.match(nodes.get("appointment-detail-content").textContent, /chưa phải là xác nhận hoàn tiền/);
  assert.equal(nodes.get("appointments-list").children.length, 0);
  trigger(tabs[1]);
  assert.match(nodes.get("appointments-list").textContent, /Đã hủy/);
  assert.equal(buttonIn(nodes.get("appointments-list"), "Hủy lịch"), undefined);
});
test("a stale card reads the latest expired state and never offers confirmation", async () => {
  const encounter = setupUpcoming(); await controller();
  encounter.encounter_status = "EXPIRED";
  const content = await openCancel();
  assert.match(content.textContent, /hết hạn giữ chỗ/);
  assert.equal(buttonIn(content, "Xác nhận hủy lịch"), undefined);
  assert.equal(calls.some(c => c.options.method === "POST"), false);
});
test("backend refusal preserves the reason and does not claim cancellation or refund", async () => {
  setupUpcoming(); const original = respond;
  respond = (url, options) => url.pathname.endsWith("/cancel") ? Response.json({ error: { message: "Không thể hủy ở trạng thái hiện tại", code: "INVALID_ENCOUNTER_STATUS" } }, { status: 409 }) : original(url, options);
  await controller(); const content = await openCancel();
  const reason = descendants(content).find(n => n.tagName === "TEXTAREA"); reason.value = "Giữ lại lý do";
  const confirm = buttonIn(content, "Xác nhận hủy lịch"); trigger(confirm); await tick();
  assert.match(nodes.get("appointment-detail-status").textContent, /Không thể hủy ở trạng thái hiện tại/);
  assert.equal(reason.value, "Giữ lại lý do"); assert.equal(confirm.disabled, true);
  assert.equal(nodes.get("appointments-list").children.length, 1);
  assert.doesNotMatch(nodes.get("appointment-detail-status").textContent, /thành công/);
});
test("leaving during cancellation cannot restore private content from a late response", async () => {
  const encounter = setupUpcoming(); const original = respond; let finish;
  respond = (url, options) => url.pathname.endsWith("/cancel") ? new Promise(resolve => { finish = resolve; }) : original(url, options);
  await controller(); const content = await openCancel();
  trigger(buttonIn(content, "Xác nhận hủy lịch")); await tick();
  window.dispatchEvent(new Event("pagehide"));
  finish(Response.json({ encounter: { ...encounter, encounter_status: "CANCELLED" } })); await tick();
  assert.equal(nodes.get("appointment-detail-content").textContent, "");
  assert.equal(nodes.get("appointments-list").children.length, 0);
});
