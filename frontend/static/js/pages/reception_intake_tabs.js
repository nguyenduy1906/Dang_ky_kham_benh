import {canCheckIn} from '../core/encounter_policy.js';
import {getEncounter} from '../api/encounter.js';
import {initEncounterList} from '../core/staff_encounters.js';
import {readReceptionPatient} from '../core/reception_patient_search.js';
import {checkInReception} from '../core/reception_intake_data.js';
import {startAutoRefresh} from '../core/auto_refresh.js';
import {loadDirectIntakePage} from '../core/reception_registration_data.js';
import {patientDetails} from '../core/admin_patient_detail.js';
import {code} from '../core/business_codes.js';
import {bindLiveSearch} from '../core/live_search.js';
import {$,esc,date,today,time,badge,statusOptions,panel,table,pagination,dialog,run} from '../core/staff_ui.js';

export async function initReceptionIntakeTabs(){
  const params=new URLSearchParams(location.search);
  const linkedId=params.get('encounter_id');
  let linked;
  if(/^[1-9]\d*$/.test(linkedId||''))linked=(await getEncounter(linkedId)).encounter;
  $('#page-body').innerHTML=`<div class="reception-intake-tabs" role="tablist" aria-label="Hình thức tiếp nhận"><button id="intake-direct-tab" type="button" role="tab" aria-controls="intake-direct" aria-selected="false" tabindex="-1">Trực tiếp</button><button id="intake-online-tab" type="button" role="tab" aria-controls="intake-online" aria-selected="true">Trực tuyến</button></div><section id="intake-direct" role="tabpanel" aria-labelledby="intake-direct-tab" hidden></section><section id="intake-online" role="tabpanel" aria-labelledby="intake-online-tab"><div id="reception-encounters"></div></section>`;
  const tabs=[$('#intake-direct-tab'),$('#intake-online-tab')];
  const online=await initEncounterList({role:'reception',target:'#reception-encounters',encounterType:'ONLINE',initialEncounter:linked?.encounter_type==='ONLINE'?linked:null});
  let direct,ready;
  async function select(index){
    tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});
    $('#intake-direct').hidden=index!==0;$('#intake-online').hidden=index!==1;
    if(index===0){ready??=initDirectList(linked).then(value=>direct=value);await ready;}
  }
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>void select(index));
    tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?1:1-index;tabs[next].focus();void select(next);});
  });
  if(linked?.encounter_type==='WALK_IN'||params.get('mode')==='direct')await select(0);
  return {refresh:async()=>{await online.refresh();if(direct)await direct.refresh();}};
}
async function initDirectList(linked){
  $('#intake-direct').innerHTML=panel('Danh sách bệnh nhân trực tiếp',`<form id="direct-patient-filters" class="staff-toolbar"><label>Tìm kiếm<input id="direct-patient-query" type="search" placeholder="Tên người bệnh, mã hồ sơ, số điện thoại hoặc CCCD"></label><label>Ngày khám<input id="direct-patient-date" type="date" value="${today()}"></label><label>Trạng thái<select id="direct-patient-status">${statusOptions().replace('<option value="">Tất cả trạng thái</option>','<option value="">Tất cả trạng thái</option><option value="UNREGISTERED">Chưa đăng ký</option>')}</select></label></form><div id="direct-patient-list" role="status"></div><div id="direct-patient-pagination" class="list-pagination"></div>`,'<button type="button" class="secondary" id="direct-patient-refresh">Làm mới</button>');
  if(linked?.encounter_type==='WALK_IN'){
    $('#direct-patient-date').value=linked.work_date;
    $('#direct-patient-query').value=code('LK',linked.encounter_id);
  }
  let active=true,version=0,request,currentPage=1,registrations=new Map();
  const stop=()=>{active=false;version++;request?.abort();};window.addEventListener('pagehide',stop,{once:true});window.addEventListener('neu:auth-change',stop,{once:true});
  async function load(page=1){
    currentPage=page;const token=++version;request?.abort();request=new AbortController();
    $('#direct-patient-list').textContent='Đang tải danh sách bệnh nhân…';
    try{
      const result=await loadDirectIntakePage({q:$('#direct-patient-query').value,work_date:$('#direct-patient-date').value,status:$('#direct-patient-status').value},page,10,{signal:request.signal});
      if(!active||token!==version)return;currentPage=result.page;
      const rows=result.items;registrations=result.registrations;
      $('#direct-patient-list').innerHTML=table(['Người bệnh / phiếu khám','Khung giờ','Phòng / bác sĩ','Trạng thái','Thao tác'],rows.map(p=>{
        const visit=p.visit;
        return `<tr><td><strong>${esc(p.full_name)}</strong><small class="cell-subtitle">${esc(code('BN',p.patient_id))} · ${esc(p.phone||'Chưa có số điện thoại')}</small>${visit?`<small class="cell-subtitle">${esc(code('LK',visit.encounter_id))} · ${esc(visit.ticket_code||'Chưa phát phiếu')}</small>`:''}</td><td class="direct-empty-cell">${visit?`${date(visit.work_date)}<small class="cell-subtitle">${time(visit.estimated_exam_at)} – ${time(visit.appointment_end_at)}</small>`:'—'}</td><td>${visit?`${esc(visit.room_name||'—')}<small class="cell-subtitle">${esc(visit.doctor_name||'—')}</small>`:'—'}</td><td class="direct-empty-cell">${visit?badge(visit.encounter_status):'<span class="badge direct-unregistered">Chưa đăng ký</span>'}</td><td><div class="actions"><button type="button" class="secondary" data-direct-detail="${esc(p.patient_id)}">Chi tiết</button>${visit?.encounter_status==='HOLDING'?`<a class="button-link secondary" href="payment.html?patient_id=${encodeURIComponent(p.patient_id)}&encounter_id=${encodeURIComponent(visit.encounter_id)}">Thanh toán</a>`:''}${visit&&canCheckIn(visit)?`<button type="button" data-direct-checkin="${esc(visit.encounter_id)}">Check-in</button>`:''}<a class="button-link secondary" href="booking.html?patient_id=${encodeURIComponent(p.patient_id)}">Đăng ký khám</a></div></td></tr>`;
      }));      pagination(result,load,$('#direct-patient-pagination'));
    }catch(error){if(!active||token!==version||error.code==='CLIENT_ABORTED')return;$('#direct-patient-list').textContent=error.message||'Không tải được danh sách bệnh nhân.';$('#direct-patient-pagination').innerHTML='';}
  }
  $('#direct-patient-list').addEventListener('click',event=>{
    const check=event.target.closest('[data-direct-checkin]');
    if(check){
      const visit=registrations.get(String(check.dataset.directCheckin));if(!visit)return;
      dialog('Xác nhận check-in',`<p>Chỉ xác nhận khi người bệnh đã đến viện.</p><p><strong>${esc(visit.patient_name)}</strong> · ${esc(code('LK',visit.encounter_id))}</p><div class="actions"><button class="primary" type="button" id="direct-confirm-checkin">Xác nhận đã đến</button></div><p id="direct-checkin-status" role="status"></p>`);
      $('#direct-confirm-checkin').onclick=async()=>{const button=$('#direct-confirm-checkin');if(button.disabled)return;button.disabled=true;try{await checkInReception(visit.encounter_id);if(!active)return;$('#staff-dialog').close();await load(currentPage);}catch(error){$('#direct-checkin-status').textContent=error.message;}finally{button.disabled=false;}};return;
    }
    const button=event.target.closest('[data-direct-detail]');if(!button)return;
    const token=version;void run(async()=>{const patient=await readReceptionPatient(button.dataset.directDetail);if(!active||token!==version)return;dialog('Thông tin bệnh nhân',patientDetails(patient,{showRelatives:false,showAccountStatus:false}));});
  });
  const search=bindLiveSearch($('#direct-patient-query'),()=>load(),{invalidate(){version++;request?.abort();}});
  $('#direct-patient-filters').addEventListener('submit',event=>{event.preventDefault();search();});
  $('#direct-patient-date').addEventListener('change',()=>void load());
  $('#direct-patient-status').addEventListener('change',()=>{const unregistered=$('#direct-patient-status').value==='UNREGISTERED';$('#direct-patient-date').disabled=unregistered;$('#direct-patient-date').title=unregistered?'Không áp dụng ngày khám cho người chưa đăng ký.':'';void load();});
  $('#direct-patient-date').addEventListener('input',()=>void load());
  $('#direct-patient-refresh').addEventListener('click',()=>void load(currentPage));
  await load();startAutoRefresh(()=>load(currentPage),{canRefresh:()=>active&&!$('#intake-direct').hidden});return {refresh:()=>load(currentPage)};
}
