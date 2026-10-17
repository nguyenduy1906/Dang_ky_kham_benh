import assert from "node:assert/strict";
import { readDraft, saveDraft } from "../../static/js/core/booking_draft.js";
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
function fixture({ uncertain = false, encounterId, failCreate = false, failSave = false, doctorGate, encounterGate, failIntent = false, failPatient = false, patientGate, failResult = false, unconfirmedPayment = false, beforeSave, normalizePatient, patientFields = {}, symptoms = "Test only", selfDraft = false, page = "review" } = {}) {
  const nodes = new Map();
  const get = selector => {
    const find = node => node.id === selector.slice(1) ? node : node.children.map(find).find(Boolean);
    for (const node of nodes.values()) { const match = find(node); if (match) return match; }
    if (!nodes.has(selector)) nodes.set(selector, new Node());
    return nodes.get(selector);
  };
  const auth = get(page === "payment" ? "#payment-auth-status" : "#booking-auth-status"); auth.append(new Node("p"), new Node("button"));
  get("#booking-payment").hidden = true; get("#booking-qr").hidden = true;
  get("#booking-payment-method").value = "BANK";
  const store = new Map();
  globalThis.sessionStorage = { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };
  sessionStorage.setItem("neu-medical.auth", JSON.stringify({ token: "test", expiresAt: Date.now() + 60000 }));
  globalThis.document = { querySelector: get, createElement: tag => new Node(tag), createElementNS: (_, tag) => new Node(tag), body: { classList: { remove() {} } } };
  const events = {};
  globalThis.window = { addEventListener: (name, handler) => { events[name] = handler; }, dispatchEvent() {} };
  const navigation = [];
  globalThis.location = { href: `http://localhost:3000/frontend/templates/(patient)/${page === "payment" ? "payment" : "booking_review"}.html?draft=${id}`, search: `?draft=${id}`, assign(url) { navigation.push(url); }, replace(url) { navigation.push(url); } };
  globalThis.history = { replaceState() {} };
  const draft = { user_id: 1, patient_id: 2, doctor_profile_id: 7, schedule_id: 9, work_date: "2030-01-15", appointment_time: "08:00", symptoms, uncertain, encounter_id: encounterId };
  if (selfDraft) Object.assign(draft, { patient_id: null, patient_type: "SELF", payment_summary: {
    doctor_name: "Test doctor", department_name: "Mắt", work_date: "2030-01-15", room_name: "204",
    estimated_exam_at: "2030-01-15T08:00:00+07:00", appointment_end_at: "2030-01-15T08:15:00+07:00", consultation_fee_snapshot: 260000,
  } });
  saveDraft(draft, id);
  const row = { encounter_id: 3, patient_id: 2, doctor_profile_id: 7, schedule_id: 9, patient_name: "Test patient", doctor_name: "Test doctor", department_name: "Mắt", room_name: "204", work_date: "2030-01-15", estimated_exam_at: "2030-01-15T08:00:00+07:00", appointment_end_at: "2030-01-15T08:15:00+07:00", consultation_fee_snapshot: "260000", deposit_amount_snapshot: "260000", symptoms: "Test only", encounter_status: "HOLDING", hold_expires_at: new Date(Date.now() + 600000).toISOString() };
  const patient = { patient_id: 2, user_id: 1, full_name: "Test patient", phone: "0912345678", id_card: "001090123456", dob: "2000-01-01", ...patientFields };
  const calls = []; let payment, saveCount = 0, patientSaved = !selfDraft;
  globalThis.fetch = async (url, options) => {
    const path = new URL(url).pathname; calls.push({ path, method: options.method, body: options.body });
    let data;
    if (path === "/me") data = { user: { user_id: 1, role_name: "USER", full_name: "Account user", phone: "0912345678" } };
    else if (path === "/doctors") { if (doctorGate) await doctorGate; data = { items: [{ doctor_profile_id: 7, full_name: "Test doctor", department_name: "Mắt", consultation_fee: 260000 }], total: 1 }; }
    else if (path === "/patients" && options.method === "POST") {
      if (patientGate) await patientGate;
      if (failPatient) return Response.json({ error: { message: "Không lưu được hồ sơ", code: "PATIENT_IDENTITY_CONFLICT" } }, { status: 409 });
      const { confirm_shared_phone, ...fields } = JSON.parse(options.body);
      Object.assign(patient, fields); patientSaved = true;
      data = { patient };
    }
    else if (path === "/patients") data = { items: patientSaved ? [patient] : [], total: patientSaved ? 1 : 0 };
    else if (path === "/patients/2") throw new Error("Booking must never update the original patient");
    else if (path.endsWith("/schedules")) data = { items: [{ schedule_id: 9, work_date: "2030-01-15", start_time: "08:00", room_name: "204", schedule_status: "OPEN", slots: [{ appointment_time: "08:00", starts_at: row.estimated_exam_at, ends_at: row.appointment_end_at }] }], total: 1 };
    else if (path === "/encounters/online") {
      if (failCreate) return Response.json({ error: { message: "Server error" } }, { status: 500 });
      const body = JSON.parse(options.body); row.registration_details = body.registration_details; row.symptoms = body.symptoms;
      row.patient_id = body.patient_id; row.patient_name = patient.full_name;
      data = { encounter: row };
    }
    else if (path === "/encounters") data = { items: [row], total: 1 };
    else if (path.endsWith("/payment-intents")) {
      if (failIntent) return Response.json({ error: { message: "Chưa tạo được phiên thanh toán" } }, { status: 500 });
      payment = { payment_id: 4, payment_type: "DEPOSIT", transaction_status: "PENDING", transaction_code: "DEMO-" + "a".repeat(32), amount: "260000", payment_method: "BANK" };
      data = { payment };
    }
    else if (path.endsWith("/payments")) data = { items: payment ? [payment] : [], total: payment ? 1 : 0 };
    else if (path === "/demo/payments/4/result") {
      if (failResult) return Response.json({ error: { message: "Chưa xác nhận được thanh toán" } }, { status: 500 });
      payment.transaction_status = JSON.parse(options.body).result;
      if (payment.transaction_status === "SUCCESS" && !unconfirmedPayment) { row.encounter_status = "CONFIRMED"; row.ticket_code = "TEST-ONLY"; }
      data = { payment };
    }
    else if (path === "/encounters/3/ticket") data = { ticket: { ticket_code: "TEST-ONLY" } };
    else if (path === "/encounters/3/registration") {
      const body = JSON.parse(options.body), count = ++saveCount;
      if (beforeSave) await beforeSave(body, count);
      if (failSave) return Response.json({ error: { message: "Không lưu được đăng ký", code: "REGISTRATION_FAILED" } }, { status: 500 });
      row.registration_details = body.registration_details; row.symptoms = body.symptoms;
      if (normalizePatient) Object.assign(row.registration_details, normalizePatient(row.registration_details));
      data = { encounter: row };
    }
    else if (path === "/encounters/3") { if (encounterGate) await encounterGate; data = { encounter: row }; }
    else throw new Error(`Unexpected API ${path}`);
    return Response.json(data);
  };
  return { get, calls, events, store, navigation, patient, page };
}
async function loaded(f) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (f.get(f.page === "payment" ? "#payment-auth-status" : "#booking-auth-status").hidden) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.fail(f.get(f.page === "payment" ? "#payment-auth-status" : "#booking-auth-status").children[0].textContent);
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

export { fixture, loaded, deferred, until, id, Node };
