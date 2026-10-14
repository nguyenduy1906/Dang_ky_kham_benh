import { ApiError } from "./api.js";

// Mouse dragging scrolls the day strip without accidentally selecting a day.
// Touch scrolling and keyboard activation keep their native behavior.
export function enableDragScroll(strip) {
  let drag, suppressClick = false;
  strip.addEventListener("pointerdown", event => {
    if (event.pointerType !== "mouse" || event.button !== 0 || strip.scrollWidth <= strip.clientWidth) return;
    if (event.clientY - strip.getBoundingClientRect().top >= strip.clientHeight) return;
    suppressClick = false;
    drag = { id: event.pointerId, x: event.clientX, scroll: strip.scrollLeft, moved: false };
  });
  window.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.id) return;
    const distance = event.clientX - drag.x;
    if (!drag.moved && Math.abs(distance) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      strip.setPointerCapture(drag.id);
      strip.classList.add("is-dragging");
    }
    event.preventDefault();
    strip.scrollLeft = drag.scroll - distance;
  }, { passive: false });
  function finish(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const id = drag.id;
    suppressClick = drag.moved;
    drag = undefined;
    strip.classList.remove("is-dragging");
    if (strip.hasPointerCapture(id)) strip.releasePointerCapture(id);
  }
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);
  strip.addEventListener("lostpointercapture", finish);
  strip.addEventListener("click", event => {
    if (!suppressClick || event.detail === 0) return;
    suppressClick = false;
    event.preventDefault(); event.stopPropagation();
  }, true);
}

// Read every backend page so a doctor's later shifts and a patient's profiles are not lost.
export async function allPages(load, params = {}, options = {}) {
  const items = [];
  for (let page = 1; ; page++) {
    const result = await load({ ...params, page, page_size: 100 }, options);
    if (!Array.isArray(result?.items)) throw new ApiError("Phản hồi danh sách không hợp lệ.");
    items.push(...result.items);
    if (result.total === undefined || items.length >= result.total) return items;
    if (!result.items.length) throw new ApiError("Danh sách chưa tải đủ. Vui lòng thử lại.");
  }
}

export function availableSchedules(items) {
  return items.filter(schedule => schedule.schedule_status === "OPEN" && Array.isArray(schedule.slots) &&
    schedule.slots.length > 0).sort((a, b) =>
    `${a.work_date} ${a.start_time}`.localeCompare(`${b.work_date} ${b.start_time}`));
}

export const money = value => value !== null && value !== undefined && Number.isFinite(Number(value))
  ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value)
  : "Chưa có giá khám";
export const clock = value => new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit", minute: "2-digit", timeZone: "Asia/Saigon", hourCycle: "h23",
}).format(new Date(value));
export const dateLabel = value => new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Saigon",
}).format(new Date(`${value}T12:00:00+07:00`));
export const todayVN = () => new Intl.DateTimeFormat("en-CA", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Saigon",
}).format(new Date());

// Recover only this exact submission after an uncertain network result. Never send a second POST automatically.
export function matchingBooking(items, request) {
  return items.find(item => Number(item.patient_id) === Number(request.patient_id) &&
    Number(item.schedule_id) === Number(request.schedule_id) &&
    ["HOLDING", "CONFIRMED"].includes(item.encounter_status) &&
    Number.isFinite(new Date(item.estimated_exam_at).getTime()) &&
    clock(item.estimated_exam_at) === request.appointment_time &&
    item.symptoms === request.symptoms);
}

export function patientPayload(formData, sharedPhoneConfirmed = false) {
  const fields = Object.fromEntries([...formData.entries()].filter(([key]) => [
    "full_name", "phone", "dob", "gender", "id_card", "address", "health_insurance", "relationship",
  ].includes(key)).map(([key, value]) => [key, value.trim() || null]));
  if (!fields.dob && !fields.id_card) throw new Error("Vui lòng nhập ngày sinh hoặc CCCD / mã định danh.");
  return { ...fields, confirm_shared_phone: sharedPhoneConfirmed };
}
