import test from "node:test";
import assert from "node:assert/strict";
import { allPages, availableSchedules, money, clock, dateLabel, matchingBooking, patientPayload } from "../static/js/core/booking.js";

test("reads later pages with original filters and propagates abort options", async () => {
  const calls = [], signal = new AbortController().signal;
  const items = await allPages(async (params, options) => {
    calls.push({ params, options });
    return { items: params.page === 1 ? [{ schedule_id: 1 }] : [{ schedule_id: 2 }], total: 2 };
  }, { from_date: "2030-01-01" }, { signal });
  assert.deepEqual(items.map(s => s.schedule_id), [1, 2]);
  assert.equal(calls[1].params.from_date, "2030-01-01");
  assert.equal(calls[1].params.page, 2);
  assert.equal(calls[1].options.signal, signal);
});
test("incomplete or malformed page responses fail instead of silently dropping schedules", async () => {
  await assert.rejects(allPages(async () => ({ items: [], total: 1 })), /chưa tải đủ/);
  await assert.rejects(allPages(async () => ({})), /không hợp lệ/);
});
test("only backend OPEN schedules with returned slots are bookable; no local slot generation", () => {
  const slot = { appointment_time: "08:30", starts_at: "2030-01-01T08:30:00+07:00", ends_at: "2030-01-01T09:00:00+07:00" };
  const rows = [
    { schedule_id: 1, work_date: "2030-01-02", start_time: "08:00", schedule_status: "OPEN", slots: [slot] },
    { schedule_id: 2, work_date: "2030-01-01", start_time: "08:00", schedule_status: "OPEN", slots: [] },
    { schedule_id: 3, work_date: "2030-01-01", start_time: "08:00", schedule_status: "UNAVAILABLE", slots: [slot] },
    { schedule_id: 4, work_date: "2030-01-01", start_time: "08:00", schedule_status: "OPEN", slots: [slot] },
  ];
  const result = availableSchedules(rows);
  assert.deepEqual(result.map(s => s.schedule_id), [4, 1]);
  assert.equal(result[0].slots[0], slot);
});
test("Vietnamese money and time display preserve zero fee and convert UTC to hospital time", () => {
  assert.equal(money(null), "Chưa có giá khám");
  assert.match(money(0), /0/);
  assert.match(money("300000.00"), /300\.000/);
  assert.equal(clock("2030-01-01T01:30:00Z"), "08:30");
  assert.equal(dateLabel("2030-01-01"), "01/01/2030");
});
test("uncertain submissions recover only the exact patient's active interval and symptoms", () => {
  const request = { patient_id: 3, schedule_id: 5, appointment_time: "08:30", symptoms: "Đau đầu" };
  const matching = { ...request, estimated_exam_at: "2030-01-01T01:30:00Z", encounter_status: "HOLDING" };
  assert.equal(matchingBooking([matching], request), matching);
  for (const changed of [{ patient_id: 4 }, { schedule_id: 6 }, { estimated_exam_at: "2030-01-01T02:00:00Z" },
    { symptoms: "Ho" }, { encounter_status: "CANCELLED" }, { encounter_status: "EXPIRED" }]) {
    assert.equal(matchingBooking([{ ...matching, ...changed }], request), undefined);
  }
});
test("profile creation requires DOB or ID and never adds ownership or implicit shared phone confirmation", () => {
  const form = new FormData();
  form.set("full_name", " Nguyễn Văn A "); form.set("phone", "0900000001"); form.set("relationship", "SELF");
  assert.throws(() => patientPayload(form), /ngày sinh hoặc CCCD/);
  form.set("dob", "2000-01-01"); form.set("user_id", "9"); form.set("confirm_shared_phone", "true");
  assert.deepEqual(patientPayload(form), {
    full_name: "Nguyễn Văn A", phone: "0900000001", relationship: "SELF", dob: "2000-01-01", confirm_shared_phone: false,
  });
  assert.equal(patientPayload(form, true).confirm_shared_phone, true);
});
