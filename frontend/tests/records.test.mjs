import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
class Node {
  constructor(tag = "div", text = "") { this.tagName = tag.toUpperCase(); this.children = []; this.listeners = {}; this.dataset = {}; this.attributes = {}; this.textContent = text; this.value = ""; }
  set textContent(v) { this.text = String(v); this.children = []; }
  get textContent() { return this.text + this.children.map(n => n.textContent).join(""); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.textContent = ""; this.append(...nodes); }
  add(node) { this.append(node); }
  setAttribute(k, v) { this.attributes[k] = v; }
  querySelector(selector) { return this.children.find(n => n.tagName === selector.toUpperCase()) || this.tabs; }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  showModal() { this.open = true; }
  close() { if (!this.open) return; this.open = false; this.listeners.close?.forEach(fn => fn()); }
  focus() {}
  reportValidity() { return true; }
}
let nodes, calls, respond, instance = 0;
const profiles = [{ patient_id: 1, full_name: "Người khám A", dob: "2000-01-01", id_card: "123456789012" }, { patient_id: 2, full_name: "Người khám B", dob: "2010-01-01" }];
const encounter = { encounter_id: 8, doctor_name: "Bác sĩ API", work_date: "2026-09-01", estimated_exam_at: "2026-09-01T08:00:00+07:00", appointment_end_at: "2026-09-01T08:30:00+07:00", encounter_status: "COMPLETED" };
const tick = async () => { for (let i = 0; i < 10; i++) await new Promise(r => setImmediate(r)); };
const trigger = (node, event = "click", extra = {}) => node.listeners[event][0]({ preventDefault() {}, ...extra });
const all = node => [node, ...node.children.flatMap(all)];
beforeEach(() => {
  nodes = new Map(); calls = [];
  for (const id of ["main", "records-auth-status", "records-profiles", "records-profiles-status", "records-profiles-retry", "records-history", "records-history-title", "records-history-status", "records-history-retry", "records-encounters", "records-prev", "records-next", "records-page", "record-lookup-dialog", "record-lookup-form", "lookup-patient", "lookup-identifier", "record-lookup-status", "record-lookup-submit", "record-result-dialog", "record-result-status", "record-result-retry", "record-result-content", "record-result-close", "record-lookup-close", "lookup-identifier-field", "lookup-identifier-label", "records-welcome"]) nodes.set(id, new Node());
  nodes.get("records-auth-status").append(new Node("p"), new Node("button")); nodes.get("record-lookup-dialog").tabs = new Node();
  globalThis.Option = class extends Node { constructor(text, value) { super("option", text); this.value = value; } };
  globalThis.document = { body: { classList: { add() {}, remove() {} } }, querySelector: s => nodes.get(s.slice(1)), querySelectorAll: () => [], createElement: t => new Node(t) };
  globalThis.location = new URL("http://localhost:3000/frontend/templates/(patient)/records.html"); globalThis.location.replace = () => {};
  globalThis.window = new EventTarget(); globalThis.sessionStorage = { getItem: () => JSON.stringify({ token: "records-test", expiresAt: Date.now() + 60000 }), removeItem() {} };
  respond = url => {
    if (url.pathname === "/me") return Response.json({ user: { user_id: 3, role_name: "USER" } });
    if (url.pathname === "/patients") return Response.json({ items: profiles, total: 2 });
    if (url.pathname === "/patients/1") return Response.json({ patient: profiles[0] });
    if (url.pathname === "/patients/1/encounters") return Response.json({ items: [encounter], total: 1 });
    if (url.pathname === "/patients/2/encounters") return Response.json({ items: [], total: 0 });
    if (url.pathname === "/encounters/8/medical-record") return Response.json({ medical_record: { record_id: 5, encounter_id: 8, diagnosis: "<script>giữ nguyên văn bản</script>", examined_at: "2026-09-01T08:15:00+07:00", treatment: "Điều trị API" } });
    if (url.pathname === "/medical-records/5/prescription-items") return Response.json({ items: [{ medication_name: "Thuốc API", dosage: "Liều API", quantity: 2 }], total: 1 });
    throw new Error(`Unexpected ${url.pathname}`);
  };
  globalThis.fetch = async (url, options) => { calls.push({ path: new URL(url).pathname, options }); return respond(new URL(url), options); };
});
async function controller() {
  const file = new URL("../static/js/pages/records.js", import.meta.url);
  const source = (await readFile(file, "utf8")).replace(/from "(\.\.[^"]+)"/g, (_, p) => `from ${JSON.stringify(new URL(p, file).href)}`);
  await import(`data:text/javascript;base64,${Buffer.from(source + `\n// ${instance++}`).toString("base64")}`); await tick();
}
test("health records loads authorized profiles and histories with no writes", async () => {
  await controller(); assert.match(nodes.get("records-profiles").textContent, /Người khám A/);
  assert.match(nodes.get("records-encounters").textContent, /Bác sĩ API/);
  assert.ok(calls.find(c => c.path === "/patients/1/encounters").options.headers.has("Authorization"));
  assert.ok(calls.every(c => c.options.method === "GET"));
});
test("changing profile clears previous history and shows a real empty state", async () => {
  await controller(); trigger(nodes.get("records-profiles").children[1]); await tick();
  assert.equal(nodes.get("records-encounters").children.length, 0);
  assert.match(nodes.get("records-history-status").textContent, /Chưa có lần khám/);
});
test("results and prescription load from the selected encounter and keep text unparsed", async () => {
  await controller(); trigger(all(nodes.get("records-encounters")).find(n => n.tagName === "BUTTON")); await tick();
  const text = nodes.get("record-result-content").textContent;
  assert.match(text, /<script>giữ nguyên văn bản<\/script>/); assert.match(text, /Thuốc API/); assert.match(text, /01\/09\/2026/);
});
test("missing medical records show no fabricated results", async () => {
  const original = respond; respond = url => url.pathname.endsWith("medical-record") ? Response.json({ error: { code: "MEDICAL_RECORD_NOT_FOUND", message: "Chưa có bệnh án" } }, { status: 404 }) : original(url);
  await controller(); trigger(all(nodes.get("records-encounters")).find(n => n.tagName === "BUTTON")); await tick();
  assert.equal(nodes.get("record-result-content").children.length, 0); assert.match(nodes.get("record-result-status").textContent, /Chưa có bệnh án/);
});
test("lookup mismatch cannot query another patient's history", async () => {
  await controller(); const count = calls.length; nodes.get("lookup-patient").value = "1"; nodes.get("lookup-identifier").value = "000000000000";
  trigger(nodes.get("record-lookup-form"), "submit"); await tick();
  assert.match(nodes.get("record-lookup-status").textContent, /không khớp/);
  assert.deepEqual(calls.slice(count).map(c => c.path), ["/patients/1"]);
});
test("late responses cannot restore private records after leaving", async () => {
  const original = respond; let finish;
  respond = url => url.pathname === "/patients" ? new Promise(resolve => { finish = resolve; }) : original(url);
  await controller(); window.dispatchEvent(new Event("pagehide")); finish(Response.json({ items: profiles, total: 2 })); await tick();
  assert.equal(nodes.get("records-profiles").children.length, 0); assert.equal(nodes.get("records-encounters").children.length, 0);
});
test("failed history requests show an error and a working retry", async () => {
  const original = respond; respond = url => url.pathname.endsWith("/encounters") ? Response.json({ error: { message: "Lỗi tải lịch sử" } }, { status: 500 }) : original(url);
  await controller(); assert.match(nodes.get("records-history-status").textContent, /Lỗi tải lịch sử/); assert.equal(nodes.get("records-history-retry").hidden, false);
  respond = original; trigger(nodes.get("records-history-retry")); await tick(); assert.match(nodes.get("records-encounters").textContent, /Bác sĩ API/);
});
test("pagination keeps the displayed record and profile controls until the next page arrives", async () => {
  const original = respond;
  let finish;
  respond = url => {
    if (url.pathname === "/patients/1/encounters") {
      assert.equal(url.searchParams.get("page_size"), "1");
      if (url.searchParams.get("page") === "2") return new Promise(resolve => { finish = resolve; });
      return Response.json({ items: [encounter], total: 2 });
    }
    return original(url);
  };
  await controller();
  const card = nodes.get("records-encounters").children[0];
  const profileButton = nodes.get("records-profiles").children[0];
  trigger(nodes.get("records-next")); await tick();
  assert.equal(nodes.get("records-encounters").children[0], card);
  assert.equal(nodes.get("records-profiles").children[0], profileButton);
  assert.equal(nodes.get("records-page").textContent, "Trang 1 / 2");
  finish(Response.json({ items: [{ ...encounter, encounter_id: 9, doctor_name: "Bác sĩ trang hai" }], total: 2 }));
  await tick();
  assert.equal(nodes.get("records-encounters").children.length, 1);
  assert.match(nodes.get("records-encounters").textContent, /Bác sĩ trang hai/);
  assert.equal(nodes.get("records-page").textContent, "Trang 2 / 2");
});
