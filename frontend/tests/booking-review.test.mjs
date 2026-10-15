import test from "node:test";
import assert from "node:assert/strict";
import { demoPaymentPayload, qrMatrix } from "../static/js/core/payment-qr.js";
import { readDraft, saveDraft } from "../static/js/core/booking-draft.js";
const nativeInterval = globalThis.setInterval;
globalThis.setInterval = (...args) => nativeInterval(...args).unref();

class Node {
  constructor(tag = "div") { this.tagName = tag.toUpperCase(); this.children = []; this.hidden = false; this.events = {}; this.namespaceURI = "http://www.w3.org/2000/svg"; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(name, handler) { this.events[name] = handler; }
  querySelector(selector) { return this.querySelectorAll(selector)[0]; }
  querySelectorAll(selector) {
    const tags = selector.split(",").map(s => s.trim().toUpperCase());
    const matches = [];
    const walk = node => { for (const child of node.children) { if (tags.includes(child.tagName)) matches.push(child); walk(child); } };
    walk(this); return matches;
  }
  checkValidity() {
    if (this.tagName === "FORM") return this.querySelectorAll("input,textarea,select").every(node => node.checkValidity());
    if (this.disabled || this.readOnly) return true;
    if (this.required && !this.value?.trim()) return false;
    if (this.value && this.pattern && !(new RegExp(`^(?:${this.pattern})$`)).test(this.value)) return false;
    if (this.type === "date" && this.value && this.max && this.value > this.max) return false;
    return true;
  }
  reportValidity() { return this.checkValidity(); }
  showModal() { this.open = true; }
  close() { this.open = false; this.events.close?.(); }
  get elements() {
    const all = [];
    const walk = node => { for (const child of node.children) { all.push(child); walk(child); } };
    walk(this); return { namedItem: name => all.find(n => n.name === name) };
  }
}
const id = "11111111-1111-4111-8111-111111111111";
function fixture({ uncertain = false, encounterId, failCreate = false, failSave = false, doctorGate, beforeSave, normalizePatient } = {}) {
  const nodes = new Map();
  const get = selector => {
    const find = node => node.id === selector.slice(1) ? node : node.children.map(find).find(Boolean);
    for (const node of nodes.values()) { const match = find(node); if (match) return match; }
    if (!nodes.has(selector)) nodes.set(selector, new Node());
    return nodes.get(selector);
  };
  const auth = get("#booking-auth-status"); auth.append(new Node("p"), new Node("button"));
  get("#booking-payment").hidden = true; get("#booking-qr").hidden = true;
  get("#booking-payment-method").value = "BANK";
  const store = new Map();
  globalThis.sessionStorage = { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };
  sessionStorage.setItem("neu-medical.auth", JSON.stringify({ token: "test", expiresAt: Date.now() + 60000 }));
  globalThis.document = { querySelector: get, createElement: tag => new Node(tag), createElementNS: (_, tag) => new Node(tag), body: { classList: { remove() {} } } };
  const events = {};
  globalThis.window = { addEventListener: (name, handler) => { events[name] = handler; }, dispatchEvent() {} };
  const navigation = [];
  globalThis.location = { href: `http://localhost:3000/frontend/templates/(patient)/booking-review.html?draft=${id}`, search: `?draft=${id}`, assign(url) { navigation.push(url); }, replace() {} };
  globalThis.history = { replaceState() {} };
  const draft = { user_id: 1, patient_id: 2, doctor_profile_id: 7, schedule_id: 9, work_date: "2030-01-15", appointment_time: "08:00", symptoms: "Test only", uncertain, encounter_id: encounterId };
  saveDraft(draft, id);
  const row = { encounter_id: 3, patient_id: 2, doctor_profile_id: 7, schedule_id: 9, patient_name: "Test patient", doctor_name: "Test doctor", department_name: "Mắt", room_name: "204", work_date: "2030-01-15", estimated_exam_at: "2030-01-15T08:00:00+07:00", appointment_end_at: "2030-01-15T08:15:00+07:00", consultation_fee_snapshot: "260000", deposit_amount_snapshot: "260000", symptoms: "Test only", encounter_status: "HOLDING", hold_expires_at: new Date(Date.now() + 600000).toISOString() };
  const patient = { patient_id: 2, user_id: 1, full_name: "Test patient", phone: "0912345678", dob: "2000-01-01" };
  const calls = []; let payment, saveCount = 0;
  globalThis.fetch = async (url, options) => {
    const path = new URL(url).pathname; calls.push({ path, method: options.method, body: options.body });
    let data;
    if (path === "/me") data = { user: { user_id: 1, role_name: "USER" } };
    else if (path === "/doctors") { if (doctorGate) await doctorGate; data = { items: [{ doctor_profile_id: 7, full_name: "Test doctor", department_name: "Mắt", consultation_fee: 260000 }], total: 1 }; }
    else if (path === "/patients") data = { items: [patient], total: 1 };
    else if (path === "/patients/2") {
      const changes = JSON.parse(options.body), count = ++saveCount;
      if (beforeSave) await beforeSave(changes, count);
      if (typeof failSave === "function" ? failSave(count) : failSave) return Response.json({ error: { message: "Thông tin trùng hồ sơ", code: "PATIENT_IDENTITY_CONFLICT" } }, { status: 409 });
      Object.assign(patient, changes);
      if (normalizePatient) Object.assign(patient, normalizePatient({ ...patient }, changes));
      data = { patient };
    }
    else if (path.endsWith("/schedules")) data = { items: [{ schedule_id: 9, work_date: "2030-01-15", start_time: "08:00", room_name: "204", schedule_status: "OPEN", slots: [{ appointment_time: "08:00", starts_at: row.estimated_exam_at, ends_at: row.appointment_end_at }] }], total: 1 };
    else if (path === "/encounters/online") {
      if (failCreate) return Response.json({ error: { message: "Server error" } }, { status: 500 });
      data = { encounter: row };
    }
    else if (path === "/encounters") data = { items: [row], total: 1 };
    else if (path.endsWith("/payment-intents")) {
      payment = { payment_id: 4, payment_type: "DEPOSIT", transaction_status: "PENDING", transaction_code: "DEMO-" + "a".repeat(32), amount: "260000", payment_method: "BANK" };
      data = { payment };
    }
    else if (path.endsWith("/payments")) data = { items: payment ? [payment] : [], total: payment ? 1 : 0 };
    else if (path === "/demo/payments/4/result") { payment.transaction_status = "SUCCESS"; row.encounter_status = "CONFIRMED"; row.ticket_code = "TEST-ONLY"; data = { payment }; }
    else if (path === "/encounters/3/ticket") data = { ticket: { ticket_code: "TEST-ONLY" } };
    else if (path === "/encounters/3") data = { encounter: row };
    else throw new Error(`Unexpected API ${path}`);
    return Response.json(data);
  };
  return { get, calls, events, store, navigation, patient };
}
async function loaded(f) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (f.get("#booking-auth-status").hidden) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.fail(f.get("#booking-auth-status").children[0].textContent);
}
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}
async function until(predicate, message) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.fail(message);
}
test("opening review has no mutations; payment click creates one hold and shows QR with server amount", async () => {
  const f = fixture();
  await import("../static/js/pages/booking-review.js?initial"); await loaded(f);
  assert.equal(f.get("#booking-payment").hidden, true);
  assert.equal(f.calls.filter(c => c.method === "POST").length, 0);
  const click = f.get("#booking-confirm").events.click;
  await Promise.all([click(), click()]);
  assert.equal(f.calls.filter(c => c.path === "/encounters/online").length, 1);
  assert.equal(f.calls.filter(c => c.path.endsWith("/payment-intents")).length, 1);
  assert.equal(f.get("#booking-payment").hidden, false);
  assert.equal(f.get("#booking-qr").hidden, false);
  assert.ok(f.get("#booking-qr").children[0].children[1].d.length > 100);
  assert.match(f.get("#booking-review-total").textContent, /260/);
  assert.equal(f.get("#booking-payment-modal").open, true);
  await f.get("#booking-payment-success").events.click();
  assert.equal(f.get("#booking-success").hidden, false, f.get("#booking-dialog-status").textContent);
  assert.equal(f.get("#booking-payment").hidden, true);
  f.events.pagehide();
});
test("an uncertain submission is reconciled without repeating the hold POST", async () => {
  const f = fixture({ failCreate: true });
  await import("../static/js/pages/booking-review.js?uncertain"); await loaded(f);
  await f.get("#booking-confirm").events.click();
  assert.equal(readDraft(id, 1).uncertain, true, f.get("#booking-dialog-status").textContent);
  assert.equal(f.get("#booking-confirm").disabled, true);
  await f.get("#booking-refresh").events.click();
  await f.get("#booking-confirm").events.click();
  assert.equal(f.calls.filter(c => c.path === "/encounters/online").length, 1);
  assert.equal(f.get("#booking-qr").hidden, false);
  f.events.pagehide();
});
test("resuming a hold keeps QR hidden until payment is explicitly opened", async () => {
  const f = fixture({ encounterId: 3 });
  await import("../static/js/pages/booking-review.js?resume"); await loaded(f);
  assert.equal(f.get("#booking-payment").hidden, true);
  await f.get("#booking-confirm").events.click();
  assert.equal(f.calls.filter(c => c.path === "/encounters/online").length, 0);
  assert.equal(f.get("#booking-qr").hidden, false);
  f.events.pagehide();
});
test("edited patient fields are saved through PATCH before creating the booking", async () => {
  const f = fixture(); await import("../static/js/pages/booking-review.js?edit"); await loaded(f);
  assert.equal(f.get("#booking-review-field-0").readOnly, false);
  assert.equal(f.get("#booking-review-field-3").readOnly, true);
  f.get("#booking-review-field-0").value = "Updated test name";
  await f.get("#booking-confirm").events.click();
  const patch = f.calls.findIndex(c => c.method === "PATCH");
  assert.deepEqual(JSON.parse(f.calls[patch].body), { full_name: "Updated test name" });
  assert.ok(patch < f.calls.findIndex(c => c.path === "/encounters/online"));
  assert.equal(f.get("#booking-review-field-0").value, "Updated test name");
  f.events.pagehide();
});
test("failed profile update preserves edits and prevents booking/payment POSTs", async () => {
  const f = fixture({ failSave: true }); await import("../static/js/pages/booking-review.js?failed-edit"); await loaded(f);
  f.get("#booking-review-field-0").value = "Updated test name";
  await f.get("#booking-confirm").events.click();
  assert.equal(f.calls.filter(c => c.method === "POST").length, 0);
  assert.equal(f.get("#booking-review-field-0").value, "Updated test name");
  assert.match(f.get("#booking-dialog-status").textContent, /trùng/);
});

test("review omits the manual save button and removed instruction", async () => {
  const f = fixture(); await import("../static/js/pages/booking-review.js?autosave-ui"); await loaded(f);
  try {
    const form = f.get("#booking-patient-form");
    assert.equal(form.querySelectorAll("button").some(node => node.textContent === "Lưu thông tin"), false);
    assert.equal(form.querySelectorAll("p").some(node => /Bạn có thể sửa thông tin cơ bản tại đây/.test(node.textContent)), false);
    assert.equal(f.calls.filter(c => c.method === "PATCH").length, 0);
  } finally { f.events.pagehide(); }
});

test("typing automatically saves patient changes without creating a hold or payment", async () => {
  const f = fixture(); await import("../static/js/pages/booking-review.js?autosave-input"); await loaded(f);
  try {
    const field = f.get("#booking-review-field-6"); field.value = "New database address";
    assert.equal(typeof field.events.input, "function");
    field.events.input();
    assert.equal(f.calls.filter(c => c.method === "PATCH").length, 0, "input should debounce writes");
    await new Promise(resolve => setTimeout(resolve, 650));
    await until(() => f.patient.address === field.value, "debounced input did not reach the patient API");
    assert.deepEqual(JSON.parse(f.calls.find(c => c.method === "PATCH").body), { address: "New database address" });
    assert.equal(f.calls.filter(c => c.method === "POST").length, 0);
    assert.notEqual(field.disabled, true);
  } finally { f.events.pagehide(); }
});

test("change saves immediately and serializes newer edits behind an in-flight PATCH", async () => {
  const firstSave = deferred();
  const f = fixture({ beforeSave: (_, count) => count === 1 ? firstSave.promise : undefined });
  await import("../static/js/pages/booking-review.js?autosave-queue"); await loaded(f);
  try {
    const field = f.get("#booking-review-field-0");
    field.value = "First changed name";
    assert.equal(typeof field.events.change, "function");
    const firstChange = field.events.change();
    await until(() => f.calls.some(c => c.method === "PATCH"), "change did not start a PATCH");
    assert.notEqual(field.disabled, true, "saving must not interrupt typing");
    field.value = "Latest changed name";
    const secondChange = field.events.change();
    for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.calls.filter(c => c.method === "PATCH").length, 1, "PATCH requests must be sequential");
    assert.equal(field.value, "Latest changed name");
    firstSave.resolve(); await Promise.all([firstChange, secondChange]);
    await until(() => f.patient.full_name === "Latest changed name", "newer edit was lost after the first PATCH completed");
    const patches = f.calls.filter(c => c.method === "PATCH");
    assert.equal(patches.length, 2);
    assert.equal(JSON.parse(patches[1].body).full_name, "Latest changed name");
    assert.equal(field.value, "Latest changed name");
    assert.equal(f.calls.filter(c => c.method === "POST").length, 0);
  } finally { firstSave.resolve(); f.events.pagehide(); }
});

test("server-normalized patient values replace the saved input", async () => {
  const f = fixture({ normalizePatient: patient => ({ health_insurance: patient.health_insurance?.toUpperCase() }) });
  await import("../static/js/pages/booking-review.js?autosave-normalized"); await loaded(f);
  try {
    const field = f.get("#booking-review-field-2"); field.value = "ab12345678";
    assert.equal(typeof field.events.blur, "function");
    await field.events.blur();
    await until(() => field.value === "AB12345678", "saved input did not use the normalized API response");
    assert.equal(f.patient.health_insurance, "AB12345678");
    assert.equal(f.calls.filter(c => c.method === "POST").length, 0);
  } finally { f.events.pagehide(); }
});

test("failed automatic PATCH keeps edits and can retry without an uncertain booking", async () => {
  const f = fixture({ failSave: count => count === 1 });
  await import("../static/js/pages/booking-review.js?autosave-retry"); await loaded(f);
  try {
    const field = f.get("#booking-review-field-0"); field.value = "Retry changed name";
    assert.equal(typeof field.events.change, "function");
    await field.events.change();
    await until(() => /trùng/.test(f.get("#booking-patient-status").textContent), "automatic PATCH failure was not shown");
    assert.equal(field.value, "Retry changed name");
    assert.equal(f.patient.full_name, "Test patient");
    assert.equal(f.calls.filter(c => c.method === "POST").length, 0);
    assert.equal(readDraft(id, 1).uncertain, false);
    assert.notEqual(f.get("#booking-confirm").hidden, true);
    assert.notEqual(f.get("#booking-confirm").disabled, true);
    await f.get("#booking-confirm").events.click();
    assert.equal(f.patient.full_name, "Retry changed name");
    assert.equal(f.calls.filter(c => c.method === "PATCH").length, 2);
    assert.equal(f.calls.filter(c => c.path === "/encounters/online").length, 1);
    assert.equal(f.calls.filter(c => c.path.endsWith("/payment-intents")).length, 1);
  } finally { f.events.pagehide(); }
});

test("payment waits for a pending patient PATCH and does not create an uncertain booking on PATCH failure", async () => {
  const saving = deferred();
  const f = fixture({ failSave: true, beforeSave: () => saving.promise });
  await import("../static/js/pages/booking-review.js?autosave-payment-wait"); await loaded(f);
  try {
    const field = f.get("#booking-review-field-0"); field.value = "Pending changed name";
    assert.equal(typeof field.events.change, "function");
    const change = field.events.change();
    await until(() => f.calls.some(c => c.method === "PATCH"), "change did not start a PATCH");
    const paymentClick = f.get("#booking-confirm").events.click();
    for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.calls.filter(c => c.method === "POST").length, 0);
    saving.resolve(); await Promise.all([change, paymentClick]);
    assert.equal(f.calls.filter(c => c.method === "POST").length, 0);
    assert.equal(readDraft(id, 1).uncertain, false);
    assert.equal(field.value, "Pending changed name");
    assert.notEqual(f.get("#booking-confirm").hidden, true, "patient conflict must not hide payment as though the slot was lost");
  } finally { saving.resolve(); f.events.pagehide(); }
});

test("back navigation flushes edited patient data before leaving the review", async () => {
  const saving = deferred();
  const f = fixture({ beforeSave: () => saving.promise });
  await import("../static/js/pages/booking-review.js?autosave-back"); await loaded(f);
  try {
    const field = f.get("#booking-review-field-6"); field.value = "Address saved before leaving";
    const back = f.get("#booking-back").events.click();
    await until(() => f.calls.some(c => c.method === "PATCH"), "back did not flush changed patient data");
    assert.equal(f.navigation.length, 0);
    saving.resolve(); await back;
    await until(() => f.navigation.length === 1, "back did not navigate after the save completed");
    assert.equal(f.patient.address, "Address saved before leaving");
  } finally { saving.resolve(); f.events.pagehide(); }
});

test("late patient PATCH response after pagehide cannot restore the private review", async () => {
  const saving = deferred();
  const f = fixture({ beforeSave: () => saving.promise });
  await import("../static/js/pages/booking-review.js?autosave-late"); await loaded(f);
  try {
    const field = f.get("#booking-review-field-0"); field.value = "Late changed name";
    assert.equal(typeof field.events.change, "function");
    const change = field.events.change();
    await until(() => f.calls.some(c => c.method === "PATCH"), "change did not start a PATCH");
    f.events.pagehide();
    const valueAtLeave = field.value;
    const statusAtLeave = f.get("#booking-patient-status").textContent;
    saving.resolve(); await change;
    for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.get("#booking-review-page").hidden, true);
    assert.equal(field.value, valueAtLeave);
    assert.equal(f.get("#booking-patient-status").textContent, statusAtLeave);
    assert.equal(f.calls.filter(c => c.method === "POST").length, 0);
  } finally { saving.resolve(); f.events.pagehide(); }
});
test("QR excludes medical/patient information and rejects real or inactive transactions", () => {
  const p = { transaction_status: "PENDING", transaction_code: "DEMO-" + "b".repeat(32), amount: "260000", patient_name: "Private name", symptoms: "Private symptoms" };
  const text = demoPaymentPayload(p);
  assert.deepEqual(JSON.parse(text), { mode: "DEMO", transaction: p.transaction_code, amount: 260000, currency: "VND" });
  assert.ok(qrMatrix(text).length >= 21);
  for (const change of [{ transaction_status: "FAILED" }, { transaction_code: "BANK-real" }, { amount: -1 }, { amount: "NaN" }]) assert.equal(demoPaymentPayload({ ...p, ...change }), null);
});
test("late API responses after leaving cannot restore the private review page", async () => {
  let release; const doctorGate = new Promise(resolve => { release = resolve; });
  const f = fixture({ doctorGate }); await import("../static/js/pages/booking-review.js?late");
  f.events.pagehide(); release();
  for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.get("#booking-review-page").hidden, true);
  assert.equal(f.get("#booking-review-patient").children.length, 0);
});
test("drafts are isolated by user and expire", () => {
  fixture(); assert.ok(readDraft(id, 1)); assert.equal(readDraft(id, 99), null);
  saveDraft({ user_id: 1 }, id);
  const saved = JSON.parse(sessionStorage.getItem("neu:booking-review:" + id)); saved.updatedAt = Date.now() - 31 * 60000;
  sessionStorage.setItem("neu:booking-review:" + id, JSON.stringify(saved)); assert.equal(readDraft(id, 1), null);
});
