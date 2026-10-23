import { initDoctorCoordination } from "./reception_doctor_coordination.js";
import * as doctors from "../api/doctor.js";
import { code } from "../core/business_codes.js";
import * as encounters from "../api/encounter.js";
import * as patients from "../api/patient.js";
import { $, panel, esc, date, time, facts, dialog, submit, run, badge } from "../core/staff_ui.js";

const normalize = value => String(value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
async function collect(reader, params = {}) {
  const rows = []; let result, page = 1;
  do { result = await reader({ ...params, page, page_size: 100 }); rows.push(...result.items); page++; }
  while (result.items.length && rows.length < result.total);
  return rows;
}

export async function initReceptionCoordination() {
  $("#page-body").innerHTML = panel("Điều phối bệnh nhân", '<div class="coordination-search-section"><div class="coordination-filter-row"><label>Tìm bệnh nhân<input id="coordination-patient-query" type="search" placeholder="Họ tên, số điện thoại, mã hồ sơ, mã lượt khám hoặc mã phiếu" aria-controls="coordination-patients"></label><label>Ngày khám<input id="coordination-visit-date" type="date"></label></div><div id="coordination-patients" class="coordination-choices" hidden></div></div><div class="coordination-search-section"><div class="coordination-filter-row"><label>Tìm bác sĩ, phòng khám<input id="coordination-room-query" type="search" placeholder="Tên bác sĩ, chuyên khoa hoặc phòng khám" aria-controls="coordination-rooms"></label><label>Chuyên khoa<input id="coordination-department" type="text" list="coordination-departments" placeholder="Nhập hoặc chọn chuyên khoa"><datalist id="coordination-departments"></datalist></label></div><div id="coordination-rooms" class="coordination-choices" hidden></div></div><div class="actions coordination-footer"><button type="button" id="coordination-confirm" disabled>Xác nhận chuyển ca</button></div>');
  initDoctorCoordination();
  const [visits, profiles, doctorProfiles] = await Promise.all([collect(encounters.listEncounters), collect(patients.listPatients), collect(doctors.listDoctors)]);
  $("#coordination-departments").innerHTML = [...new Set(doctorProfiles.map(row => row.department_name).filter(Boolean))].map(name => `<option value="${esc(name)}"></option>`).join("");
  const departmentFor = row => row.department_name || doctorProfiles.find(doctor => String(doctor.doctor_profile_id) === String(row.doctor_profile_id) || normalize(doctor.full_name) === normalize(String(row.doctor_name || "").replace(/^BS\.?\s*/i, "")))?.department_name || "";
  const profileMap = new Map(profiles.map(row => [String(row.patient_id), row]));
  const eligible = visits.filter(row => ["CONFIRMED", "CHECKED_IN"].includes(row.encounter_status) && row.payment_confirmed === true);
  let selectedVisit = null, selectedSchedule = null, schedules = [], version = 0;
  const confirm = $("#coordination-confirm");
  function renderPatients() {
    const words = normalize($("#coordination-patient-query").value).trim().split(/\s+/).filter(Boolean);
    const results = $("#coordination-patients");
    const selectedDate = $("#coordination-visit-date").value;
    results.hidden = !words.length && !selectedDate;
    if (results.hidden) { results.innerHTML = ""; return; }
    const matches = eligible.filter(row => {
      const profile = profileMap.get(String(row.patient_id));
      // Deliberately exclude CCCD and email from this search index.
      const text = normalize([row.patient_name, profile?.full_name, profile?.phone, row.patient_phone, code("BN", row.patient_id), code("LK", row.encounter_id), row.ticket_code, row.work_date].join(" "));
      return (!selectedDate || row.work_date === selectedDate) && words.every(word => text.includes(word));
    });
    $("#coordination-patients").innerHTML = matches.length ? matches.slice(0, 3).map(row => `<button type="button" class="coordination-choice${selectedVisit?.encounter_id === row.encounter_id ? " is-selected" : ""}" data-coordination-patient="${esc(row.encounter_id)}" aria-pressed="${selectedVisit?.encounter_id === row.encounter_id}"><span><strong>${esc(row.patient_name)}</strong><small>${esc(code("BN", row.patient_id))} · ${esc(profileMap.get(String(row.patient_id))?.phone || row.patient_phone || "Chưa có số điện thoại")}</small></span><span>${esc(code("LK", row.encounter_id))}<small>${esc(row.ticket_code || "—")}</small></span><span>${date(row.work_date)}<small>${esc(row.room_name || "—")}</small></span><span>${badge(row.encounter_status)}</span></button>`).join("") : '<p class="scope-note">Không tìm thấy lượt khám phù hợp để điều phối.</p>';
  }
  function renderRooms() {
    const results = $("#coordination-rooms");
    const words = normalize($("#coordination-room-query").value).trim().split(/\s+/).filter(Boolean);
    const department = normalize($("#coordination-department").value.trim());
    results.hidden = !selectedVisit || (!words.length && !department);
    if (results.hidden) { results.innerHTML = ""; return; }
    const selectedDate = $("#coordination-visit-date").value;
    const matches = schedules.filter(row => (!selectedDate || row.work_date === selectedDate) && (!department || normalize(departmentFor(row)).includes(department)) && words.every(word => normalize(`${row.doctor_name} ${row.department_name || ""} ${row.room_name}`).includes(word)));
    $("#coordination-rooms").innerHTML = matches.length ? matches.slice(0, 3).map(row => `<button type="button" class="coordination-choice${selectedSchedule?.schedule_id === row.schedule_id ? " is-selected" : ""}" data-coordination-schedule="${esc(row.schedule_id)}" aria-pressed="${selectedSchedule?.schedule_id === row.schedule_id}" ${row.slots?.length ? "" : "disabled"}><span><strong>${esc(row.doctor_name)}</strong><small>${esc(row.room_name)}</small></span><span>${date(row.work_date)}</span><span>${esc(row.start_time.slice(0, 5))} – ${esc(row.end_time.slice(0, 5))}</span><span>${row.slots?.length || 0} khung giờ còn trống</span></button>`).join("") : '<p class="scope-note">Không có ca chuyển phù hợp với tìm kiếm.</p>';
  }
  $("#coordination-patient-query").addEventListener("input", () => {
    selectedVisit = null; selectedSchedule = null; schedules = []; version++; confirm.disabled = true;
    renderPatients(); renderRooms();
  });
  $("#coordination-room-query").addEventListener("input", () => { selectedSchedule = null; confirm.disabled = true; renderRooms(); });
  $("#coordination-visit-date").addEventListener("change", () => { selectedVisit = null; selectedSchedule = null; schedules = []; version++; confirm.disabled = true; renderPatients(); renderRooms(); });
  $("#coordination-department").addEventListener("input", () => { selectedSchedule = null; confirm.disabled = true; renderRooms(); });
  $("#coordination-patients").addEventListener("click", event => {
    const button = event.target.closest("[data-coordination-patient]"); if (!button) return;
    selectedVisit = eligible.find(row => String(row.encounter_id) === button.dataset.coordinationPatient);
    selectedSchedule = null; schedules = []; confirm.disabled = true; renderPatients();
    const current = ++version, id = selectedVisit.encounter_id;
    renderRooms();
    void run(async () => {
      const result = await collect(params => encounters.getTransferOptions(id, params));
      if (current !== version) return;
      schedules = result; renderRooms();
    });
  });
  $("#coordination-rooms").addEventListener("click", event => {
    const button = event.target.closest("[data-coordination-schedule]"); if (!button || button.disabled) return;
    selectedSchedule = schedules.find(row => String(row.schedule_id) === button.dataset.coordinationSchedule);
    renderRooms(); confirm.disabled = !(selectedVisit && selectedSchedule);
  });
  confirm.addEventListener("click", () => {
    if (!selectedVisit || !selectedSchedule) return;
    const visit = selectedVisit, schedule = selectedSchedule;
    const patient = profileMap.get(String(visit.patient_id)) || {};
    const slot = schedule.slots[0];
    if (!slot) return;
    dialog("Xác nhận chuyển bác sĩ / ca", `<div class="reception-transfer-detail">${panel("Thông tin bệnh nhân", facts([["Họ tên", visit.patient_name], ["Mã hồ sơ", code("BN", visit.patient_id)], ["Số điện thoại", patient.phone || visit.patient_phone || "—"], ["Ngày sinh", patient.dob ? date(patient.dob) : "—"], ["Giới tính", patient.gender || "—"], ["Địa chỉ", patient.address || "—"]]))}${panel("Thông tin ca trước", facts([["Mã lượt khám", code("LK", visit.encounter_id)], ["Bác sĩ", visit.doctor_name || "—"], ["Phòng khám", visit.room_name || "—"], ["Ngày khám", date(visit.work_date)], ["Khung giờ", `${time(visit.estimated_exam_at)} – ${time(visit.appointment_end_at)}`]]))}<form id="transfer-form">${panel("Thông tin ca mới", facts([["Bác sĩ", schedule.doctor_name], ["Phòng khám", schedule.room_name], ["Ngày khám", date(schedule.work_date)], ["Giờ ca khám", `${schedule.start_time.slice(0, 5)} – ${schedule.end_time.slice(0, 5)}`], ["Khung giờ khám", `${time(slot.starts_at)} – ${time(slot.ends_at)}`]]))}<input type="hidden" name="appointment_time" value="${esc(slot.appointment_time)}"><label class="transfer-reason">Lý do chuyển *<textarea name="reason" rows="3" maxlength="1000" required></textarea></label><div class="actions transfer-confirm-actions"><button type="submit">Xác nhận chuyển ca</button></div><p role="status" class="form-feedback"></p></form></div>`);
    $("#transfer-form").addEventListener("submit", event => {
      event.preventDefault(); const form = event.currentTarget;
      submit(form, async () => { await encounters.transfer(visit.encounter_id, { ...Object.fromEntries(new FormData(form)), schedule_id: schedule.schedule_id }); $("#staff-dialog").close(); location.reload(); }, "Đã chuyển bác sĩ / ca.");
    });
  });
  renderPatients();
  const initial = new URLSearchParams(location.search).get("encounter_id");
  if (initial && /^\d+$/.test(initial)) {
    $("#coordination-patient-query").value = code("LK", initial);
    renderPatients();
    $("#coordination-patients").querySelector(`[data-coordination-patient="${CSS.escape(initial)}"]`)?.click();
  }
}
