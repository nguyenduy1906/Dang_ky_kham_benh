import { code } from "./business_codes.js";
import { getEncounter } from "../api/encounter.js";
import { getPatient } from "../api/patient.js";
import { readMedicalRecord } from "./staff_encounters.js";
import { sessionError } from "./staff_workspace.js";
import { activeStatuses, nurseEncounters, localPage, shiftEnd, attendance, normalizeSearch } from "./nurse_encounter_data.js";
import { $, esc, date, time, facts, panel, empty, table, pagination, badge, dialog, encounterSummary } from "./staff_ui.js";

export async function initNursePatients({ assignments }) {
  const requested = new URLSearchParams(location.search).get("schedule_id") || "";
  const selected = assignments.some(a => String(a.schedule_id) === requested) ? requested : "";
  const shifts = [...assignments].sort((a, b) => `${a.work_date}${a.start_time}`.localeCompare(`${b.work_date}${b.start_time}`));
  $("#page-body").innerHTML = panel("Người bệnh trong ca", `
    <form id="nurse-visit-filters" class="staff-toolbar">
      <label>Phạm vi ca<select name="period"><option value="upcoming" ${!selected ? "selected" : ""}>Ca hiện tại và sắp tới</option><option value="past">Ca trước chưa xử lý</option><option value="all" ${selected ? "selected" : ""}>Tất cả ca được phân công</option></select></label>
      <label>Ngày khám<input type="date" name="work_date"></label>
      <label>Ca được phân công<select name="schedule_id"><option value="">Tất cả ca</option>${shifts.map(a => `<option value="${esc(a.schedule_id)}" ${String(a.schedule_id) === selected ? "selected" : ""}>${date(a.work_date)} · ${esc(a.start_time.slice(0, 5))}–${esc(a.end_time.slice(0, 5))} · ${esc(a.room_name)}</option>`).join("")}</select></label>
      <label>Trạng thái<select name="encounter_status"><option value="">Tất cả</option><option value="CONFIRMED">Sắp khám</option><option value="CHECKED_IN">Chờ khám</option><option value="IN_PROGRESS">Đang khám</option></select></label>
      <button type="submit">Làm mới</button><button type="reset" class="secondary">Bỏ bộ lọc</button>
    </form>
    <label>Tìm người bệnh hoặc mã phiếu<input id="nurse-visit-search" type="search" maxlength="100" placeholder="Họ tên, mã phiếu hoặc mã lượt khám" autocomplete="off"></label>
    <p id="nurse-visit-status" role="status" hidden></p><div id="nurse-visit-list"></div><div id="nurse-visit-pages" class="list-pagination"></div>`);
  const form = $("#nurse-visit-filters"), search = $("#nurse-visit-search"), status = $("#nurse-visit-status");
  let active = true, version = 0, detailVersion = 0, request, detailRequest, rows = [];
  const assigned = new Set(assignments.map(a => String(a.schedule_id)));
  function stop() {
    active = false; version++; detailVersion++; request?.abort(); detailRequest?.abort(); rows = [];
    $("#page-body").replaceChildren(); $("#staff-dialog").close();
  }
  window.addEventListener("pagehide", stop, { once: true });
  window.addEventListener("neu:auth-change", stop, { once: true });

  function render(next = 1) {
    const q = normalizeSearch(search.value.trim()), now = Date.now(), period = form.elements.period.value;
    const matches = rows.filter(e => assigned.has(String(e.schedule_id))
      && (period === "all" || (period === "past" ? shiftEnd(e) < now : shiftEnd(e) >= now || e.encounter_status === "IN_PROGRESS"))
      && normalizeSearch(`${e.patient_name} ${e.ticket_code || ""} ${code("LK",e.encounter_id)} ${code("BN",e.patient_id)}`).includes(q));
    matches.sort((a, b) => `${a.work_date}${a.estimated_exam_at || a.start_time}`.localeCompare(`${b.work_date}${b.estimated_exam_at || b.start_time}`) || a.encounter_id - b.encounter_id);
    const result = localPage(matches, next); 
    $("#nurse-visit-list").innerHTML = result.items.length ? table(["Người bệnh / phiếu khám", "Ngày / giờ khám", "Phòng / bác sĩ", "Trạng thái", "Có mặt", "Thao tác"], result.items.map(e => `<tr>
      <td><strong>${esc(e.patient_name)}</strong><small class="cell-subtitle">${esc(e.ticket_code || `Lượt ${code("LK", e.encounter_id)}`)}</small></td>
      <td>${date(e.work_date)}<small class="cell-subtitle">${time(e.estimated_exam_at)} – ${time(e.appointment_end_at)}</small></td>
      <td>${esc(e.room_name)}<small class="cell-subtitle">${esc(e.doctor_name)}</small></td>
      <td>${badge(e.encounter_status)}</td><td>${attendance(e)}</td>
      <td><div class="actions"><button type="button" class="secondary" data-visit="${esc(e.encounter_id)}">Xem chi tiết</button></div></td></tr>`)) : empty("Không có người bệnh phù hợp với bộ lọc.");
    pagination(result, render, $("#nurse-visit-pages"));
  }
  async function load() {
    const current = ++version; request?.abort(); request = new AbortController();
    detailVersion++; detailRequest?.abort(); $("#staff-dialog").close(); rows = [];
    $("#nurse-visit-list").innerHTML = ""; $("#nurse-visit-pages").innerHTML = "";
    status.hidden = false; status.textContent = "Đang tải danh sách khám…"; status.dataset.error = "false";
    try {
      const filter = { work_date: form.elements.work_date.value, schedule_id: form.elements.schedule_id.value };
      if (filter.schedule_id && !assigned.has(filter.schedule_id)) throw new Error("Ca khám không thuộc phân công của bạn.");
      const state = form.elements.encounter_status.value;
      if (state && !activeStatuses.includes(state)) throw new Error("Trạng thái lọc không hợp lệ.");
      const items = await nurseEncounters(state ? [state] : activeStatuses, filter, { signal: request.signal });
      if (!active || current !== version) return;
      rows = items; render(); status.hidden = true;
    } catch (error) {
      if (active && current === version) { status.textContent = sessionError(error); status.dataset.error = "true"; }
    }
  }
  $("#nurse-visit-list").addEventListener("click", async event => {
    const button = event.target.closest("[data-visit]");
    if (!button || !active) return;
    const row = rows.find(e => String(e.encounter_id) === button.dataset.visit);
    if (!row || !assigned.has(String(row.schedule_id))) return;
    const current = ++detailVersion; detailRequest?.abort(); detailRequest = new AbortController();
    status.hidden = false; status.textContent = "Đang tải thông tin…"; status.dataset.error = "false";
    try {
      const { encounter } = await getEncounter(row.encounter_id, { signal: detailRequest.signal });
      if (!active || current !== detailVersion) return;
      if (String(encounter.patient_id) !== String(row.patient_id) || !assigned.has(String(encounter.schedule_id))) throw new Error("Lượt khám không thuộc người bệnh hoặc ca đang xem.");
      const { patient } = await getPatient(encounter.patient_id, { signal: detailRequest.signal });
      if (!active || current !== detailVersion) return;
      if (String(patient.patient_id) !== String(encounter.patient_id)) throw new Error("Hồ sơ trả về không thuộc người bệnh đã chọn.");
      const clinical = encounter.encounter_status === "IN_PROGRESS" ? await readMedicalRecord(encounter) : "";
      if (!active || current !== detailVersion) return;
      dialog("Chi tiết lượt khám", encounterSummary(encounter) + panel("Thông tin người bệnh", facts([["Ngày sinh", date(patient.dob)], ["Giới tính", patient.gender], ["Điện thoại", patient.phone], ["BHYT", patient.health_insurance]])) + clinical);
      status.hidden = true;
    } catch (error) {
      if (active && current === detailVersion) { status.textContent = sessionError(error); status.dataset.error = "true"; }
    }
  });
  form.addEventListener("submit", event => { event.preventDefault(); load(); });
  form.addEventListener("change", () => load());
  form.addEventListener("reset", event => {
    event.preventDefault(); form.elements.period.value = "upcoming";
    for (const key of ["work_date", "schedule_id", "encounter_status"]) form.elements[key].value = "";
    search.value = ""; load();
  });
  search.addEventListener("input", () => { if (active) render(); });
  await load();
}
