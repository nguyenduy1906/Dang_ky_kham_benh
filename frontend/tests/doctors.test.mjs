// Fetch fixtures exist only in tests. Public pages call the real backend.
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { doctorCard, portrait, currentWeek, profileSections } from "../static/js/core/doctors.js";
import { setAccessToken } from "../static/js/core/api.js";

class Element {
  constructor(tag = "div") { this.tagName = tag.toUpperCase(); }
  children = []; dataset = {}; attributes = {}; listeners = {}; value = ""; hidden = false; disabled = false;
  classes = new Set(); ownText = "";
  classList = { toggle: (key, value) => value ? this.classes.add(key) : this.classes.delete(key) };
  get textContent() { return this.ownText + this.children.map(node => node.textContent).join(""); }
  set textContent(value) { this.ownText = String(value); this.children = []; }
  append(...nodes) { nodes.forEach(node => { node.parent = this; this.children.push(node); }); }
  replaceChildren(...nodes) { this.children = []; this.ownText = ""; this.append(...nodes); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(key, fn) { (this.listeners[key] ||= []).push(fn); }
  querySelectorAll() { return this.children.filter(node => node.dataset.doctorChip !== undefined); }
}
const NativeFormData = globalThis.FormData;
let nodes, calls, respond, instance = 0;
const fixture = id => ({ doctor_profile_id: id, full_name: `Bác sĩ API ${id}`, department_id: 42,
  department_name: "Tim mạch", academic_degree: "Thạc sĩ", experience_years: 0,
  specialization: "Chuyên môn API", introduction: "Giới thiệu API", consultation_fee: 0, avatar_url: null });
const fixtures = Array.from({ length: 10 }, (_, i) => fixture(101 + i));
const pageResponse = (url, items = fixtures) => {
  const page = Number(url.searchParams.get("page") || 1), size = Number(url.searchParams.get("page_size") || 8);
  const q = url.searchParams.get("q"), department = url.searchParams.get("department_id");
  const filtered = items.filter(item => (!q || item.full_name.includes(q)) && (!department || String(item.department_id) === department));
  return Response.json({ items: filtered.slice((page - 1) * size, page * size), total: filtered.length, page, page_size: size });
};
const tick = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
beforeEach(() => {
  globalThis.FormData = NativeFormData;
  nodes = new Map(); calls = []; setAccessToken("admin-token-must-not-be-sent");
  for (const selector of ["#directory-search", "#directory-department", ".directory-grid", "#directory-result", "#directory-empty",
    "#directory-retry", ".directory-pagination", "#directory-prev", "#directory-next", "#directory-pages", ".directory-chips",
    "#directory-department-status", "#directory-department-retry", "#directory-filter", "#detail-status", "#detail-retry",
    ".doctor-detail-layout", "#detail-feedback", "#schedule-status", "#detail-schedules", "#schedule-pagination", "#schedule-retry", "#schedule-page",
    "#schedule-prev", "#schedule-next", "#detail-name", "#detail-photo", "#detail-specialty", "#schedule-specialty", "#detail-degree",
    "#detail-experience", "#detail-specialization", "#detail-introduction", "#detail-fee", "#detail-booking", "#schedule-booking", "#schedule-week", "#doctor-review-form", "#doctor-reviews", "#detail-rating", "#review-rating", "#review-status", "#review-more", "#review-retry", "#doctor-reviews-scroll", "#review-fields", "#review-encounter", "#review-eligibility", "#review-access-retry", "#review-submit-status", "#review-comment", "#detail-education", "#detail-work", "#detail-sample-note"]) nodes.set(selector, new Element());
  globalThis.document = { querySelector: selector => nodes.get(selector) || null, createElement: tag => new Element(tag) };
  globalThis.location = new URL("http://localhost:3000/frontend/templates/public/doctors.html");
  globalThis.history = { replaceState(state, title, url) { location.href = url.href; } };
  globalThis.window = new EventTarget();
  const saved = new Map(); globalThis.sessionStorage = { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
  respond = url => url.pathname === "/departments" ? Response.json({ items: [{ department_id: 42, name: "Tim mạch" }] })
    : url.pathname.endsWith("/reviews") ? Response.json({ items: [], total: 0, page: 1, page_size: 4, average_rating: null })
    : url.pathname.endsWith("/schedules") ? pageResponse(url, [])
    : /^\/doctors\/\d+$/.test(url.pathname) ? Response.json({ doctor: fixture(Number(url.pathname.split("/").pop())) }) : pageResponse(url);
  globalThis.fetch = async (url, options) => { calls.push({ url: new URL(url), options }); return respond(new URL(url), options); };
});
async function controller(name) {
  const file = new URL(`../static/js/pages/${name}.js`, import.meta.url);
  const source = (await readFile(file, "utf8")).replace(/from "(\.\.[^"]+)"/g, (_, path) => `from ${JSON.stringify(new URL(path, file).href)}`);
  await import(`data:text/javascript;base64,${Buffer.from(source + `\n// instance ${instance++}`).toString("base64")}`);
  await tick();
}
const click = selector => nodes.get(selector).listeners.click[0]({ preventDefault() {} });
const submit = () => nodes.get("#directory-filter").listeners.submit[0]({ preventDefault() {} });

test("directory uses backend pagination and real profile IDs without sending the session token", async () => {
  await controller("doctors");
  assert.equal(nodes.get(".directory-grid").children.length, 8);
  assert.match(nodes.get(".directory-grid").textContent, /Bác sĩ API 101/);
  assert.equal(nodes.get(".directory-grid").children[0].children[0].href, "doctor_detail.html?id=101");
  assert.equal(nodes.get("#directory-result").textContent, "");
  assert.equal(nodes.get("#directory-department").children[1].value, "42");
  click("#directory-next"); await tick();
  assert.equal(nodes.get(".directory-grid").children.length, 2);
  assert.equal(nodes.get("#directory-next").disabled, true);
  assert.equal(calls.at(-1).url.searchParams.get("page"), "2");
  assert.ok(calls.every(call => !call.options.headers.has("Authorization")));
});
test("department name links resolve against API IDs and search resets pagination", async () => {
  location.search = "?department_name=Tim%20m%E1%BA%A1ch&page=2";
  await controller("doctors");
  assert.equal(calls.at(-1).url.searchParams.get("department_id"), "42");
  nodes.get("#directory-search").value = "API 103"; submit(); await tick();
  assert.equal(calls.at(-1).url.searchParams.get("q"), "API 103");
  assert.equal(calls.at(-1).url.searchParams.get("page"), "1");
  assert.equal(nodes.get(".directory-grid").children.length, 1);
  assert.equal(location.searchParams.get("q"), "API 103");
  assert.equal(location.searchParams.get("department_id"), "42");
  assert.equal(location.searchParams.has("page"), false);
});
test("empty results and API failures do not retain sample profiles; retry restores results", async () => {
  await controller("doctors");
  nodes.get("#directory-search").value = "no match"; submit(); await tick();
  assert.equal(nodes.get("#directory-empty").hidden, false);
  assert.equal(nodes.get(".directory-grid").children.length, 0);
  nodes.get("#directory-search").value = "";
  const healthy = respond; respond = () => Response.json({ error: { message: "Backend lỗi" } }, { status: 500 });
  submit(); await tick();
  assert.equal(nodes.get("#directory-result").textContent, "Backend lỗi");
  assert.equal(nodes.get("#directory-retry").hidden, false);
  assert.equal(nodes.get("#directory-empty").hidden, true);
  respond = healthy; click("#directory-retry"); await tick();
  assert.equal(nodes.get(".directory-grid").children.length, 8);
});
test("late search responses cannot overwrite newer results, and stale bookmarks recover", async () => {
  location.search = "?page=999"; await controller("doctors");
  assert.equal(calls.at(-1).url.searchParams.get("page"), "2");
  let release; const healthy = respond;
  respond = url => url.searchParams.get("q") === "old" ? new Promise(resolve => { release = resolve; }) : healthy(url);
  nodes.get("#directory-search").value = "old"; submit(); await tick();
  nodes.get("#directory-search").value = "API 105"; submit(); await tick();
  release(Response.json({ items: [fixture(999)], total: 1, page: 1, page_size: 8 })); await tick();
  assert.match(nodes.get(".directory-grid").textContent, /Bác sĩ API 105/);
  assert.doesNotMatch(nodes.get(".directory-grid").textContent, /999/);
});
test("failed departments can be retried while the doctor list remains usable", async () => {
  const healthy = respond;
  respond = url => url.pathname === "/departments" ? Response.json({}, { status: 500 }) : healthy(url);
  await controller("doctors");
  assert.equal(nodes.get(".directory-grid").children.length, 8);
  assert.equal(nodes.get("#directory-department-retry").hidden, false);
  respond = healthy; click("#directory-department-retry"); await tick();
  assert.equal(nodes.get("#directory-department").disabled, false);
  assert.equal(nodes.get("#directory-department-retry").hidden, true);
});
test("portraits use uploaded images or neutral placeholders and text cannot inject markup", () => {
  const card = doctorCard({ ...fixture(101), full_name: '<script>alert("x")</script>' }, { showFee: true });
  assert.match(card.textContent, /<script>/);
  assert.match(card.textContent, /0 năm kinh nghiệm/);
  assert.match(card.textContent, /Phí khám: 0/);
  const empty = portrait(fixture(101)); assert.equal(empty.children.length, 1);
  const photo = portrait({ ...fixture(101), avatar_url: "/uploads/avatars/a.jpg" });
  assert.equal(photo.children[1].src, "http://127.0.0.1:5000/uploads/avatars/a.jpg");
  photo.children[1].listeners.error[0](); assert.equal(photo.children.length, 1);
});
test("detail supports IDs beyond demo range and shows backend profile and empty schedules", async () => {
  location.search = "?id=101"; await controller("doctor_detail");
  assert.equal(nodes.get("#detail-name").textContent, "Bác sĩ API 101");
  assert.equal(nodes.get("#detail-introduction").textContent, "Giới thiệu API");
  assert.equal(nodes.get("#detail-booking").href, "../(patient)/booking.html?doctor=101");
  assert.equal(nodes.get(".doctor-detail-layout").hidden, false);
  assert.equal(nodes.get("#schedule-status").textContent, "Bác sĩ chưa có lịch khám trong tuần này.");
  assert.ok(calls.every(call => !call.options.headers.has("Authorization")));
});
test("invalid and unavailable doctor links do not substitute another doctor", async () => {
  location.search = "?id=invalid"; await controller("doctor_detail");
  assert.equal(calls.length, 0); assert.equal(nodes.get(".doctor-detail-layout").hidden, true);
  location.search = "?id=999"; respond = () => Response.json({}, { status: 404 });
  await controller("doctor_detail");
  assert.match(nodes.get("#detail-status").textContent, /Không tìm thấy/);
  assert.equal(nodes.get(".doctor-detail-layout").hidden, true);
});
test("weekly schedule uses week filters, summarizes shifts and omits slot details", async () => {
  const week = currentWeek();
  const shift = { schedule_id: 1, work_date: week.from_date, start_time: "08:00:00", end_time: "11:30:00", room_name: "P101", schedule_status: "OPEN",
    slots: [{ starts_at: "2026-10-20T01:00:00Z", ends_at: "2026-10-20T01:30:00Z" }] };
  const healthy = respond;
  respond = url => url.pathname.endsWith("/schedules") ? Response.json({ items: [shift, { ...shift, start_time: "13:30:00" }], total: 2, page: 1, page_size: 100 }) : healthy(url);
  location.search = "?id=101"; await controller("doctor_detail");
  const call = calls.find(call => call.url.pathname.endsWith("/schedules"));
  assert.equal(call.url.searchParams.get("current_week"), "true");
  assert.equal(call.url.searchParams.get("to_date"), week.to_date);
  const text = nodes.get("#detail-schedules").textContent;
  assert.match(text, /Sáng · Chiều/); assert.doesNotMatch(text, /08:00|P101|Khung giờ/);
  assert.equal(nodes.get("#detail-schedules").children.length, 1);
});
test("week boundaries use Vietnam time, and profile histories remain backend text", () => {
  assert.deepEqual(currentWeek(new Date("2027-01-03T17:30:00Z")), { from_date: "2027-01-04", to_date: "2027-01-10" });
  assert.deepEqual(currentWeek(new Date("2027-01-03T03:00:00Z")), { from_date: "2026-12-28", to_date: "2027-01-03" });
  const sections = profileSections("Giới thiệu\n\nQuá trình đào tạo:\n- 2015: Thạc sĩ, Đại học Y Hà Nội.\n\nQuá trình công tác:\n- 2020–nay: NEU Medical.\n\nHồ sơ đào tạo và công tác mẫu phục vụ đồ án.");
  assert.deepEqual(sections.education, ["2015: Thạc sĩ, Đại học Y Hà Nội."]);
  assert.deepEqual(sections.work, ["2020–nay: NEU Medical."]);
  assert.equal(sections.sample, true);
  assert.deepEqual(profileSections("Thông tin bác sĩ").education, []);
});
test("anonymous visitors only read public reviews, loaded in small pages without exposing patient data", async () => {
  const healthy = respond;
  respond = url => url.pathname.endsWith("/reviews") ? Response.json({ items: Array.from({ length: 4 }, (_, i) => ({ review_id: i, rating: 5, comment: "Đánh giá API", created_at: "2026-10-12T01:00:00Z" })), total: 8, average_rating: 5, page: Number(url.searchParams.get("page")), page_size: 4 }) : healthy(url);
  location.search = "?id=101"; await controller("doctor_detail");
  assert.equal(nodes.get("#doctor-review-form").hidden, true);
  assert.equal(nodes.get("#doctor-reviews").children.length, 4);
  assert.equal(nodes.get("#review-more").hidden, false);
  assert.equal(calls.some(call => call.url.pathname === "/encounters"), false);
  click("#review-more"); await tick();
  assert.equal(nodes.get("#doctor-reviews").children.length, 8);
  assert.equal(nodes.get("#review-more").hidden, true);
  assert.match(nodes.get("#detail-rating").textContent, /5\/5/);
});
test("review and weekly schedule errors can retry while the profile remains visible", async () => {
  const healthy = respond;
  respond = url => /\/(schedules|reviews)$/.test(url.pathname) ? Response.json({}, { status: 500 }) : healthy(url);
  location.search = "?id=101"; await controller("doctor_detail");
  assert.equal(nodes.get("#review-retry").hidden, false);
  assert.equal(nodes.get("#schedule-retry").hidden, false);
  assert.equal(nodes.get(".doctor-detail-layout").hidden, false);
  respond = healthy; click("#review-retry"); click("#schedule-retry"); await tick();
  assert.equal(nodes.get("#review-retry").hidden, true);
  assert.equal(nodes.get("#schedule-retry").hidden, true);
});
test("signed-in patients can rate directly without choosing a patient or encounter", async () => {
  const healthy = respond;
  sessionStorage.setItem("neu-medical.auth", JSON.stringify({ token: "patient-review-test", expiresAt: Date.now() + 60000 }));
  respond = url => url.pathname === "/me" ? Response.json({ user: { user_id: 4, role_name: "USER" } })
    : url.pathname === "/encounters" ? Response.json({ items: [{ encounter_id: 23, work_date: "2026-09-10", patient_name: "Bệnh nhân mẫu", encounter_status: "COMPLETED" }], total: 1, page: 1, page_size: 100 }) : healthy(url);
  location.search = "?id=101"; await controller("doctor_detail");
  assert.equal(nodes.get("#doctor-review-form").hidden, false);
  assert.equal(nodes.get("#review-fields").disabled, false);
  assert.equal(nodes.get("#review-fields").hidden, false);
  assert.equal(nodes.get("#review-eligibility").textContent, "");
  const call = calls.find(call => call.url.pathname === "/encounters");
  assert.equal(call.url.searchParams.get("encounter_status"), "COMPLETED");
  assert.equal(call.url.searchParams.get("doctor_profile_id"), "101");
  sessionStorage.removeItem("neu-medical.auth"); window.dispatchEvent(new Event("neu:auth-change"));
  assert.equal(nodes.get("#doctor-review-form").hidden, true);
});

test("direct rating allows repeated submissions for the latest completed encounter but blocks concurrent clicks", async () => {
  const healthy = respond;
  sessionStorage.setItem("neu-medical.auth", JSON.stringify({ token: "direct-rating-test", expiresAt: Date.now() + 60000 }));
  let release;
  respond = url => url.pathname === "/me" ? Response.json({ user: { user_id: 4, role_name: "USER" } })
    : url.pathname === "/encounters" ? Response.json({ items: [
      { encounter_id: 23, work_date: "2026-09-10", has_review: false },
      { encounter_id: 24, work_date: "2026-09-30", has_review: true },
      { encounter_id: 25, work_date: "2026-09-20", has_review: false },
    ], total: 3, page: 1, page_size: 100 })
    : url.pathname === "/encounters/24/review" ? new Promise(resolve => { release = resolve; }) : healthy(url);
  location.search = "?id=101"; await controller("doctor_detail");
  const form = nodes.get("#doctor-review-form"); form.reportValidity = () => true; form.reset = () => {};
  nodes.get("#review-comment").value = "Bác sĩ tư vấn rõ ràng.";
  globalThis.FormData = class extends NativeFormData { constructor() { super(); this.set("rating", "5"); } };
  const send = form.listeners.submit[0]({ preventDefault() {} });
  await form.listeners.submit[0]({ preventDefault() {} }); await tick();
  const posts = calls.filter(call => call.options.method === "POST");
  assert.equal(posts.length, 1); assert.equal(posts[0].url.pathname, "/encounters/24/review");
  assert.deepEqual(JSON.parse(posts[0].options.body), { rating: 5, comment: "Bác sĩ tư vấn rõ ràng." });
  release(Response.json({ review: { review_id: 1 } })); await send; await tick();
  assert.match(nodes.get("#review-submit-status").textContent, /Đã gửi đánh giá/);
  assert.equal(nodes.get("#review-fields").disabled, false);
  const second = form.listeners.submit[0]({ preventDefault() {} }); await tick();
  assert.equal(calls.filter(call => call.options.method === "POST").length, 2);
  release(Response.json({ review: { review_id: 2 } })); await second; await tick();
  assert.equal(nodes.get("#review-fields").disabled, false);
  const html = await readFile(new URL("../templates/public/doctor_detail.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /review-encounter|Lượt khám đã hoàn tất<\/label>/);
});

test("directory omits fees for guests and booking links directly preserve the selected doctor", async () => {
  const guest = doctorCard(fixture(101));
  assert.doesNotMatch(guest.textContent, /Phí khám/);
  const schedule = guest.children[1].children.find(node => node.className === "directory-schedule");
  assert.equal(schedule.textContent, "▦ Đặt lịch khám");
  assert.equal(schedule.href, "../(patient)/booking.html?doctor=101");
  await controller("doctors");
  assert.doesNotMatch(nodes.get(".directory-grid").textContent, /Phí khám/);
});
test("directory shows fees after session verification and removes them on logout", async () => {
  sessionStorage.setItem("neu-medical.auth", JSON.stringify({ token: "directory-fee-test", expiresAt: Date.now() + 60000 }));
  const healthy = respond;
  respond = url => url.pathname === "/me" ? Response.json({ user: { user_id: 4, role_name: "USER" } }) : healthy(url);
  await controller("doctors");
  assert.match(nodes.get(".directory-grid").textContent, /Phí khám/);
  sessionStorage.removeItem("neu-medical.auth"); window.dispatchEvent(new Event("neu:auth-change"));
  assert.doesNotMatch(nodes.get(".directory-grid").textContent, /Phí khám/);
});
test("a saved token rejected by the backend cannot reveal directory fees", async () => {
  sessionStorage.setItem("neu-medical.auth", JSON.stringify({ token: "directory-rejected-test", expiresAt: Date.now() + 60000 }));
  const healthy = respond;
  respond = url => url.pathname === "/me" ? Response.json({}, { status: 401 }) : healthy(url);
  await controller("doctors");
  assert.doesNotMatch(nodes.get(".directory-grid").textContent, /Phí khám/);
});
