import { startAutoRefresh } from "../core/auto_refresh.js";
import { hasSession } from "../core/session.js";
import { code } from "../core/business_codes.js";
import { listPatients, listEncounters } from "../api/patient.js";
import { getRecord, listPrescriptionItems } from "../api/medical_record.js";
import { allPages, dateLabel, clock } from "../core/booking.js";
import { statusLabels } from "../core/appointments.js";
import { protectPatientPage } from "../core/patient_access.js";
import { bindLiveSearch } from "../core/live_search.js";

const $ = selector => document.querySelector(selector);
const el = (tag, text = "", className = "") => { const node = document.createElement(tag); node.textContent = text; node.className = className; return node; };
const recordDate = value => value ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Saigon" }).format(new Date(value)) : "Chưa cập nhật";
const ui = {
  profiles: $("#records-profiles"), profileStatus: $("#records-profiles-status"), profileRetry: $("#records-profiles-retry"),
  history: $("#records-history"), historyTitle: $("#records-history-title"), historyStatus: $("#records-history-status"), historyRetry: $("#records-history-retry"),
  encounters: $("#records-encounters"), prev: $("#records-prev"), next: $("#records-next"), page: $("#records-page"),
  lookup: $("#record-lookup-dialog"), form: $("#record-lookup-form"), phone: $("#lookup-phone"), matches: $("#record-lookup-matches"), lookupStatus: $("#record-lookup-status"),
  result: $("#record-result-dialog"), resultStatus: $("#record-result-status"), resultRetry: $("#record-result-retry"), resultContent: $("#record-result-content"),
};
let profiles = [], selected = null, currentPage = 1, lastEncounter = null;
let profileVersion = 0, historyVersion = 0, resultVersion = 0, lookupVersion = 0;
let profileController, historyController, resultController, lookupController;
function facts(target, pairs) {
  const dl = el("dl", "", "booking-review-list");
  for (const [label, value] of pairs) dl.append(el("dt", label), el("dd", String(value ?? "Chưa cập nhật")));
  target.append(dl);
}
function renderProfiles() {
  ui.profiles.replaceChildren();
  for (const p of profiles) {
    const button = el("button", "", "record-profile-button"); button.type = "button";
    button.dataset.patientId = String(p.patient_id);
    button.setAttribute("aria-pressed", String(String(p.patient_id) === String(selected)));
    button.append(el("strong", p.full_name), el("span", `Mã hồ sơ: ${code("BN", p.patient_id)}`), el("small", `${p.dob ? dateLabel(p.dob) : "Chưa có ngày sinh"}${p.is_archived ? " · Đã lưu trữ" : ""}`));
    button.addEventListener("click", () => loadHistory(p.patient_id)); ui.profiles.append(button);
  }
}
async function loadProfiles() {
  const version = ++profileVersion;
  profileController?.abort(); profileController = new AbortController();
  profiles = []; selected = null; ui.profiles.replaceChildren();
  ui.profileStatus.textContent = "Đang tải hồ sơ người bệnh…"; ui.profileRetry.hidden = true;
  try {
    const data = await allPages(listPatients, { include_archived: true }, { signal: profileController.signal });
    if (version !== profileVersion) return;
    profiles = data; renderProfiles();
    ui.profileStatus.textContent = data.length ? `${data.length} hồ sơ được phép truy cập.` : "Chưa có hồ sơ người bệnh trong tài khoản.";
    if (data.length) {
      const requested = new URLSearchParams(location.search).get("patient_id");
      await loadHistory(data.find(p => String(p.patient_id) === requested)?.patient_id ?? data[0].patient_id);
    }
  } catch (error) { if (version === profileVersion) { ui.profileStatus.textContent = errorText(error); ui.profileRetry.hidden = false; } }
}
async function loadHistory(id, page = 1) {
  const profile = profiles.find(p => String(p.patient_id) === String(id));
  if (!profile) return;
  const sameProfile = String(selected) === String(profile.patient_id);
  const version = ++historyVersion;
  historyController?.abort(); historyController = new AbortController();
  resultVersion++; resultController?.abort(); ui.resultContent.replaceChildren(); ui.resultStatus.textContent = ""; ui.result.close();
  selected = profile.patient_id; currentPage = page;
  for (const button of ui.profiles.children) {
    button.setAttribute("aria-pressed", String(button.dataset.patientId === String(selected)));
  }
  ui.history.hidden = false; ui.historyTitle.textContent = `Lịch sử khám · ${profile.full_name}`;
  $("#records-welcome").hidden = true;
  if (!sameProfile) {
    ui.encounters.replaceChildren();
    ui.historyStatus.textContent = "Đang tải lịch sử khám…";
    ui.page.textContent = "";
  }
  ui.encounters.setAttribute("aria-busy", "true"); ui.historyRetry.hidden = true;
  ui.prev.disabled = ui.next.disabled = true;
  try {
    const data = await listEncounters(selected, { page, page_size: 1 }, { signal: historyController.signal });
    if (version !== historyVersion) return;
    if (!Array.isArray(data.items)) throw new Error("Phản hồi lịch sử khám không hợp lệ.");
    ui.historyStatus.textContent = data.total ? `${data.total} lượt khám trong phạm vi được phép xem.` : "Chưa có lần khám nào được phép xem cho hồ sơ này.";
    ui.encounters.replaceChildren();
    for (const encounter of data.items) {
      const card = el("article", "", "record-encounter-card");
      card.append(el("h4", encounter.doctor_name || "Bác sĩ phụ trách"));
      facts(card, [["Ngày khám", dateLabel(encounter.work_date)], ["Khung giờ", `${clock(encounter.estimated_exam_at)}–${clock(encounter.appointment_end_at)}`], ["Phòng", encounter.room_name], ["Mã lượt khám", code("LK", encounter.encounter_id)], ["Trạng thái", statusLabels[encounter.encounter_status] || encounter.encounter_status]]);
      if (["IN_PROGRESS", "COMPLETED"].includes(encounter.encounter_status)) {
        const button = el("button", "Xem kết quả & đơn thuốc", "outline-button"); button.type = "button";
        button.addEventListener("click", () => showResult(encounter)); card.append(button);
      } else card.append(el("p", "Lượt khám chưa có kết quả để hiển thị."));
      ui.encounters.append(card);
    }
    const count = Math.max(1, data.total);
    ui.page.textContent = `Trang ${page} / ${count}`; ui.prev.disabled = page <= 1; ui.next.disabled = page >= count;
  } catch (error) { if (version === historyVersion) { ui.historyStatus.textContent = errorText(error); ui.historyRetry.hidden = false; } }
  finally { if (version === historyVersion) ui.encounters.setAttribute("aria-busy", "false"); }
}
async function showResult(encounter) {
  const version = ++resultVersion;
  resultController?.abort(); resultController = new AbortController(); lastEncounter = encounter;
  ui.resultContent.replaceChildren(); ui.resultStatus.textContent = "Đang tải kết quả khám…"; ui.resultRetry.hidden = true;
  if (!ui.result.open) ui.result.showModal();
  try {
    const { medical_record: record } = await getRecord(encounter.encounter_id, { signal: resultController.signal });
    if (version !== resultVersion) return;
    if (!record?.record_id || record.encounter_id !== encounter.encounter_id) throw new Error("Kết quả khám không khớp lượt khám đã chọn.");
    const medications = await allPages((params, options) => listPrescriptionItems(record.record_id, params, options), {}, { signal: resultController.signal });
    if (version !== resultVersion) return;
    const profile = profiles.find(p => p.patient_id === selected);
    facts(ui.resultContent, [["Người khám", profile?.full_name], ["Bác sĩ", encounter.doctor_name], ["Ngày khám", recordDate(record.examined_at)], ["Chẩn đoán", record.diagnosis], ["Hướng điều trị", record.treatment], ["Ghi chú bác sĩ", record.doctor_notes]]);
    ui.resultContent.append(el("h3", "Đơn thuốc"));
    if (!medications.length) ui.resultContent.append(el("p", "Bác sĩ không kê thuốc cho lần khám này."));
    for (const item of medications) {
      const medicine = el("section", "", "record-medication"); medicine.append(el("h4", item.medication_name));
      facts(medicine, [["Liều dùng", item.dosage], ["Số lượng", item.quantity], ["Hướng dẫn", item.instructions]]); ui.resultContent.append(medicine);
    }
    ui.resultStatus.textContent = encounter.encounter_status === "IN_PROGRESS" ? "Lượt khám đang diễn ra; kết quả có thể được bác sĩ cập nhật." : "Kết quả do bác sĩ ghi nhận.";
  } catch (error) {
    if (version !== resultVersion) return;
    ui.resultStatus.textContent = error.code === "MEDICAL_RECORD_NOT_FOUND" ? "Chưa có bệnh án cho lượt khám này." : errorText(error);
    ui.resultRetry.hidden = error.code === "MEDICAL_RECORD_NOT_FOUND" || [401, 403, 404].includes(error.status);
  }
}
function normalizedPhone(value) {
  const phone = value.trim().replace(/[\s.-]/g, "");
  return /^\+?84[35789]\d{0,8}$/.test(phone) ? `0${phone.replace(/^\+?84/, "")}` : phone;
}
function resetLookup() {
  refreshLookup.cancel(); lookupVersion++; lookupController?.abort();
  ui.lookupStatus.textContent = ""; ui.matches.replaceChildren();
  ui.phone.setCustomValidity("");
}
document.querySelectorAll("[data-open-record-lookup]").forEach(button => button.addEventListener("click", () => {
  resetLookup(); ui.phone.value = ""; ui.lookup.showModal(); ui.phone.focus();
}));
async function lookup() {
  const phone = normalizedPhone(ui.phone.value);
  if (!phone) return;
  if (!/^\+?\d{1,15}$/.test(phone)) { ui.lookupStatus.textContent = "Vui lòng chỉ nhập số điện thoại hợp lệ (tối đa 15 chữ số)."; return; }
  const version = ++lookupVersion;
  lookupController?.abort(); lookupController = new AbortController();
  ui.lookupStatus.textContent = "Đang tra cứu…"; ui.matches.replaceChildren();
  try {
    const matches = await allPages(listPatients, { q: phone, booked_by_me: true, include_archived: true }, { signal: lookupController.signal });
    if (version !== lookupVersion) return;
    const found = matches.filter(p => normalizedPhone(p.phone || "").includes(phone));
    if (!found.length) {
      ui.lookupStatus.textContent = "Không tìm thấy người bệnh có số điện thoại này mà bạn đã từng đặt khám hộ.";
      return;
    }
    const choose = profile => {
      if (version !== lookupVersion) return;
      if (!profiles.some(p => p.patient_id === profile.patient_id)) { profiles.push(profile); renderProfiles(); }
      ui.lookup.close();
      loadHistory(profile.patient_id);
    };
    ui.lookupStatus.textContent = `Có ${found.length} người bệnh phù hợp. Chọn người cần xem kết quả.`;
    for (const profile of found) {
      const button = el("button", "", "record-profile-button"); button.type = "button";
      button.append(el("strong", profile.full_name), el("small", profile.dob ? dateLabel(profile.dob) : "Chưa có ngày sinh"), el("small", profile.phone));
      button.addEventListener("click", () => choose(profile)); ui.matches.append(button);
    }
  } catch (error) { if (version === lookupVersion) ui.lookupStatus.textContent = errorText(error); }
}
const refreshLookup = bindLiveSearch(ui.phone, lookup, { invalidate: resetLookup });
ui.form.addEventListener("submit", event => { event.preventDefault(); refreshLookup(); });
$("#record-lookup-close").addEventListener("click", () => ui.lookup.close());
ui.lookup.addEventListener("close", () => { resetLookup(); ui.phone.value = ""; });
$("#record-result-close").addEventListener("click", () => ui.result.close());
ui.result.addEventListener("close", () => { resultVersion++; resultController?.abort(); ui.resultContent.replaceChildren(); ui.resultStatus.textContent = ""; });
ui.profileRetry.addEventListener("click", loadProfiles);
ui.historyRetry.addEventListener("click", () => loadHistory(selected, currentPage));
ui.resultRetry.addEventListener("click", () => { if (lastEncounter) showResult(lastEncounter); });
ui.prev.addEventListener("click", () => { if (!ui.prev.disabled) loadHistory(selected, currentPage - 1); });
ui.next.addEventListener("click", () => { if (!ui.next.disabled) loadHistory(selected, currentPage + 1); });
const errorText = protectPatientPage({
  status: $("#records-auth-status"), main: $("#main"), onAccess: loadProfiles,
  onSuspend: () => {
    profileVersion++; historyVersion++; resultVersion++; lookupVersion++;
    for (const controller of [profileController, historyController, resultController, lookupController]) controller?.abort();
    profiles = []; selected = null; lastEncounter = null;
    for (const node of [ui.profiles, ui.encounters, ui.resultContent, ui.matches]) node.replaceChildren();
    for (const node of [ui.profileStatus, ui.historyTitle, ui.historyStatus, ui.lookupStatus, ui.resultStatus, ui.page]) node.textContent = "";
    refreshLookup.cancel(); ui.phone.value = ""; ui.phone.setCustomValidity(""); ui.matches.replaceChildren(); ui.history.hidden = true;
    $("#records-welcome").hidden = false;
    ui.lookup.close(); ui.result.close();
  },
});
startAutoRefresh(() => selected ? loadHistory(selected, currentPage) : loadProfiles(), { canRefresh: () => hasSession() });
