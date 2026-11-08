import {createTreatmentAppointments,listTreatmentAppointments} from '../api/treatment.js';
import {allPages} from './booking.js';
import {dialog,esc} from './staff_ui.js';
import {commitForm,markFormChanged} from './form_workflow.js';
import {enhanceDialogDismiss} from './dialog_dismiss.js';

export const treatmentTimeSlots = Object.freeze([
  {label:'Ca sáng',start:8*60,end:11*60+30},
  {label:'Ca chiều',start:13*60+30,end:17*60},
].map(shift=>Object.freeze({...shift,slots:Object.freeze(Array.from({length:(shift.end-shift.start)/30},(_,i)=>{
  const clock=minutes=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
  return `${clock(shift.start+i*30)}–${clock(shift.start+(i+1)*30)}`;
}))})));

export function treatmentSession(day,slot,now=new Date()) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!treatmentTimeSlots.some(shift=>shift.slots.includes(slot)))throw Error('Vui lòng chọn ngày hẹn và khung thời gian hợp lệ.');
  const [start,end]=slot.split('–');
  const a=new Date(`${day}T${start}:00+07:00`),b=new Date(`${day}T${end}:00+07:00`);
  if(!Number.isFinite(a.getTime())||a<=now)throw Error('Mỗi buổi hẹn phải ở tương lai.');
  return {starts_at:a.toISOString(),ends_at:b.toISOString()};
}

export async function openTreatmentForm(profile) {
  if (profile.status!=='IN_PROGRESS') return;
  const requestKey=crypto.randomUUID();
  dialog('Hẹn điều trị',`<p>Người bệnh: <strong>${esc(profile.name)}</strong> · ${esc(profile.patient)}</p>
    <p id="treatment-existing" role="status">Đang tải các buổi đã hẹn…</p>
    <form id="treatment-form">
      <label>Nội dung điều trị *<textarea name="content" required maxlength="2000" rows="3"></textarea></label>
      <label>Địa điểm *<input name="location" required maxlength="255" value="${esc(profile.room)}"></label>
      <fieldset class="treatment-sessions-group"><legend>Buổi hẹn (giờ Việt Nam)</legend><div id="treatment-sessions"></div></fieldset>
      <button type="button" class="secondary" id="treatment-add">＋ Thêm buổi hẹn</button>
      <label>Ghi chú / dặn dò<textarea name="notes" maxlength="2000" rows="2"></textarea></label>
      <p id="treatment-feedback" role="status"></p>
      <div class="actions"><button type="submit">Lưu lịch hẹn điều trị</button></div>
    </form>`);
  const form=document.querySelector('#treatment-form');
  const holder=form.querySelector('#treatment-sessions');
  const feedback=form.querySelector('#treatment-feedback');
  let pending=null,busy=false,removalOpen=false;
  const modal=document.querySelector('#staff-dialog');
  if(!modal.dataset.treatmentDismissBound){
    enhanceDialogDismiss(modal,{closeButtons:[document.querySelector('#staff-dialog-close')],canClose:()=>!modal.querySelector('[data-busy="true"]')});
    modal.dataset.treatmentDismissBound='true';
  }
  const preventClose=event=>{if(busy)event.preventDefault();};
  modal.addEventListener('cancel',preventClose);
  modal.addEventListener('close',()=>modal.removeEventListener('cancel',preventClose),{once:true});
  const minimum=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Saigon',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function add() {
    if(holder.children.length>=30)return;
    const row=document.createElement('div');
    row.className='treatment-session-row';
    row.innerHTML='<label>Ngày hẹn *<input data-day type="date" required min="'+minimum+'"></label><label>Thời gian *<select data-slot required><option value="">Chọn thời gian</option>'+treatmentTimeSlots.map(shift=>`<optgroup label="${shift.label}">${shift.slots.map(slot=>`<option value="${slot}">${slot}</option>`).join('')}</optgroup>`).join('')+'</select></label><button type="button" class="secondary treatment-remove-session" data-remove-session aria-label="Xóa buổi hẹn" title="Xóa buổi hẹn">×</button>';
    row.querySelector('[data-remove-session]').addEventListener('click',()=>{
      if(busy||pending||removalOpen)return;
      removalOpen=true;
      const trigger=row.querySelector('[data-remove-session]');
      const notice=document.createElement('dialog');
      notice.className='workflow-discard-dialog';
      notice.setAttribute('aria-labelledby','treatment-remove-title');
      notice.setAttribute('aria-describedby','treatment-remove-description');
      notice.innerHTML='<h2 id="treatment-remove-title">Xóa buổi hẹn?</h2><p id="treatment-remove-description">Ngày và thời gian đã chọn của buổi hẹn này sẽ bị xóa khỏi form.</p><div class="workflow-discard-actions"><button type="button" data-workflow-stay>Giữ lại</button><button type="button" data-workflow-leave>Xóa buổi hẹn</button></div>';
      document.body.append(notice);
      let done=false;
      const finish=accepted=>{
        if(done)return;done=true;
        if(accepted&&modal.open&&row.isConnected&&!busy&&!pending){row.remove();markFormChanged(form);}
        notice.close();notice.remove();removalOpen=false;
        modal.removeEventListener('close',parentClosed);
        if(modal.open)(trigger.isConnected?trigger:form.querySelector('#treatment-add')).focus();
      };
      const parentClosed=()=>finish(false);
      modal.addEventListener('close',parentClosed);
      notice.querySelector('[data-workflow-stay]').addEventListener('click',()=>finish(false));
      notice.querySelector('[data-workflow-leave]').addEventListener('click',()=>finish(true));
      notice.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
      notice.addEventListener('close',()=>finish(false));
      notice.showModal();notice.querySelector('[data-workflow-stay]').focus();
    });
    holder.append(row);
  }
  add();
  form.querySelector('#treatment-add').addEventListener('click',()=>{add();markFormChanged(form);});
  const existing=document.querySelector('#treatment-existing');
  allPages(listTreatmentAppointments).then(items=>{
    const rows=items.filter(row=>String(row.encounter_id)===String(profile.encounter_id));
    if(existing.isConnected)existing.textContent=rows.length ? `Đã có ${rows.length} buổi hẹn: `+rows.map(row=>new Date(row.starts_at).toLocaleString('vi-VN',{timeZone:'Asia/Saigon'})).join('; ') : 'Chưa có buổi hẹn điều trị cho lượt khám này.';
  }).catch(error=>{if(existing.isConnected)existing.textContent=error.message;});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    if(!pending) {
      try {
        if(!holder.children.length)throw Error('Vui lòng thêm ít nhất một buổi hẹn.');
        const sessions=[...holder.children].map(row=>{
          return treatmentSession(row.querySelector('[data-day]').value,row.querySelector('[data-slot]').value);
        });
        const data=Object.fromEntries(new FormData(form));
        pending={request_key:requestKey,content:data.content.trim(),location:data.location.trim(),notes:data.notes.trim()||null,sessions};
      } catch(error){feedback.textContent=error.message;return;}
    }
    busy=true;form.dataset.busy='true';
    form.querySelectorAll('input,textarea,select,button').forEach(node=>node.disabled=true);
    const close=document.querySelector('#staff-dialog-close');if(close)close.disabled=true;
    feedback.textContent='Đang lưu lịch hẹn…';
    try {
      const result=await createTreatmentAppointments(profile.encounter_id,pending);
      if(!Array.isArray(result.items)||result.items.length!==pending.sessions.length)throw Error('Chưa xác nhận đủ các buổi hẹn. Hãy thử lưu lại để kiểm tra.');
      commitForm(form);feedback.textContent=`Đã lưu ${result.items.length} buổi hẹn. Bệnh nhân có thể xem trong Lịch hẹn điều trị.`;
      form.querySelector('button[type="submit"]').hidden=true;
    } catch(error) {
      feedback.textContent=error.message;
      if(error.status&&error.status<500){pending=null;form.querySelectorAll('input,textarea,select,button').forEach(node=>node.disabled=false);}
      else feedback.textContent+=' Bấm Lưu lại để kiểm tra cùng yêu cầu, tránh tạo trùng.';
      form.querySelector('button[type="submit"]').disabled=false;
    } finally {busy=false;form.dataset.busy='false';if(close)close.disabled=false;}
  });
}
