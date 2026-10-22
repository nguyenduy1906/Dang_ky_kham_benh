import { doctorEncounterStatuses as registeredEncounterStatuses } from "./doctor_encounter_list.js";
import { recordDetailView } from "./record_detail_view.js";
import { startAutoRefresh } from "./auto_refresh.js";
import { code } from "./business_codes.js";
import { listPatients, getPatient } from "../api/patient.js";
import { allPages, nurseEncounters, historyStatuses, localPage, nurseRange, nurseFormRange, recentNursePatients } from "./nurse_encounter_data.js";
import { nurseRecordTable } from "./nurse_tables.js";
import { getEncounter } from "../api/encounter.js";
import { listDoctorPatientHistory,getDoctorPatientHistory } from "../api/medical_record.js";
import { readMedicalRecord,medicalRecordMarkup } from "./staff_encounters.js";
import { sessionError } from "./staff_workspace.js";
import { bindLiveSearch } from "./live_search.js";
import { $, esc, date, facts, panel, empty, table, pagination, badge, dialog, time, money } from "./staff_ui.js";

// Shared read-only records screen. Existing endpoints enforce the signed-in staff role and encounter scope; no patient or clinical writes.
export async function initNurseRecords() {
  const initialRange = nurseRange();
  const doctorView = document.body?.dataset?.role === "doctor";
  const recordStatuses = historyStatuses.filter(status => registeredEncounterStatuses.includes(status));
  $("#page-body").innerHTML = panel("Tra cứu hồ sơ", `
    <form id="nurse-record-search" class="staff-toolbar" role="search" aria-label="Tra cứu hồ sơ"><label>Tên, số điện thoại hoặc CCCD<input type="search" name="q" maxlength="100" placeholder="Nhập thông tin người bệnh…" autocomplete="off" aria-controls="nurse-record-list"></label><label>Trạng thái<select name="encounter_status"><option value="">Tất cả</option><option value="COMPLETED">Đã khám xong</option><option value="NO_SHOW">Không đến khám</option></select></label><label>Từ ngày<input type="date" name="from_date" value="${esc(initialRange?.from || "")}"></label><label>Đến ngày<input type="date" name="to_date" value="${esc(initialRange?.to || "")}"></label></form>
    <p id="nurse-record-status" class="scope-note" role="status" hidden></p><div id="nurse-record-list"></div><div id="nurse-record-pages" class="list-pagination"></div>`)
    + '<section id="nurse-record-detail" class="panel" tabindex="-1" aria-label="Hồ sơ đang xem" hidden></section>';
  const search = $("#nurse-record-search"), detail = $("#nurse-record-detail");
  if (initialRange) {
    search.elements.from_date.value = initialRange.from;
    search.elements.to_date.value = initialRange.to;
  }
  let matchingPatients = [];
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

  let currentPage = 1, historyPageNumber = 1;
  async function load(page = 1) {
    currentPage = page;
    const version = ++listVersion;
    matchingPatients = [];
    listRequest?.abort(); listRequest = new AbortController(); clearDetail();
    const status = $("#nurse-record-status");
    status.hidden = false; status.textContent = "Đang tải hồ sơ…";
    $("#nurse-record-list").innerHTML = ""; $("#nurse-record-pages").innerHTML = "";
    try {
      const range = nurseFormRange(search);
      const options = { signal: listRequest.signal };
      const state = search.elements.encounter_status.value;
      if (state && !recordStatuses.includes(state)) throw new Error("Trạng thái lọc không hợp lệ.");
      const [patients, visits] = await Promise.all([
        allPages((paging, request) => listPatients({ q: search.elements.q.value.trim(), include_archived: true, ...paging }, request), options),
        nurseEncounters(state ? [state] : recordStatuses, range?.from && range.from === range.to ? { work_date: range.from } : {}, options),
      ]);
      if (!active || version !== listVersion) return;
      const { items: matching, latest } = recentNursePatients(patients, visits.filter(v=>v.payment_confirmed===true), range);
      matchingPatients = matching;
      const result = localPage(matching, page);
      $("#nurse-record-list").innerHTML = nurseRecordTable(result.items, latest);
      pagination(result, load, $("#nurse-record-pages")); status.hidden = true;
    } catch (error) {
      if (!active || version !== listVersion) return;
      status.textContent = sessionError(error); status.hidden = false;
    }
  }

  async function showPatient(patientId, page = 1, silent = false) {
    historyPageNumber = page;
    const version = ++detailVersion;
    recordVersion++; recordRequest?.abort(); detailRequest?.abort(); detailRequest = new AbortController();
    if (!silent) {
      selectedPatient = null; historyRows = []; detail.hidden = false;
      detail.innerHTML = '<p role="status">Đang tải hồ sơ và lịch sử được phép xem…</p>';
    }
    try {
      const [{ patient }, history] = await Promise.all([
        getPatient(patientId, { signal: detailRequest.signal }),
        doctorView ? allPages((paging,request)=>listDoctorPatientHistory(patientId,paging,request), {signal:detailRequest.signal}) : nurseEncounters(recordStatuses, { patient_id: patientId }, { signal: detailRequest.signal }),
      ]);
      if (!active || version !== detailVersion) return;
      if (Number(patient.patient_id) !== Number(patientId) || history.some(e => Number(e.patient_id) !== Number(patientId))) throw new Error("Không nhận được hồ sơ hợp lệ của người bệnh đã chọn.");
      history.sort((a, b) => `${b.work_date}${b.estimated_exam_at || ""}`.localeCompare(`${a.work_date}${a.estimated_exam_at || ""}`) || b.encounter_id - a.encounter_id);
      const historyPage = localPage(history, page, 10);
      selectedPatient = patient; historyRows = historyPage.items;
      detail.innerHTML = `<div class="section-heading"><div><p class="eyebrow">HỒ SƠ ${esc(code("BN", patient.patient_id))} · CHỈ XEM</p><h2>${esc(patient.full_name)}</h2></div><button type="button" class="secondary" data-profile-close>Đóng hồ sơ</button></div>
        ${facts([["Ngày sinh", date(patient.dob)], ["Giới tính", patient.gender], ["Điện thoại", patient.phone], ["CCCD / mã định danh", patient.id_card], ["Địa chỉ", patient.address], ["BHYT", patient.health_insurance]])}
        <div class="nurse-record-history"><h3>Các lượt đã khám xong hoặc không đến</h3>
        ${historyPage.items.length ? table(["Ngày khám", "Bác sĩ / phòng", "Trạng thái", "Kết quả"], historyPage.items.map(e => `<tr><td>${date(e.work_date)}<small class="cell-subtitle">Lượt ${esc(code("LK", e.encounter_id))}</small></td><td>${esc(e.doctor_name || "—")}<small class="cell-subtitle">${esc(e.room_name || "—")}</small></td><td>${badge(e.encounter_status)}</td><td><button type="button" class="secondary" data-record="${esc(e.encounter_id)}">${e.encounter_status === "COMPLETED" ? "Xem bệnh án / đơn thuốc" : "Xem lượt khám"}</button></td></tr>`)) : empty("Chưa có lượt đã khám xong hoặc không đến được phép xem.")}
        <div id="nurse-history-pages" class="list-pagination"></div><p id="nurse-history-status" class="scope-note" role="status" hidden></p></div>`;
      pagination(historyPage, next => showPatient(patientId, next), $("#nurse-history-pages"));
      if (!silent) {
        detail.focus({ preventScroll: true });
        detail.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      }
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
      const historyDetail = doctorView ? await getDoctorPatientHistory(patientId,row.encounter_id,{signal:recordRequest.signal}) : await getEncounter(row.encounter_id,{signal:recordRequest.signal});
      const {encounter} = historyDetail;
      if (!active || version !== recordVersion) return;
      if (Number(encounter.patient_id) !== Number(patientId)) throw new Error("Lượt khám không thuộc hồ sơ đang xem.");
      if (!recordStatuses.includes(encounter.encounter_status)) throw new Error("Lượt khám không còn thuộc danh sách hồ sơ đã kết thúc.");
      const clinical = encounter.encounter_status === "COMPLETED" ? (doctorView ? medicalRecordMarkup(historyDetail.medical_record,historyDetail.items) : await readMedicalRecord(encounter)) : '<p class="scope-note">Người bệnh không đến khám.</p>';
      if (!active || version !== recordVersion) return;
      dialog(encounter.encounter_status === "COMPLETED" ? "Bệnh án & đơn thuốc · Chỉ xem" : "Lượt không đến khám", recordDetailView({
        name:selectedPatient.full_name,patientCode:code("BN",selectedPatient.patient_id),status:encounter.encounter_status,
        patientFields:[["Ngày sinh",date(selectedPatient.dob)],["Giới tính",selectedPatient.gender],["Điện thoại",selectedPatient.phone],["CCCD / mã định danh",selectedPatient.id_card],["Địa chỉ",selectedPatient.address],["BHYT",selectedPatient.health_insurance]],
        visitFields:[["Mã lượt khám",code("LK",encounter.encounter_id)],["Mã phiếu",encounter.ticket_code],["Ngày khám",date(encounter.work_date)],["Khung giờ",`${time(encounter.estimated_exam_at)} – ${time(encounter.appointment_end_at)}`],["Bác sĩ",encounter.doctor_name],["Chuyên khoa",encounter.department_name],["Phòng",encounter.room_name],["Hình thức",encounter.encounter_type === "ONLINE" ? "Đặt trực tuyến" : "Khám trực tiếp"],["Phí khám",encounter.consultation_fee_snapshot == null ? "Chưa cập nhật" : money(encounter.consultation_fee_snapshot)]],
        symptoms:encounter.symptoms,clinical,
      })); status.hidden = true;
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
  for (const key of ["from_date", "to_date"]) search.elements[key]?.addEventListener("change", () => refreshSearch());
  search.addEventListener("reset", event => { event.preventDefault(); for (const key of ["q", "encounter_status", "from_date", "to_date"]) if (search.elements[key]) search.elements[key].value = ""; refreshSearch(); });
  await load();
  const patientId = new URLSearchParams(globalThis.location?.search || "").get("patient_id");
  if (patientId && matchingPatients.some(p => String(p.patient_id) === patientId)) await showPatient(patientId);
  startAutoRefresh(() => selectedPatient ? showPatient(selectedPatient.patient_id, historyPageNumber, true) : load(currentPage), { canRefresh: () => active });
}
