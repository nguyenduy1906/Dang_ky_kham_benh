import { listPatients, getPatient, listEncounters } from "../api/patient.js";
import { getEncounter } from "../api/encounter.js";
import { readMedicalRecord } from "./staff_encounters.js";
import { sessionError } from "./staff_workspace.js";
import { bindLiveSearch } from "./live_search.js";
import { $, esc, date, facts, panel, empty, table, pagination, badge, dialog, encounterSummary } from "./staff_ui.js";

// All reads use the existing server-side nurse scope. There are no patient or clinical writes here.
export async function initNurseRecords() {
  $("#page-body").innerHTML = panel("Tra cứu hồ sơ", `
    <p class="scope-note">Chỉ hiển thị người bệnh thuộc phân công còn hiệu lực của bạn. Lịch sử khám và bệnh án được giới hạn theo quyền trên từng lượt khám.</p>
    <form id="nurse-record-search" class="staff-toolbar" role="search" aria-label="Tra cứu hồ sơ"><label>Tên, số điện thoại hoặc CCCD<input type="search" name="q" maxlength="100" placeholder="Nhập thông tin người bệnh…" autocomplete="off" aria-controls="nurse-record-list"></label><button type="reset" class="secondary">Bỏ tìm kiếm</button></form>
    <p id="nurse-record-status" class="scope-note" role="status" hidden></p><div id="nurse-record-list"></div><div id="nurse-record-pages" class="list-pagination"></div>`)
    + '<section id="nurse-record-detail" class="panel" tabindex="-1" aria-label="Hồ sơ đang xem" hidden></section>';
  const search = $("#nurse-record-search"), detail = $("#nurse-record-detail");
  let active = true, listVersion = 0, detailVersion = 0, recordVersion = 0;
  let listRequest, detailRequest, recordRequest, selectedPatient = null, historyRows = [];

  function clearDetail() {
    detailVersion++; recordVersion++; detailRequest?.abort(); recordRequest?.abort();
    selectedPatient = null; historyRows = []; detail.hidden = true; detail.innerHTML = "";
  }
  function stop() {
    active = false; listVersion++; listRequest?.abort(); clearDetail();
    $("#page-body").replaceChildren(); $("#staff-dialog").close();
  }
  window.addEventListener("pagehide", stop, { once: true });
  window.addEventListener("neu:auth-change", stop, { once: true });

  async function load(page = 1) {
    const version = ++listVersion;
    listRequest?.abort(); listRequest = new AbortController(); clearDetail();
    const status = $("#nurse-record-status");
    status.hidden = false; status.textContent = "Đang tải hồ sơ…";
    $("#nurse-record-list").innerHTML = ""; $("#nurse-record-pages").innerHTML = "";
    try {
      const result = await listPatients({ q: search.elements.q.value.trim(), page, page_size: 12 }, { signal: listRequest.signal });
      if (!active || version !== listVersion) return;
      $("#nurse-record-list").innerHTML = result.items.length ? table(["Người bệnh", "Ngày sinh", "Giới tính", "Điện thoại", "Hồ sơ"], result.items.map(p => `<tr><td><strong>${esc(p.full_name)}</strong><small class="cell-subtitle">Mã hồ sơ #${esc(p.patient_id)}</small></td><td>${date(p.dob)}</td><td>${esc(p.gender || "—")}</td><td>${esc(p.phone || "—")}</td><td><button type="button" class="secondary" data-patient="${esc(p.patient_id)}">Xem hồ sơ</button></td></tr>`)) : empty("Chưa có hồ sơ phù hợp trong phạm vi được phân công.");
      pagination(result, load, $("#nurse-record-pages")); status.hidden = true;
    } catch (error) {
      if (!active || version !== listVersion) return;
      status.textContent = sessionError(error); status.hidden = false;
    }
  }

  async function showPatient(patientId, page = 1) {
    const version = ++detailVersion;
    recordVersion++; recordRequest?.abort(); detailRequest?.abort(); detailRequest = new AbortController();
    selectedPatient = null; historyRows = []; detail.hidden = false;
    detail.innerHTML = '<p role="status">Đang tải hồ sơ và lịch sử được phép xem…</p>';
    try {
      const [{ patient }, history] = await Promise.all([
        getPatient(patientId, { signal: detailRequest.signal }),
        listEncounters(patientId, { page, page_size: 10 }, { signal: detailRequest.signal }),
      ]);
      if (!active || version !== detailVersion) return;
      if (Number(patient.patient_id) !== Number(patientId) || history.items.some(e => Number(e.patient_id) !== Number(patientId))) throw new Error("Không nhận được hồ sơ hợp lệ của người bệnh đã chọn.");
      selectedPatient = patient; historyRows = history.items;
      detail.innerHTML = `<div class="section-heading"><div><p class="eyebrow">HỒ SƠ #${esc(patient.patient_id)} · CHỈ XEM</p><h2>${esc(patient.full_name)}</h2></div><button type="button" class="secondary" data-profile-close>Đóng hồ sơ</button></div>
        ${facts([["Ngày sinh", date(patient.dob)], ["Giới tính", patient.gender], ["Điện thoại", patient.phone], ["CCCD / mã định danh", patient.id_card], ["Địa chỉ", patient.address], ["BHYT", patient.health_insurance]])}
        <div class="nurse-record-history"><h3>Các lượt khám được phép xem</h3><p class="muted">Danh sách này chỉ gồm các lượt thuộc phạm vi phân công của bạn.</p>
        ${history.items.length ? table(["Ngày khám", "Bác sĩ / phòng", "Trạng thái", "Kết quả"], history.items.map(e => `<tr><td>${date(e.work_date)}<small class="cell-subtitle">Lượt #${esc(e.encounter_id)}</small></td><td>${esc(e.doctor_name || "—")}<small class="cell-subtitle">${esc(e.room_name || "—")}</small></td><td>${badge(e.encounter_status)}</td><td><button type="button" class="secondary" data-record="${esc(e.encounter_id)}">Xem bệnh án / đơn thuốc</button></td></tr>`)) : empty("Chưa có lượt khám được phép xem.")}
        <div id="nurse-history-pages" class="list-pagination"></div><p id="nurse-history-status" class="scope-note" role="status" hidden></p></div>`;
      pagination(history, next => showPatient(patientId, next), $("#nurse-history-pages"));
      detail.focus({ preventScroll: true });
      detail.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    } catch (error) {
      if (!active || version !== detailVersion) return;
      detail.innerHTML = `<p class="scope-note" role="status">${esc(sessionError(error))}</p><button type="button" class="secondary" data-profile-close>Đóng hồ sơ</button>`;
    }
  }

  $("#nurse-record-list").addEventListener("click", event => {
    const button = event.target.closest("[data-patient]");
    if (button && active) showPatient(button.dataset.patient);
  });
  detail.addEventListener("click", async event => {
    if (event.target.closest("[data-profile-close]")) { clearDetail(); return; }
    const button = event.target.closest("[data-record]");
    if (!button || !selectedPatient || !active) return;
    const row = historyRows.find(e => String(e.encounter_id) === button.dataset.record);
    if (!row) return;
    const version = ++recordVersion, patientId = selectedPatient.patient_id;
    recordRequest?.abort(); recordRequest = new AbortController();
    const status = $("#nurse-history-status"); status.hidden = false; status.textContent = "Đang tải bệnh án…";
    try {
      const { encounter } = await getEncounter(row.encounter_id, { signal: recordRequest.signal });
      if (!active || version !== recordVersion) return;
      if (Number(encounter.patient_id) !== Number(patientId)) throw new Error("Lượt khám không thuộc hồ sơ đang xem.");
      const clinical = await readMedicalRecord(encounter);
      if (!active || version !== recordVersion) return;
      dialog("Bệnh án & đơn thuốc · Chỉ xem", encounterSummary(encounter) + clinical); status.hidden = true;
    } catch (error) {
      if (active && version === recordVersion) { status.textContent = sessionError(error); status.hidden = false; }
    }
  });
  const refreshSearch = bindLiveSearch(search.elements.q, () => load(), { invalidate() {
    listVersion++; listRequest?.abort();
    if (!active) return;
    clearDetail();
    $("#nurse-record-list").innerHTML = ""; $("#nurse-record-pages").innerHTML = "";
    const status = $("#nurse-record-status"); status.hidden = false; status.textContent = "Đang tìm hồ sơ…";
  } });
  search.addEventListener("submit", event => { event.preventDefault(); refreshSearch(); });
  search.addEventListener("reset", event => { event.preventDefault(); search.elements.q.value = ""; refreshSearch(); });
  await load();
}
