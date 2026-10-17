import test from "node:test";
import assert from "node:assert/strict";
import { fixture, loaded, deferred, until, id } from "./helpers/booking-fixture.mjs";

test("an old draft without a saved booking returns to review without showing fake payment success", async () => {
  const f = fixture({ page: "payment", selfDraft: true });
  await import("../static/js/pages/payment.js?unsaved-draft");
  await until(() => f.navigation.length > 0, "Expected return to review");
  try {
    const destination = new URL(f.navigation[0]);
    assert.ok(destination.pathname.endsWith("/booking_review.html"));
    assert.equal(destination.searchParams.get("draft"), id);
    assert.equal(f.get("#payment-page").hidden, true);
    assert.ok(f.calls.every(call => call.method === "GET"));
  } finally { f.events.pagehide(); }
});

test("opening an existing hold is read-only; explicit payment actions keep the server flow", async () => {
  const f = fixture({ page: "payment", encounterId: 3 });
  await import("../static/js/pages/payment.js?existing-hold"); await loaded(f);
  try {
    assert.ok(f.calls.every(call => call.method === "GET"));
    assert.equal(f.get("#booking-payment-create").hidden, false);
    const create = f.get("#booking-payment-create").events.click;
    await Promise.all([create(), create()]);
    assert.equal(f.calls.filter(call => call.path.endsWith("/payment-intents")).length, 1);
    assert.equal(f.get("#booking-qr").hidden, false);
    assert.equal(f.get("#booking-payment-method").disabled, true);
    await f.get("#booking-payment-success").events.click();
    assert.equal(f.get("#booking-success").hidden, false);
    assert.doesNotMatch(f.get("#booking-success-title").textContent, /minh họa/);
    assert.ok(!f.calls.some(call => call.path === "/encounters/online"));
  } finally { f.events.pagehide(); }
});

test("returning to the payment page reuses the existing transaction without another POST", async () => {
  const f = fixture({ page: "payment", encounterId: 3 });
  await import("../static/js/pages/payment.js?restore"); await loaded(f);
  try {
    await f.get("#booking-payment-create").events.click();
    const mutations = f.calls.filter(call => call.method === "POST").length;
    f.events.pagehide(); f.events.pageshow({ persisted: true }); await loaded(f);
    assert.equal(f.get("#booking-qr").hidden, false);
    assert.equal(f.calls.filter(call => call.method === "POST").length, mutations);
  } finally { f.events.pagehide(); }
});

test("payment errors and an unconfirmed server booking never show success", async () => {
  for (const mode of ["failResult", "unconfirmedPayment"]) {
    const f = fixture({ page: "payment", encounterId: 3, [mode]: true });
    await import(`../static/js/pages/payment.js?confirmation-${mode}`); await loaded(f);
    try {
      await f.get("#booking-payment-create").events.click();
      await f.get("#booking-payment-success").events.click();
      assert.equal(f.get("#booking-success").hidden, true);
      assert.match(f.get("#booking-payment-status").textContent, /cập nhật trạng thái/);
      assert.equal(f.calls.filter(call => call.path === "/demo/payments/4/result").length, 1);
    } finally { f.events.pagehide(); }
  }
});

test("failed payment remains a stored hold and offers another payment attempt", async () => {
  const f = fixture({ page: "payment", encounterId: 3 });
  await import("../static/js/pages/payment.js?failed-result"); await loaded(f);
  try {
    await f.get("#booking-payment-create").events.click();
    await f.get("#booking-payment-failed").events.click();
    assert.equal(f.get("#booking-success").hidden, true);
    assert.equal(f.get("#booking-payment-create").hidden, false);
    assert.match(f.get("#booking-payment-status").textContent, /không thành công/);
    assert.equal(f.calls.filter(call => call.path === "/encounters/online").length, 0);
  } finally { f.events.pagehide(); }
});

test("a failed payment request is read back without an automatic mutation retry", async () => {
  const f = fixture({ page: "payment", encounterId: 3, failIntent: true });
  await import("../static/js/pages/payment.js?failed-intent"); await loaded(f);
  try {
    await f.get("#booking-payment-create").events.click();
    assert.equal(f.calls.filter(call => call.path.endsWith("/payment-intents")).length, 1);
    assert.match(f.get("#booking-payment-status").textContent, /cập nhật trạng thái/);
  } finally { f.events.pagehide(); }
});

test("missing or expired draft shows a recoverable empty state with no mutation", async () => {
  const f = fixture({ page: "payment", selfDraft: true });
  f.store.delete("neu:booking-review:" + id);
  await import("../static/js/pages/payment.js?missing");
  await until(() => f.get("#payment-auth-status").querySelector("button").hidden === false, "Expected a retry state");
  assert.match(f.get("#payment-auth-status").querySelector("p").textContent, /hết hạn/);
  assert.equal(f.get("#payment-page").hidden, true);
  assert.ok(f.calls.every(call => call.method === "GET"));
  f.events.pagehide();
});

test("late responses after leaving cannot restore the payment page", async () => {
  const pending = deferred();
  const f = fixture({ page: "payment", encounterId: 3, encounterGate: pending.promise });
  await import("../static/js/pages/payment.js?late");
  await until(() => f.calls.some(call => call.path === "/encounters/3"), "Expected encounter read");
  f.events.pagehide(); pending.resolve();
  for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.get("#payment-page").hidden, true);
  assert.ok(f.calls.every(call => call.method === "GET"));
});
