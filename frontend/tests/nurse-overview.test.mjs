import test from "node:test";
import assert from "node:assert/strict";
import { renderNurseOverview, nurseOverviewLink } from "../static/js/core/nurse_overview.js";
import { nurseRange } from "../static/js/core/nurse_encounter_data.js";

test("overview reads every authorized page before selecting five visits and five recent distinct records", async () => {
  const original = globalThis.fetch, requests = [];
  const range = { from: "2026-10-12", to: "2026-10-18" };
  const shift = { schedule_id: 1, room_name: "Phòng kiểm thử", work_date: "2026-10-18", start_time: "08:00:00", end_time: "11:30:00", schedule_status: "OPEN" };
  const shifts = Array.from({ length: 7 }, (_, i) => ({ ...shift, schedule_id: i + 1 }));
  const visit = (id, state = "CONFIRMED", day = "2026-10-18") => ({ ...shift, work_date: day, encounter_id: id, patient_id: id, patient_name: `Người khám ${id}`, encounter_status: state });
  const visits = [visit(90, "CONFIRMED", "2026-10-19"), ...Array.from({ length: 7 }, (_, i) => visit(i + 1)), ...Array.from({ length: 7 }, (_, i) => visit(i + 11, "COMPLETED")), { ...visit(100, "COMPLETED"), patient_id: 11 }, { ...visit(200), schedule_id: 99 }];
  const patients = Array.from({ length: 7 }, (_, i) => ({ patient_id: i + 11, full_name: `Hồ sơ ${i + 11}`, dob: "2000-01-01" }));
  try {
    globalThis.fetch = async (url, options) => {
      const u = new URL(url); requests.push({ u, options });
      const rows = u.pathname === "/nurse/assignments" ? shifts : u.pathname === "/patients" ? patients : visits.filter(e => e.encounter_status === u.searchParams.get("encounter_status"));
      const page = Number(u.searchParams.get("page")), size = 3;
      return Response.json({ items: rows.slice((page - 1) * size, page * size), page, page_size: size, total: rows.length });
    };
    const html = await renderNurseOverview(range, { period: "week" });
    const sections = html.split('<section class="panel">');
    assert.match(sections[1], /Danh sách khám tuần này/);
    assert.equal((sections[1].match(/<tr>/g) || []).length, 6);
    assert.equal((sections[1].match(/<th scope=/g) || []).length, 6);
    assert.doesNotMatch(sections[1], /encounter_id=(6|7|90|200)"/);
    assert.match(sections[2], /nurse-compact-shifts/);
    assert.equal((sections[2].match(/class="shift-card"/g) || []).length, 7);
    for (const id of [5, 6, 7]) assert.match(sections[2], new RegExp(`schedule_id=${id}"`));
    assert.equal((sections[3].match(/<tr>/g) || []).length, 6);
    const ids = [...sections[3].matchAll(/patient_id=(\d+)/g)].map(m => Number(m[1]));
    assert.deepEqual(ids, [11, 17, 16, 15, 14]);
    assert.ok(requests.some(r => r.u.pathname === "/patients" && r.u.searchParams.get("page") === "3"));
    assert.ok(requests.every(r => r.options.method === "GET" && !r.u.searchParams.has("nurse_id")));
    for (const target of ["patients", "records", "assignments"]) assert.ok(html.includes(nurseOverviewLink(target, range).replaceAll("&", "&amp;")));
    const empty = await renderNurseOverview({ from: "2030-01-01", to: "2030-01-01" });
    assert.doesNotMatch(empty, /<tbody>|class="shift-card"/);
  } finally { globalThis.fetch = original; }
});

test("overview fails rather than presenting partial data if a later API page fails", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async url => {
      const u = new URL(url);
      if (u.searchParams.get("page") === "2") return Response.json({ error: { message: "Không tải được trang tiếp theo" } }, { status: 403 });
      const items = u.pathname === "/patients" ? [{ patient_id: 1 }] : [];
      return Response.json({ items, total: items.length ? 2 : 0, page: 1, page_size: 1 });
    };
    await assert.rejects(() => renderNurseOverview({ from: "2026-10-18", to: "2026-10-18" }), /Không tải được trang tiếp theo/);
  } finally { globalThis.fetch = original; }
});

test("date links reject reversed or nonexistent calendar dates", () => {
  assert.throws(() => nurseRange("from_date=2026-10-19&to_date=2026-10-18"), /hợp lệ/);
  assert.throws(() => nurseRange("from_date=2026-02-30"), /hợp lệ/);
  assert.deepEqual(nurseRange("from_date=2026-10-12&to_date=2026-10-18"), { from: "2026-10-12", to: "2026-10-18" });
});
