import test from "node:test";
import assert from "node:assert/strict";
import { demoPaymentPayload, qrMatrix } from "../static/js/core/payment_qr.js";
import { readDraft, saveDraft } from "../static/js/core/booking_draft.js";
const nativeInterval = globalThis.setInterval;
globalThis.setInterval = (...args) => nativeInterval(...args).unref();

class Node {
  constructor(tag = "div") { this.tagName = tag.toUpperCase(); this.children = []; this.textContent = ""; this.hidden = false; this.events = {}; this.namespaceURI = "http://www.w3.org/2000/svg"; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this[name] = value; }
  scrollIntoView(options) { this.scrolled = options; }
  focus() { this.focused = true; }
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
function fixture({ uncertain = false, encounterId, failCreate = false, failSave = false, doctorGate, beforeSave, normalizePatient, patientFields = {}, symptoms = "Test only" } = {}) {
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
  globalThis.location = { href: `http://localhost:3000/frontend/templates/(patient)/booking_review.html?draft=${id}`, search: `?draft=${id}`, assign(url) { navigation.push(url); }, replace() {} };
  globalThis.history = { replaceState() {} };
  const draft = { user_id: 1, patient_id: 2, doctor_profile_id: 7, schedule_id: 9, work_date: "2030-01-15", appointment_time: "08:00", symptoms, uncertain, encounter_id: encounterId };
  saveDraft(draft, id);
  const row = { encounter_id: 3, patient_id: 2, doctor_profile_id: 7, schedule_id: 9, patient_name: "Test patient", doctor_name: "Test doctor", department_name: "Mắt", room_name: "204", work_date: "2030-01-15", estimated_exam_at: "2030-01-15T08:00:00+07:00", appointment_end_at: "2030-01-15T08:15:00+07:00", consultation_fee_snapshot: "260000", deposit_amount_snapshot: "260000", symptoms: "Test only", encounter_status: "HOLDING", hold_expires_at: new Date(Date.now() + 600000).toISOString() };
  const patient = { patient_id: 2, user_id: 1, full_name: "Test patient", phone: "0912345678", id_card: "001090123456", dob: "2000-01-01", ...patientFields };
  const calls = []; let payment, saveCount = 0;
  globalThis.fetch = async (url, options) => {
    const path = new URL(url).pathname; calls.push({ path, method: options.method, body: options.body });
    let data;
    if (path === "/me") data = { user: { user_id: 1, role_name: "USER", phone: "0912345678" } };
    else if (path === "/doctors") { if (doctorGate) await doctorGate; data = { items: [{ doctor_profile_id: 7, full_name: "Test doctor", department_name: "Mắt", consultation_fee: 260000 }], total: 1 }; }
    else if (path === "/patients") data = { items: [patient], total: 1 };
    else if (path === "/patients/2") throw new Error("Booking must never update the original patient");
    else if (path.endsWith("/schedules")) data = { items: [{ schedule_id: 9, work_date: "2030-01-15", start_time: "08:00", room_name: "204", schedule_status: "OPEN", slots: [{ appointment_time: "08:00", starts_at: row.estimated_exam_at, ends_at: row.appointment_end_at }] }], total: 1 };
    else if (path === "/encounters/online") {
      if (failCreate) return Response.json({ error: { message: "Server error" } }, { status: 500 });
      const body = JSON.parse(options.body); row.registration_details = body.registration_details; row.symptoms = body.symptoms;
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
    else if (path === "/encounters/3/registration") {
      const body = JSON.parse(options.body), count = ++saveCount;
      if (beforeSave) await beforeSave(body, count);
      if (failSave) return Response.json({ error: { message: "Không lưu được đăng ký", code: "REGISTRATION_FAILED" } }, { status: 500 });
      row.registration_details = body.registration_details; row.symptoms = body.symptoms;
      if (normalizePatient) Object.assign(row.registration_details, normalizePatient(row.registration_details));
      data = { encounter: row };
    }
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
  await import("../static/js/pages/booking_review.js?initial"); await loaded(f);
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
  await import("../static/js/pages/booking_review.js?uncertain"); await loaded(f);
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
  await import("../static/js/pages/booking_review.js?resume"); await loaded(f);
  assert.equal(f.get("#booking-payment").hidden, true);
  await f.get("#booking-confirm").events.click();
  assert.equal(f.calls.filter(c => c.path === "/encounters/online").length, 0);
  assert.equal(f.get("#booking-qr").hidden, false);
  f.events.pagehide();
});
test("typing registration details only changes the draft, never the account or original patient", async () => {
  const f = fixture({ patientFields: { user_id: null } });
  await import("../static/js/pages/booking_review.js?draft-only"); await loaded(f);
  try {
    for (let index = 0; index < 8; index++) assert.equal(f.get(`#booking-review-field-${index}`).readOnly, false);
    const address = f.get("#booking-review-field-6"); address.value = "Địa chỉ khai cho lần này"; address.events.input();
    const phone = f.get("#booking-review-field-3"); phone.value = "+84 912.345.678"; phone.events.input();
    assert.equal(readDraft(id, 1).registration_details.address, address.value);
    assert.equal(readDraft(id, 1).registration_details.phone, "0912345678");
    assert.equal(f.patient.address, undefined);
    assert.equal(f.calls.filter(c => ["POST", "PATCH"].includes(c.method)).length, 0);
    await f.get("#booking-back").events.click();
    assert.equal(f.navigation.length, 1);
    assert.equal(f.calls.filter(c => ["POST", "PATCH"].includes(c.method)).length, 0);
  } finally { f.events.pagehide(); }
});

test("payment sends the entered registration snapshot and leaves the original patient unchanged", async () => {
  const f = fixture(); await import("../static/js/pages/booking_review.js?snapshot-create"); await loaded(f);
  try {
    f.get("#booking-review-field-0").value = "Tên khai trong lần đăng ký";
    f.get("#booking-review-field-6").value = "Địa chỉ tiếp nhận";
    await f.get("#booking-confirm").events.click();
    const call = f.calls.find(c => c.path === "/encounters/online");
    const details = JSON.parse(call.body).registration_details;
    assert.equal(details.full_name, "Tên khai trong lần đăng ký");
    assert.equal(details.address, "Địa chỉ tiếp nhận");
    assert.equal(f.patient.full_name, "Test patient");
    assert.equal(f.calls.filter(c => c.method === "PATCH" && ["/me", "/patients/2"].includes(c.path)).length, 0);
    assert.equal(f.get("#booking-review-field-0").value, details.full_name);
  } finally { f.events.pagehide(); }
});

test("partial registration drafts survive rerendering without writing to the server", async () => {
  const f = fixture({ encounterId: 3 });
  await import("../static/js/pages/booking_review.js?draft-render"); await loaded(f);
  try {
    const address = f.get("#booking-review-field-6"); address.value = "Nơi lưu trú hiện tại"; address.events.input();
    const name = f.get("#booking-review-field-0"); name.value = ""; name.events.input();
    await f.get("#booking-refresh").events.click();
    assert.equal(f.get("#booking-review-field-6").value, address.value);
    assert.equal(f.get("#booking-review-field-0").value, "");
    assert.equal(f.calls.filter(c => ["POST", "PATCH"].includes(c.method)).length, 0);
  } finally { f.events.pagehide(); }
});

test("payment marks missing fields, scrolls and focuses the first error without creating a hold", async () => {
  const f = fixture({ symptoms: "" });
  await import("../static/js/pages/booking_review.js?validation-missing"); await loaded(f);
  try {
    const name = f.get("#booking-review-field-0"), symptoms = f.get("#booking-review-field-7");
    name.value = "   "; symptoms.value = "   "; symptoms.events.input();
    await f.get("#booking-confirm").events.click();
    assert.equal(name["aria-invalid"], "true");
    assert.equal(symptoms["aria-invalid"], "true");
    assert.match(f.get("#booking-review-field-0-error").textContent, /họ và tên/);
    assert.equal(name.focused, true);
    assert.equal(name.scrolled.block, "center");
    assert.equal(f.calls.filter(c => ["POST", "PATCH"].includes(c.method)).length, 0);
    assert.notEqual(f.get("#booking-payment-modal").open, true);
    name.value = "Valid name"; name.events.input();
    assert.equal(name["aria-invalid"], "false");
    assert.equal(f.get("#booking-review-field-0-error").hidden, true);
    await f.get("#booking-confirm").events.click();
    assert.equal(symptoms.focused, true);
    symptoms.value = "New symptom description"; symptoms.events.input();
    await f.get("#booking-confirm").events.click();
    const request = f.calls.find(c => c.path === "/encounters/online");
    assert.equal(JSON.parse(request.body).symptoms, symptoms.value);
    assert.equal(f.get("#booking-payment-modal").open, true);
  } finally { f.events.pagehide(); }
});

test("CCCD is required even with a DOB; optional fields can stay empty", async () => {
  const f = fixture({ patientFields: { id_card: null } });
  await import("../static/js/pages/booking_review.js?required-id"); await loaded(f);
  try {
    const idCard = f.get("#booking-review-field-1");
    assert.equal(idCard.required, true);
    await f.get("#booking-confirm").events.click();
    assert.equal(idCard.focused, true);
    assert.match(f.get("#booking-review-field-1-error").textContent, /nhập số cccd/i);
    assert.equal(f.calls.filter(c => ["POST", "PATCH"].includes(c.method)).length, 0);
    idCard.value = "123456789012"; idCard.events.input();
    f.get("#booking-review-field-4").value = "";
    await f.get("#booking-confirm").events.click();
    assert.equal(f.get("#booking-payment-modal").open, true);
    for (const index of [2, 4, 5, 6]) assert.notEqual(f.get(`#booking-review-field-${index}`).required, true);
  } finally { f.events.pagehide(); }
});

test("invalid ID, insurance, phone and future DOB block payment and point to the field", async () => {
  const f = fixture();
  await import("../static/js/pages/booking_review.js?validation-format"); await loaded(f);
  try {
    for (const [index, value, original] of [[1, "123", "001090123456"], [2, "bad", ""], [3, "abc", "0912345678"], [4, "2999-01-01", "2000-01-01"]]) {
      const field = f.get(`#booking-review-field-${index}`); field.value = value;
      await f.get("#booking-confirm").events.click();
      assert.equal(field.focused, true);
      assert.equal(field["aria-invalid"], "true");
      assert.equal(f.get(`#booking-review-field-${index}-error`).hidden, false);
      field.value = original;
    }
    assert.equal(f.calls.filter(c => ["POST", "PATCH"].includes(c.method)).length, 0);
  } finally { f.events.pagehide(); }
});

test("a delegate can enter every field and save only this encounter's registration", async () => {
  const f = fixture({ encounterId: 3, patientFields: { user_id: 99 } });
  await import("../static/js/pages/booking_review.js?delegate-registration"); await loaded(f);
  try {
    for (let index = 0; index < 8; index++) assert.equal(f.get(`#booking-review-field-${index}`).readOnly, false);
    f.get("#booking-review-field-1").value = "123456789012";
    f.get("#booking-review-field-6").value = "Địa chỉ do người đặt hộ khai";
    const symptoms = f.get("#booking-review-field-7"); symptoms.value = "Triệu chứng mới"; symptoms.events.input();
    assert.equal(f.calls.filter(c => c.method === "PATCH").length, 0);
    await f.get("#booking-confirm").events.click();
    const patch = f.calls.findIndex(c => c.path === "/encounters/3/registration");
    assert.equal(JSON.parse(f.calls[patch].body).registration_details.id_card, "123456789012");
    assert.ok(patch < f.calls.findIndex(c => c.path.endsWith("/payment-intents")));
    assert.equal(f.calls.filter(c => c.path === "/encounters/online").length, 0);
    assert.equal(f.calls.filter(c => c.method === "PATCH" && ["/me", "/patients/2"].includes(c.path)).length, 0);
    assert.equal(f.patient.address, undefined);
    assert.equal(f.get("#booking-payment-modal").open, true);
  } finally { f.events.pagehide(); }
});

test("filled-in registration does not need to match stored patient details", async () => {
  for (const encounterId of [undefined, 3]) {
    const f = fixture({ encounterId });
    await import(`../static/js/pages/booking_review.js?no-comparison-${encounterId}`); await loaded(f);
    try {
      f.get("#booking-review-field-0").value = "Tên nhập trên form";
      f.get("#booking-review-field-1").value = "123456789012";
      f.get("#booking-review-field-3").value = "0987654321";
      await f.get("#booking-confirm").events.click();
      assert.equal(f.get("#booking-payment-modal").open, true);
      assert.equal(f.patient.full_name, "Test patient");
      assert.equal(f.patient.phone, "0912345678");
      assert.equal(f.patient.id_card, "001090123456");
      assert.equal(f.calls.filter(c => c.method === "PATCH" && ["/me", "/patients/2"].includes(c.path)).length, 0);
    } finally { f.events.pagehide(); }
  }
});

test("only entering a phone highlights the other required fields without any server mutation", async () => {
  const f = fixture();
  await import("../static/js/pages/booking_review.js?only-phone"); await loaded(f);
  try {
    for (const index of [0, 1, 7]) f.get(`#booking-review-field-${index}`).value = "";
    await f.get("#booking-confirm").events.click();
    for (const index of [0, 1, 7]) assert.equal(f.get(`#booking-review-field-${index}`)["aria-invalid"], "true");
    assert.equal(f.get("#booking-review-field-0").focused, true);
    assert.equal(f.calls.filter(c => ["POST", "PATCH"].includes(c.method)).length, 0);
    assert.equal(f.get("#booking-patient-form").querySelectorAll("p").some(node => /Nhập thông tin người được khám cho lần đăng ký này/.test(node.textContent)), false);
  } finally { f.events.pagehide(); }
});

test("failed registration save preserves input and blocks payment", async () => {
  const f = fixture({ encounterId: 3, failSave: true });
  await import("../static/js/pages/booking_review.js?registration-failed"); await loaded(f);
  try {
    const field = f.get("#booking-review-field-6"); field.value = "Chưa lưu được";
    await f.get("#booking-confirm").events.click();
    assert.equal(field.value, "Chưa lưu được");
    assert.equal(f.calls.filter(c => c.method === "POST").length, 0);
    assert.notEqual(f.get("#booking-payment-modal").open, true);
  } finally { f.events.pagehide(); }
});

test("leaving during a registration save cannot open payment from a late response", async () => {
  const saving = deferred();
  const f = fixture({ encounterId: 3, beforeSave: () => saving.promise });
  await import("../static/js/pages/booking_review.js?registration-late"); await loaded(f);
  const click = f.get("#booking-confirm").events.click();
  await until(() => f.calls.some(c => c.method === "PATCH"), "Registration save did not start");
  f.events.pagehide(); saving.resolve(); await click;
  assert.equal(f.get("#booking-review-page").hidden, true);
  assert.notEqual(f.get("#booking-payment-modal").open, true);
  assert.equal(f.calls.filter(c => c.method === "POST").length, 0);
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
  const f = fixture({ doctorGate }); await import("../static/js/pages/booking_review.js?late");
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
