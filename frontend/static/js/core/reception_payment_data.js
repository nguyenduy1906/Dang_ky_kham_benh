import {createStaffIntent,confirmStaffPayment,getPayment,listEncounterPayments} from '../api/payment.js';
import {getEncounter} from '../api/encounter.js';
import {allPages} from './booking.js';
function identity(payment,encounterId){if(!payment?.payment_id||String(payment.encounter_id)!==String(encounterId)||!['DEPOSIT','EXAM_FEE'].includes(payment.payment_type))throw new Error('Giao dịch thanh toán không khớp lượt khám.');return payment;}
export async function createReceptionPayment(encounterId,patientId,method,options={}){
 if(!['CASH','BANK','EWALLET','CARD'].includes(method))throw new Error('Phương thức thanh toán không hợp lệ.');
 const {encounter}=await getEncounter(encounterId,options);
 if(String(encounter?.encounter_id)!==String(encounterId)||String(encounter.patient_id)!==String(patientId)||!['HOLDING','CHECKED_IN','IN_PROGRESS','COMPLETED'].includes(encounter.encounter_status))throw new Error('Lượt khám không còn chờ thanh toán. Vui lòng cập nhật trạng thái.');
 let result;
 try{result=await createStaffIntent(encounterId,{payment_method:method},options);}
 catch(error){
  if(error.status>=400&&error.status<500)throw error;
  const rows=await allPages((params,opts)=>listEncounterPayments(encounterId,params,opts),{},options);
  const pending=rows.filter(p=>p.payment_method===method&&p.transaction_status==='PENDING'&&['DEPOSIT','EXAM_FEE'].includes(p.payment_type));
  if(pending.length!==1)throw new Error('Chưa xác định được kết quả tạo giao dịch. Vui lòng cập nhật trạng thái trước khi thao tác tiếp.');
  result={payment:pending[0],encounter};
 }
 const payment=identity(result.payment,encounterId);
 if(payment.payment_method!==method||(payment.payment_type==='DEPOSIT'?Number(payment.amount)!==Number(encounter.deposit_amount_snapshot):Number(payment.amount)>Number(encounter.consultation_fee_snapshot)))throw new Error('Số tiền hoặc phương thức trả về không khớp giá đã chốt. Vui lòng cập nhật trạng thái.');
 return result;
}
export async function confirmReceptionPayment(review,outcome,options={}){
 if(!['SUCCESS','FAILED'].includes(outcome))throw new Error('Kết quả thanh toán không hợp lệ.');
 const {payment:fresh}=await getPayment(review.payment_id,options);identity(fresh,review.encounter_id);
 if(String(fresh.payment_id)!==String(review.payment_id)||Number(fresh.amount)!==Number(review.amount)||fresh.payment_method!==review.payment_method)throw new Error('Giao dịch đã thay đổi. Vui lòng kiểm tra lại trước khi xác nhận.');
 let result;
 try{result=await confirmStaffPayment(review.payment_id,{result:outcome,...(review.note?{note:review.note}:{})},options);}
 catch(error){
  if(error.status>=400&&error.status<500)throw error;
  const [{payment},{encounter}]=await Promise.all([getPayment(review.payment_id,options),getEncounter(review.encounter_id,options)]);
  if(!payment.result_received_at||!(outcome==='SUCCESS'?['SUCCESS','REFUNDED'].includes(payment.transaction_status):payment.transaction_status==='FAILED'))throw new Error('Chưa xác định được kết quả xác nhận. Vui lòng cập nhật trạng thái trước khi gửi lại.');
  result={payment,encounter};
 }
 identity(result.payment,review.encounter_id);
 if(String(result.payment.payment_id)!==String(review.payment_id)||String(result.encounter?.encounter_id)!==String(review.encounter_id))throw new Error('Phản hồi xác nhận không khớp giao dịch. Vui lòng cập nhật trạng thái.');
 return result;
}
