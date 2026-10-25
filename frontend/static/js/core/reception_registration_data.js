import {listPatients} from '../api/patient.js';
import * as encounters from '../api/encounter.js';
import {listEncounterPayments} from '../api/payment.js';
import {allPages,clock} from './booking.js';
import {bookReceptionPatient,loadBookingOptions} from './reception_coordination_data.js';

export async function readReceptionRegistration(id,patientId,options={}){
 const {encounter}=await encounters.getEncounter(id,options);
 if(String(encounter?.encounter_id)!==String(id)||String(encounter.patient_id)!==String(patientId))throw new Error('Lượt khám trả về không khớp người bệnh đã chọn.');
 return encounter;
}
export async function recoverReceptionRegistration(draft,actor,options={}){
 const rows=await allPages(encounters.listEncounters,{patient_id:draft.patient_id,schedule_id:draft.schedule.schedule_id,work_date:draft.schedule.work_date},options);
 const matches=rows.filter(row=>String(row.patient_id)===String(draft.patient_id)&&String(row.schedule_id)===String(draft.schedule.schedule_id)&&String(row.created_by_id)===String(actor.user_id)&&row.symptoms===draft.symptoms&&Number.isFinite(Date.parse(row.estimated_exam_at))&&clock(row.estimated_exam_at)===draft.slot.appointment_time&&Date.parse(row.created_at)>=draft.submission_started_at-10000);
 if(matches.length!==1)throw new Error('Chưa xác định được kết quả đăng ký. Hãy cập nhật trạng thái hoặc kiểm tra danh sách trước khi gửi lại.');
 return matches[0];
}
export async function submitReceptionRegistration(draft,actor,{persist,...options}={}){
 if(actor?.role_name!=='RECEPTIONIST'||draft.user_id!==actor.user_id)throw new Error('Phiên đăng ký không khớp tài khoản lễ tân.');
 if(draft.encounter_id)return readReceptionRegistration(draft.encounter_id,draft.patient_id,options);
 if(draft.submission_state==='UNCERTAIN')return recoverReceptionRegistration(draft,actor,options);
 const targets=await loadBookingOptions(draft.patient_id,draft.schedule.work_date,options);
 const schedule=targets.find(row=>String(row.schedule_id)===String(draft.schedule.schedule_id)&&String(row.doctor_profile_id)===String(draft.doctor.doctor_profile_id));
 if(!schedule?.slots?.some(slot=>slot.appointment_time===draft.slot.appointment_time))throw new Error('Ca hoặc khung giờ đã thay đổi. Vui lòng quay lại chọn lịch.');
 draft.submission_state='UNCERTAIN';draft.submission_started_at=Date.now();persist?.(draft);
 try{
  const result=await bookReceptionPatient(draft.patient,schedule,draft.slot.appointment_time,draft.symptoms,options);
  if(String(result.created_by_id)!==String(actor.user_id)||result.work_date!==draft.schedule.work_date||!Number.isFinite(Date.parse(result.estimated_exam_at))||clock(result.estimated_exam_at)!==draft.slot.appointment_time)throw new Error('Phản hồi đăng ký chưa khớp khung giờ đã chọn.');
  return result;
 }
 catch(error){
  if(error.status>=400&&error.status<500&&error.status!==408){draft.submission_state='REJECTED';persist?.(draft);throw error;}
  return recoverReceptionRegistration(draft,actor,options);
 }
}
export async function readReceptionRegistrationPayments(encounterId,options={}){
 const rows=await allPages((params,opts)=>listEncounterPayments(encounterId,params,opts),{},options);
 if(rows.some(row=>String(row.encounter_id)!==String(encounterId)))throw new Error('Giao dịch trả về không khớp lượt khám.');
 return rows;
}
export function hasVerifiedRegistrationPayment(encounter,payments){
 return ['CONFIRMED','CHECKED_IN','IN_PROGRESS','COMPLETED'].includes(encounter.encounter_status)&&encounter.payment_confirmed===true&&payments.some(row=>row.transaction_status==='SUCCESS'&&['DEPOSIT','EXAM_FEE'].includes(row.payment_type));
}


export async function loadIntakeRegistrations(profiles,today,options={}){
 const groups=await Promise.all(profiles.map(async patient=>{
  const rows=await allPages(encounters.listEncounters,{patient_id:patient.patient_id},options);
  if(rows.some(row=>String(row.patient_id)!==String(patient.patient_id)))throw new Error('Danh sách lượt khám không khớp hồ sơ người bệnh.');
  const active=rows.filter(row=>row.encounter_type==='WALK_IN'&&row.work_date>=today&&['HOLDING','CONFIRMED','CHECKED_IN','IN_PROGRESS'].includes(row.encounter_status)).sort((a,b)=>String(a.work_date).localeCompare(String(b.work_date))||String(a.estimated_exam_at).localeCompare(String(b.estimated_exam_at)));
  const todayHistory=rows.filter(row=>row.encounter_type==='WALK_IN'&&row.work_date===today).sort((a,b)=>Number(b.encounter_id)-Number(a.encounter_id));
  return [String(patient.patient_id),active[0]||todayHistory[0]||null];
 }));
 return new Map(groups);
}


export async function loadDirectIntakePage({q='',work_date='',status=''}={},page=1,size=10,options={}){
 if(status!=='UNREGISTERED'&&work_date&&(!/^\d{4}-\d{2}-\d{2}$/.test(work_date)||!Number.isFinite(Date.parse(work_date))||new Date(work_date).toISOString().slice(0,10)!==work_date))throw new Error('Vui lòng chọn ngày khám hợp lệ.');
 // Unregistered means no active appointment in any channel or day, not a missing visit on the filtered date.
 const unregistered=status==='UNREGISTERED';
 const visitQuery=unregistered||!status?{}:{encounter_type:'WALK_IN',...(work_date?{work_date}:{})};
 const [profiles,visits]=await Promise.all([allPages(listPatients,{include_archived:false},options),allPages(encounters.listEncounters,visitQuery,options)]);
 const registeredPatients=new Set(visits.filter(row=>['HOLDING','CONFIRMED','CHECKED_IN','IN_PROGRESS'].includes(row.encounter_status)).map(row=>String(row.patient_id)));
 const normalize=value=>String(value||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[đĐ]/g,'d').toLowerCase();
 const registrations=new Map();
 const matching=unregistered?[]:visits.filter(row=>row.encounter_type==='WALK_IN'&&(!work_date||row.work_date===work_date)&&(!status||row.encounter_status===status)).sort((a,b)=>Number(b.encounter_id)-Number(a.encounter_id));
 const words=normalize(q).trim().split(/\s+/).filter(Boolean);
 const items=profiles.flatMap(p=>{
  if(p.archived_at||p.is_archived)return [];
  const own=matching.filter(row=>String(row.patient_id)===String(p.patient_id));
  if(unregistered&&registeredPatients.has(String(p.patient_id)))return [];
  if(status&&!unregistered&&!own.length)return [];
  if(!status&&!own.length&&registeredPatients.has(String(p.patient_id)))return [];
  return (own.length?own:[null]).flatMap(visit=>{
   const text=normalize([p.full_name,p.phone,p.id_card,`BN_${String(p.patient_id).padStart(3,'0')}`,visit?.ticket_code,visit?`LK_${String(visit.encounter_id).padStart(3,'0')}`:''].join(' '));
   if(!words.every(word=>text.includes(word)))return [];
   if(visit)registrations.set(String(visit.encounter_id),visit);
   return [{...p,visit}];
  });
 });
 const current=Math.min(Math.max(1,page),Math.max(1,Math.ceil(items.length/size)));
 return {items:items.slice((current-1)*size,current*size),total:items.length,page:current,page_size:size,registrations};
}
