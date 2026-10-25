import {staffReady} from '../core/staff_workspace.js';
import {listStaffPayments,getPayment,listEncounterPayments,listPaymentOptions} from '../api/payment.js';
import {getPatient} from '../api/patient.js';
import {getEncounter} from '../api/encounter.js';
import {createReceptionPayment,confirmReceptionPayment} from '../core/reception_payment_data.js';
import {paymentStatusBadge,paymentMethodLabel} from '../core/admin_payment_view.js';
import {encounterTypeBadge} from '../core/encounter_type.js';
import {code,parseCode} from '../core/business_codes.js';
import {allPages,money,todayVN} from '../core/booking.js';
import {startAutoRefresh} from '../core/auto_refresh.js';
import {bindLiveSearch} from '../core/live_search.js';
import {$,esc,date,time,facts,pagination} from '../core/staff_ui.js';
if(await staffReady)await init();
async function init(){
 const filters=$('#payment-search'),modal=$('#payment-dialog'),form=$('#payment-request-form'),review=$('#payment-request-preview'),feedback=$('#payment-filter-error'),check=$('#payment-request-check'),submit=form.querySelector('[type="submit"]');
 filters.elements.from_date.value=filters.elements.to_date.value=todayVN();
 let active=true,version=0,request,page=1,modalVersion=0,busy=false,visit,payment,historyRows=[];
 const stop=()=>{active=false;version++;modalVersion++;request?.abort();modal.close();};window.addEventListener('pagehide',stop,{once:true});window.addEventListener('neu:auth-change',stop,{once:true});
 const message=text=>{feedback.textContent=text;feedback.hidden=!text;};
 async function load(next=1){
  page=next;const token=++version;request?.abort();request=new AbortController();
  const params=Object.fromEntries(new FormData(filters));
  if(params.from_date&&params.to_date&&params.from_date>params.to_date){message('Từ ngày phải trước hoặc bằng Đến ngày.');return;}
  try{
   const result=await listStaffPayments({...params,page,page_size:10},{signal:request.signal});if(!active||token!==version)return;
   historyRows=result.items;message('');
   $('#payment-results').innerHTML=result.items.length?result.items.map(p=>`<tr><td>${esc(code('TT',p.payment_id))}</td><td>${esc(code('LK',p.encounter_id))}<small class="cell-subtitle">${esc(p.patient_name)}</small></td><td class="payment-channel">${encounterTypeBadge(p.encounter_type)}</td><td>${p.payment_type==='REFUND'?'Hoàn tiền':'Phí khám'}</td><td>${esc(money(p.amount))}</td><td>${esc(paymentMethodLabel(p.payment_method))}</td><td>${date(p.refunded_at||p.paid_at||p.result_received_at||p.created_at)} ${time(p.refunded_at||p.paid_at||p.result_received_at||p.created_at)}</td><td>${paymentStatusBadge(p.transaction_status)}</td><td><div class="actions"><button class="secondary" type="button" data-detail="${p.payment_id}">Chi tiết</button>${p.transaction_status==='PENDING'&&['DEPOSIT','EXAM_FEE'].includes(p.payment_type)?`<button type="button" data-confirm="${p.payment_id}">Xác nhận</button>`:''}</div></td></tr>`).join(''):'<tr><td colspan="9" class="reception-payment-empty">Chưa có giao dịch phù hợp.</td></tr>';
   pagination(result,load,$('.reception-payment-pagination'));
  }catch(error){if(active&&token===version&&error.code!=='CLIENT_ABORTED'){$('#payment-results').innerHTML='<tr><td colspan="9">Không tải được danh sách thanh toán.</td></tr>';message(error.message);}}
 }
 function setBusy(value){busy=value;form.dataset.busy=String(value);form.querySelectorAll('button,input,select,textarea').forEach(n=>n.disabled=value);$('#payment-dialog-close').disabled=value;}
 function reset(){$('#payment-dialog-title').textContent='Yêu cầu thanh toán';form.reset();form.elements.note.readOnly=false;visit=null;payment=null;modalVersion++;form.elements.encounter_code.readOnly=false;form.elements.payment_method.disabled=false;review.hidden=true;review.replaceChildren();check.hidden=true;form.elements.verified.required=false;$('#payment-request-failed').hidden=true;submit.textContent='Tạo yêu cầu thanh toán';submit.disabled=true;$('#payment-amount-preview').textContent='';}
 function fill(row,amount){visit=row;form.elements.encounter_code.value=code('LK',row.encounter_id);form.elements.full_name.value=row.patient_name||'';form.elements.phone.value=row.patient_phone||row.registration_details?.phone||'';form.elements.amount.value=money(amount);$('#payment-amount-preview').textContent=money(amount);form.elements.payment_type.value=row.encounter_status==='HOLDING'?'Phí đăng ký khám':'Phí khám còn lại';submit.disabled=amount<0;}
 function showReview(p){$('#payment-dialog-title').textContent=p.transaction_status==='PENDING'?'Xác nhận thanh toán':'Chi tiết thanh toán';form.elements.payment_type.value=p.payment_type==='REFUND'?'Hoàn tiền':p.payment_type==='DEPOSIT'?'Phí đăng ký khám':'Phí khám còn lại';form.elements.note.readOnly=p.transaction_status!=='PENDING';payment={...p};form.elements.encounter_code.readOnly=true;form.elements.payment_method.value=p.payment_method;form.elements.payment_method.disabled=true;review.hidden=false;review.innerHTML=facts([['Mã thanh toán',code('TT',p.payment_id)],['Lượt khám',code('LK',p.encounter_id)],['Người bệnh',visit.patient_name],['Số tiền',money(p.amount)],['Phương thức',paymentMethodLabel(p.payment_method)]]);check.hidden=false;form.elements.verified.required=true;form.elements.verified.checked=false;submit.textContent='Xác nhận đã thu tiền';submit.disabled=false;$('#payment-request-failed').hidden=p.transaction_status!=='PENDING';}
 async function selectVisit(id){
  const token=++modalVersion;visit=null;submit.disabled=true;
  try{const [{encounter:row},payments]=await Promise.all([getEncounter(id),allPages((params,opts)=>listEncounterPayments(id,params,opts))]);if(!active||token!==modalVersion)return;
   if(String(row.encounter_id)!==String(id))throw new Error('Lượt khám trả về không khớp lựa chọn.');
   if(row.consultation_fee_snapshot==null||row.deposit_amount_snapshot==null)throw new Error('Lượt khám chưa có giá đã chốt; cần đối soát trước khi thu tiền.');
   const paid=payments.filter(p=>['SUCCESS','REFUNDED'].includes(p.transaction_status)&&['DEPOSIT','EXAM_FEE'].includes(p.payment_type)).reduce((sum,p)=>sum+Number(p.amount),0);
   const due=row.encounter_status==='HOLDING'?Number(row.deposit_amount_snapshot):Number(row.consultation_fee_snapshot)-paid;
   if(!['HOLDING','CHECKED_IN','IN_PROGRESS','COMPLETED'].includes(row.encounter_status)||!Number.isFinite(due)||(row.encounter_status==='HOLDING'?due<0:due<=0))throw new Error('Lượt khám không còn khoản phí có thể thu.');const {patient}=await getPatient(row.patient_id);if(!active||token!==modalVersion)return;fill({...row,patient_phone:patient.phone},due);review.hidden=true;const pending=payments.find(p=>p.transaction_status==='PENDING'&&['DEPOSIT','EXAM_FEE'].includes(p.payment_type));if(pending)showReview(pending);
  }catch(error){if(active&&token===modalVersion){review.hidden=false;review.textContent=error.message;}}
 }
 $('#request-payment').onclick=async()=>{
  reset();modal.showModal();const token=modalVersion;
  try{const rows=await allPages(listPaymentOptions);if(!active||token!==modalVersion)return;$('#payment-encounters').innerHTML=rows.map(row=>`<option value="${esc(code('LK',row.encounter_id))}" label="${esc(row.patient_name)} · ${esc(money(row.amount_due))}"></option>`).join('');if(!rows.length){review.hidden=false;review.textContent='Hiện không có lượt khám còn phí cần thanh toán.';}}catch(error){if(active&&token===modalVersion){review.hidden=false;review.textContent=error.message;}}
 };
 form.elements.encounter_code.addEventListener('input',()=>{if(payment)return;modalVersion++;visit=null;submit.disabled=true;form.elements.full_name.value=form.elements.phone.value=form.elements.amount.value='';let id;try{id=parseCode(form.elements.encounter_code.value.trim(),'LK');}catch{return;}if(id)void selectVisit(id);});
 const close=()=>{if(!busy){modalVersion++;modal.close();}};$('#payment-dialog-close').onclick=close;$('#payment-request-cancel').onclick=close;modal.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 async function finish(outcome){
  if(busy||!payment||!form.reportValidity())return;setBusy(true);review.hidden=false;
  try{const response=await confirmReceptionPayment({...payment,note:form.elements.note.value.trim()},outcome);if(!active)return;modal.close();await load(page);message(response.payment.transaction_status==='REFUNDED'?'Tiền đến khi lịch không còn hiệu lực đã được hoàn.':outcome==='SUCCESS'?'Đã ghi nhận thanh toán.':'Đã ghi nhận giao dịch không thành công.');}
  catch(error){if(active)review.textContent=error.message;}
  finally{if(active){setBusy(false);if(payment)form.elements.payment_method.disabled=true;}}
 }
 form.onsubmit=async event=>{
  event.preventDefault();if(busy)return;if(payment){await finish('SUCCESS');return;}if(!visit||!form.reportValidity())return;
  setBusy(true);try{const response=await createReceptionPayment(visit.encounter_id,visit.patient_id,form.elements.payment_method.value);if(!active)return;showReview(response.payment);await load(page);}catch(error){if(active){review.hidden=false;review.textContent=error.message;}}finally{if(active){setBusy(false);if(payment)form.elements.payment_method.disabled=true;}}
 };
 $('#payment-request-failed').onclick=()=>void finish('FAILED');
 $('#payment-results').addEventListener('click',event=>{
  const button=event.target.closest('[data-detail],[data-confirm]');if(!button)return;const id=button.dataset.detail||button.dataset.confirm;const row=historyRows.find(p=>String(p.payment_id)===String(id));if(!row)return;
  reset();modal.showModal();const token=modalVersion;
  void Promise.all([getPayment(id),getEncounter(row.encounter_id)]).then(([{payment:p},{encounter}])=>{
   if(!active||token!==modalVersion)return;if(String(p.encounter_id)!==String(encounter.encounter_id)||String(p.payment_id)!==String(id))throw new Error('Giao dịch không khớp lượt khám.');
   fill({...encounter,patient_phone:row.patient_phone},p.amount);form.elements.note.value=p.reason||'';showReview(p);
   if(p.transaction_status!=='PENDING'||p.payment_type==='REFUND'){submit.hidden=true;check.hidden=true;$('#payment-request-failed').hidden=true;review.innerHTML+=`<p>${paymentStatusBadge(p.transaction_status)}</p>`;}else submit.hidden=false;
  }).catch(error=>{if(active&&token===modalVersion){review.hidden=false;review.textContent=error.message;}});
 });
 const live=bindLiveSearch(filters.elements.q,()=>load(),{invalidate(){version++;request?.abort();}});filters.onsubmit=event=>{event.preventDefault();live();};for(const name of ['status','from_date','to_date'])filters.elements[name].addEventListener('change',()=>void load());for(const name of ['from_date','to_date'])filters.elements[name].addEventListener('input',()=>void load());
 // Reset buttons left by a read-only transaction detail before opening a new request.
 modal.addEventListener('close',()=>{submit.hidden=false;});
 await load();startAutoRefresh(()=>load(page),{canRefresh:()=>active&&!busy&&!modal.open});
}
