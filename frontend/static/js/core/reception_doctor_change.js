import {apiRequest} from './api.js';
import {esc,date,table} from './admin_ui.js';
import {code} from './business_codes.js';

const draftPayload=input=>{
  const reason=String(input.reason||'').trim();
  const key=input.target_schedule_id!=null?'target_schedule_id':'doctor_profile_id',id=Number(input[key]);
  if(!Number.isSafeInteger(id)||id<1||!reason||reason.length>500)throw new Error('Chọn bác sĩ hoặc ca hợp lệ và nhập lý do, tối đa 500 ký tự.');
  return {[key]:id,reason};
};
export async function previewDoctorChange(scheduleId,input,options={}){
  const payload=draftPayload(input);
  const preview=await apiRequest(`/staff/schedules/${scheduleId}/doctor-change/preview`,{...options,method:'POST',data:payload});
  const expected=payload.target_schedule_id?[Number(scheduleId),payload.target_schedule_id]:[Number(scheduleId)];
  if(!preview||!Array.isArray(preview.schedules)||!Array.isArray(preview.affected_encounters)||typeof preview.version!=='string'||!preview.version||!preview.replacements
    ||preview.schedules.length!==expected.length||new Set(preview.schedules.map(row=>Number(row.schedule_id))).size!==expected.length
    ||preview.schedules.some(row=>!expected.includes(Number(row.schedule_id))||!Number.isSafeInteger(Number(preview.replacements[row.schedule_id]))||Number(preview.replacements[row.schedule_id])<1)
    ||preview.schedules.some(row=>!Number.isSafeInteger(Number(row.doctor_profile_id))||Number(row.doctor_profile_id)<1)
    ||new Set(preview.affected_encounters.map(row=>row.encounter_id)).size!==preview.affected_encounters.length
    ||preview.affected_encounters.some(row=>!Number.isSafeInteger(row.encounter_id)||row.encounter_id<1||!expected.includes(Number(row.schedule_id))))throw new Error('Bản xem trước không khớp ca đã chọn. Vui lòng tải lại.');
  const source=preview.schedules.find(row=>Number(row.schedule_id)===Number(scheduleId));
  if(payload.doctor_profile_id&&Number(preview.replacements[scheduleId])!==payload.doctor_profile_id)throw new Error('Bác sĩ trong bản xem trước không khớp lựa chọn.');
  if(payload.target_schedule_id){
    const other=preview.schedules.find(row=>Number(row.schedule_id)===payload.target_schedule_id);
    if(Number(preview.replacements[scheduleId])!==Number(other.doctor_profile_id)||Number(preview.replacements[other.schedule_id])!==Number(source.doctor_profile_id))throw new Error('Bản xem trước hoán đổi không khớp hai bác sĩ.');
  }
  // A confirmation must use exactly the payload/version the user reviewed.
  return Object.freeze({scheduleId:Number(scheduleId),payload:Object.freeze(payload),preview:JSON.parse(JSON.stringify(preview))});
}
export async function confirmDoctorChange(review,options={}){
  const {scheduleId,payload,preview}=review;
  const result=await apiRequest(`/staff/schedules/${scheduleId}/doctor-change`,{...options,method:'POST',data:{...payload,expected_version:preview.version}});
  if(!Array.isArray(result?.schedules)||result.schedules.length!==preview.schedules.length||new Set(result.schedules.map(row=>String(row.schedule_id))).size!==preview.schedules.length
    ||preview.schedules.some(before=>!result.schedules.some(after=>String(after.schedule_id)===String(before.schedule_id)&&String(after.doctor_profile_id)===String(preview.replacements[before.schedule_id])))
    ||result.affected_count!==preview.affected_encounters.length)throw new Error('Đã gửi yêu cầu nhưng phản hồi chưa khớp. Hãy tải lại để kiểm tra trước khi thao tác tiếp.');
  return result;
}
export function doctorChangeReviewMarkup(review,doctors=[]){
  const {preview}=review;
  const name=id=>doctors.find(row=>String(row.doctor_profile_id)===String(id))?.full_name||code('BS',id);
  return `<section class="doctor-change-review" aria-label="Xem trước thay đổi bác sĩ"><h3>Xem trước thay đổi</h3><p><strong>${preview.affected_encounters.length} lượt khám bị ảnh hưởng</strong></p>${table(['Mã ca','Ngày','Thời gian','Phòng','Bác sĩ trước','Bác sĩ sau','Số lượt'],preview.schedules.map(row=>[
    esc(code('CA',row.schedule_id)),date(row.work_date),esc(`${row.start_time} – ${row.end_time}`),esc(row.room_name),esc(row.doctor_name||name(row.doctor_profile_id)),esc(name(preview.replacements[row.schedule_id])),String(preview.affected_encounters.filter(visit=>String(visit.schedule_id)===String(row.schedule_id)).length)
  ]),'Bác sĩ trước và sau thay đổi')}<p>Lý do: ${esc(review.payload.reason)}</p><p>Kiểm tra thông tin trên rồi bấm Xác nhận thay đổi để lưu.</p></section>`;
}
