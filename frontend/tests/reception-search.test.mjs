import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { installDom, trigger, tick } from "./helpers/admin-dom.mjs";
import { setAccessToken } from "../static/js/core/api.js";

const patient = { patient_id: 42, full_name: "Người bệnh kiểm thử", dob: "2000-01-01", phone: "0900000042" };
function fixture(page, respond) {
  const dom = installDom(page), calls = [];
  dom.root.dataset.role = "reception";
  dom.$("#page-header").insertAdjacentHTML("afterend", '<p id="page-status" hidden></p>');
  setAccessToken("unit-test-only");
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url), call = { path: parsed.pathname, params: parsed.searchParams, method: options.method };
    calls.push(call);
    const data = await respond?.(call);
    if (data) return data instanceof Response ? data : Response.json(data);
    if (call.path === "/patients") return Response.json({ items: [patient], total: 1, page: Number(parsed.searchParams.get("page")), page_size: 15 });
    if (call.path === "/doctors") return Response.json({ items: [], total: 0, page: 1, page_size: 100 });
    if (/^\/encounters\/\d+$/.test(call.path)) return Response.json({ encounter: { encounter_id: Number(call.path.split("/").at(-1)), patient_name: patient.full_name, encounter_status: "CONFIRMED" } });
    if (call.path.endsWith("/transfer-options")) return Response.json({ items: [], total: 0, page: 1, page_size: 12 });
    throw new Error(`Unexpected request ${call.path}`);
  };
  return { ...dom, calls, restore() { setAccessToken(null); dom.restore(); } };
}
let version = 0;
async function openPage() {
  const file = new URL("../static/js/pages/reception.js", import.meta.url);
  const source = (await readFile(file, "utf8"))
    .replace('import { staffReady } from "../core/staff_workspace.js";', 'const staffReady = Promise.resolve({ role_name: "RECEPTIONIST" });')
    .replace(/from "(\.\.[^"]+)"/g, (_, path) => `from ${JSON.stringify(new URL(path, file).href)}`);
  await import(`data:text/javascript;base64,${Buffer.from(source + `\n// test ${++version}`).toString("base64")}`);
}
for (const [page, formId, resultId] of [["patients", "#patient-search-form", "#patient-list"], ["walk_in", "#walkin-search", "#walkin-results"]]) {
  test(`${page} searches while typing and clears the query without submitting`, async t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const f = fixture(page);
    try {
      await openPage(); const form = f.$(formId), input = form.elements.q;
      assert.equal(form.querySelector('button[type="submit"]'), null);
      const before = f.calls.length;
      input.value = "Ngu"; await trigger(input, "input");
      input.value = "  Nguyễn  "; await trigger(input, "input");
      assert.equal(f.calls.length, before);
      t.mock.timers.tick(251); await tick();
      assert.equal(f.calls.length, before + 1);
      assert.equal(f.calls.at(-1).params.get("q"), "Nguyễn");
      assert.equal(f.calls.at(-1).params.get("page"), "1");
      assert.match(f.$(resultId).innerHTML, /Người bệnh kiểm thử/);
      input.value = ""; await trigger(input, "input"); t.mock.timers.tick(251); await tick();
      assert.equal(f.calls.at(-1).params.has("q"), false);
      assert.ok(f.calls.every(c => c.method === "GET"));
    } finally { f.restore(); }
  });
}
test("late reception results cannot overwrite a more recent search", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] }); let finish;
  const f = fixture("walk_in", c => c.params.get("q") === "old" ? new Promise(resolve => { finish = resolve; }) : null);
  try {
    await openPage(); const input = f.$("#walkin-search").elements.q;
    input.value = "old"; await trigger(input, "input"); t.mock.timers.tick(251); await tick();
    input.value = "new"; await trigger(input, "input");
    finish({ items: [{ ...patient, full_name: "Old response" }], total: 1, page: 1, page_size: 10 }); await tick();
    assert.doesNotMatch(f.$("#walkin-results").innerHTML, /Old response/);
    t.mock.timers.tick(251); await tick(); assert.equal(f.calls.at(-1).params.get("q"), "new");
  } finally { f.restore(); }
});
test("coordination looks up typed ids, clears results for an empty id, and keeps the doctor selector action", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] }); const f = fixture("coordination");
  try {
    await openPage(); const form = f.$("#coordination-search"), input = form.elements.encounter_id;
    assert.equal(form.querySelector('button[type="submit"]'), null);
    assert.ok(f.$("#room-search").querySelector('button[type="submit"]'));
    input.value = "51"; await trigger(input, "input"); t.mock.timers.tick(251); await tick();
    assert.deepEqual(f.calls.slice(-2).map(c => c.path), ["/encounters/51", "/staff/encounters/51/transfer-options"]);
    assert.match(f.$("#transfer-context").innerHTML, /Người bệnh kiểm thử/);
    const before = f.calls.length;
    input.value = ""; await trigger(input, "input"); t.mock.timers.tick(251); await tick();
    assert.equal(f.calls.length, before); assert.equal(f.$("#transfer-context").innerHTML, "");
    assert.equal(f.$("#transfer-options").innerHTML, ""); assert.equal(f.$("#list-pagination").innerHTML, "");
    assert.ok(f.calls.every(c => c.method === "GET"));
  } finally { f.restore(); }
});
