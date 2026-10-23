import { staffReady } from "../core/staff_workspace.js";
import { $, panel, table, esc, today, date, facts, dialog, bindDialog, pagination, badge } from "../core/staff_ui.js";
import {sessionError} from "../core/staff_workspace.js";
import {code} from "../core/business_codes.js";
import {bindLiveSearch} from "../core/live_search.js";
import {startAutoRefresh} from "../core/auto_refresh.js";
import {encounterSummary} from "../core/staff_ui.js";
import {loadReceptionDoctorSchedules,filterReceptionDoctorSchedules,readReceptionDoctorSchedule,canReceiveInSchedule,searchSchedulePatients,receiveSchedulePatient} from "../core/reception_doctor_schedule_data.js";

const toView = row => ({...row,id:String(row.schedule_id),doctor:String(row.doctor_name||'').replace(/^BS\.?\s*/i,''),department:row.department_name||'',room:row.room_name||'',day:row.work_date,count:row.booked_count,capacity:row.max_quota,shift:String(row.start_time)<'12:00'?'Ca sáng':'Ca chiều',hours:`${String(row.start_time||'').slice(0,5)} – ${String(row.end_time||'').slice(0,5)}`});
export async function initReceptionDoctorSchedule() {
  let rows=[],active=true,version=0,request,detailVersion=0,detailRequest,patientRequest,saving=false;
  $("#page-body").innerHTML = panel("Danh sách lịch khám bác sĩ", '<form id="doctor-schedule-filter" class="staff-toolbar" role="search" aria-label="Tra cứu lịch khám bác sĩ"><label>Tên bác sĩ, chuyên khoa hoặc phòng khám<input type="search" name="q" placeholder="Nhập thông tin để tìm lịch khám"></label><label>Chuyên khoa<input type="text" name="department" list="reception-schedule-departments" placeholder="Nhập hoặc chọn chuyên khoa" autocomplete="off"><datalist id="reception-schedule-departments"></datalist></label><label>Ngày khám<input type="date" name="work_date"></label></form><div id="doctor-schedule-list"></div><div id="list-pagination" class="list-pagination"></div>');
  const form = $("#doctor-schedule-filter");
  form.elements.work_date.value = today();
  const feedback=$('#page-status'),modal=$('#staff-dialog');
  const closeDetail=()=>{detailVersion++;detailRequest?.abort();patientRequest?.abort();};
  const stop=()=>{active=false;version++;request?.abort();closeDetail();};
  window.addEventListener('pagehide',stop,{once:true});
  window.addEventListener('neu:auth-change',()=>{stop();modal.close();$('#page-body').innerHTML='';$('#staff-dialog-content').innerHTML='';},{once:true});
  modal.addEventListener('close',closeDetail);
  modal.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
  async function load() {
    if(!active)return;
    request?.abort();request=new AbortController();const current=++version;
    rows=[];$('#doctor-schedule-list').innerHTML='';$('#list-pagination').innerHTML='';
    feedback.hidden=false;feedback.textContent='Đang tải lịch khám bác sĩ…';feedback.dataset.error='false';
    $('#doctor-schedule-list').setAttribute('aria-busy','true');
    try {
      const result=await loadReceptionDoctorSchedules(form.elements.work_date.value,{signal:request.signal});
      if(!active||current!==version)return;
      rows=result.rows.map(toView);$('#reception-schedule-departments').innerHTML=result.departments.map(name=>`<option value="${esc(name)}"></option>`).join('');
      feedback.hidden=true;feedback.textContent='';render();
    } catch(error) {if(active&&current===version){feedback.textContent=sessionError(error);feedback.dataset.error='true';}}
    finally {if(active&&current===version)$('#doctor-schedule-list').setAttribute('aria-busy','false');}
  }
  const normalize = value => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
  function render(page = 1) {
    if(!active)return;
    const matches = filterReceptionDoctorSchedules(rows,{q:form.elements.q.value,department:form.elements.department.value,work_date:form.elements.work_date.value});
    const current = Math.min(page, Math.max(1, Math.ceil(matches.length / 10)));
    $("#doctor-schedule-list").innerHTML = table(["Bác sĩ / chuyên khoa", "Ngày khám", "Ca / giờ khám", "Số lượng", "Phòng khám", "Thao tác"], matches.slice((current - 1) * 10, current * 10).map(row => `<tr><td><strong>BS. ${esc(row.doctor)}</strong><small class="cell-subtitle">${esc(row.department)}</small></td><td>${date(row.day)}</td><td><strong>${esc(row.shift)}</strong><small class="cell-subtitle">${esc(row.hours)}</small>${badge(row.schedule_status)}</td><td><span class="reception-schedule-count">${row.count} / ${row.capacity}</span></td><td>${esc(row.room)}</td><td><div class="reception-schedule-actions"><button type="button" class="secondary" data-schedule-detail="${esc(row.id)}">Xem chi tiết</button><button type="button" class="secondary" data-schedule-add="${esc(row.id)}">Thêm bệnh nhân</button></div></td></tr>`));
    pagination({ total: matches.length, page: current, page_size: 10 }, render);
    $('#doctor-schedule-list').querySelectorAll('[data-schedule-add]').forEach(button=>{button.disabled=!canReceiveInSchedule(rows.find(row=>row.id===button.dataset.scheduleAdd));});
  }
  form.addEventListener("input", event => {if(event.target.name!=='work_date')render();});
  form.addEventListener("change", event => {if(event.target.name==='work_date'){closeDetail();void load();}else render();});
  form.addEventListener("submit", event => { event.preventDefault();void load(); });
  $("#doctor-schedule-list").addEventListener("click", async event => {
    const button = event.target.closest("[data-schedule-detail], [data-schedule-add]");
    if (!active || !button || button.disabled) return;
    let row = rows.find(item => item.id === (button.dataset.scheduleDetail || button.dataset.scheduleAdd));
    if (!row) return;
    closeDetail();detailRequest=new AbortController();const current=detailVersion,options={signal:detailRequest.signal};
    dialog('Chi tiết lịch khám bác sĩ','<p role="status">Đang tải chi tiết ca khám…</p>');
    try {
    row=toView(await readReceptionDoctorSchedule(row,options));
    if(!active || current!==detailVersion)return;
    if (button.hasAttribute("data-schedule-add")) {
      if(!canReceiveInSchedule(row))throw new Error('Ca đã kết thúc hoặc ngừng tiếp nhận. Vui lòng chọn ca khác.');
      dialog("Thêm bệnh nhân vào ca khám", `<div class="reception-schedule-detail">${panel("Ca khám đã chọn", facts([["Bác sĩ", `BS. ${row.doctor}`], ["Ngày khám", date(row.day)], ["Ca / giờ khám", `${row.shift} · ${row.hours}`], ["Phòng khám", row.room], ["Số lượng", `${row.count} / ${row.capacity}`]]))}<section class="panel reception-patient-picker"><label>Tìm bệnh nhân<input type="search" id="schedule-patient-search" placeholder="Nhập họ tên, mã hồ sơ hoặc số điện thoại" aria-controls="schedule-patient-results"></label><div id="schedule-patient-results" class="reception-patient-results" aria-label="Kết quả tìm bệnh nhân"></div></section><div class="actions"><button type="button" class="secondary" data-schedule-cancel>Hủy</button><button type="button" disabled>Thêm bệnh nhân</button></div></div>`);
      let patients = [],patientVersion=0;
      const search = $("#schedule-patient-search"), results = $("#schedule-patient-results");
      let selected = "";
      const confirm=$('#staff-dialog-content .actions > button:last-child');
      results.insertAdjacentHTML('afterend','<p id="schedule-patient-feedback" class="scope-note" role="status"></p>');
      const note=$('#schedule-patient-feedback');
      function renderPatients() {
        const query = normalize(search.value.trim());
        const matches = patients.filter(patient => normalize(`${patient.name} ${patient.id} ${patient.phone}`).includes(query));
        results.innerHTML = matches.length ? matches.map(patient => `<button type="button" class="reception-patient-choice${selected === patient.id ? " is-selected" : ""}" data-pick-patient="${esc(patient.id)}" aria-pressed="${selected === patient.id}"><strong>${esc(patient.name)}</strong><span>${esc(patient.id)} · ${date(patient.dob)}</span><span>Điện thoại: ${esc(patient.phone)}</span></button>`).join("") : '<p class="scope-note">Không tìm thấy bệnh nhân phù hợp.</p>';
      }
      async function findPatients() {
        patientRequest?.abort();patientRequest=new AbortController();const next=++patientVersion;
        selected='';confirm.disabled=true;note.textContent='Đang tìm hồ sơ…';
        try {
          const profiles=await searchSchedulePatients(search.value,{signal:patientRequest.signal});
          if(!active||current!==detailVersion||next!==patientVersion)return;
          patients=profiles.map(p=>({...p,id:code('BN',p.patient_id),name:p.full_name}));renderPatients();note.textContent='';
        } catch(error) {if(active&&current===detailVersion&&next===patientVersion){patients=[];renderPatients();note.textContent=sessionError(error);}}
      }
      bindLiveSearch(search,findPatients,{invalidate(){patientVersion++;patientRequest?.abort();selected='';confirm.disabled=true;results.innerHTML='';}});
      results.addEventListener("click", event => {
        const choice = event.target.closest("[data-pick-patient]");
        if (!choice || saving) return;
        selected = choice.dataset.pickPatient;
        confirm.disabled=false;
        renderPatients();
        results.querySelector(`[data-pick-patient="${selected}"]`)?.focus();
      });
      $("#staff-dialog-content [data-schedule-cancel]").addEventListener("click", () => {if(!saving)modal.close();});
      confirm.addEventListener('click',async()=>{
        const patient=patients.find(p=>p.id===selected);if(!active||saving||!patient)return;
        const detail=$('#staff-dialog-content .reception-schedule-detail');
        saving=true;detail.dataset.busy='true';confirm.disabled=true;search.disabled=true;$('#staff-dialog-close').disabled=true;note.textContent='Đang tiếp nhận và phát phiếu…';
        try {
          const encounter=await receiveSchedulePatient(row,patient.patient_id,options);
          if(!active||current!==detailVersion)return;
          dialog('Đã tiếp nhận và phát phiếu',`<div class="staff-confirm">${encounterSummary(encounter)}<a href="walk_in.html?schedule_id=${encodeURIComponent(encounter.schedule_id)}&work_date=${encodeURIComponent(encounter.work_date)}">Xem lượt khám trong ca →</a></div>`);
          await load();
        } catch(error) {if(active&&current===detailVersion){note.textContent=sessionError(error);confirm.disabled=false;}}
        finally {saving=false;detail.dataset.busy='false';search.disabled=false;$('#staff-dialog-close').disabled=false;}
      });
      await findPatients();
      return;
    }
    dialog("Chi tiết lịch khám bác sĩ", `<div class="reception-schedule-detail"><div class="reception-checkin-heading"><div><span>LỊCH KHÁM BÁC SĨ</span><h3>BS. ${esc(row.doctor)}</h3><p>${esc(row.department)}</p></div><div class="reception-checkin-time"><span>${esc(row.shift)}</span><strong>${esc(row.hours)}</strong><small>${date(row.day)}</small></div></div>${panel("Thông tin ca khám", facts([["Bác sĩ", `BS. ${row.doctor}`], ["Chuyên khoa", row.department], ["Ngày khám", date(row.day)], ["Ca khám", row.shift], ["Giờ khám", row.hours], ["Phòng khám", row.room], ["Số lượng", `${row.count} / ${row.capacity}`]]))}</div>`);
    } catch(error) {if(active&&current===detailVersion)dialog('Chi tiết lịch khám bác sĩ',`<p role="status">${esc(sessionError(error))}</p>`);}
  });
  await load();
  startAutoRefresh(load,{canRefresh:()=>active&&!saving});
}

if (await staffReady) {bindDialog();await initReceptionDoctorSchedule();}
