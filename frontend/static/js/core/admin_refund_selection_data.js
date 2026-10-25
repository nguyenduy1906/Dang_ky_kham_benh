import {listEncounters} from '../api/encounter.js';
import {listRooms} from '../api/catalog.js';
import {allPages} from './admin_ui.js';
import {canRequestRefund} from './admin_payment_view.js';
import {readAdminPaymentHistory,readPaymentContext,submitRefundRequest,refundOutcome} from './admin_payment_data.js';
import {code} from './business_codes.js';

// Preview only: the refund endpoint rechecks the saved policy before charging.
export function refundPreview(payment,encounter) {
  if(!refundablePayment(payment,encounter))return 0;
  const amount=Number(payment.amount),policy=encounter.policy_snapshot||{};
  if(!Number.isFinite(amount)||amount<0)return null;
  if(encounter.cancel_origin==='HOSPITAL'||encounter.encounter_status==='NO_SHOW')return amount;
  const reference=Date.parse(encounter.refund_reference_at||encounter.estimated_exam_at),cancelled=Date.parse(encounter.cancelled_at);
  const hours=policy.CANCEL_HOURS_LIMIT,percent=policy.CANCEL_REFUND_PERCENT;
  if(hours==null||percent==null||!Number.isFinite(reference)||!Number.isFinite(cancelled))return null;
  if(reference-cancelled<Number(hours)*3600000)return 0;
  return Math.floor(amount*Number(percent)/100);
}

export function refundablePayment(payment,encounter) {
  if(!encounter||!canRequestRefund(payment))return false;
  if(encounter.encounter_status==='NO_SHOW')return payment.payment_type==='DEPOSIT'&&encounter.policy_snapshot?.NO_SHOW_FORFEIT_DEPOSIT===false;
  return encounter.encounter_status==='CANCELLED'&&(encounter.cancel_origin==='HOSPITAL'||payment.payment_type==='DEPOSIT');
}
export async function readRefundSelectionData(signal) {
  const [payments,encounters,rooms]=await Promise.all([readAdminPaymentHistory({signal}),allPages(listEncounters,{},signal),listRooms({include_inactive:true},{signal}).then(result=>result.items)]);
  const visits=new Map(encounters.map(row=>[String(row.encounter_id),row]));
  const items=[];
  for(const payment of payments) {
    if(!canRequestRefund(payment))continue;
    const encounter=visits.get(String(payment.encounter_id));
    if(!encounter)throw new Error(`Không tải được lượt khám của ${code('TT',payment.payment_id)}. Vui lòng thử lại.`);
    if(refundablePayment(payment,encounter))items.push({payment,encounter});
  }
  return {items,rooms};
}
const normalize=value=>String(value??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[đĐ]/g,'d').toLowerCase().trim();
export function filterRefundSelection(items,filters={}) {
  const query=normalize(filters.query),reference=query.match(/^(tt|lk)_0*(\d+)$/);
  return items.filter(({payment,encounter})=>{
    if(filters.room&&String(encounter.room_id)!==String(filters.room))return false;
    if(filters.day&&String(encounter.work_date).slice(0,10)!==filters.day)return false;
    if(filters.period){if(!encounter.start_time)return false;const period=encounter.start_time.slice(0,5)<'12:00'?'MORNING':'AFTERNOON';if(period!==filters.period)return false;}
    if(reference)return Number(reference[2])===Number(reference[1]==='tt'?payment.payment_id:payment.encounter_id);
    const searchable=normalize([encounter.patient_name,encounter.doctor_name,encounter.room_name,code('TT',payment.payment_id),code('LK',payment.encounter_id),payment.transaction_code].join(' '));
    return query.split(/\s+/).every(word=>searchable.includes(word));
  });
}
const uncertainCodes=new Set(['CLIENT_TIMEOUT','CLIENT_NETWORK_ERROR','CLIENT_INVALID_RESPONSE','CLIENT_ABORTED']);
const sameVisit=(old,current)=>['schedule_id','room_id','work_date','start_time','estimated_exam_at'].every(key=>String(old[key]??'')===String(current[key]??''));
export async function executeRefundBatch(items,reason,{signal,isActive=()=>true,onProgress=()=>{}}={}) {
  if(!reason.trim()||reason.length>1000)throw new Error('Vui lòng nhập lý do hoàn tiền, tối đa 1.000 ký tự.');
  const distinct=[...new Map(items.map(item=>[String(item.payment.payment_id),item])).values()],results=[];
  for(const item of distinct) {
    if(signal?.aborted||!isActive())break;
    const id=item.payment.payment_id;let posting=false;
    try {
      const current=await readPaymentContext(id,{signal});
      if(signal?.aborted||!isActive())break;
      if(current.payment.transaction_status==='REFUNDED')results.push({id,status:'already',message:'Giao dịch đã được hoàn tiền trước đó.'});
      else {
        if(Number(item.payment.amount)!==Number(current.payment.amount)||!sameVisit(item.encounter,current.encounter))throw new Error('Lượt khám đã thay đổi phòng hoặc ca. Vui lòng tra cứu lại.');
        if(!refundablePayment(current.payment,current.encounter))throw new Error('Giao dịch không còn đủ điều kiện yêu cầu hoàn tiền.');
        posting=true;
        const response=await submitRefundRequest(id,reason,{signal});
        let outcome;
        try {outcome=refundOutcome(response);}catch(error){throw Object.assign(error,{code:'CLIENT_INVALID_RESPONSE'});}
        if(outcome.completed&&Number(outcome.refund.original_payment_id)!==Number(id))throw Object.assign(new Error('Phản hồi hoàn tiền không khớp giao dịch gốc.'),{code:'CLIENT_INVALID_RESPONSE'});
        results.push({id,status:outcome.completed?'success':'zero',message:outcome.message,refund:outcome.refund});
      }
    }catch(error) {
      if(posting&&(uncertainCodes.has(error.code)||Number(error.status)>=500)) {
        let confirmed=false;
        if(isActive()&&!signal?.aborted) {
          try {const history=await readAdminPaymentHistory({signal});const refund=history.find(row=>Number(row.original_payment_id)===Number(id)&&row.payment_type==='REFUND'&&row.transaction_status==='SUCCESS');
            if(refund){confirmed=true;results.push({id,status:'success',message:`Đã xác minh hoàn tiền · ${code('TT',refund.payment_id)}.`,refund});}
          }catch { /* Keep the uncertain result; never retry a POST. */ }
        }
        if(!confirmed)results.push({id,status:'uncertain',message:'Chưa xác định được kết quả. Kiểm tra lịch sử trước khi gửi lại.'});
        onProgress([...results]);break;
      }
      results.push({id,status:'failed',message:error.message||'Không thể hoàn tiền.'});
      if(error.status===401||error.status===403){onProgress([...results]);throw Object.assign(error,{results});}
      if(uncertainCodes.has(error.code)){onProgress([...results]);break;}
    }
    onProgress([...results]);
  }
  return results;
}
