import { listEncounters, getEncounter, getTicket } from "../api/encounter.js";
import { listPatients } from "../api/patient.js";
import { listDoctors } from "../api/doctor.js";
import { allPages, dateLabel, clock, money } from "../core/booking.js";
import { statusLabels, isUpcoming, filterAppointments, appointmentActionUrl } from "../core/appointments.js";
import { thumbnailUrl } from "../core/articles.js";
import { protectPatientPage } from "../core/patient_access.js";

const $ = selector => document.querySelector(selector);
function el(tag, text = "", className = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}
const ui = {
  list: $("#appointments-list"), status: $("#appointments-status"), patient: $("#appointments-patient"),
  filter: $("#appointments-status-filter"), retry: $("#appointments-retry"), refresh: $("#appointments-refresh"),
  dialog: $("#appointment-detail-dialog"), detail: $("#appointment-detail-content"),
  detailStatus: $("#appointment-detail-status"), detailRetry: $("#appointment-detail-retry"), action: $("#appointment-detail-action"),
};
const tabs = [...document.querySelectorAll("[data-view]")];
const params = new URLSearchParams(location.search);
let items = [], doctors = [], view = params.get("view") === "history" ? "history" : "upcoming";
let page = Math.max(1, Number.parseInt(params.get("page"), 10) || 1), loading = false, initialized = false, version = 0, controller;
let detailVersion = 0, detailController, detailId;
const perPage = 6;
for (const [value, label] of Object.entries(statusLabels)) ui.filter.add(new Option(label, value));
if (Object.hasOwn(statusLabels, params.get("status"))) ui.filter.value = params.get("status");

function details(target, pairs) {
  const list = el("dl", "", "booking-review-list");
  for (const [label, value] of pairs) list.append(el("dt", label), el("dd", String(value ?? "Chưa cung cấp")));
  target.append(list);
}
function portrait(doctor, name) {
  const holder = el("span", "", "booking-portrait");
  const missing = el("span", "Chưa có ảnh", "booking-portrait-missing");
  holder.append(missing);
  const src = thumbnailUrl(doctor?.avatar_url);
  if (src) {
    const image = el("img");
    image.alt = `Ảnh ${name}`;
    image.loading = "lazy";
    image.addEventListener("load", () => { missing.hidden = true; });
    image.addEventListener("error", () => { image.remove(); missing.hidden = false; });
    image.src = src;
    holder.append(image);
  }
  return holder;
}
function saveFilters() {
  const url = new URL(location.href);
  url.searchParams.set("view", view);
  for (const [key, value] of [["patient_id", ui.patient.value], ["status", ui.filter.value], ["page", page > 1 ? page : ""]]) {
    if (value) url.searchParams.set(key, String(value)); else url.searchParams.delete(key);
  }
  history.replaceState(null, "", url);
}
function render() {
  tabs.forEach(tab => {
    const selected = tab.dataset.view === view;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected) $("#appointments-panel").setAttribute("aria-labelledby", tab.id);
  });
  const filtered = filterAppointments(items, { view, patient: ui.patient.value, status: ui.filter.value });
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  page = Math.min(page, pages);
  ui.list.replaceChildren();
  for (const item of filtered.slice((page - 1) * perPage, page * perPage)) {
    const card = el("article", "", "appointment-card");
    card.dataset.encounterId = item.encounter_id;
    const heading = el("div", "", "appointment-card-heading");
    const info = el("div", "", "appointment-card-doctor");
    const doctor = doctors.find(d => d.doctor_profile_id === item.doctor_profile_id);
    info.append(el("h2", item.doctor_name), el("p", doctor?.department_name || item.room_name));
    const badge = el("span", statusLabels[item.encounter_status] || item.encounter_status, "appointment-status-badge");
    badge.dataset.status = item.encounter_status;
    heading.append(portrait(doctor, item.doctor_name), info, badge);
    card.append(heading);
    const metadata = el("div", "", "appointment-card-metadata");
    details(metadata, [
      ["Người khám", item.patient_name], ["Ngày khám", dateLabel(item.work_date)],
      ["Khung giờ", `${clock(item.estimated_exam_at)}–${clock(item.appointment_end_at)}`],
      ["Phòng khám", item.room_name], ["Giá khám đã chốt", money(item.consultation_fee_snapshot)],
      ["Mã phiếu", item.ticket_code || "Chưa được cấp"],
    ]);
    const actions = el("div", "", "appointment-card-actions");
    const detail = el("button", "Xem chi tiết", "outline-button");
    detail.type = "button";
    detail.setAttribute("aria-label", `Xem chi tiết lịch của ${item.patient_name} ngày ${dateLabel(item.work_date)}`);
    detail.addEventListener("click", () => { detailId = item.encounter_id; ui.dialog.showModal(); loadDetail(); });
    actions.append(detail);
    if (isUpcoming(item) && item.encounter_status === "HOLDING") {
      const link = el("a", "Tiếp tục đăng ký", "solid-button");
      link.href = appointmentActionUrl(item);
      actions.append(link);
    } else if (!isUpcoming(item)) {
      const link = el("a", "Đặt khám lại", "solid-button");
      link.href = appointmentActionUrl({ ...item, encounter_status: "COMPLETED" });
      actions.append(link);
    }
    card.append(metadata, actions);
    ui.list.append(card);
  }
  $("#appointments-empty").hidden = filtered.length > 0;
  $("#appointments-empty").textContent = view === "upcoming"
    ? "Không có lịch sắp tới phù hợp. Bạn có thể xem tab Lịch sử hoặc đặt lịch khám mới."
    : "Không có lịch sử khám phù hợp với bộ lọc.";
  ui.status.textContent = `${filtered.length} lịch ${view === "upcoming" ? "sắp tới" : "trong lịch sử"} · Chỉ hiển thị dữ liệu tài khoản được phép xem.`;
  $("#appointments-pagination").hidden = pages <= 1;
  $("#appointments-page").textContent = `Trang ${page} / ${pages}`;
  $("#appointments-prev").disabled = page <= 1;
  $("#appointments-next").disabled = page >= pages;
  saveFilters();
}
async function load() {
  if (loading) return;
  loading = true;
  controller?.abort();
  controller = new AbortController();
  const current = ++version;
  ui.list.replaceChildren();
  ui.list.setAttribute("aria-busy", "true");
  ui.status.textContent = "Đang tải lịch đã đăng ký…";
  ui.retry.hidden = true;
  $("#appointments-empty").hidden = $("#appointments-pagination").hidden = true;
  ui.refresh.disabled = ui.patient.disabled = ui.filter.disabled = true;
  tabs.forEach(tab => { tab.disabled = true; });
  const results = await Promise.allSettled([
    allPages(listEncounters, {}, { signal: controller.signal }),
    allPages(listPatients, { include_archived: true }, { signal: controller.signal }),
    allPages(listDoctors, {}, { signal: controller.signal, auth: false }),
  ]);
  try {
    if (current !== version) return;
    const failed = results.find(result => result.status === "rejected");
    if (failed) throw failed.reason;
    items = results[0].value; doctors = results[2].value;
    const preferred = initialized ? ui.patient.value : params.get("patient_id");
    const profiles = new Map(results[1].value.map(p => [p.patient_id, p]));
    // Keep archived profiles from authorized history selectable too.
    for (const item of items) if (!profiles.has(item.patient_id)) profiles.set(item.patient_id, { patient_id: item.patient_id, full_name: item.patient_name });
    ui.patient.replaceChildren(new Option("Tất cả hồ sơ", ""));
    for (const profile of profiles.values()) {
      ui.patient.add(new Option(`${profile.full_name}${profile.dob ? ` — ${dateLabel(profile.dob)}` : ""}${profile.is_archived ? " (đã lưu trữ)" : ""}`, profile.patient_id));
    }
    if ([...profiles.keys()].some(id => String(id) === preferred)) ui.patient.value = preferred;
    if (!initialized && !params.has("view") && !items.some(item => isUpcoming(item))) view = "history";
    initialized = true;
    render();
  } catch (error) {
    if (current !== version) return;
    ui.status.textContent = errorText(error);
    ui.retry.hidden = false;
  } finally {
    if (current === version) {
      loading = false;
      ui.list.setAttribute("aria-busy", "false");
      ui.refresh.disabled = ui.patient.disabled = ui.filter.disabled = false;
      tabs.forEach(tab => { tab.disabled = false; });
    }
  }
}
async function loadDetail() {
  detailController?.abort();
  detailController = new AbortController();
  const current = ++detailVersion;
  ui.detail.replaceChildren();
  ui.detailRetry.hidden = ui.action.hidden = true;
  ui.detailStatus.textContent = "Đang tải thông tin lịch khám…";
  try {
    const result = await getEncounter(detailId, { signal: detailController.signal });
    let ticket;
    if (result.encounter.ticket_code) ticket = (await getTicket(detailId, { signal: detailController.signal })).ticket;
    if (current !== detailVersion) return;
    const item = result.encounter;
    details(ui.detail, [
      ["Trạng thái", statusLabels[item.encounter_status] || item.encounter_status],
      ["Mã phiếu", ticket?.ticket_code || "Chưa được cấp"], ["Người khám", item.patient_name],
      ["Bác sĩ", item.doctor_name], ["Ngày khám", dateLabel(item.work_date)],
      ["Khung giờ", `${clock(item.estimated_exam_at)}–${clock(item.appointment_end_at)}`],
      ["Phòng khám", item.room_name], ["Giá khám đã chốt", money(item.consultation_fee_snapshot)],
      ["Tiền cọc đã chốt", money(item.deposit_amount_snapshot)], ["Vấn đề sức khỏe", item.symptoms || "Chưa cung cấp"],
    ]);
    const upcoming = isUpcoming(item);
    ui.detailStatus.textContent = ["CANCELLED", "EXPIRED", "NO_SHOW"].includes(item.encounter_status)
      ? "Lượt khám này không còn hiệu lực. Mã phiếu được giữ để đối chiếu lịch sử."
      : !upcoming ? "Đây là lịch sử khám được lưu trong hệ thống."
        : item.encounter_status === "HOLDING" ? "Chưa xác nhận. Tiếp tục đăng ký để thanh toán trong thời gian giữ chỗ."
          : "Vui lòng đến làm thủ tục trước khung giờ đã chọn ít nhất 30 phút.";
    if (upcoming && item.encounter_status === "HOLDING") {
      ui.action.textContent = "Tiếp tục đăng ký"; ui.action.href = appointmentActionUrl(item); ui.action.hidden = false;
    }
  } catch (error) {
    if (current !== detailVersion) return;
    ui.detailStatus.textContent = errorText(error);
    ui.detailRetry.hidden = false;
  }
}
function switchView(next) { view = next; page = 1; render(); }
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
  tab.addEventListener("keydown", event => {
    const target = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs.at(-1)
      : event.key === "ArrowLeft" || event.key === "ArrowRight" ? tabs[(index + 1) % tabs.length] : undefined;
    if (target) { event.preventDefault(); switchView(target.dataset.view); target.focus(); }
  });
});
for (const input of [ui.patient, ui.filter]) input.addEventListener("change", () => { page = 1; render(); });
$("#appointments-prev").addEventListener("click", () => { page--; render(); });
$("#appointments-next").addEventListener("click", () => { page++; render(); });
ui.retry.addEventListener("click", load); ui.refresh.addEventListener("click", load);
ui.detailRetry.addEventListener("click", loadDetail);
$("#appointment-detail-close").addEventListener("click", () => ui.dialog.close());
ui.dialog.addEventListener("close", () => { detailVersion++; detailController?.abort(); });
const errorText = protectPatientPage({
  main: $("#main"), status: $("#appointments-auth-status"), onAccess: load,
  onSuspend: () => {
    version++; detailVersion++; controller?.abort(); detailController?.abort(); loading = false;
    ui.list.replaceChildren(); ui.detail.replaceChildren();
  },
});
