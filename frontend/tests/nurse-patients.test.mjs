import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { initNursePatients } from "../static/js/core/nurse_patients.js";
import { allPages, localPage, attendance, nurseEncounters, normalizeSearch } from "../static/js/core/nurse_encounter_data.js";
import { setAccessToken } from "../static/js/core/api.js";

class Node {
  innerHTML = ""; textContent = ""; hidden = false; dataset = {}; listeners = {}; value = "";
  addEventListener(type, handler) { this.listeners[type] = handler; }
  replaceChildren() { this.innerHTML = ""; }
  querySelectorAll() { return []; }
  close() { this.open = false; }
  showModal() { this.open = true; }
}
let nodes, calls, respond, original, events, rows;
const future = { schedule_id: 1, work_date: "2099-01-01", start_time: "08:00:00", end_time: "11:30:00", room_name: "Phòng A" };
const past = { ...future, schedule_id: 2, work_date: "2000-01-01" };
const visit = (id, status, shift = future) => ({ ...shift, encounter_id: id, patient_id: id, patient_name: `Người bệnh ${id}`, encounter_status: status, doctor_name: "Bác sĩ A", ticket_code: `NEU-${id}`, estimated_exam_at: `${shift.work_date}T08:00:00+07:00`, appointment_end_at: `${shift.work_date}T08:30:00+07:00` });
const tick = async () => { for (let n = 0; n < 12; n++) await new Promise(resolve => setImmediate(resolve)); };
const click = id => nodes.get("#nurse-visit-list").listeners.click({ target: { closest: selector => selector === "[data-visit]" ? { dataset: { visit: String(id) } } : null } });
beforeEach(() => {
  original = ["document", "window", "location", "fetch"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  nodes = new Map(["page-body", "nurse-visit-filters", "nurse-visit-search", "nurse-visit-list", "nurse-visit-status", "nurse-visit-pages", "staff-dialog", "staff-dialog-title", "staff-dialog-content"].map(id => [`#${id}`, new Node()]));
  const fields = Object.fromEntries(["period", "work_date", "schedule_id", "encounter_status"].map(key => [key, new Node()]));
  fields.period.value = "upcoming"; nodes.get("#nurse-visit-filters").elements = fields;
  calls = []; events = {};
  rows = [visit(1, "CONFIRMED"), visit(2, "CHECKED_IN"), visit(3, "IN_PROGRESS"), visit(4, "COMPLETED"), visit(5, "NO_SHOW"), visit(6, "CONFIRMED", past), visit(7, "CONFIRMED", { ...future, schedule_id: 99 })];
  respond = (url) => {
    if (url.pathname === "/encounters") {
      const items = rows.filter(r => r.encounter_status === url.searchParams.get("encounter_status"));
      return { items, total: items.length, page: 1, page_size: 100 };
    }
    const id = Number(url.pathname.split("/").at(-1));
    if (url.pathname.startsWith("/encounters/")) return { encounter: rows.find(r => r.encounter_id === id) };
    if (url.pathname.startsWith("/patients/")) return { patient: { patient_id: id, full_name: `Người bệnh ${id}` } };
    throw new Error(`Unexpected request ${url.pathname}`);
  };
  Object.assign(globalThis, {
    document: { querySelector: selector => nodes.get(selector) || null },
    location: new URL("http://localhost/frontend/templates/(nurse)/patients.html"),
    window: { addEventListener: (type, callback) => { events[type] = callback; } },
    fetch: async (input, options) => {
      const url = new URL(input); calls.push({ path: url.pathname, params: Object.fromEntries(url.searchParams), method: options.method });
      const result = await respond(url); return result instanceof Response ? result : Response.json(result);
    },
  });
  setAccessToken("test-only");
});
afterEach(() => {
  setAccessToken(null);
  for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
});

test("active list includes only current/upcoming assigned active visits and attendance; no write actions", async () => {
  await initNursePatients({ assignments: [future, past] });
  const html = nodes.get("#nurse-visit-list").innerHTML;
  for (const id of [1, 2, 3]) assert.ok(html.includes(`data-visit="${id}"`));
  for (const id of [4, 5, 6, 7]) assert.ok(!html.includes(`data-visit="${id}"`));
  assert.match(html, /Chưa đến/); assert.match(html, /Đã đến/);
  assert.match(html, /<th scope="col">Hoạt động<\/th><th scope="col">Chi tiết<\/th>/);
  const formHtml = nodes.get("#page-body").innerHTML.split('</form>')[0];
  assert.equal((formHtml.match(/<label>/g) || []).length, 4);
  assert.doesNotMatch(formHtml, /Làm mới|Bỏ bộ lọc|<button/);
  assert.doesNotMatch(html, /data-absent|data-checkin|Đánh dấu/);
  assert.deepEqual(calls.map(c => c.params.encounter_status).sort(), ["CHECKED_IN", "CONFIRMED", "IN_PROGRESS"]);
  assert.ok(calls.every(c => c.method === "GET"));
});

test("past-shift filter retains unresolved visits and searches the entire merged dataset", async () => {
  await initNursePatients({ assignments: [future, past] });
  const form = nodes.get("#nurse-visit-filters"); form.elements.period.value = "past";
  await form.listeners.change(); await tick();
  assert.match(nodes.get("#nurse-visit-list").innerHTML, /data-visit="6"/);
  assert.doesNotMatch(nodes.get("#nurse-visit-list").innerHTML, /data-visit="1"/);
  nodes.get("#nurse-visit-search").value = "NEU-6";
  nodes.get("#nurse-visit-search").listeners.input();
  assert.match(nodes.get("#nurse-visit-list").innerHTML, /data-visit="6"/);
});

test("details use authorized reads, escape patient names and do not request a medical record before examination", async () => {
  rows[0].patient_name = '<script>alert("test")</script>';
  await initNursePatients({ assignments: [future] });
  assert.doesNotMatch(nodes.get("#nurse-visit-list").innerHTML, /<script>/);
  click(1); await tick();
  assert.equal(nodes.get("#staff-dialog").open, true);
  assert.ok(calls.some(c => c.path === "/encounters/1"));
  assert.ok(calls.some(c => c.path === "/patients/1"));
  assert.ok(!calls.some(c => c.path.endsWith("medical-record")));
  assert.ok(calls.every(c => c.method === "GET"));
});

test("revoked assignment errors clear the old list; late responses cannot restore a departed page", async () => {
  await initNursePatients({ assignments: [future] });
  respond = () => Response.json({ error: { message: "Phân công đã bị thu hồi" } }, { status: 403 });
  nodes.get("#nurse-visit-filters").listeners.submit({ preventDefault() {} }); await tick();
  assert.equal(nodes.get("#nurse-visit-list").innerHTML, "");
  assert.match(nodes.get("#nurse-visit-status").textContent, /Phân công/);
  let finish;
  respond = () => new Promise(resolve => { finish = resolve; });
  nodes.get("#nurse-visit-filters").elements.encounter_status.value = "CONFIRMED";
  nodes.get("#nurse-visit-filters").listeners.submit({ preventDefault() {} }); await tick();
  events.pagehide(); finish({ items: [rows[0]], page: 1, page_size: 100, total: 1 }); await tick();
  assert.equal(nodes.get("#page-body").innerHTML, "");
  assert.equal(nodes.get("#nurse-visit-list").innerHTML, "");
});

test("all status pages are merged before local pagination and filtering", async () => {
  const requests = [];
  const result = await allPages(async query => {
    requests.push(query.page);
    return { page: query.page, page_size: 2, total: 5, items: query.page === 1 ? [1, 2] : query.page === 2 ? [3, 4] : [5] };
  });
  assert.deepEqual(result, [1, 2, 3, 4, 5]); assert.deepEqual(requests, [1, 2, 3]);
  assert.deepEqual(localPage(result, 2, 3).items, [4, 5]);
  assert.equal(localPage([], 9).page, 1);
  const archive = await nurseEncounters(["COMPLETED", "NO_SHOW"]);
  assert.deepEqual(archive.map(e => e.encounter_status).sort(), ["COMPLETED", "NO_SHOW"]);
  assert.match(attendance({ encounter_status: "CONFIRMED" }), /Chưa đến/);
  for (const state of ["CHECKED_IN", "IN_PROGRESS", "COMPLETED"]) assert.match(attendance({ encounter_status: state }), /Đã đến/);
  assert.match(attendance({ encounter_status: "NO_SHOW" }), /Không đến/);
  assert.equal(normalizeSearch("ĐẶNG"), "dang");
});

test("overview date links include past assigned visits, preserve all columns and open the selected visit", async () => {
  location.search = "?from_date=2000-01-01&to_date=2000-01-01&encounter_id=6";
  await initNursePatients({ assignments: [future, past] });
  const html = nodes.get("#nurse-visit-list").innerHTML;
  assert.match(html, /data-visit="6"/);
  assert.doesNotMatch(html, /data-visit="1"/);
  assert.equal((html.match(/<th scope=/g) || []).length, 6);
  assert.equal(nodes.get("#nurse-visit-filters").elements.period.value, "all");
  assert.equal(nodes.get("#staff-dialog").open, true);
  assert.ok(calls.some(c => c.path === "/encounters/6"));
});

test("changing the day overrides an inherited range and changing any filter refreshes without a button", async () => {
  location.search = "?from_date=2000-01-01&to_date=2000-01-02";
  await initNursePatients({ assignments: [future, past] });
  assert.match(nodes.get("#nurse-visit-list").innerHTML, /data-visit="6"/);
  const form = nodes.get("#nurse-visit-filters");
  form.elements.work_date.value = future.work_date;
  await form.listeners.change({ target: { name: "work_date" } });
  assert.doesNotMatch(nodes.get("#nurse-visit-list").innerHTML, /data-visit="6"/);
  assert.match(nodes.get("#nurse-visit-list").innerHTML, /data-visit="1"/);
  for (const key of ["period", "schedule_id", "encounter_status"]) {
    const previous = calls.length;
    await form.listeners.change({ target: { name: key } });
    assert.ok(calls.length > previous);
  }
  assert.equal(calls.findLast(c => c.path === "/encounters").params.work_date, future.work_date);
});

test("opening an assigned room with no registrations shows an empty list instead of another room's visits", async () => {
  location.search = "?schedule_id=3";
  await initNursePatients({ assignments: [future, past, { ...future, schedule_id: 3 }] });
  assert.equal(nodes.get("#nurse-visit-filters").elements.schedule_id.value, "3");
  assert.match(nodes.get("#nurse-visit-list").innerHTML, /Không có người bệnh phù hợp/);
  assert.doesNotMatch(nodes.get("#nurse-visit-list").innerHTML, /data-visit=/);
  assert.ok(calls.every(c => c.params.schedule_id === "3"));
});
