import {startAutoRefresh} from "../core/auto_refresh.js";
import {sessionError} from "../core/staff_workspace.js";
import {canTransferEncounter,loadTransferOptions,transferReceptionEncounter,sameTransferSource,retainTransferTarget} from "../core/reception_coordination_data.js";
import { initDoctorCoordination } from "./reception_doctor_coordination.js";
import * as doctors from "../api/doctor.js";
import { code } from "../core/business_codes.js";
import * as encounters from "../api/encounter.js";
import * as patients from "../api/patient.js";
import { $, panel, esc, date, today, time, facts, dialog, submit, run, badge } from "../core/staff_ui.js";

const normalize = value => String(value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
async function collect(reader, params = {}, options = {}) {
  const rows = []; let result, page = 1;
  do { result = await reader({ ...params, page, page_size: 100 }, options); rows.push(...result.items); page++; }
  while (result.items.length && page <= Math.ceil(result.total / result.page_size));
  return rows;
}

export async function initReceptionCoordination() {
  $("#page-body").innerHTML = panel("Điều phối bệnh nhân", '<p id="coordination-status" role="status" hidden></p><div class="coordination-search-section"><div class="coordination-filter-row coordination-patient-filters"><label>Tìm kiếm<input id="coordination-patient-query" type="search" placeholder="Họ tên, số điện thoại, mã hồ sơ, mã lượt khám hoặc mã phiếu" aria-controls="coordination-patients"></label></div><div id="coordination-patients" class="coordination-choices" hidden></div></div><div class="coordination-search-section"><div class="coordination-filter-row coordination-target-filters"><label>Tìm kiếm<input id="coordination-room-query" type="search" placeholder="Tên bác sĩ, chuyên khoa hoặc phòng khám" aria-controls="coordination-rooms"></label><label>Chuyên khoa<input id="coordination-department" type="text" list="coordination-departments" placeholder="Tên chuyên khoa"><datalist id="coordination-departments"></datalist></label><label>Ngày khám<input id="coordination-visit-date" type="date"></label></div><div id="coordination-rooms" class="coordination-choices" hidden></div></div><div class="actions coordination-footer"><button class="primary" type="button" id="coordination-confirm" disabled>Xác nhận chuyển ca</button></div>');
  $("#coordination-visit-date").value = today();
  initDoctorCoordination();
  let version = 0;
  const lifecycle = new AbortController();
  let active = true;
  const stop = () => { active = false; lifecycle.abort(); dataRequest?.abort();version++;dataVersion++; };
  window.addEventListener("pagehide", stop, {once:true});
  window.addEventListener("neu:auth-change", stop, {once:true});
  let doctorProfiles=[],profileMap=new Map(),eligible=[],dataVersion=0,dataRequest,saving=false;
  let selectedVisit = null, selectedSchedule = null, schedules = [];
  const readOptions = (source,options={}) => loadTransferOptions(source.encounter_id,options);
  const departmentFor = row => row.department_name || doctorProfiles.find(doctor => String(doctor.doctor_profile_id) === String(row.doctor_profile_id))?.department_name || '';
  const confirm = $("#coordination-confirm");
  function updateConfirm() {
    confirm.textContent="Xác nhận chuyển ca";
    confirm.disabled=!(selectedVisit&&selectedSchedule&&schedules.some(row=>String(row.schedule_id)===String(selectedSchedule.schedule_id)&&row.slots?.length));
  }
  function clearSource(){selectedVisit=null;selectedSchedule=null;schedules=[];version++;confirm.disabled=true;}
  async function refreshData(){
    if(!active)return;
    const current=++dataVersion;dataRequest?.abort();dataRequest=new AbortController();
    const note=$('#coordination-status');let optionsVersion;
    try {
      const [visits,profiles,doctorRows]=await Promise.all([collect(encounters.listEncounters,{}, {signal:dataRequest.signal}),collect(patients.listPatients,{}, {signal:dataRequest.signal}),collect(doctors.listDoctors,{}, {signal:dataRequest.signal})]);
      if(!active||current!==dataVersion)return;
      doctorProfiles=doctorRows;profileMap=new Map(profiles.map(row=>[String(row.patient_id),row]));eligible=visits.filter(canTransferEncounter);
      $('#coordination-departments').innerHTML=[...new Set(doctorRows.map(row=>row.department_name).filter(Boolean))].map(name=>`<option value="${esc(name)}"></option>`).join('');
      const fresh=selectedVisit&&eligible.find(row=>String(row.encounter_id)===String(selectedVisit.encounter_id));
      if(!sameTransferSource(selectedVisit,fresh))clearSource();else selectedVisit=fresh;
      renderPatients();
      if(selectedVisit){
        const source=selectedVisit,target=selectedSchedule,token=++version;optionsVersion=token;
        const options=await readOptions(source,{signal:dataRequest.signal});
        if(!active||current!==dataVersion||token!==version)return;
        schedules=options;selectedSchedule=retainTransferTarget(target,options);
      }
      renderRooms();updateConfirm();note.hidden=true;note.textContent='';
    }catch(error){
      if(!active||current!==dataVersion||(optionsVersion!=null&&optionsVersion!==version))return;
      eligible=[];clearSource();renderPatients();renderRooms();note.hidden=false;note.dataset.error='true';note.textContent=sessionError(error);
    }
  }
  function renderPatients() {
    const words = normalize($("#coordination-patient-query").value).trim().split(/\s+/).filter(Boolean);
    const results = $("#coordination-patients");
    results.hidden = !words.length && !selectedVisit;
    if (results.hidden) { results.innerHTML = ""; return; }
    const matches = selectedVisit ? [selectedVisit] : eligible.filter(row => {
      const profile = profileMap.get(String(row.patient_id));
      // Deliberately exclude CCCD and email from this search index.
      const text = normalize([row.patient_name, profile?.full_name, profile?.phone, row.patient_phone, code("BN", row.patient_id), code("LK", row.encounter_id), row.ticket_code, row.work_date].join(" "));
      return words.every(word => text.includes(word));
    });
    $("#coordination-patients").innerHTML = matches.length ? matches.map(row => `<button type="button" class="coordination-choice${selectedVisit?.encounter_id === row.encounter_id ? " is-selected" : ""}" data-coordination-patient="${esc(row.encounter_id)}" aria-pressed="${selectedVisit?.encounter_id === row.encounter_id}"><span><strong>${esc(row.patient_name)}</strong><small>${esc(code("BN", row.patient_id))} · ${esc(profileMap.get(String(row.patient_id))?.phone || row.patient_phone || "Chưa có số điện thoại")}</small></span><span>${esc(code("LK", row.encounter_id))}<small>${esc(row.ticket_code || "—")}</small></span><span>${date(row.work_date)}<small>${esc(row.room_name || "—")}</small></span><span>${badge(row.encounter_status)}</span></button>`).join("") : '<p class="coordination-empty" role="status">Không có lượt khám phù hợp với từ khóa đã nhập.</p>';
  }
  function renderRooms() {
    const results = $("#coordination-rooms");
    const words = normalize($("#coordination-room-query").value).trim().split(/\s+/).filter(Boolean);
    const department = normalize($("#coordination-department").value.trim());
    results.hidden = !selectedVisit && !selectedSchedule;
    if (results.hidden) { results.innerHTML = ""; return; }
    const selectedDate = $("#coordination-visit-date").value;
    const matches = selectedSchedule ? [selectedSchedule] : schedules.filter(row => (!selectedDate || row.work_date === selectedDate) && (!department || normalize(departmentFor(row)).includes(department)) && words.every(word => normalize(`${row.doctor_name} ${row.department_name || ""} ${row.room_name}`).includes(word)));
    $("#coordination-rooms").innerHTML = matches.length ? matches.map(row => `<button type="button" class="coordination-choice${selectedSchedule?.schedule_id === row.schedule_id ? " is-selected" : ""}" data-coordination-schedule="${esc(row.schedule_id)}" aria-pressed="${selectedSchedule?.schedule_id === row.schedule_id}" ${row.slots?.length ? "" : "disabled"}><span><strong>${esc(row.doctor_name)}</strong><small>${esc(row.room_name)}</small></span><span>${date(row.work_date)}</span><span>${esc(row.start_time.slice(0, 5))} – ${esc(row.end_time.slice(0, 5))}</span><span>${row.slots?.length || 0} khung giờ còn trống</span></button>`).join("") : '<p class="coordination-empty" role="status">Không có ca khám phù hợp với tìm kiếm và ngày đã chọn.</p>';
  }
  $("#coordination-patient-query").addEventListener("input", () => {
    clearSource();
    renderPatients(); renderRooms();
  });
  $("#coordination-room-query").addEventListener("input", () => { selectedSchedule = null; confirm.disabled = true; renderRooms(); });
  $("#coordination-visit-date").addEventListener("change", () => { selectedSchedule=null;confirm.disabled=true;renderRooms(); });
  $("#coordination-department").addEventListener("input", () => { selectedSchedule = null; confirm.disabled = true; renderRooms(); });
  $("#coordination-patients").addEventListener("click", event => {
    const button = event.target.closest("[data-coordination-patient]"); if (!button) return;
    clearSource();
    selectedVisit = eligible.find(row => String(row.encounter_id) === button.dataset.coordinationPatient);
    if(!selectedVisit)return;
    schedules = []; updateConfirm(); renderPatients();
    const current = ++version, source = selectedVisit;
    renderRooms();
    void run(async () => {
      const result = await readOptions(source,{signal:lifecycle.signal});
      if (!active || current !== version) return;
      schedules = result;
      selectedSchedule=null;
      renderRooms();updateConfirm();
    });
  });
  $("#coordination-rooms").addEventListener("click", event => {
    const button = event.target.closest("[data-coordination-schedule]"); if (!button || button.disabled) return;
    const choice = schedules.find(row => String(row.schedule_id) === button.dataset.coordinationSchedule);
    if (!selectedVisit || !choice) return;
    selectedSchedule = choice;
    renderRooms(); updateConfirm();
  });
  confirm.addEventListener("click", () => {
    if (!selectedVisit || !selectedSchedule || confirm.disabled) return;
    const visit = selectedVisit, schedule = selectedSchedule;
    const patient = profileMap.get(String(visit.patient_id)) || {};
    const slot = schedule.slots[0];
    if (!slot) return;
    dialog("Xác nhận chuyển bác sĩ / ca", `<div class="reception-transfer-detail">${panel("Thông tin bệnh nhân", facts([["Họ tên", visit.patient_name], ["Mã hồ sơ", code("BN", visit.patient_id)], ["Số điện thoại", patient.phone || visit.patient_phone || "—"], ["Ngày sinh", patient.dob ? date(patient.dob) : "—"], ["Giới tính", patient.gender || "—"], ["Địa chỉ", patient.address || "—"]]))}${panel("Thông tin ca trước", facts([["Mã lượt khám", code("LK", visit.encounter_id)], ["Bác sĩ", visit.doctor_name || "—"], ["Phòng khám", visit.room_name || "—"], ["Ngày khám", date(visit.work_date)], ["Khung giờ", `${time(visit.estimated_exam_at)} – ${time(visit.appointment_end_at)}`]]))}<form id="transfer-form">${panel("Thông tin ca mới", facts([["Bác sĩ", schedule.doctor_name], ["Phòng khám", schedule.room_name], ["Ngày khám", date(schedule.work_date)], ["Giờ ca khám", `${schedule.start_time.slice(0, 5)} – ${schedule.end_time.slice(0, 5)}`]]))}<label>Khung giờ khám<select name="appointment_time" required>${schedule.slots.map(item => `<option value="${esc(item.appointment_time)}">${item.automatic ? "Tự động xếp giờ · " : ""}${time(item.starts_at)} – ${time(item.ends_at)}</option>`).join("")}</select></label><label class="transfer-reason">Lý do chuyển *<textarea name="reason" rows="3" maxlength="1000" required></textarea></label><div class="actions transfer-confirm-actions"><button type="submit">Xác nhận chuyển ca</button></div><p role="status" class="form-feedback"></p></form></div>`);
    $("#transfer-form").addEventListener("submit", event => {
      event.preventDefault(); const form = event.currentTarget;
      if(form.dataset.busy === "true")return;
      const fields = new FormData(form);
      const modal = $("#staff-dialog"), close = $("#staff-dialog-close");
      const protect = event => { if(form.dataset.busy === "true")event.preventDefault(); };
      modal.addEventListener("cancel",protect);
      saving=true;close.disabled = true;
      void submit(form, async () => {
        const updated = await transferReceptionEncounter(visit, schedule, fields.get("appointment_time"), fields.get("reason"), {signal:lifecycle.signal});
        if(!active)return;
        eligible = eligible.map(row => String(row.encounter_id) === String(visit.encounter_id) ? updated : row);
        selectedVisit = null; selectedSchedule = null; schedules = []; version++; confirm.disabled = true;
        renderPatients(); renderRooms(); modal.close();await refreshData();
        $("#page-status").textContent = "Đã chuyển bác sĩ / ca. Mã phiếu và phí khám được giữ nguyên.";
        $("#page-status").hidden = false;
      }, "Đã chuyển bác sĩ / ca.").finally(() => {saving=false;close.disabled = false; modal.removeEventListener("cancel",protect);});
    });
  });
  await refreshData();
  if(!active)return;
  startAutoRefresh(refreshData,{canRefresh:()=>active&&!saving});
  const initial = new URLSearchParams(location.search).get("encounter_id");
  if (initial && /^\d+$/.test(initial)) {
    $("#coordination-patient-query").value = code("LK", initial);
    renderPatients();
    $("#coordination-patients").querySelector(`[data-coordination-patient="${CSS.escape(initial)}"]`)?.click();
  }
}
