import {esc,date,stamp,money,table,label} from './admin_ui.js';
import {openAdminFormDialog,batchFinishedSuccessfully} from './admin_form_dialog.js';
import {code} from './business_codes.js';
import {paymentMethodLabel} from './admin_payment_view.js';
import {readRefundSelectionData,filterRefundSelection,executeRefundBatch,refundPreview} from './admin_refund_selection_data.js';

export function refundSelectionMarkup() {
  return `<section class="admin-refund-bulk" data-refund-bulk>
    <section class="admin-payment-section"><h3>Chọn giao dịch cần hoàn</h3>
      <div class="admin-payment-fields">
        <label>Phòng khám<select name="bulk_room"><option value="">Tất cả phòng khám</option></select></label>
        <label>Ngày khám<input type="date" name="bulk_date"></label>
        <label>Ca khám<select name="bulk_period"><option value="">Tất cả ca khám</option><option value="MORNING">Buổi sáng</option><option value="AFTERNOON">Buổi chiều</option></select></label>
        <label>Tìm người bệnh / giao dịch<input type="search" name="bulk_query" placeholder="Tên người bệnh, mã lượt khám hoặc mã thanh toán"></label>
      </div>

      <p data-bulk-status class="admin-refund-status" role="status">Đang tải giao dịch…</p>
    </section>
    <section class="admin-payment-section"><div class="admin-refund-selection-heading"><h3>Danh sách giao dịch phù hợp</h3><span data-bulk-count>Đã chọn 0 giao dịch</span></div>
      <div data-bulk-results><p class="admin-refund-status">Chưa có điều kiện tìm kiếm. Nhập tên, mã hoặc chọn phòng / ca khám để bắt đầu.</p></div>
    </section>
    <section class="admin-payment-section"><h3>Nội dung yêu cầu hoàn tiền</h3><div class="admin-refund-amount-summary" role="status" aria-live="polite"><span>Số tiền cần hoàn</span><strong data-refund-amount>Chưa chọn giao dịch</strong><p>Số tiền tính theo nguyên nhân hủy và chính sách của lượt khám. Chọn nhóm lý do bên dưới không thay đổi mức hoàn.</p></div><div class="admin-payment-fields">
      <label>Nhóm lý do<select name="bulk_reason_group"><option>Yêu cầu từ người bệnh</option><option>Phòng / ca khám bị hủy</option><option>Bác sĩ ngừng khám</option><option>Thay đổi lịch từ cơ sở khám</option><option>Khác</option></select></label>
      <label class="admin-refund-reason">Lý do hoàn tiền *<textarea name="bulk_reason" rows="3" maxlength="900" required placeholder="Nhập lý do áp dụng cho giao dịch hoặc nhóm giao dịch đã chọn"></textarea></label>
    </div></section>
    <div data-bulk-outcomes></div>
    <p class="admin-refund-status" data-bulk-feedback role="status" aria-live="polite" hidden></p>
    <div class="admin-refund-bulk-actions"><span data-bulk-total>Chưa chọn giao dịch</span><div class="actions"><button class="primary" type="button" data-bulk-confirm disabled>Xác nhận hoàn tiền</button><button type="button" class="secondary" data-bulk-close>Đóng</button></div></div>
  </section>`;
}
const uncertainPayments=new Set();
export async function openUnifiedRefundRequest({ctx,paymentId=null,trigger,onSaved,onClose=()=>{}}) {
  let active=true,saving=false,loading=false,data={items:[],rooms:[]},rows=[],selected=new Set();
  const request=new AbortController();
  const opened=openAdminFormDialog({title:'Yêu cầu hoàn tiền',trigger,canClose:()=>!saving,onClose:()=>{active=false;request.abort();onClose();}});
  opened.content.innerHTML=`<form class="admin-refund-request" autocomplete="off">${refundSelectionMarkup()}</form>`;
  const form=opened.content.querySelector('form'),fields=form.elements;
  const results=form.querySelector('[data-bulk-results]'),status=form.querySelector('[data-bulk-status]'),feedback=form.querySelector('[data-bulk-feedback]'),outcomes=form.querySelector('[data-bulk-outcomes]'),confirm=form.querySelector('[data-bulk-confirm]');
  const alive=()=>active&&ctx.active;
  const filters=()=>({room:fields.bulk_room.value,day:fields.bulk_date.value,period:fields.bulk_period.value,query:fields.bulk_query.value.trim()});
  const controls=()=>[...form.querySelectorAll('input,select,textarea,button')];
  const picked=()=>rows.filter(row=>selected.has(String(row.payment.payment_id))&&!uncertainPayments.has(String(row.payment.payment_id)));
  function error(cause) {
    if(!alive())return;
    feedback.textContent=cause.message||'Không thể tải dữ liệu.';feedback.dataset.error='true';feedback.hidden=false;
    if(cause.status===401||cause.status===403){ctx.handle(cause);opened.dialog.close();}
  }
  function count() {
    const chosen=picked();form.querySelector('[data-bulk-count]').textContent=`Đã chọn ${chosen.length} / ${rows.length} giao dịch`;
    const amounts=chosen.map(row=>refundPreview(row.payment,row.encounter));
    form.querySelector('[data-refund-amount]').textContent=chosen.length?(amounts.some(value=>value===null)?'Chưa đủ dữ liệu chính sách':money(amounts.reduce((sum,value)=>sum+value,0))):'Chưa chọn giao dịch';
    form.querySelector('[data-bulk-total]').textContent=chosen.length?`Dự kiến hoàn: ${amounts.some(value=>value===null)?'Chưa đủ dữ liệu chính sách':money(amounts.reduce((sum,value)=>sum+value,0))}`:'Chưa chọn giao dịch';
    confirm.disabled=loading||saving||!chosen.length;
    const all=results.querySelector('[data-bulk-all]'),available=rows.filter(row=>!uncertainPayments.has(String(row.payment.payment_id)));
    if(all){all.disabled=saving||!available.length;all.checked=available.length>0&&chosen.length===available.length;all.indeterminate=chosen.length>0&&chosen.length<available.length;}
  }
  function render() {
    const filter=filters(),hasFilter=Object.values(filter).some(Boolean);
    rows=hasFilter?filterRefundSelection(data.items,filter):[];
    status.textContent=hasFilter?`${rows.length} giao dịch phù hợp.`:'Nhập tìm kiếm hoặc chọn bộ lọc để hiển thị giao dịch.';
    results.innerHTML=rows.length?table(['Chọn','Người bệnh / lượt khám','Phòng / ngày khám','Ca / giờ hẹn','Giao dịch / số đã thu','Dự kiến hoàn','Trạng thái'],rows.map(({payment,encounter})=>{
      const id=String(payment.payment_id),blocked=uncertainPayments.has(id);
      return [`<input type="checkbox" data-bulk-row="${esc(id)}" aria-label="Chọn ${esc(code('TT',id))} của ${esc(encounter.patient_name)}" ${selected.has(id)&&!blocked?'checked':''} ${blocked?'disabled':''}>`,
        `<strong>${esc(encounter.patient_name||'Chưa cập nhật')}</strong><small>${esc(code('LK',payment.encounter_id))} · ${esc(encounter.doctor_name||'')}</small>`,
        `${esc(encounter.room_name||'Chưa cập nhật')}<small>${date(encounter.work_date)}</small>`,
        `${esc(encounter.start_time?.slice(0,5)||'—')} – ${esc(encounter.end_time?.slice(0,5)||'—')}<small>Giờ hẹn: ${esc(encounter.estimated_exam_at?stamp(encounter.estimated_exam_at):'—')}</small>`,
        `${esc(code('TT',id))}<small>${money(payment.amount)} · ${esc(paymentMethodLabel(payment.payment_method))}</small>`,
        refundPreview(payment,encounter)===null?'Chưa đủ dữ liệu chính sách':money(refundPreview(payment,encounter)),
        `<span class="badge ${blocked?'amber':'blue'}">${blocked?'Chờ kiểm tra kết quả':esc(label(encounter.encounter_status))}</span>`];
    }),'Giao dịch phù hợp yêu cầu hoàn tiền').replace('<th scope="col">Chọn</th>','<th scope="col"><label class="admin-refund-check-all"><input type="checkbox" data-bulk-all aria-label="Chọn tất cả giao dịch trong danh sách đã lọc"> Chọn tất cả</label></th>'):`<p class="admin-refund-status">${hasFilter?'Không có giao dịch đủ điều kiện yêu cầu hoàn tiền phù hợp.':'Chưa có điều kiện tìm kiếm.'}</p>`;
    count();
  }
  async function load(prefill=false) {
    loading=true;confirm.disabled=true;status.textContent='Đang tải giao dịch…';
    try {
      const fresh=await readRefundSelectionData(request.signal);if(!alive())return;
      data=fresh;
      const previous=fields.bulk_room.value,rooms=new Map(data.rooms.map(room=>[String(room.room_id),room.room_name]));
      data.items.forEach(({encounter})=>{if(!rooms.has(String(encounter.room_id)))rooms.set(String(encounter.room_id),encounter.room_name);});
      fields.bulk_room.innerHTML='<option value="">Tất cả phòng khám</option>'+[...rooms].map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');fields.bulk_room.value=previous;
      if(prefill&&paymentId){fields.bulk_query.value=code('TT',paymentId);const item=data.items.find(row=>String(row.payment.payment_id)===String(paymentId));if(item)selected.add(String(paymentId));}
      render();
    }catch(cause){if(alive()){results.innerHTML='<p class="admin-refund-status">Không tải được giao dịch. <button type="button" class="secondary" data-refund-retry>Thử lại</button></p>';error(cause);}}
    finally{loading=false;if(alive())count();}
  }
  function apply(){if(saving||loading)return;selected.clear();feedback.hidden=true;outcomes.innerHTML='';render();}
  for(const name of ['bulk_room','bulk_date','bulk_period'])fields[name].addEventListener('change',apply);
  fields.bulk_date.addEventListener('input',apply);fields.bulk_query.addEventListener('input',apply);
  fields.bulk_query.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();apply();}});
  fields.bulk_reason.addEventListener('input',()=>fields.bulk_reason.setCustomValidity(''));
  results.addEventListener('click',event=>{if(event.target.closest('[data-refund-retry]')&&!loading)void load();});
  results.addEventListener('change',event=>{
    if(saving||loading)return;
    const node=event.target;
    if(node.matches('[data-bulk-all]')){rows.forEach(({payment})=>{const id=String(payment.payment_id);if(!uncertainPayments.has(id))node.checked?selected.add(id):selected.delete(id);});results.querySelectorAll('[data-bulk-row]:not(:disabled)').forEach(input=>input.checked=selected.has(input.dataset.bulkRow));}
    else if(node.matches('[data-bulk-row]'))node.checked?selected.add(node.dataset.bulkRow):selected.delete(node.dataset.bulkRow);
    count();
  });
  const showOutcomes=items=>{
    outcomes.innerHTML=table(['Giao dịch','Kết quả'],items.map(item=>[esc(code('TT',item.id)),esc(item.message)]),'Kết quả hoàn tiền');
  };
  async function submit(event) {
    event.preventDefault();if(saving||loading||!alive()||!picked().length)return;
    if(!fields.bulk_reason.value.trim()){fields.bulk_reason.setCustomValidity('Vui lòng nhập lý do hoàn tiền.');fields.bulk_reason.reportValidity();return;}
    if(!form.reportValidity())return;
    const batch=picked(),reason=`${fields.bulk_reason_group.value}: ${fields.bulk_reason.value.trim()}`;
    saving=true;controls().forEach(node=>node.disabled=true);form.setAttribute('aria-busy','true');feedback.hidden=false;feedback.dataset.error='false';feedback.textContent=`Đang xử lý ${batch.length} giao dịch…`;
    let processed=[];
    try {
      processed=await executeRefundBatch(batch,reason,{signal:request.signal,isActive:alive,onProgress:items=>{processed=items;if(alive()){showOutcomes(items);feedback.textContent=`Đã xử lý ${items.length} / ${batch.length} giao dịch.`;}}});
      if(!alive())return;
      processed.filter(item=>item.status==='uncertain').forEach(item=>uncertainPayments.add(String(item.id)));
      const completed=processed.filter(item=>item.status==='success').length,failed=processed.filter(item=>item.status==='failed'||item.status==='uncertain').length;
      feedback.textContent=`Đã hoàn tiền ${completed} giao dịch. ${failed?`${failed} giao dịch chưa hoàn thành. `:''}${processed.length<batch.length?`${batch.length-processed.length} giao dịch chưa được gửi.`:''}`;
      feedback.dataset.error=String(failed>0);showOutcomes(processed);
      if(batchFinishedSuccessfully(processed,batch.length,item=>item.status==='success'||item.status==='already')) {
        saving=false;opened.close();
        try {await onSaved?.();}catch(cause){ctx.handle(cause);}
        return;
      }
      try {await onSaved?.();}catch {feedback.textContent+=' Chưa cập nhật được danh sách thanh toán.';}
      selected.clear();await load();
    }catch(cause){if(alive())error(cause);}
    finally{saving=false;if(alive()){controls().forEach(node=>node.disabled=false);form.setAttribute('aria-busy','false');render();}}
  }
  confirm.addEventListener('click',submit);form.addEventListener('submit',submit);
  form.querySelector('[data-bulk-close]').addEventListener('click',opened.close);
  await load(true);return opened;
}
