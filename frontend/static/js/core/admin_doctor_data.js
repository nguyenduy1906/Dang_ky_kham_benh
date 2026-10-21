import {getDoctor,updateDoctor} from '../api/doctor.js';
import {getUser,setAccountStatus} from '../api/auth.js';

export async function loadAdminDoctor(id,{signal}={}){
  const {doctor}=await getDoctor(id,{signal});
  if(String(doctor?.doctor_profile_id)!==String(id)||!doctor.user_id)throw new Error('Không xác định được tài khoản của bác sĩ.');
  const {user}=await getUser(doctor.user_id,{signal});
  if(String(user?.user_id)!==String(doctor.user_id))throw new Error('Tài khoản không khớp hồ sơ bác sĩ.');
  return {...doctor,account:user};
}

export async function saveAdminDoctor(row,payload,status,{signal,onSaved=()=>{}}={}){
  const changes=Object.fromEntries(Object.entries(payload).filter(([key,value])=>value!==(row[key]??null)));
  const changeStatus=status!=null&&status!==row.account?.account_status;
  if(status!=null&&!['ACTIVE','LOCKED'].includes(status))throw new Error('Trạng thái tài khoản không hợp lệ.');
  let account=row.account;
  if(changeStatus){
    account=(await getUser(row.user_id,{signal})).user;
    if(String(account?.user_id)!==String(row.user_id)||account.is_deleted||account.role_name!=='DOCTOR')throw new Error('Tài khoản bác sĩ đã thay đổi hoặc ngừng sử dụng. Hãy mở lại biểu mẫu.');
  }
  if(!Object.keys(changes).length&&!changeStatus)throw new Error('Chưa có thay đổi để lưu.');
  let savedProfile=false;
  if(Object.keys(changes).length){
    const result=await updateDoctor(row.doctor_profile_id,changes,{signal});
    if(String(result.doctor?.doctor_profile_id)!==String(row.doctor_profile_id))throw new Error('Chưa xác minh được kết quả lưu hồ sơ bác sĩ.');
    Object.assign(row,result.doctor);savedProfile=true;onSaved(row);
  }
  if(changeStatus){
    try{
      if(account.account_status!==status)account=(await setAccountStatus(row.user_id,{account_status:status},{signal})).user;
      if(String(account?.user_id)!==String(row.user_id)||account.account_status!==status)throw new Error('Chưa xác minh được trạng thái tài khoản. Hãy mở lại để kiểm tra.');
      row.account=account;row.account_ok=!account.is_deleted&&status==='ACTIVE'&&account.approval_status==='APPROVED';onSaved(row);
    }catch(error){
      if(savedProfile)error.message=`Thông tin chuyên môn đã được lưu; trạng thái tài khoản chưa được xác nhận. ${error.message}`;
      throw error;
    }
  }
  return {doctor:row};
}
