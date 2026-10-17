import { code } from "./business_codes.js";
import { listPatients, getPatient } from "../api/patient.js";
import { allPages, nurseEncounters, historyStatuses, localPage, attendance } from "./nurse_encounter_data.js";
import { getEncounter } from "../api/encounter.js";
import { readMedicalRecord } from "./staff_encounters.js";
import { sessionError } from "./staff_workspace.js";
import { bindLiveSearch } from "./live_search.js";
import { $, esc, date, facts, panel, empty, table, pagination, badge, dialog, encounterSummary } from "./staff_ui.js";

// All reads use the existing server-side nurse scope. There are no patient or clinical writes here.
export async function initNurseRecords() {
  $("#page-body").innerHTML = panel("Tra cứu hồ sơ", `
    <form id="nurse-record-search" class="staff-toolbar" role="search" aria-label="Tra cứu hồ sơ"><label>Tên, số điện thoại hoặc CCCD<input type="search" name="q" maxlength="100" placeholder="Nhập thông tin người bệnh…" autocomplete="off" aria-controls="nurse-record-list"></label><label>Trạng thái<select name="encounter_status"><option value="">Tất cả</option><option value="COMPLETED">Đã khám xong</option><option value="NO_SHOW">Không đến khám</option></select></label><button type="submit">Làm mới</button><button type="reset" class="secondary">Bỏ bộ lọc</button></form>
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
      const options = { signal: listRequest.signal };
      const state = search.elements.encounter_status.value;
      if (state && !historyStatuses.includes(state)) throw new Error("Trạng thái lọc không hợp lệ.");
      const [patients, visits] = await Promise.all([
        allPages((paging, request) => listPatients({ q: search.elements.q.value.trim(), include_archived: true, ...paging }, request), options),
        nurseEncounters(state ? [state] : historyStatuses, {}, options),
      ]);
      if (!active || version !== listVersion) return;
      const latest = new Map();
      for (const visit of visits.sort((a, b) => `${b.work_date}${b.estimated_exam_at || ""}`.localeCompare(`${a.work_date}${a.estimated_exam_at || ""}`) || b.encounter_id - a.encounter_id)) {
        if (!latest.has(String(visit.patient_id))) latest.set(String(visit.patient_id), visit);
      }
      const matching = patients.filter(p => latest.has(String(p.patient_id))).sort((a, b) =>
        `${latest.get(String(b.patient_id)).work_date}`.localeCompare(`${latest.get(String(a.patient_id)).work_date}`) || b.patient_id - a.patient_id);
      const result = localPage(matching, page);
      $("#nurse-record-list").innerHTML = result.items.length ? table(["Người bệnh", "Ngày sinh", "Điện thoại", "Lượt gần nhất", "Có mặt", "Hồ sơ"], result.items.map(p => {
        const last = latest.get(String(p.patient_id));
        return `<tr><td><strong>${esc(p.full_name)}</strong><small class="cell-subtitle">Mã hồ sơ ${esc(code("BN", p.patient_id))}</small></td><td>${date(p.dob)}</td><td>${esc(p.phone || "—")}</td><td>${date(last.work_date)}<small class="cell-subtitle">${badge(last.encounter_status)}</small></td><td>${attendance(last)}</td><td><button type="button" class="secondary" data-patient="${esc(p.patient_id)}">Xem hồ sơ</button></td></tr>`;
      })) : empty("Chưa có người bệnh đã khám xong hoặc không đến khám phù hợp.");
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
        nurseEncounters(historyStatuses, { patient_id: patientId }, { signal: detailRequest.signal }),
      ]);
      if (!active || version !== detailVersion) return;
      if (Number(patient.patient_id) !== Number(patientId) || history.some(e => Number(e.patient_id) !== Number(patientId))) throw new Error("Không nhận được hồ sơ hợp lệ của người bệnh đã chọn.");
      history.sort((a, b) => `${b.work_date}${b.estimated_exam_at || ""}`.localeCompare(`${a.work_date}${a.estimated_exam_at || ""}`) || b.encounter_id - a.encounter_id);
      const historyPage = localPage(history, page, 10);
      selectedPatient = patient; historyRows = historyPage.items;
      detail.innerHTML = `<div class="section-heading"><div><p class="eyebrow">HỒ SƠ ${esc(code("BN", patient.patient_id))} · CHỈ XEM</p><h2>${esc(patient.full_name)}</h2></div><button type="button" class="secondary" data-profile-close>Đóng hồ sơ</button></div>
        ${facts([["Ngày sinh", date(patient.dob)], ["Giới tính", patient.gender], ["Điện thoại", patient.phone], ["CCCD / mã định danh", patient.id_card], ["Địa chỉ", patient.address], ["BHYT", patient.health_insurance]])}
        <div class="nurse-record-history"><h3>Các lượt đã khám xong hoặc không đến</h3>
        ${historyPage.items.length ? table(["Ngày khám", "Bác sĩ / phòng", "Trạng thái", "Có mặt", "Kết quả"], historyPage.items.map(e => `<tr><td>${date(e.work_date)}<small class="cell-subtitle">Lượt ${esc(code("LK", e.encounter_id))}</small></td><td>${esc(e.doctor_name || "—")}<small class="cell-subtitle">${esc(e.room_name || "—")}</small></td><td>${badge(e.encounter_status)}</td><td>${attendance(e)}</td><td><button type="button" class="secondary" data-record="${esc(e.encounter_id)}">${e.encounter_status === "COMPLETED" ? "Xem bệnh án / đơn thuốc" : "Xem lượt khám"}</button></td></tr>`)) : empty("Chưa có lượt đã khám xong hoặc không đến được phép xem.")}
        <div id="nurse-history-pages" class="list-pagination"></div><p id="nurse-history-status" class="scope-note" role="status" hidden></p></div>`;
      pagination(historyPage, next => showPatient(patientId, next), $("#nurse-history-pages"));
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
      if (!historyStatuses.includes(encounter.encounter_status)) throw new Error("Lượt khám không còn thuộc danh sách hồ sơ đã kết thúc.");
      const clinical = encounter.encounter_status === "COMPLETED" ? await readMedicalRecord(encounter) : '<p class="scope-note">Người bệnh không đến khám.</p>';
      if (!active || version !== recordVersion) return;
      dialog(encounter.encounter_status === "COMPLETED" ? "Bệnh án & đơn thuốc · Chỉ xem" : "Lượt không đến khám", encounterSummary(encounter) + clinical); status.hidden = true;
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
  search.elements.encounter_status.addEventListener("change", () => refreshSearch());
  search.addEventListener("reset", event => { event.preventDefault(); search.elements.q.value = ""; search.elements.encounter_status.value = ""; refreshSearch(); });
  await load();
}
