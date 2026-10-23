import * as encounters from '../api/encounter.js';
import {allPages} from './admin_ui.js';
import {getStaffRoomOptions,assignStaffRoom} from '../api/schedule.js';

export {getStaffRoomOptions};
export async function assignReceptionRoom(schedule,roomId,reason,options={}) {
  const explanation=String(reason||'').trim();
  if(!explanation || explanation.length>500)throw new Error('Vui lòng nhập lý do, tối đa 500 ký tự.');
  if(!Number.isInteger(Number(roomId)) || Number(roomId)<1)throw new Error('Vui lòng chọn phòng khám.');
  const {schedule:result}=await assignStaffRoom(schedule.schedule_id,{room_id:Number(roomId),reason:explanation,expected_version:schedule.version},options);
  if(!result || String(result.schedule_id)!==String(schedule.schedule_id) || String(result.room_id)!==String(roomId)
    || ['doctor_profile_id','work_date','start_time','end_time','max_quota','slot_minutes','booked_count','schedule_status'].some(key=>schedule[key]!=null && String(result[key])!==String(schedule[key])))throw new Error('Yêu cầu đã gửi nhưng phản hồi chưa khớp ca khám. Hãy tải lại để kiểm tra trước khi thao tác tiếp.');
  return result;
}

export const canTransferEncounter = row => ['CONFIRMED','CHECKED_IN'].includes(row.encounter_status);
export const loadTransferOptions = (id,options={}) => allPages((params,opts)=>encounters.getTransferOptions(id,params,opts),{},options.signal);
export async function transferReceptionEncounter(visit,schedule,appointmentTime,reason,options={}) {
  const explanation=String(reason||'').trim();
  if(!explanation || explanation.length>1000)throw new Error('Vui lòng nhập lý do chuyển, tối đa 1000 ký tự.');
  const {encounter:current}=await encounters.getEncounter(visit.encounter_id,options);
  if(String(current?.encounter_id)!==String(visit.encounter_id) || !canTransferEncounter(current))throw new Error('Lượt khám không còn đủ điều kiện chuyển. Vui lòng tải lại danh sách.');
  if(['patient_id','schedule_id','doctor_profile_id','encounter_status'].some(key=>String(current[key])!==String(visit[key])))throw new Error('Lượt khám đã thay đổi. Vui lòng chọn lại lượt khám.');
  const targets=await loadTransferOptions(visit.encounter_id,options);
  const target=targets.find(row=>String(row.schedule_id)===String(schedule.schedule_id));
  if(!target || String(target.doctor_profile_id)!==String(schedule.doctor_profile_id) || !target.slots?.some(slot=>slot.appointment_time===appointmentTime))throw new Error('Ca hoặc khung giờ đã thay đổi. Vui lòng chọn lại ca chuyển.');
  const {encounter:result}=await encounters.transfer(visit.encounter_id,{schedule_id:target.schedule_id,appointment_time:appointmentTime,reason:explanation},options);
  const unchanged=['encounter_id','patient_id','encounter_status','ticket_code','consultation_fee_snapshot','deposit_amount_snapshot'];
  if(!result || unchanged.some(key=>current[key]!=null && String(result[key])!==String(current[key])) || String(result.schedule_id)!==String(target.schedule_id) || String(result.doctor_profile_id)!==String(target.doctor_profile_id))throw new Error('Yêu cầu đã được gửi nhưng phản hồi chưa khớp lượt khám. Hãy tải lại để kiểm tra trước khi thao tác tiếp.');
  return result;
}
