import { listUsers } from "../api/auth.js";
import { listAdminSchedules } from "../api/schedule.js";
import { esc, date, today, allPages } from "./admin_ui.js";
import { code } from "./business_codes.js";
import { assignmentBlockReason, filterAssignmentShifts, loadNurseAvailability, saveAssignmentBatch } from "./admin_bulk_assignment_data.js";
import { openAdminFormDialog } from "./admin_form_dialog.js";
import { allAvailableSelected, toggleAllAvailable } from "./bulk_selection.js";
import { scheduleDefaultRange } from "./admin_schedule_builder.js";
import { scheduleDepartments, scheduleNameChoices, scheduleDepartmentKey, bindScheduleSuggestions } from "./admin_schedule_choices.js";

const days = [[1,"T2"],[2,"T3"],[3,"T4"],[4,"T5"],[5,"T6"],[6,"T7"],[0,"CN"]];
const choiceInput=(name,title,placeholder)=>`<label>${title}<span class="admin-schedule-autocomplete"><input name="${name}" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="bulk-${name}-suggestions" autocomplete="off" placeholder="${placeholder}" ${name==="nurse"?"required":""}><span id="bulk-${name}-suggestions" class="admin-schedule-suggestions" role="listbox" aria-label="Gợi ý ${title}" hidden></span></span></label>`;

export function bulkAssignmentMarkup() {
  const [start,end]=scheduleDefaultRange();
  return `<form data-bulk-filter><fieldset data-bulk-fields>
    <section class="admin-card admin-bulk-settings"><h3><span class="admin-schedule-step">1</span> Thời gian</h3>
      <div class="admin-schedule-date-row"><label>Từ ngày *<input name="from_date" type="date" value="${start}" min="${today()}" required></label><label>Đến ngày *<input name="to_date" type="date" value="${end}" min="${today()}" required></label></div>
      <label class="admin-schedule-shift-select">Ca làm việc<select name="period"><option value="FULL_DAY">Cả ngày</option><option value="MORNING">Ca sáng · 08:00 – 11:30</option><option value="AFTERNOON">Ca chiều · 13:30 – 17:00</option></select></label>
      <fieldset class="admin-schedule-days"><legend>Ngày làm việc trong tuần</legend><div class="admin-schedule-day-grid">${days.map(([value,title])=>`<label class="admin-schedule-day"><input type="checkbox" name="weekday" value="${value}" checked><span class="admin-schedule-day-name">${title}</span></label>`).join("")}</div></fieldset>
    </section>
    <section class="admin-card admin-bulk-settings"><h3><span class="admin-schedule-step">2</span> Thông tin phân công</h3><div class="admin-assignment-nurse">${choiceInput("nurse","Y tá *","Nhập tên hoặc mã y tá")}</div><div class="admin-schedule-pair"><label>Chuyên khoa<select name="department"><option value="">Tất cả chuyên khoa</option></select></label>${choiceInput("room","Phòng khám","Nhập tên phòng khám")}</div><p data-bulk-feedback role="status" aria-live="polite"></p><button type="button" class="secondary" data-bulk-reload hidden>Tải lại danh sách ca</button><button type="button" class="secondary" data-bulk-nurses hidden>Tải lại danh sách y tá</button></section>
  </fieldset></form>
  <section class="admin-card"><div class="admin-panel-heading"><div><h3>Danh sách ca làm việc</h3><p data-bulk-summary role="status">Chưa chọn ca nào</p></div><div class="admin-bulk-select-actions"><button type="button" class="secondary" data-bulk-all aria-pressed="false" disabled>Chọn tất cả</button></div></div><div data-bulk-results><p class="admin-bulk-hint">Chưa có ca phù hợp.</p></div></section>
  <section class="admin-card admin-bulk-footer"><label>Ghi chú<textarea data-bulk-note rows="2" maxlength="1000"></textarea></label><div class="admin-bulk-confirm"><div class="actions"><button type="button" data-bulk-save disabled>Phân công</button><button type="button" class="secondary" data-bulk-back>Hủy</button></div></div><p data-bulk-outcome role="status" aria-live="polite"></p></section>`;
}

export function assignmentPreviewTable(rows,{selected,blocked,outcomes,busy}) {
  const groups=new Map();for(const row of rows){if(!groups.has(row.work_date))groups.set(row.work_date,[]);groups.get(row.work_date).push(row);}
  const html=[...groups.entries()].map(([day,items])=>`<tbody>${items.map((row,index)=>{
    const id=String(row.schedule_id),reason=blocked(row),outcome=outcomes.get(id),morning=row.start_time<"12:00:00";
    const state=outcome?.success?"Đã phân công":reason||outcome?.message||"Có thể phân công";
    const weekday=new Date(`${day}T12:00:00+07:00`).getUTCDay();
    return `<tr><td><input type="checkbox" data-bulk-shift="${esc(id)}" aria-label="Chọn ca ${esc(code("CA",row.schedule_id))}" ${selected.has(id)?"checked":""} ${busy||reason?"disabled":""}></td>${index===0?`<th class="admin-draft-date" scope="rowgroup" rowspan="${items.length}"><strong>${esc(date(day))}</strong><small>${weekday===0?"Chủ nhật":`Thứ ${weekday+1}`}</small></th>`:""}<td><span class="admin-draft-period ${morning?"is-morning":"is-afternoon"}">${morning?"Buổi sáng":"Buổi chiều"}</span></td><td class="admin-draft-time">${esc(row.start_time.slice(0,5))} – ${esc(row.end_time.slice(0,5))}<small>${esc(code("CA",row.schedule_id))}</small></td><td class="admin-draft-doctor">${esc(row.doctor_name)}</td><td class="admin-assignment-room">${esc(row.room_name)}</td><td class="admin-assignment-status"><span class="admin-bulk-state ${reason||outcome&&!outcome.success?"is-blocked":"is-ready"}">${esc(state)}</span></td></tr>`;
  }).join("")}</tbody>`).join("");
  return `<div class="admin-table-scroll admin-draft-scroll" tabindex="0" role="region" aria-label="Các ca để phân công y tá"><table class="admin-table admin-draft-table admin-assignment-draft-table"><caption class="visually-hidden">Danh sách ca để phân công</caption><colgroup>${Array(7).fill('<col>').join("")}</colgroup><thead><tr>${["Chọn","Ngày","Buổi","Thời gian","Bác sĩ","Phòng khám","Tình trạng"].map(title=>`<th scope="col">${title}</th>`).join("")}</tr></thead>${html||'<tbody><tr><td colspan="7"><div class="admin-empty">Chưa có ca phù hợp.</div></td></tr></tbody>'}</table></div>`;
}

export function openBulkAssignment({ ctx, body, trigger, onBack }) {
  let busy=false,changed=false;
  const formDialog=openAdminFormDialog({title:"Phân công y tá",trigger,canClose:()=>!busy,onClose:()=>{dispose();if(changed&&ctx.active)onBack();}});
  const view=document.createElement("section");view.className="admin-bulk-assignment admin-schedule-builder admin-assignment-builder";
  view.innerHTML=bulkAssignmentMarkup();formDialog.content.append(view);
  const find=selector=>view.querySelector(selector), form=find("[data-bulk-filter]"), feedback=find("[data-bulk-feedback]");
  const root=new AbortController();let read, version=0, active=true, ready=false;
  let nurses=[],rows=[],availability={assignments:[],leaves:[]},loadedNurse=null;
  const selected=new Set(), outcomes=new Map();
  const nurse=()=>nurses.find(item=>`${item.full_name} (${code("TK",item.user_id)})`===form.elements.nurse.value.trim());
  const picked=()=>rows.filter(row=>selected.has(String(row.schedule_id)));
  const blocked=row=>assignmentBlockReason(row,availability.assignments,availability.leaves,picked());
  const visible=()=>filterAssignmentShifts(rows.filter(row=>(!form.elements.department.value||scheduleDepartmentKey(row)===form.elements.department.value)&&["room"].every(kind=>!form.elements[kind].value||scheduleNameChoices([row],"",kind,form.elements[kind].value).length)),{weekdays:[...form.querySelectorAll('[name="weekday"]:checked')].map(node=>Number(node.value)),period:form.elements.period.value,q:""});
  bindScheduleSuggestions({input:form.elements.nurse,list:find("#bulk-nurse-suggestions"),names:query=>nurses.map(item=>`${item.full_name} (${code("TK",item.user_id)})`).filter(name=>name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/gi,"d").toLowerCase().includes(query.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/gi,"d").toLowerCase()))});
  const nameControls=["room"].map(kind=>bindScheduleSuggestions({input:form.elements[kind],list:find(`#bulk-${kind}-suggestions`),names:query=>scheduleNameChoices(rows,form.elements.department.value,kind,query)}));
  const valid=()=>active&&ctx.active&&view.isConnected;
  function tell(message,error=false){feedback.textContent=message;feedback.dataset.error=String(error);}
  function dispose(){active=false;root.abort();read?.abort();window.removeEventListener("pagehide",dispose);window.removeEventListener("neu:auth-change",dispose);}
  window.addEventListener("pagehide",dispose,{once:true});window.addEventListener("neu:auth-change",dispose,{once:true});
  function controls(){
    find("[data-bulk-fields]").disabled=busy;
    find("[data-bulk-note]").disabled=busy;
    find("[data-bulk-nurses]").disabled=busy;find("[data-bulk-reload]").disabled=busy;
    view.querySelectorAll("[data-bulk-back]").forEach(node=>{node.disabled=busy;});
    find("[data-bulk-all]").disabled=busy||!ready;
    find("[data-bulk-all]").setAttribute("aria-pressed",String(allAvailableSelected(visible(),selected,row=>String(row.schedule_id),row=>!blocked(row))));
    const count=picked().filter(row=>!blocked(row)).length;
    find("[data-bulk-save]").disabled=busy||!ready||!count;
    find("[data-bulk-save]").textContent=busy?"Đang phân công…":`Phân công${count?` ${count} ca`:""}`;
    const dates=new Set(picked().map(row=>row.work_date));
    find("[data-bulk-summary]").textContent=selected.size?`Đã chọn ${selected.size} ca trong ${dates.size} ngày${count<selected.size?` · ${selected.size-count} ca cần kiểm tra lại`:""}`:"Chưa chọn ca nào";
  }
  function render(){
    const filtered=visible();
    if(ready){
      find("[data-bulk-results]").innerHTML=assignmentPreviewTable(filtered,{selected,blocked,outcomes,busy});
    }
    controls();
  }
  function invalidate(){version++;read?.abort();ready=false;selected.clear();rows=[];outcomes.clear();loadedNurse=null;find("[data-bulk-results]").innerHTML='<p class="admin-search-status">Chưa có ca phù hợp.</p>';controls();}
  async function load(){
    if(busy||!valid())return;
    const person=nurse();
    if(!person){invalidate();tell("",true);return;}
    if(!form.reportValidity())return;
    if(form.elements.to_date.value<form.elements.from_date.value){tell("Đến ngày phải bằng hoặc sau Từ ngày.",true);return;}
    const current=++version;read?.abort();read=new AbortController();ready=false;outcomes.clear();controls();
    find("[data-bulk-results]").innerHTML='<p class="admin-search-status" role="status">Đang tìm ca và kiểm tra lịch y tá…</p>';find("[data-bulk-reload]").hidden=true;tell("");
    try {
      const [shifts,state]=await Promise.all([allPages(listAdminSchedules,{from_date:form.elements.from_date.value,to_date:form.elements.to_date.value},read.signal),loadNurseAvailability(person.user_id,read.signal)]);
      if(!valid()||current!==version)return;
      rows=shifts;availability=state;loadedNurse=person.user_id;
      const department=form.elements.department.value;
      form.elements.department.innerHTML='<option value="">Tất cả chuyên khoa</option>'+scheduleDepartments(rows).map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("");
      if(scheduleDepartments(rows).some(item=>item.id===department))form.elements.department.value=department;
      for(const id of selected)if(!rows.some(row=>String(row.schedule_id)===id)||availability.assignments.some(item=>String(item.schedule_id)===id&&!item.revoked_at))selected.delete(id);
      ready=true;render();
      tell("");
    }catch(error){if(valid()&&current===version){find("[data-bulk-results]").innerHTML='<p class="admin-search-status">Chưa tải được danh sách ca.</p>';find("[data-bulk-reload]").hidden=false;tell(error.message,true);ctx.handle(error,feedback);}}
  }
  form.addEventListener("submit",event=>{event.preventDefault();load();});
  form.elements.nurse.addEventListener("input",()=>{if(!busy){invalidate();tell("");if(nurse())load();}});
  form.addEventListener("change",event=>{
    if(busy)return;
    if(["nurse","from_date","to_date"].includes(event.target.name)){invalidate();load();}
    else if(["weekday","period","department"].includes(event.target.name)){
      if(event.target.name==="department"){nameControls.forEach(control=>control.close());form.elements.room.value="";}
      selected.clear();render();}
  });
  for(const kind of ["room"])form.elements[kind].addEventListener("input",()=>{if(!busy){selected.clear();render();}});
  view.addEventListener("change",event=>{
    const input=event.target.closest("[data-bulk-shift]");if(!input||busy||!ready)return;
    const row=rows.find(item=>String(item.schedule_id)===input.dataset.bulkShift);
    if(input.checked&&row&&!blocked(row))selected.add(input.dataset.bulkShift);else selected.delete(input.dataset.bulkShift);
    const id=input.dataset.bulkShift;render();find(`[data-bulk-shift="${id}"]`)?.focus();
  });
  async function save(){
    if(busy||!ready||!valid()||nurse()?.user_id!==loadedNurse)return;
    const candidates=picked().filter(row=>!blocked(row));if(!candidates.length)return;
    busy=true;render();find("[data-bulk-outcome]").textContent="Đang kiểm tra lại lịch và phân công từng ca…";
    try {
      availability=await loadNurseAvailability(loadedNurse,root.signal);
      if(!valid())return;
      const results=await saveAssignmentBatch({nurseId:loadedNurse,rows:candidates,note:find("[data-bulk-note]").value.trim(),availability,signal:root.signal,isActive:valid,onResult(result){
        if(!valid())return;
        outcomes.set(String(result.row.schedule_id),result);
        if(result.success){selected.delete(String(result.row.schedule_id));changed=true;}
        find("[data-bulk-outcome]").textContent=`Đã xử lý ca ${code("CA",result.row.schedule_id)}: ${result.message}`;render();
      }});
      if(!valid())return;
      const success=results.filter(item=>item.success).length,stopped=results.find(item=>item.stop);
      find("[data-bulk-outcome]").textContent=`Đã phân công ${success}/${candidates.length} ca. ${selected.size?`Còn ${selected.size} ca chưa phân công; xem lý do trong bảng.`:"Tất cả ca đã chọn đã được phân công."}${stopped?" Bấm Tải lại danh sách ca để kiểm tra dữ liệu mới nhất trước khi tiếp tục.":""}`;
      if(stopped){ready=false;find("[data-bulk-reload]").hidden=false;ctx.handle(stopped.error,feedback);}
    }catch(error){if(valid()){ready=false;find("[data-bulk-reload]").hidden=false;tell(error.message,true);ctx.handle(error,feedback);find("[data-bulk-outcome]").textContent="Chưa kiểm tra được lịch. Bấm Tải lại danh sách ca để tải lại trước khi tiếp tục.";}}
    finally{if(valid()){busy=false;render();}}
  }
  view.addEventListener("click",event=>{
    const target=event.target.closest("button");if(!target||busy)return;
    if(target.hasAttribute("data-bulk-back")){
      formDialog.close();
    }else if(target.hasAttribute("data-bulk-reload")){load();}
    else if(target.hasAttribute("data-bulk-nurses")){loadNurses();}
    else if(target.hasAttribute("data-bulk-all")){
      toggleAllAvailable(visible(),selected,row=>String(row.schedule_id),row=>!blocked(row));render();
    }
    else if(target.hasAttribute("data-bulk-save"))save();
  });
  controls();
  async function loadNurses(){
    find("[data-bulk-nurses]").hidden=true;tell("Đang tải danh sách y tá…");
    try {
      nurses=await allPages(listUsers,{role:"NURSE",account_status:"ACTIVE",approval_status:"APPROVED"},root.signal);
      if(!valid())return;
      find("[data-bulk-nurses]").hidden=Boolean(nurses.length);
      tell(nurses.length?"":"Chưa có y tá đang hoạt động và đã được duyệt.");
    }catch(error){if(valid()){find("[data-bulk-nurses]").hidden=false;tell(error.message,true);ctx.handle(error,feedback);}}
  }
  loadNurses();
}
