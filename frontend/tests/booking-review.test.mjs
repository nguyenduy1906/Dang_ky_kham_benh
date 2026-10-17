import test from "node:test";
import assert from "node:assert/strict";
import { demoPaymentPayload, qrMatrix } from "../static/js/core/payment_qr.js";
import { readDraft, saveDraft } from "../static/js/core/booking_draft.js";
import { fixture, loaded, deferred, until, id, Node } from "./helpers/booking-fixture.mjs";
import { listEncounters } from "../static/js/api/encounter.js";

test("payment validates review, creates one hold and navigates to its dedicated page", async () => {
  const f = fixture();
  await import("../static/js/pages/booking_review.js?initial"); await loaded(f);
  assert.equal(f.calls.filter(c => c.method === "POST").length, 0);
  const click = f.get("#booking-confirm").events.click;
  await Promise.all([click(), click()]);
  assert.equal(f.calls.filter(c => c.path === "/encounters/online").length, 1);
  assert.equal(f.calls.filter(c => c.path.endsWith("/payment-intents")).length, 1);
  assert.equal(f.navigation.length, 1);
  const destination = new URL(f.navigation[0]);
  assert.ok(destination.pathname.endsWith("/payment.html"));
  assert.equal(destination.searchParams.get("draft"), id);
  assert.equal(destination.searchParams.get("encounter"), "3");
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
  assert.match(f.navigation.at(-1), /payment\.html/);
  f.events.pagehide();
});
test("resuming a hold navigates to payment without creating another encounter", async () => {
  const f = fixture({ encounterId: 3 });
  await import("../static/js/pages/booking_review.js?resume"); await loaded(f);
  await f.get("#booking-confirm").events.click();
  assert.equal(f.calls.filter(c => c.path === "/encounters/online").length, 0);
  assert.match(f.navigation.at(-1), /payment\.html/);
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
    assert.equal(f.navigation.length, 0);
    name.value = "Valid name"; name.events.input();
    assert.equal(name["aria-invalid"], "false");
    assert.equal(f.get("#booking-review-field-0-error").hidden, true);
    await f.get("#booking-confirm").events.click();
    assert.equal(symptoms.focused, true);
    symptoms.value = "New symptom description"; symptoms.events.input();
    await f.get("#booking-confirm").events.click();
    const request = f.calls.find(c => c.path === "/encounters/online");
    assert.equal(JSON.parse(request.body).symptoms, symptoms.value);
    assert.match(f.navigation.at(-1), /payment\.html/);
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
    assert.match(f.navigation.at(-1), /payment\.html/);
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
    assert.match(f.navigation.at(-1), /payment\.html/);
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
      assert.match(f.navigation.at(-1), /payment\.html/);
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
    assert.equal(f.navigation.length, 0);
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
  assert.equal(f.navigation.length, 0);
  assert.equal(f.calls.filter(c => c.method === "POST").length, 0);
});

test("default self opens review with account details even without a saved patient", async () => {
  const f = fixture({ selfDraft: true });
  await import("../static/js/pages/booking_review.js?self-review"); await loaded(f);
  try {
    assert.equal(f.get("#booking-review-page").hidden, false);
    assert.equal(f.get("#booking-review-field-0").value, "Account user");
    assert.equal(f.get("#booking-review-field-3").value, "0912345678");
    assert.equal(f.get("#booking-confirm").textContent, "Thanh toán →");
    assert.ok(f.calls.every(call => call.method === "GET"));
  } finally { f.events.pagehide(); }
});

test("self payment saves a real patient ID and booking before navigating, then confirms into the appointments API", async () => {
  const f = fixture({ selfDraft: true });
  await import("../static/js/pages/booking_review.js?self-draft-save"); await loaded(f);
  try {
    const identity = f.get("#booking-review-field-1"); identity.value = "001090123456"; identity.events.input();
    const address = f.get("#booking-review-field-6"); address.value = "Địa chỉ đang nhập"; address.events.input();
    const confirm = f.get("#booking-confirm").events.click;
    await Promise.all([confirm(), confirm()]);
    const saved = readDraft(id, 1);
    assert.equal(saved.patient_id, 2);
    assert.equal(saved.registration_details.address, address.value);
    assert.equal(saved.encounter_id, 3);
    assert.match(f.navigation.at(-1), /payment\.html/);
    const profileCall = f.calls.findIndex(call => call.path === "/patients" && call.method === "POST");
    const bookingCall = f.calls.findIndex(call => call.path === "/encounters/online");
    assert.ok(profileCall >= 0 && profileCall < bookingCall);
    assert.equal(f.calls.filter(call => call.path === "/patients" && call.method === "POST").length, 1);
    assert.equal(f.calls.filter(call => call.path === "/encounters/online").length, 1);
    assert.equal(JSON.parse(f.calls[profileCall].body).confirm_shared_phone, false);
    assert.equal(JSON.parse(f.calls[bookingCall].body).patient_id, 2);
    const destination = f.navigation.at(-1);
    f.events.pagehide();
    f.page = "payment";
    f.get("#payment-auth-status").append(new Node("p"), new Node("button"));
    location.href = destination; location.search = new URL(destination).search;
    await import("../static/js/pages/payment.js?self-confirmed-history"); await loaded(f);
    await f.get("#booking-payment-success").events.click();
    assert.equal(f.get("#booking-success").hidden, false);
    const history = await listEncounters();
    assert.equal(history.items[0].encounter_id, saved.encounter_id);
    assert.equal(history.items[0].encounter_status, "CONFIRMED");
    assert.equal(history.items[0].ticket_code, "TEST-ONLY");
  } finally { f.events.pagehide(); }
});

test("failed self profile creation does not create a booking, payment or success screen", async () => {
  const f = fixture({ selfDraft: true, failPatient: true });
  await import("../static/js/pages/booking_review.js?self-profile-error"); await loaded(f);
  try {
    const identity = f.get("#booking-review-field-1"); identity.value = "001090123456"; identity.events.input();
    await f.get("#booking-confirm").events.click();
    assert.equal(f.navigation.length, 0);
    assert.ok(!f.calls.some(call => call.path === "/encounters/online" || call.path.endsWith("/payment-intents")));
    assert.match(f.get("#booking-dialog-status").textContent, /Không lưu được hồ sơ/);
    assert.equal(readDraft(id, 1).uncertain, false);
  } finally { f.events.pagehide(); }
});

test("leaving while saving self profile prevents subsequent booking and payment writes", async () => {
  const saving = deferred();
  const f = fixture({ selfDraft: true, patientGate: saving.promise });
  await import("../static/js/pages/booking_review.js?self-profile-late"); await loaded(f);
  const identity = f.get("#booking-review-field-1"); identity.value = "001090123456"; identity.events.input();
  const action = f.get("#booking-confirm").events.click();
  await until(() => f.calls.some(call => call.path === "/patients" && call.method === "POST"), "Expected profile save");
  f.events.pagehide(); saving.resolve(); await action;
  assert.ok(!f.calls.some(call => call.path === "/encounters/online"));
  assert.equal(f.navigation.length, 0);
});

test("self payment requires complete information before navigating", async () => {
  const f = fixture({ selfDraft: true });
  await import("../static/js/pages/booking_review.js?self-payment-required"); await loaded(f);
  try {
    await f.get("#booking-confirm").events.click();
    assert.equal(f.navigation.length, 0);
    assert.equal(f.get("#booking-review-field-1")["aria-invalid"], "true");
    assert.ok(f.calls.every(call => call.method === "GET"));
  } finally { f.events.pagehide(); }
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
