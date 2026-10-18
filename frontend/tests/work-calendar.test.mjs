import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setAccessToken } from "../static/js/core/api.js";
import "../static/js/core/staff_workspace.js";

class Element {
  value = ""; textContent = ""; innerHTML = ""; hidden = false; disabled = false; open = false;
  validity = ""; dataset = {}; listeners = {}; attributes = {};
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  emit(type, event = {}) { return Promise.all((this.listeners[type] || []).map(fn => fn({ target: this, preventDefault() {}, ...event }))); }
  dispatchEvent(event) { this.emit(event.type, event); }
  setCustomValidity(message) { this.validity = message; }
  setAttribute(key, value) { this.attributes[key] = value; }
  showModal() { this.open = true; }
  close() { if (this.open) { this.open = false; this.emit("close"); } }
  scrollIntoView() {}
  focus() { this.focused = true; }
  querySelectorAll() { return [...Object.values(this.elements || {}), ...this.buttons || []]; }
  reportValidity() { return Object.values(this.elements).every(el => !el.validity); }
}
let nodes, calls, user, rows, intercept, session, instance = 0;
const addDays = (iso, days) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const tick = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
const get = selector => { if (!nodes.has(selector)) nodes.set(selector, new Element()); return nodes.get(selector); };
const form = () => get("#leave-form");
function monday() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return addDays(today, -((new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7));
}
function calendarFor(call) {
  const start = call.url.searchParams.get("from_date");
  return { user_id: user.user_id, items: Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return { work_date: date, clinical_schedules: i === 0 ? [{ schedule_id: 12, room_id: 9, start_time: "08:00:00", end_time: "11:30:00", schedule_status: "OPEN" }] : [],
      shifts: i > 4 ? [] : ["MORNING", "AFTERNOON"].map(period => {
        const matched = rows.filter(r => r.from_date <= date && r.to_date >= date && (r.period === period || r.period === "FULL_DAY"));
        return { period, start_time: period === "MORNING" ? "08:00:00" : "13:30:00", end_time: period === "MORNING" ? "11:30:00" : "17:00:00",
          status: matched.some(r => r.status === "APPROVED") ? "ON_LEAVE" : "WORKING", pending_leave: matched.some(r => r.status === "PENDING"), leave_request_ids: matched.map(r => r.request_id) };
      }) };
  }) };
}
function route(call) {
  if (call.path === "/staff/work-schedules") return Response.json(calendarFor(call));
  if (call.path === "/staff/leave-requests" && call.method === "GET") {
    const page = Number(call.url.searchParams.get("page")), size = Number(call.url.searchParams.get("page_size"));
    const filtered = rows.filter(r => !call.url.searchParams.get("status") || r.status === call.url.searchParams.get("status"));
    return Response.json({ items: filtered.slice((page - 1) * size, page * size), total: filtered.length, page, page_size: size });
  }
  if (call.path === "/staff/leave-requests" && call.method === "POST") {
    const row = { ...call.data, request_id: 99, user_id: user.user_id, status: "PENDING", created_at: "2026-10-17T00:00:00Z" };
    rows.unshift(row); return Response.json({ leave_request: row }, { status: 201 });
  }
  const match = call.path.match(/^\/staff\/leave-requests\/(\d+)(\/cancel)?$/);
  if (match) {
    const row = rows.find(r => r.request_id === Number(match[1]));
    if (match[2]) row.status = "CANCELLED";
    return Response.json({ leave_request: row, affected_encounters: 2 });
  }
  throw new Error(`Unexpected ${call.method} ${call.path}`);
}
beforeEach(() => {
  nodes = new Map(); calls = []; intercept = null;
  user = { user_id: 3, role_name: "NURSE", full_name: "Điều dưỡng kiểm thử" };
  rows = [{ request_id: 7, user_id: 3, from_date: addDays(monday(), 7), to_date: addDays(monday(), 7), period: "MORNING", status: "PENDING", reason: "Việc gia đình <script>", created_at: "2026-10-17T00:00:00Z" },
    { request_id: 8, user_id: 3, from_date: addDays(monday(), 8), to_date: addDays(monday(), 8), period: "AFTERNOON", status: "APPROVED", reason: "Việc cá nhân", review_note: "Đã bố trí người thay", reviewed_at: "2026-10-17T01:00:00Z" }];
  get("#shift-filter").value = "all";
  form().elements = Object.fromEntries(["start_date", "end_date", "period", "reason", "handover"].map(key => [key, new Element()]));
  form().buttons = [get("#leave-submit"), new Element()];
  globalThis.document = { body: { dataset: { role: "nurse" }, classList: { contains: () => false, add: value => { get("body").hidden = value === "staff-auth-pending"; } } }, querySelector: get };
  globalThis.window = new Element();
  globalThis.matchMedia = () => ({ matches: true });
  session = new Map([["neu-medical.auth", JSON.stringify({ token: "calendar-test", expiresAt: Date.now() + 3600000 })]]);
  globalThis.sessionStorage = { getItem: key => session.get(key) || null, removeItem: key => session.delete(key) };
  setAccessToken("calendar-test");
  globalThis.fetch = async (url, options) => {
    const call = { url: new URL(url), path: new URL(url).pathname, method: options.method, data: options.body ? JSON.parse(options.body) : undefined, options };
    calls.push(call);
    assert.equal(options.headers.get("Authorization"), "Bearer calendar-test");
    return (intercept ? await intercept(call) : undefined) || route(call);
  };
});
async function load() {
  const file = new URL("../static/js/pages/work_calendar.js", import.meta.url);
  const source = (await readFile(file, "utf8"))
    .replace('import { staffReady, sessionError } from "../core/staff_workspace.js";',
      `import { sessionError } from "../core/staff_workspace.js"; const staffReady = Promise.resolve(${JSON.stringify(user)});`)
    .replace(/from "(\.\.[^"]+)"/g, (_, path) => `from ${JSON.stringify(new URL(path, file).href)}`);
  await import(`data:text/javascript;base64,${Buffer.from(source + `\n// instance ${instance++}`).toString("base64")}`);
}
const click = async selector => { await get(selector).emit("click"); await tick(); };
const requestDetail = async (id, action) => { await get("#leave-requests").emit("click", { target: { closest: () => ({ dataset: { request: String(id), action } }) } }); await tick(); };
function fill() {
  form().elements.start_date.value = addDays(monday(), 14); form().elements.end_date.value = addDays(monday(), 14);
  form().elements.period.value = "morning"; form().elements.reason.value = "Việc gia đình"; form().elements.handover.value = "Đã bàn giao ca";
}

for (const role of ["DOCTOR", "NURSE", "RECEPTIONIST"]) test(`${role} loads actual calendar and own requests without a user-id override`, async () => {
  user.role_name = role; await load();
  assert.deepEqual(calls.map(c => c.path), ["/staff/work-schedules", "/staff/leave-requests"]);
  assert.ok(calls.every(c => !c.url.searchParams.has("user_id")));
  assert.match(get("#calendar-announcement").textContent, /10 ca làm việc, 0 ca đã duyệt nghỉ/);
  assert.match(get("#calendar-grid").innerHTML, /08:00 – 11:30/);
  assert.match(get("#calendar-grid").innerHTML, /Phòng PH_009/);
  assert.doesNotMatch(get("#calendar-grid").innerHTML, /Phòng khám 201|07:00|minh họa/);
  assert.match(get("#leave-requests").innerHTML, /&lt;script&gt;/);
  assert.match(get("#leave-requests").innerHTML, role === "NURSE" ? /leave-detail-title">Chi tiết/ : /<th>Thao tác<\/th>/);
  assert.equal(get("#requests-page").textContent, role === "NURSE" ? "Trang 1/1" : "2 đơn · Trang 1/1");
});

test("guest never requests private calendar or leave data", async () => {
  user = null; await load(); assert.equal(calls.length, 0);
});

test("week navigation uses server data; filtering does not fetch; a pending leave still works", async () => {
  await load(); const start = get("#week-picker").value;
  await click("#week-next");
  assert.equal(get("#week-picker").value, addDays(start, 7));
  assert.match(get("#calendar-grid").innerHTML, /Chờ duyệt nghỉ · Vẫn làm việc/);
  assert.match(get("#calendar-grid").innerHTML, /Đã duyệt nghỉ/);
  const count = calls.length;
  get("#shift-filter").value = "afternoon"; await get("#shift-filter").emit("change");
  assert.equal(calls.length, count);
  assert.match(get("#calendar-announcement").textContent, /4 ca làm việc, 1 ca đã duyệt nghỉ/);
  await click("#week-previous"); assert.equal(get("#week-picker").value, start);
});

test("a future shift prefills the leave form and cannot offer a second pending leave", async () => {
  await load(); await click("#week-next");
  const date = get("#week-picker").value;
  await get("#calendar-grid").emit("click", { target: { closest: () => ({ dataset: { shift: `${date}-AFTERNOON` } }) } });
  assert.equal(get("#calendar-dialog").open, true); assert.equal(get("#dialog-use-date").hidden, false);
  await click("#dialog-use-date");
  assert.equal(form().elements.start_date.value, date); assert.equal(form().elements.period.value, "afternoon");
  await get("#calendar-grid").emit("click", { target: { closest: () => ({ dataset: { shift: `${date}-MORNING` } }) } });
  assert.equal(get("#dialog-use-date").hidden, true);
});

for (const role of ["DOCTOR", "NURSE", "RECEPTIONIST"]) test(`${role} only offers leave before the shift starts, including when its dialog stays open`, async () => {
  user.role_name = role; await load(); await click("#week-next");
  const date = get("#week-picker").value;
  const start = Date.parse(`${date}T13:30:00+07:00`), originalNow = Date.now;
  const open = () => get("#calendar-grid").emit("click", { target: { closest: () => ({ dataset: { shift: `${date}-AFTERNOON` } }) } });
  try {
    Date.now = () => start - 1;
    await open(); assert.equal(get("#dialog-use-date").hidden, false);
    const previousDate = form().elements.start_date.value;
    Date.now = () => start;
    await click("#dialog-use-date");
    assert.equal(form().elements.start_date.value, previousDate);
    assert.equal(get("#dialog-use-date").hidden, true);
    await open(); assert.equal(get("#dialog-use-date").hidden, true);
    Date.now = () => start + 4 * 3600000;
    await open(); assert.equal(get("#dialog-use-date").hidden, true);
  } finally { Date.now = originalNow; }
});

test("submission maps payload and handover, locks duplicates, and only reports success from backend", async () => {
  await load(); fill(); let finish;
  intercept = c => c.method === "POST" ? new Promise(resolve => { finish = () => resolve(route(c)); }) : undefined;
  const pending = form().emit("submit"); await tick(); await form().emit("submit");
  assert.equal(calls.filter(c => c.method === "POST").length, 1);
  assert.doesNotMatch(get("#leave-feedback").textContent, /Đã gửi/);
  assert.equal(get("#leave-submit").disabled, true);
  finish(); await pending;
  assert.deepEqual(calls.find(c => c.method === "POST").data, { from_date: addDays(monday(), 14), to_date: addDays(monday(), 14), period: "MORNING", reason: "Việc gia đình\n\nGhi chú bàn giao: Đã bàn giao ca" });
  assert.match(get("#leave-feedback").textContent, /Đã gửi đơn NP_099, đang chờ admin duyệt/);
  assert.equal(get("#leave-submit").disabled, false); assert.equal(form().elements.reason.value, "");
});

for (const role of ["DOCTOR", "NURSE", "RECEPTIONIST"]) test(`${role} reset clears the entire leave draft and validation without a request`, async () => {
  user.role_name = role; await load(); fill();
  await form().elements.start_date.emit("change");
  form().elements.reason.value = "";
  await form().emit("submit");
  assert.ok(form().elements.reason.validity);
  const count = calls.length;
  await form().emit("reset");
  for (const key of ["start_date", "end_date", "reason", "handover"]) {
    assert.equal(form().elements[key].value, "");
    assert.equal(form().elements[key].validity, "");
  }
  assert.equal(form().elements.period.value, "full");
  assert.equal(form().elements.end_date.min, form().elements.start_date.min);
  assert.equal(get("#leave-feedback").textContent, "");
  assert.equal(get("#leave-feedback").dataset.error, "false");
  assert.equal(calls.length, count);
});

test("server conflict preserves draft and reports error without changing calendar", async () => {
  await load(); fill(); const before = get("#calendar-grid").innerHTML;
  intercept = c => c.method === "POST" ? Response.json({ error: { code: "LEAVE_OVERLAP", message: "Đã có đơn nghỉ trùng ca" } }, { status: 409 }) : undefined;
  await form().emit("submit");
  assert.match(get("#leave-feedback").textContent, /Đã có đơn nghỉ trùng ca/);
  assert.equal(form().elements.reason.value, "Việc gia đình"); assert.equal(get("#calendar-grid").innerHTML, before);
  assert.equal(get("#leave-feedback").dataset.error, "true");
});

test("invalid dates, empty reason and combined payload over 1000 characters do not submit", async () => {
  await load(); fill(); form().elements.end_date.value = "2000-01-01";
  await form().emit("submit"); assert.match(form().elements.end_date.validity, /Ngày kết thúc/);
  fill(); form().elements.reason.value = " "; await form().emit("submit");
  assert.match(form().elements.reason.validity, /Vui lòng nhập/);
  fill(); form().elements.handover.value = "x".repeat(1000); await form().emit("submit");
  assert.match(form().elements.handover.validity, /1.000/);
  assert.equal(calls.filter(c => c.method === "POST").length, 0);
});

test("detail displays admin review; approved requests cannot be withdrawn", async () => {
  await load(); await requestDetail(8);
  assert.match(get("#calendar-dialog-body").innerHTML, /Đã bố trí người thay/);
  assert.equal(get("#dialog-cancel-request").hidden, true);
  await click("#dialog-cancel-request"); assert.equal(calls.filter(c => c.method === "POST").length, 0);
});

test("withdrawing requires confirmation and backend success, then refreshes calendar and requests", async () => {
  await load(); await requestDetail(7, "cancel");
  assert.equal(calls.filter(c => c.method === "POST").length, 0);
  assert.equal(get("#calendar-dialog-title").textContent, "Xác nhận rút đơn xin nghỉ");
  await click("#dialog-cancel-request");
  assert.equal(calls.filter(c => c.path === "/staff/leave-requests/7/cancel").length, 1);
  assert.equal(rows[0].status, "CANCELLED");
  assert.match(get("#leave-list-status").textContent, /Đã rút đơn NP_007/);
  assert.equal(get("#calendar-dialog").open, false);
});

test("filter and pagination use server query parameters", async () => {
  rows = Array.from({ length: 23 }, (_, i) => ({ ...rows[0], request_id: i + 1 }));
  await load(); await click("#requests-next");
  assert.equal(calls.at(-1).url.searchParams.get("page"), "2");
  assert.match(get("#requests-page").textContent, /Trang 2\/3/);
  get("#leave-status-filter").value = "APPROVED"; await get("#leave-status-filter").emit("change"); await tick();
  assert.equal(calls.at(-1).url.searchParams.get("page"), "1");
  assert.equal(calls.at(-1).url.searchParams.get("status"), "APPROVED");
  assert.match(get("#leave-requests").innerHTML, /Chưa có đơn/);
});

test("late old week response cannot overwrite a newer selected week", async () => {
  await load(); const start = get("#week-picker").value; let finish;
  intercept = c => c.path === "/staff/work-schedules" && c.url.searchParams.get("from_date") === addDays(start, 7)
    ? new Promise(resolve => { finish = () => resolve(Response.json(calendarFor(c))); }) : undefined;
  await click("#week-next"); await click("#week-next");
  assert.equal(get("#week-picker").value, addDays(start, 14));
  const current = get("#calendar-grid").innerHTML; finish(); await tick();
  assert.equal(get("#calendar-grid").innerHTML, current);
});

test("offline calendar shows the backend error without inventing shifts", async () => {
  intercept = c => { if (c.path === "/staff/work-schedules") throw new Error("offline"); };
  await load(); assert.equal(get("#calendar-grid").innerHTML, "");
  assert.match(get("#calendar-status").textContent, /Không thể kết nối/);
});

test("session expiration clears private data and late responses cannot repopulate it", async () => {
  await load(); fill();
  intercept = c => c.path === "/staff/work-schedules" ? Response.json({ error: { code: "TOKEN_EXPIRED", message: "Phiên hết hạn" } }, { status: 401 }) : undefined;
  await click("#week-next");
  assert.equal(get("#main-content").inert, true); assert.equal(get("#calendar-grid").innerHTML, "");
  assert.equal(get("#leave-requests").innerHTML, ""); assert.equal(form().elements.reason.value, "");
  assert.equal(session.has("neu-medical.auth"), false);
});

test("leaving the page prevents a late successful submit from restoring personal data", async () => {
  await load(); fill(); let finish;
  intercept = c => c.method === "POST" ? new Promise(resolve => { finish = () => resolve(route(c)); }) : undefined;
  const pending = form().emit("submit"); await tick();
  await window.emit("pagehide"); finish(); await pending;
  assert.equal(get("#calendar-grid").innerHTML, ""); assert.equal(get("#leave-requests").innerHTML, "");
  assert.equal(form().elements.reason.value, ""); assert.doesNotMatch(get("#leave-feedback").textContent, /Đã gửi/);
});
