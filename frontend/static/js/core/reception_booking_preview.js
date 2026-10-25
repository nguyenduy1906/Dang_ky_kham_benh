// UI draft only: this module never creates an encounter or a payment.
const prefix='neu:reception-booking-preview:';
export function previewPatientId(value){return /^[1-9]\d*$/.test(String(value||''))&&Number.isSafeInteger(Number(value))?Number(value):null;}
export function makeReceptionPreview(actor,patient,doctor,schedule,slot,symptoms){
  if(actor?.role_name!=='RECEPTIONIST')throw new Error('Chỉ lễ tân được mở luồng đăng ký tại quầy.');
  if(!previewPatientId(patient?.patient_id)||patient.archived_at||patient.is_archived)throw new Error('Hồ sơ người bệnh không còn sử dụng được.');
  if(!schedule?.schedule_id||String(schedule.doctor_profile_id)!==String(doctor?.doctor_profile_id)||!schedule.slots?.some(item=>item.appointment_time===slot?.appointment_time))throw new Error('Vui lòng chọn bác sĩ và khung giờ phù hợp.');
  const text=String(symptoms||'').trim();if(!text||text.length>2000)throw new Error('Vui lòng mô tả vấn đề sức khỏe, tối đa 2.000 ký tự.');
  return {context:'RECEPTION_PREVIEW',user_id:actor.user_id,patient_id:patient.patient_id,patient,doctor,schedule,slot,symptoms:text,updatedAt:Date.now()};
}
export function saveReceptionPreview(value,key=crypto.randomUUID()){sessionStorage.setItem(prefix+key,JSON.stringify({...value,updatedAt:Date.now()}));return key;}
export function readReceptionPreview(key,actor){
  if(!/^[a-f0-9-]{36}$/i.test(key||'')||actor?.role_name!=='RECEPTIONIST')return null;
  try{const value=JSON.parse(sessionStorage.getItem(prefix+key));return value?.context==='RECEPTION_PREVIEW'&&value.user_id===actor.user_id&&previewPatientId(value.patient_id)&&String(value.patient?.patient_id)===String(value.patient_id)&&Number.isFinite(value.updatedAt)&&Date.now()-value.updatedAt<30*60000?value:null;}catch{return null;}
}
