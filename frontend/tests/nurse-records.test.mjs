import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { initNurseRecords } from "../static/js/core/nurse_records.js";
import { setAccessToken } from "../static/js/core/api.js";

class Node {
  innerHTML = ""; textContent = ""; hidden = false; listeners = {}; dataset = {};
  addEventListener(type, callback) { this.listeners[type] = callback; }
  querySelectorAll() { return []; }
  replaceChildren() { this.innerHTML = ""; }
  close() { this.open = false; }
  showModal() { this.open = true; }
  focus() {}
  scrollIntoView() {}
}
let nodes, requests, respond, originals, windowEvents;
const patient = { patient_id: 41, full_name: "Người kiểm thử <script>", dob: "2000-01-01", gender: "Nữ", phone: "0900000041", address: "Địa chỉ kiểm thử", id_card: "123456789012", health_insurance: null };
const encounter = { encounter_id: 501, patient_id: 41, patient_name: patient.full_name, doctor_name: "Bác sĩ kiểm thử", room_name: "Phòng kiểm thử", work_date: "2026-10-17", encounter_status: "COMPLETED" };
const page = items => ({ items, total: items.length, page: 1, page_size: 12 });
const tick = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
const click = (selector, attribute, value = "") => nodes.get(selector).listeners.click({ target: { closest: candidate => candidate === `[${attribute}]` ? { dataset: { [attribute === "data-patient" ? "patient" : "record"]: value } } : null } });
beforeEach(() => {
  originals = ["document", "window", "matchMedia", "fetch"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  nodes = new Map(["page-body", "nurse-record-search", "nurse-record-detail", "nurse-record-status", "nurse-record-list", "nurse-record-pages", "nurse-history-pages", "nurse-history-status", "staff-dialog", "staff-dialog-title", "staff-dialog-content"].map(id => [`#${id}`, new Node()]));
  nodes.get("#nurse-record-search").elements = { q: Object.assign(new Node(), { value: "" }) };
  windowEvents = {}; requests = [];
  respond = async path => {
    if (path === "/patients") return page([patient]);
    if (path === "/patients/41") return { patient };
    if (path === "/patients/41/encounters") return page([encounter]);
    if (path === "/encounters/501") return { encounter };
    if (path === "/encounters/501/medical-record") return { medical_record: { record_id: 99, diagnosis: "Kết quả kiểm thử", treatment: "Hướng điều trị kiểm thử" } };
    if (path === "/medical-records/99/prescription-items") return page([]);
    throw new Error(`Unexpected request ${path}`);
  };
  Object.assign(globalThis, {
    document: { querySelector: selector => nodes.get(selector) || null },
    window: { addEventListener: (type, callback) => { const previous = windowEvents[type]; windowEvents[type] = () => { previous?.(); callback(); }; } },
    matchMedia: () => ({ matches: true }),
    fetch: async (url, options) => {
      const parsed = new URL(url); requests.push({ path: parsed.pathname, params: Object.fromEntries(parsed.searchParams), method: options.method });
      const data = await respond(parsed.pathname, parsed.searchParams);
      return data instanceof Response ? data : Response.json(data);
    },
  });
  setAccessToken("unit-test-only");
});
afterEach(() => {
  setAccessToken(null);
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
});

test("nurse patient search and clinical details use only existing authorized reads", async () => {
  await initNurseRecords();
  assert.deepEqual(requests, [{ path: "/patients", params: { page: "1", page_size: "12" }, method: "GET" }]);
  assert.match(nodes.get("#nurse-record-list").innerHTML, /&lt;script&gt;/);
  assert.doesNotMatch(nodes.get("#nurse-record-list").innerHTML, /<script>/);
  click("#nurse-record-list", "data-patient", "41"); await tick();
  assert.match(nodes.get("#nurse-record-detail").innerHTML, /CHỈ XEM/);
  assert.match(nodes.get("#nurse-record-detail").innerHTML, /Các lượt khám được phép xem/);
  assert.doesNotMatch(nodes.get("#nurse-record-detail").innerHTML, /Sửa hồ sơ|Lưu|name="diagnosis"/);
  click("#nurse-record-detail", "data-record", "501"); await tick();
  assert.equal(nodes.get("#staff-dialog").open, true);
  assert.match(nodes.get("#staff-dialog-content").innerHTML, /Kết quả kiểm thử/);
  assert.ok(requests.every(r => r.method === "GET"));
  assert.ok(requests.every(r => !Object.hasOwn(r.params, "nurse_id") && !Object.hasOwn(r.params, "user_id")));
});

test("typing searches without submitting and clears the previously selected patient", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  await initNurseRecords(); click("#nurse-record-list", "data-patient", "41"); await tick();
  assert.equal(nodes.get("#nurse-record-detail").hidden, false);
  const input = nodes.get("#nurse-record-search").elements.q;
  input.value = "  0900000041  "; input.listeners.input({});
  assert.equal(nodes.get("#nurse-record-detail").hidden, true);
  t.mock.timers.tick(251); await tick();
  assert.equal(requests.at(-1).params.q, "0900000041");
  assert.equal(nodes.get("#nurse-record-detail").hidden, true);
  assert.equal(nodes.get("#nurse-record-detail").innerHTML, "");
  input.value = ""; input.listeners.input({}); t.mock.timers.tick(251); await tick();
  assert.equal(requests.at(-1).params.q, undefined);
});

test("revoked access and late profile responses never restore previous patient details", async () => {
  await initNurseRecords();
  const previous = respond;
  respond = (path, params) => path === "/patients/41" ? Response.json({ error: { message: "Không tìm thấy trong phạm vi phân công", code: "PATIENT_NOT_FOUND" } }, { status: 404 }) : previous(path, params);
  click("#nurse-record-list", "data-patient", "41"); await tick();
  assert.match(nodes.get("#nurse-record-detail").innerHTML, /Không tìm thấy/);
  assert.doesNotMatch(nodes.get("#nurse-record-detail").innerHTML, /123456789012|Địa chỉ kiểm thử/);
  let finish;
  respond = (path, params) => path === "/patients/41" ? new Promise(resolve => { finish = resolve; }) : previous(path, params);
  click("#nurse-record-list", "data-patient", "41"); await tick();
  windowEvents.pagehide(); finish({ patient }); await tick();
  assert.equal(nodes.get("#page-body").innerHTML, "");
  assert.equal(nodes.get("#nurse-record-detail").innerHTML, "");
  assert.equal(nodes.get("#staff-dialog").open, false);
});

test("clinical details belonging to another patient are rejected before loading a medical record", async () => {
  await initNurseRecords(); click("#nurse-record-list", "data-patient", "41"); await tick();
  const previous = respond;
  respond = (path, params) => path === "/encounters/501" ? { encounter: { ...encounter, patient_id: 999 } } : previous(path, params);
  click("#nurse-record-detail", "data-record", "501"); await tick();
  assert.match(nodes.get("#nurse-history-status").textContent, /không thuộc hồ sơ/);
  assert.equal(requests.some(r => r.path.endsWith("/medical-record")), false);
  assert.notEqual(nodes.get("#staff-dialog").open, true);
});
