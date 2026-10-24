import './date_inputs.js';
import './table_layout.js';
import {today,esc,panel,allPages,table,facts,date,stamp,options,createAdminContext} from './admin_ui.js';
import {bulkAssignmentMarkup} from './admin_bulk_assignment.js';
import {listUsers} from '../api/auth.js';
import {openAdminFormDialog} from './admin_form_dialog.js';
import {listAdminLeaveRequests} from '../api/staff_leave.js';
import * as api from '../api/reception_assignment.js';
import {code} from './business_codes.js';
import {bindLiveSearch} from './live_search.js';
import {bindScheduleSuggestions} from './admin_schedule_choices.js';
import {startAutoRefresh} from './auto_refresh.js';
import {receptionShiftRows,receptionShiftBlocked,saveReceptionAssignmentBatch} from './reception_assignment_data.js';

const period=row=>String(row.start_time)<'12:00'?'Ca sáng':'Ca chiều';
const hours=row=>`${String(row.start_time).slice(0,5)} – ${String(row.end_time).slice(0,5)}`;
const state=row=>`<span class="badge ${row.revoked_at?'assignment-revoked':'green'}">${row.revoked_at?'Thu hồi':'Đang phân công'}</span>`;
const staffLabel=row=>`${row.full_name} (${code('TK',row.user_id)})`;
const stationLabel=row=>row.name;
const eligible=row=>!row.revoked_at&&Date.parse(`${row.work_date}T${row.start_time}+07:00`)>Date.now();
const normalized=value=>String(value).normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[đĐ]/g,'d').toLowerCase();

export async function initReceptionAssignmentPresentation() {
  const ctx=createAdminContext(),body=document.querySelector('#page-body'),header=document.querySelector('#page-header');
  const modal=document.querySelector('#admin-dialog'),modalBody=document.querySelector('#admin-dialog-body'),close=document.querySelector('#dialog-close');
  header.insertAdjacentHTML('afterend','<p id="admin-status" role="status" class="scope-note" hidden></p>');
  header.insertAdjacentHTML('beforeend','<button type="button" id="add-reception-assignment">＋ Phân công lễ tân</button>');
  const add=document.querySelector('#add-reception-assignment');
  const root=new AbortController();let active=true,viewVersion=0,detailVersion=0,read,busy=false,inList=true,page=1;
  let staff=[],stations=[],filters={q:'',work_date:today()},bulkDispose=()=>{};
  const stop=()=>{active=false;viewVersion++;detailVersion++;root.abort();read?.abort();bulkDispose();};
  window.addEventListener('pagehide',stop,{once:true});window.addEventListener('neu:auth-change',stop,{once:true});
  modal.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  modal.addEventListener('close',()=>{detailVersion++;});
  const current=()=>active&&ctx.active;
  function protect(value){busy=value;modal.setAttribute('aria-busy',String(value));close.disabled=value;}
  async function catalogs(signal=root.signal){
    const [people,places]=await Promise.all([allPages(listUsers,{role:'RECEPTIONIST',account_status:'ACTIVE',approval_status:'APPROVED'},signal),api.listReceptionWorkstations({}, {signal})]);
    if(!current())return;
    staff=people.filter(row=>row.role_name==='RECEPTIONIST'&&!row.is_deleted&&row.account_status==='ACTIVE'&&row.approval_status==='APPROVED');stations=places.items;
  }
  function pager(result){
    const total=Math.max(1,Math.ceil(result.total/result.page_size));
    document.querySelector('#admin-pager').innerHTML=`<div class="admin-pagination"><span>${result.total} bản ghi · Trang ${result.page}/${total}</span><div class="actions"><button type="button" class="secondary" data-page="${result.page-1}" ${result.page<=1?'disabled':''}>Trang trước</button><button type="button" class="secondary" data-page="${result.page+1}" ${result.page>=total?'disabled':''}>Trang sau</button></div></div>`;
  }
  async function loadList(next=page){
    if(!current()||!inList||busy)return;page=next;
    document.querySelector('#admin-results').innerHTML='';document.querySelector('#admin-pager').innerHTML='';
    await ctx.load(signal=>api.listReceptionAssignments({...filters,include_revoked:true,page,page_size:10},{signal}),result=>{
      if(!inList)return;
      if(page>1&&!result.items.length&&result.total<(page-1)*10+1){void loadList(Math.max(1,Math.ceil(result.total/10)));return;}
      document.querySelector('#admin-results').innerHTML=table(['Mã','Lễ tân','Ca làm việc','Khu vực','Ngày','Thời gian','Trạng thái','Thao tác'],result.items.map(row=>[
        esc(code('PC',row.assignment_id)),esc(row.receptionist_name),period(row),esc(row.workstation_name),date(row.work_date),esc(hours(row)),state(row),`<div class="admin-row-actions"><button type="button" class="row-action" data-detail="${row.assignment_id}">Chi tiết</button>${eligible(row)?`<button type="button" class="row-action" data-edit="${row.assignment_id}">Chỉnh sửa</button>`:''}</div>`]));
      pager(result);
    });
  }
  async function list(){
    if(!current())return;bulkDispose();viewVersion++;read?.abort();inList=true;add.hidden=false;body.classList.add('admin-assignments-list');
    body.innerHTML=panel('Danh sách phân công lễ tân',`<form id="resource-filter" class="admin-toolbar" role="search"><label>Tìm kiếm<input type="search" name="q" value="${esc(filters.q)}" placeholder="Tên, mã lễ tân hoặc khu vực"></label><label>Ngày làm việc<input type="date" name="work_date" value="${esc(filters.work_date)}"></label></form><div id="admin-results"></div><div id="admin-pager"></div>`);
    const form=body.querySelector('form');
    const search=bindLiveSearch(form.elements.q,()=>{filters.q=form.elements.q.value;void loadList(1);},{invalidate(){ctx.cancelLoad();document.querySelector('#admin-results').innerHTML='';document.querySelector('#admin-pager').innerHTML='';}});
    form.addEventListener('submit',event=>{event.preventDefault();search();});
    form.elements.work_date.addEventListener('change',()=>{filters.work_date=form.elements.work_date.value;void loadList(1);});
    document.querySelector('#admin-pager').addEventListener('click',event=>{const button=event.target.closest('[data-page]');if(button&&!button.disabled)void loadList(Number(button.dataset.page));});
    document.querySelector('#admin-results').addEventListener('click',event=>{const button=event.target.closest('[data-detail],[data-edit]');if(button)void openAssignment(button.dataset.detail||button.dataset.edit,Boolean(button.dataset.edit));});
    await loadList();
  }
  function detail(row,history){
    const section=(title,entries)=>`<section class="admin-basic-detail-section"><h3>${esc(title)}</h3>${facts(entries)}</section>`;
    return `<div class="admin-basic-detail"><div class="admin-basic-detail-summary"><div><small>${esc(code('PC',row.assignment_id))}</small><h3>${esc(row.receptionist_name)}</h3></div>${state(row)}</div>${section('Ca làm việc', [['Ngày',date(row.work_date)],['Ca',period(row)],['Thời gian',hours(row)],['Khu vực',row.workstation_name]])}<section class="admin-basic-detail-section"><h3>Ghi chú phân công</h3><p class="admin-basic-detail-note">${esc(row.note||'Chưa có ghi chú.')}</p></section>${section('Thông tin phân công',[['Người phân công',row.assigned_by_name],['Ngày phân công',stamp(row.assigned_at)]])}${row.revoked_at?section('Thông tin thu hồi',[['Ngày thu hồi',stamp(row.revoked_at)],['Người thu hồi',row.revoked_by_name],['Lý do',row.revoke_reason]]):''}<section class="admin-basic-detail-section"><h3>Lịch sử thay đổi</h3>${table(['Thời gian','Thao tác','Người thực hiện'],history.map(item=>[stamp(item.changed_at),esc(({created:'Phân công',updated:'Cập nhật',revoked:'Thu hồi'})[item.action]||item.action),esc(item.actor_name)]))}</section>${eligible(row)?`<div class="actions"><button type="button" data-detail-edit="${row.assignment_id}">Chỉnh sửa</button><button type="button" class="secondary" data-detail-revoke="${row.assignment_id}">Thu hồi phân công</button></div>`:''}</div>`;
  }
  async function openAssignment(id,edit=false){
    const token=++detailVersion;let row;
    await ctx.show(edit?'Chỉnh sửa phân công lễ tân':'Chi tiết phân công lễ tân',async signal=>{
      const result=await api.getReceptionAssignment(id,{signal});row=result.assignment;
      if(String(row?.assignment_id)!==String(id))throw new Error('Phân công trả về không khớp.');
      if(!edit)return detail(row,result.history);
      if(!eligible(row))throw new Error('Phân công đã bắt đầu hoặc đã thu hồi, chỉ được xem.');
      await catalogs(signal);
      const people=[...staff],places=[...stations];
      if(!people.some(p=>String(p.user_id)===String(row.receptionist_id)))people.push({user_id:row.receptionist_id,full_name:row.receptionist_name});
      if(!places.some(p=>String(p.workstation_id)===String(row.workstation_id)))places.push({workstation_id:row.workstation_id,name:row.workstation_name,area:row.area});
      return `<form id="reception-assignment-edit"><div class="admin-contact-fields"><label>Lễ tân<select name="receptionist_id" required>${options(people.map(p=>[p.user_id,staffLabel(p)]),row.receptionist_id,'Chọn lễ tân')}</select></label><label>Khu vực *<input name="area_name" list="reception-edit-areas" required maxlength="100" value="${esc(row.workstation_name)}"><datalist id="reception-edit-areas">${places.map(p=>`<option value="${esc(p.name)}"></option>`).join('')}</datalist></label><label>Ngày làm việc<input type="date" name="work_date" required min="${today()}" value="${esc(row.work_date)}"></label><label>Ca làm việc<select name="period"><option value="MORNING" ${period(row)==='Ca sáng'?'selected':''}>Ca sáng · 08:00 – 11:30</option><option value="AFTERNOON" ${period(row)==='Ca chiều'?'selected':''}>Ca chiều · 13:30 – 17:00</option></select></label></div><label>Ghi chú<textarea name="note" rows="3" maxlength="1000">${esc(row.note||'')}</textarea></label><div class="actions"><button type="button" class="secondary" data-cancel>Hủy</button><button type="submit">Lưu thay đổi</button></div><p role="status"></p></form>`;
    });
    if(!current()||token!==detailVersion||!row)return;
    if(!edit){
      modalBody.querySelector('[data-detail-edit]')?.addEventListener('click',()=>void openAssignment(id,true));
      modalBody.querySelector('[data-detail-revoke]')?.addEventListener('click',()=>void revoke(row));return;
    }
    const form=modalBody.querySelector('form');if(!form)return;
    form.querySelector('[data-cancel]').addEventListener('click',()=>modal.close());
    form.addEventListener('submit',event=>{
      event.preventDefault();if(busy||!form.reportValidity())return;
      const fields=Object.fromEntries(new FormData(form)),times=fields.period==='MORNING'?['08:00','11:30']:['13:30','17:00'];
      protect(true);form.inert=true;
      void ctx.submit(form,signal=>api.updateReceptionAssignment(id,{receptionist_id:Number(fields.receptionist_id),area_name:fields.area_name.trim(),work_date:fields.work_date,start_time:times[0],end_time:times[1],note:fields.note.trim()||null,expected_version:row.version},{signal}),async result=>{
        if(String(result.assignment?.assignment_id)!==String(id))throw new Error('Phản hồi chưa khớp. Tải lại để kiểm tra.');
        protect(false);modal.close();await list();
      }).finally(()=>{protect(false);form.inert=false;});
    });
  }
  async function revoke(row){
    const token=++detailVersion;
    await ctx.show('Thu hồi phân công lễ tân',async()=>`<div class="admin-basic-detail">${facts([['Lễ tân',row.receptionist_name],['Khu vực',row.workstation_name],['Ngày',date(row.work_date)],['Ca',hours(row)]])}<form id="reception-revoke"><label>Lý do thu hồi *<textarea name="reason" required maxlength="1000" rows="3"></textarea></label><div class="actions"><button type="button" class="secondary" data-cancel>Hủy</button><button type="submit">Xác nhận thu hồi</button></div><p role="status"></p></form></div>`);
    if(!current()||token!==detailVersion)return;
    const form=modalBody.querySelector('form');form.querySelector('[data-cancel]').addEventListener('click',()=>modal.close());
    form.addEventListener('submit',event=>{event.preventDefault();if(busy||!form.reportValidity())return;const reason=form.elements.reason.value.trim();protect(true);form.inert=true;
      void ctx.submit(form,signal=>api.revokeReceptionAssignment(row.assignment_id,{reason,expected_version:row.version},{signal}),async result=>{if(!result.assignment?.revoked_at||String(result.assignment.assignment_id)!==String(row.assignment_id))throw new Error('Phản hồi thu hồi chưa khớp.');protect(false);modal.close();await list();}).finally(()=>{protect(false);form.inert=false;});
    });
  }
  async function bulk(){
    if(busy)return;ctx.cancelLoad();bulkDispose();const token=++viewVersion;inList=false;
    const formDialog=openAdminFormDialog({title:'Phân công lễ tân',trigger:add,canClose:()=>!busy,onClose:()=>{bulkDispose();inList=true;void loadList();}});
    const body=document.createElement('section');body.className='admin-bulk-assignment admin-schedule-builder admin-assignment-builder admin-reception-assignment-builder';formDialog.content.append(body);
    const controller=new AbortController();read?.abort();let disposed=false,choices=[],assignments=[],leaves=[],selected=new Set(),checkVersion=0,ready=false;
    bulkDispose=()=>{disposed=true;checkVersion++;controller.abort();read?.abort();};
    body.innerHTML=bulkAssignmentMarkup().replaceAll('Y tá','Lễ tân').replaceAll('y tá','lễ tân').replaceAll('Phòng khám','Khu vực').replaceAll('phòng khám','khu vực');
    const form=body.querySelector('form'),feedback=body.querySelector('[data-bulk-feedback]'),save=body.querySelector('[data-bulk-save]');
    form.elements.to_date.value=new Date(Date.parse(form.elements.from_date.value)+30*86400000).toISOString().slice(0,10);
    form.elements.department.closest('label').remove();
    form.elements.room.placeholder='Sảnh A, Sảnh B, Sảnh C';form.elements.room.maxLength=100;form.elements.room.required=true;
    const find=selector=>body.querySelector(selector),valid=()=>current()&&!disposed&&token===viewVersion;
    const person=()=>staff.find(p=>staffLabel(p)===form.elements.nurse.value.trim());
    const station=()=>{const name=form.elements.room.value.trim();return stations.find(p=>normalized(p.name)===normalized(name))||(name&&name.length<=100?{area_name:name,name}:null);};
    const blocked=row=>receptionShiftBlocked(row,person(),station(),assignments,leaves);
    const selectedRows=()=>choices.filter(row=>selected.has(row.key)&&!blocked(row));
    function render(){
      if(!valid())return;
      find('[data-bulk-results]').innerHTML=table(['Chọn','Ngày','Ca làm việc','Thời gian','Khu vực','Trạng thái'],choices.map(row=>{const reason=blocked(row);return [`<input type="checkbox" data-shift-key="${row.key}" aria-label="Chọn ca ${esc(date(row.work_date))} ${period(row)}" ${selected.has(row.key)?'checked':''} ${reason||!ready||busy?'disabled':''}>`,date(row.work_date),period(row),hours(row),esc(station()?.name||'—'),esc(reason||(!ready?'Đang kiểm tra…':'Có thể phân công'))];}));
      const count=selectedRows().length;save.disabled=busy||!ready||!count;save.textContent=busy?'Đang phân công…':`Phân công${count?` ${count} ca`:''}`;
      find('[data-bulk-summary]').textContent=count?`Đã chọn ${count} ca`:'Chưa chọn ca nào';
      find('[data-bulk-all]').disabled=busy||!ready||!choices.some(row=>!blocked(row));
    }
    function build(){
      selected.clear();ready=false;
      try{choices=receptionShiftRows(form.elements.from_date.value,form.elements.to_date.value,form.elements.period.value,[...form.querySelectorAll('[name="weekday"]:checked')].map(node=>Number(node.value)));feedback.textContent='';}
      catch(error){choices=[];feedback.textContent=error.message;feedback.dataset.error='true';}
      render();
    }
    async function check(){
      if(!valid()||busy)return;const revision=++checkVersion;read?.abort();read=new AbortController();build();
      if(!person()||!station()||!choices.length)return;
      feedback.textContent='Đang kiểm tra trùng ca và lịch nghỉ…';
      try{
        const [existing,absences]=await Promise.all([allPages(api.listReceptionAssignments,{from_date:form.elements.from_date.value,to_date:form.elements.to_date.value},read.signal),allPages(listAdminLeaveRequests,{user_id:person().user_id,status:'APPROVED'},read.signal)]);
        if(!valid()||revision!==checkVersion)return;assignments=existing;leaves=absences;ready=true;feedback.textContent=station()?.area_name?'Khu vực mới sẽ được lưu khi phân công thành công.':'';render();
      }catch(error){if(valid()&&revision===checkVersion){ready=false;feedback.textContent=error.message;feedback.dataset.error='true';render();}}
    }
    const searchNames=(list,label,query)=>list.map(label).filter(name=>normalized(name).includes(normalized(query)));
    const suggestionControls=[bindScheduleSuggestions({input:form.elements.nurse,list:find('#bulk-nurse-suggestions'),names:query=>searchNames(staff,staffLabel,query)}),bindScheduleSuggestions({input:form.elements.room,list:find('#bulk-room-suggestions'),names:query=>{const matches=searchNames(stations,stationLabel,query);return matches.length?matches:query.trim()?[query.trim()]:[];}})];
    const disposeOriginal=bulkDispose;bulkDispose=()=>{suggestionControls.forEach(control=>control.close());disposeOriginal();};
    form.addEventListener('submit',event=>{event.preventDefault();void check();});
    form.addEventListener('change',()=>void check());
    for(const input of [form.elements.nurse,form.elements.room])input.addEventListener('input',()=>void check());
    find('[data-bulk-back]').addEventListener('click',()=>{if(!busy)formDialog.close();});
    find('[data-bulk-results]').addEventListener('change',event=>{const key=event.target.dataset.shiftKey;if(!key||busy||!ready)return;if(event.target.checked)selected.add(key);else selected.delete(key);render();});
    find('[data-bulk-all]').addEventListener('click',()=>{if(busy||!ready)return;const available=choices.filter(row=>!blocked(row));if(available.every(row=>selected.has(row.key)))selected.clear();else available.forEach(row=>selected.add(row.key));render();});
    save.addEventListener('click',async()=>{
      if(!valid()||busy||!ready||!selectedRows().length)return;
      const rows=selectedRows(),employee=person(),place=station(),note=find('[data-bulk-note]').value;
      busy=true;find('[data-bulk-fields]').disabled=true;find('[data-bulk-back]').disabled=true;find('[data-bulk-note]').disabled=true;render();
      find('[data-bulk-outcome]').textContent='Đang lưu phân công…';
      try{await saveReceptionAssignmentBatch(employee,place,rows,note,{signal:controller.signal});if(!valid())return;busy=false;formDialog.close();}
      catch(error){if(valid()){find('[data-bulk-outcome]').textContent=error.message;find('[data-bulk-outcome]').dataset.error='true';if([401,403].includes(error.status))ctx.handle(error);}}
      finally{busy=false;if(valid()){find('[data-bulk-fields]').disabled=false;find('[data-bulk-back]').disabled=false;find('[data-bulk-note]').disabled=false;render();}}
    });
    async function loadCatalogs(){
      form.elements.nurse.disabled=true;form.elements.room.disabled=true;
      const retry=find('[data-bulk-nurses]');retry.hidden=true;retry.disabled=true;
      feedback.textContent='Đang tải danh sách lễ tân và khu vực…';feedback.dataset.error='false';
      try{
        await catalogs(controller.signal);if(!valid())return;
        form.elements.nurse.disabled=false;form.elements.room.disabled=false;
        feedback.textContent=!staff.length?'Chưa có lễ tân đang hoạt động và đã được duyệt.':!stations.length?'Nhập khu vực làm việc, ví dụ Sảnh A.':'';
      }catch(error){if(valid()){feedback.textContent=error.message;feedback.dataset.error='true';retry.hidden=false;ctx.handle(error,feedback);}}
      finally{if(valid())retry.disabled=false;}
    }
    find('[data-bulk-nurses]').addEventListener('click',()=>void loadCatalogs());
    build();await loadCatalogs();
  }
  add.addEventListener('click',()=>void bulk());
  await list();
  const id=new URLSearchParams(location.search).get('detail_id');if(id&&/^\d+$/.test(id))await openAssignment(id);
  startAutoRefresh(()=>loadList(),{canRefresh:()=>current()&&inList&&!busy});
}
