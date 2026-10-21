import { esc, date, today } from "./admin_ui.js";
import { openAdminFormDialog } from "./admin_form_dialog.js";
import { allAvailableSelected, toggleAllAvailable } from "./bulk_selection.js";
import { scheduleDepartments, scheduleNameChoices, bindScheduleSuggestions } from "./admin_schedule_choices.js";
import {readScheduleChoices,resolveScheduleDraft,createScheduleBatch,scheduleIdentity,readScheduleConflicts} from "./admin_schedule_create.js";

const weekdays = [[1,"T2"],[2,"T3"],[3,"T4"],[4,"T5"],[5,"T6"],[6,"T7"],[0,"CN"]];
const periodDefinitions = [{key:"morning",title:"Buổi sáng",start:"08:00",end:"11:30"},{key:"afternoon",title:"Buổi chiều",start:"13:30",end:"17:00"}];
const normalized = value => String(value || "").trim().replace(/\s+/g," ").toLocaleLowerCase("vi");
function parseDay(value) {
  const time=Date.parse(`${value}T00:00:00Z`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==value)throw new Error("Chọn ngày bắt đầu và kết thúc hợp lệ.");
  return time;
}

// Draft generation is entirely local. No identifiers or saved records are created.
export function buildScheduleDraft({from,to,days,patterns,periods}) {
  const first=parseDay(from),last=parseDay(to);
  if(last<first)throw new Error("Đến ngày phải bằng hoặc sau Từ ngày.");
  if(!days.length)throw new Error("Chọn ít nhất một ngày trong tuần.");
  if(!patterns.length||patterns.some(item=>!item.doctor.trim()||!item.room.trim()))throw new Error("Nhập bác sĩ và phòng khám cho từng dòng.");
  if(!periods.length)throw new Error("Chọn ít nhất một buổi làm việc.");
  for(const period of periods) {
    if(!/^\d{2}:\d{2}$/.test(period.start)||!/^\d{2}:\d{2}$/.test(period.end)||period.end<=period.start)throw new Error(`Giờ kết thúc ${period.title.toLocaleLowerCase("vi")} phải sau giờ bắt đầu.`);
    if(![15,30].includes(Number(period.minutes)))throw new Error("Chọn thời lượng khung giờ 15 hoặc 30 phút.");
  }
  if(periods.some((item,index)=>periods.slice(index+1).some(other=>item.start<other.end&&other.start<item.end)))throw new Error("Giờ ca sáng và ca chiều đang trùng nhau. Hãy điều chỉnh lại.");
  const doctors=new Set(),rooms=new Set();
  for(const pattern of patterns) {
    if(doctors.has(normalized(pattern.doctor)))throw new Error("Một bác sĩ đang được chọn ở nhiều dòng cùng thời gian.");
    if(rooms.has(normalized(pattern.room)))throw new Error("Một phòng khám đang được chọn ở nhiều dòng cùng thời gian.");
    doctors.add(normalized(pattern.doctor));rooms.add(normalized(pattern.room));
  }
  const result=[];
  // Bound rendering work for an unusually large draft without changing saved scheduling rules.
  if((last-first)/86400000>366||((last-first)/86400000+1)*patterns.length*periods.length>5000)throw new Error("Bản xem trước quá lớn. Hãy chia thành khoảng ngày ngắn hơn.");
  for(let day=first;day<=last;day+=86400000) {
    const workDate=new Date(day);if(!days.includes(workDate.getUTCDay()))continue;
    patterns.forEach((pattern,index)=>periods.forEach(period=>result.push({...period,key:`${workDate.toISOString().slice(0,10)}-${period.key}-${index}`,date:workDate.toISOString().slice(0,10),weekday:workDate.getUTCDay(),doctor:pattern.doctor.trim(),room:pattern.room.trim()})));
  }
  return result;
}

export function scheduleDefaultRange(from=today()) {
  const start=new Date(parseDay(from));
  const end=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,1));
  const lastDay=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();
  end.setUTCDate(Math.min(start.getUTCDate(),lastDay));
  return [from,end.toISOString().slice(0,10)];
}
const pairMarkup = () => `<div class="admin-schedule-pair"><label>Chuyên khoa<select name="draft_department"><option value="">Tất cả chuyên khoa</option></select></label>${[["doctor","Bác sĩ","tên bác sĩ"],["room","Phòng khám","tên phòng khám"]].map(([kind,title,placeholder])=>`<label>${title} *<span class="admin-schedule-autocomplete"><input type="text" name="draft_${kind}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="draft-${kind}-suggestions" placeholder="Nhập ${placeholder}" autocomplete="off" maxlength="150" required><span id="draft-${kind}-suggestions" class="admin-schedule-suggestions" role="listbox" aria-label="Gợi ý ${title.toLocaleLowerCase('vi')}" hidden></span></span></label>`).join("")}</div>`;

export function scheduleDraftTable(rows, selected, locked = new Set(), outcomes = new Map()) {
  const groups=new Map();
  for(const row of rows){if(!groups.has(row.date))groups.set(row.date,[]);groups.get(row.date).push(row);}
  const body=[...groups.entries()].map(([day,items])=>`<tbody>${items.map((row,index)=>`<tr>
    <td><input type="checkbox" data-draft-row="${esc(row.key)}" aria-label="Chọn ca ${esc(row.title)} ngày ${esc(date(day))} của ${esc(row.doctor)}" ${locked.has(row.key)?"disabled":""} ${selected.has(row.key)?"checked":""}></td>
    ${index===0?`<th scope="rowgroup" rowspan="${items.length}" class="admin-draft-date"><strong>${esc(date(day))}</strong><small>${row.weekday===0?"Chủ nhật":`Thứ ${row.weekday+1}`}</small></th>`:""}
    <td><span class="admin-draft-period ${row.start<"12:00"?"is-morning":"is-afternoon"}">${esc(row.title)}</span></td>
    <td class="admin-draft-time">${esc(row.start)} <span>–</span> ${esc(row.end)}</td><td class="admin-draft-doctor">${esc(row.doctor)}${row.payload&&outcomes.has(scheduleIdentity(row.payload))?`<small title="${esc(outcomes.get(scheduleIdentity(row.payload)).message)}" class="${outcomes.get(scheduleIdentity(row.payload)).success?'':'admin-schedule-conflict'}">${esc(outcomes.get(scheduleIdentity(row.payload)).message.replace("Bác sĩ đã có ca làm việc trùng thời gian này, không thể phân công thêm.","Bác sĩ đã có ca trùng giờ.").replace("Phòng khám đã có ca trùng thời gian này.","Phòng đã có ca trùng giờ."))}</small>`:""}</td><td>${esc(row.room)}</td>
  </tr>`).join("")}</tbody>`).join("");
  return `<div class="admin-table-scroll admin-draft-scroll" tabindex="0" role="region" aria-label="Danh sách ca dự kiến theo ngày"><table class="admin-table admin-draft-table"><caption class="visually-hidden">Bản xem trước ca làm việc chưa lưu</caption><colgroup><col class="draft-check-col"><col class="draft-date-col"><col class="draft-period-col"><col class="draft-time-col"><col><col></colgroup><thead><tr>${["Chọn","Ngày","Buổi","Thời gian","Bác sĩ","Phòng khám"].map(title=>`<th scope="col">${title}</th>`).join("")}</tr></thead>${body||'<tbody><tr><td colspan="6"><div class="admin-empty">Chưa có ca dự kiến.</div></td></tr></tbody>'}</table></div>`;
}

export function scheduleBuilderMarkup() {
  const [from,to]=scheduleDefaultRange();
  return `<div class="admin-bulk-heading"><button type="button" class="secondary" data-draft-back>← Quay lại danh sách</button><div><h2 tabindex="-1">Tạo ca làm việc</h2><p>Cấu hình một lần, xem trước các ca theo ngày và buổi đã chọn.</p></div><span class="admin-schedule-draft-badge">Bản nháp · Chưa lưu</span></div>
    <form data-schedule-draft>
      <section class="admin-card admin-bulk-settings"><h3><span class="admin-schedule-step">1</span> Thời gian</h3><div class="admin-schedule-date-row"><label>Từ ngày *<input type="date" name="from_date" min="${today()}" value="${from}" required></label><label>Đến ngày *<input type="date" name="to_date" min="${today()}" value="${to}" required></label></div><label class="admin-schedule-shift-select">Ca làm việc *<select name="draft_period"><option value="morning">Ca sáng · 08:00 – 11:30</option><option value="afternoon">Ca chiều · 13:30 – 17:00</option><option value="both" selected>Cả ngày</option></select></label><fieldset class="admin-schedule-days"><legend>Ngày làm việc trong tuần</legend><div class="admin-schedule-day-grid">${weekdays.map(([value,title])=>`<label class="admin-schedule-day"><input type="checkbox" name="draft_day" value="${value}" checked><span class="admin-schedule-day-name">${title}</span></label>`).join("")}</div></fieldset></section>
      <section class="admin-card admin-bulk-settings"><div class="admin-schedule-section-heading"><h3><span class="admin-schedule-step">2</span> Bác sĩ và phòng khám</h3></div><div data-draft-pairs>${pairMarkup()}</div></section>
      <p data-draft-feedback role="status" aria-live="polite"></p>
    </form>
    <section class="admin-card"><div class="admin-panel-heading"><div><h3>Danh sách ca dự kiến</h3><p data-draft-summary>Chưa có ca dự kiến</p></div><button type="button" class="secondary" data-draft-select-all aria-pressed="false" disabled>Chọn tất cả</button></div><div data-draft-preview><p class="admin-bulk-hint">Chưa có ca dự kiến.</p></div></section>
    <section class="admin-card admin-schedule-draft-footer"><div class="actions"><button type="button" data-draft-create disabled>Tạo ca</button><button type="button" class="secondary" data-draft-back>Quay lại</button></div></section>`;
}

export async function openScheduleBuilder({body,trigger,ctx,onSaved=async()=>{}}) {
  let saving=false,ready=false,checking=false,previewVersion=0,previewKey="",previewController;
  let previewConflicts=new Map();
  const controller=new AbortController(),outcomes=new Map();
  controller.signal.addEventListener("abort",()=>previewController?.abort(),{once:true});
  const formDialog=openAdminFormDialog({title:"Tạo ca làm việc",trigger,canClose:()=>!saving,onClose:()=>controller.abort()});
  const view=document.createElement("section");view.className="admin-bulk-assignment admin-schedule-builder";view.innerHTML=scheduleBuilderMarkup();view.querySelector(".admin-bulk-heading").remove();formDialog.content.append(view);
  const find=selector=>view.querySelector(selector),form=find("[data-schedule-draft]"),feedback=find("[data-draft-feedback]");
  let draft=[],choices,suggestions=[];const selected=new Set();
  const active=()=>view.isConnected&&!controller.signal.aborted&&(!ctx||ctx.active);
  const locked=()=>new Set(draft.filter(row=>{const result=row.payload&&outcomes.get(scheduleIdentity(row.payload));return checking||previewConflicts.has(scheduleIdentity(row.payload))||result?.success||result?.uncertain||result?.blocked;}).map(row=>row.key));
  const available=()=>{const blocked=locked();return draft.filter(row=>!blocked.has(row.key));};
  const controls=[...form.querySelectorAll("input,select")];controls.forEach(input=>input.disabled=true);
  feedback.textContent="Đang tải danh mục bác sĩ và phòng khám…";
  try {
    choices=await readScheduleChoices(controller.signal);
    if(!active())return;
    suggestions=choices.suggestions;ready=true;controls.forEach(input=>input.disabled=false);feedback.textContent="";
  }catch(error){if(active()){feedback.textContent=error.message;feedback.dataset.error="true";if(error.status===401||error.status===403){formDialog.dialog.close();ctx?.handle(error);}}return;}
  form.elements.draft_department.insertAdjacentHTML("beforeend",scheduleDepartments(suggestions).map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join(""));
  const suggestionControls=["doctor","room"].map(kind=>bindScheduleSuggestions({input:form.elements[`draft_${kind}`],list:find(`#draft-${kind}-suggestions`),names:query=>scheduleNameChoices(suggestions,form.elements.draft_department.value,kind,query)}));
  form.elements.draft_department.addEventListener("change",()=>{
    suggestionControls.forEach(control=>control.close());
    for(const kind of ["doctor","room"]){const input=form.elements[`draft_${kind}`];if(!scheduleNameChoices(suggestions,form.elements.draft_department.value,kind).includes(input.value))input.value="";}
  });
  function invalidate(){previewVersion++;previewController?.abort();previewKey="";checking=false;previewConflicts.clear();draft=[];selected.clear();find("[data-draft-preview]").innerHTML='<p class="admin-bulk-hint">Chưa có ca dự kiến.</p>';find("[data-draft-summary]").textContent="Chưa có ca dự kiến";find("[data-draft-select-all]").disabled=true;find("[data-draft-select-all]").setAttribute("aria-pressed","false");find("[data-draft-create]").textContent="Tạo ca";find("[data-draft-create]").disabled=true;feedback.textContent="";}
  function summary(){const rows=draft.filter(row=>selected.has(row.key));find("[data-draft-summary]").textContent=`Đang chọn ${rows.length}/${draft.length} ca · ${new Set(rows.map(row=>row.date)).size} ngày · ${new Set(rows.map(row=>row.doctor)).size} bác sĩ`;find("[data-draft-create]").textContent=saving?"Đang tạo ca…":`Tạo ${rows.length} ca`;find("[data-draft-create]").disabled=!ready||checking||saving||!rows.length||[...outcomes.values()].some(result=>result.uncertain);find("[data-draft-select-all]").setAttribute("aria-pressed",String(allAvailableSelected(available(),selected,row=>row.key)));}
  function render(){
    find("[data-draft-preview]").innerHTML=scheduleDraftTable(draft,selected,locked(),new Map([...previewConflicts,...outcomes]));
    find("[data-draft-select-all]").disabled=saving||!available().length;summary();
  }
  async function updatePreview(){
    if(!active()||!ready||saving)return;
    if(!form.checkValidity()){invalidate();return;}
    try {
      let next=buildScheduleDraft({from:form.elements.from_date.value,to:form.elements.to_date.value,days:[...form.querySelectorAll('[name="draft_day"]:checked')].map(node=>Number(node.value)),patterns:[...form.querySelectorAll(".admin-schedule-pair")].map(node=>({doctor:node.querySelector('[name="draft_doctor"]').value,room:node.querySelector('[name="draft_room"]').value})),periods:periodDefinitions.filter(period=>form.elements.draft_period.value==="both"||period.key===form.elements.draft_period.value).map(period=>({...period,minutes:30}))});
      next=resolveScheduleDraft(next,choices,form.elements.draft_department.value);
      const key=JSON.stringify(next.map(row=>row.payload));
      if(key===previewKey)return;
      const version=++previewVersion;previewController?.abort();previewController=new AbortController();
      previewKey=key;draft=next;selected.clear();previewConflicts.clear();checking=true;render();
      feedback.dataset.error="false";feedback.textContent="Đang kiểm tra lịch bác sĩ và phòng khám…";
      try {
        const conflicts=await readScheduleConflicts(next,previewController.signal);
        if(!active()||version!==previewVersion)return;
        previewConflicts=conflicts;checking=false;feedback.dataset.error="false";
        available().forEach(row=>selected.add(row.key));render();
        feedback.textContent=!draft.length?"Không có ngày nào khớp với các thứ đã chọn.":"";
      }catch(error){
        if(!active()||version!==previewVersion)return;
        previewKey="";checking=true;render();feedback.dataset.error="true";
        feedback.textContent=`Không thể kiểm tra lịch: ${error.message}`;
        if(error.status===401||error.status===403){formDialog.dialog.close();ctx?.handle(error);}
      }
    }catch(error){invalidate();feedback.dataset.error="true";feedback.textContent=error.message;}
  }
  form.addEventListener("input",updatePreview);
  form.addEventListener("change",updatePreview);
  form.addEventListener("submit",event=>{event.preventDefault();updatePreview();});
  view.addEventListener("change",event=>{const checkbox=event.target.closest("[data-draft-row]");if(!checkbox)return;if(checking||saving||checkbox.disabled){checkbox.checked=false;return;}if(checkbox.checked)selected.add(checkbox.dataset.draftRow);else selected.delete(checkbox.dataset.draftRow);summary();});
  view.addEventListener("click",async event=>{
    const target=event.target.closest("button");if(!target)return;
    if(saving)return;
    if(target.hasAttribute("data-draft-back")){formDialog.close();}
    else if(target.hasAttribute("data-draft-select-all")){toggleAllAvailable(available(),selected,row=>row.key);render();}
    else if(target.hasAttribute("data-draft-create")&&!target.disabled) {
      const rows=available().filter(row=>selected.has(row.key));if(!rows.length)return;
      saving=true;controls.forEach(input=>input.disabled=true);render();view.querySelectorAll('[data-draft-row]').forEach(input=>input.disabled=true);
      feedback.dataset.error="false";feedback.textContent="Đang kiểm tra và tạo ca làm việc…";
      try {
        const results=await createScheduleBatch(rows,{signal:controller.signal,isActive:active,outcomes,onResult:result=>{
          if(result.success||result.blocked||result.uncertain)selected.delete(result.row.key);
          if(active()){
            const finished=rows.filter(row=>outcomes.has(scheduleIdentity(row.payload))).length;
            feedback.textContent=`Đã xử lý ${finished}/${rows.length} ca · Đã tạo ${[...outcomes.values()].filter(item=>item.success).length} ca.`;
            find("[data-draft-create]").textContent=`Đang xử lý ${finished}/${rows.length} ca…`;
          }
        }});
        if(!active())return;
        const success=results.filter(result=>result.success).length,failed=results.filter(result=>!result.success);
        feedback.dataset.error=String(failed.length>0);
        feedback.textContent=`Đã tạo ${success}/${rows.length} ca.${failed.length?` ${failed[0].row.date} · ${failed[0].row.title}: ${failed[0].message}`:""}`;
        if(success)await onSaved();
        const denied=failed.find(result=>result.error?.status===401||result.error?.status===403);
        if(denied){formDialog.dialog.close();ctx?.handle(denied.error);}
      }catch(error){if(active()){feedback.dataset.error="true";feedback.textContent=error.message;if(error.status===401||error.status===403){formDialog.dialog.close();ctx?.handle(error);}}}
      finally{saving=false;if(active()){controls.forEach(input=>input.disabled=false);render();if([...outcomes.values()].some(result=>result.uncertain))find("[data-draft-create]").textContent="Cần kiểm tra kết quả";else if(!selected.size&&outcomes.size)find("[data-draft-create]").textContent="Đã xử lý xong";feedback.scrollIntoView({block:"nearest"});}}
    }
  });
}
