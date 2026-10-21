import * as auth from "../api/auth.js";
import { facts, date, stamp, label } from "./admin_ui.js";
import { code } from "./business_codes.js";

export function userAccountDetails(row) {
  const value=v=>v==null||v===""?"Chưa cập nhật":v;
  const section=(title,entries)=>`<section class="admin-account-detail-section"><h3>${title}</h3>${facts(entries)}</section>`;
  return `<div class="admin-account-details">`+section("Thông tin cá nhân",[
    ["Mã tài khoản",code("TK",row.user_id)],["Họ và tên",value(row.full_name)],
    ["Email",value(row.email)],["Điện thoại",value(row.phone)],
    ["Ngày sinh",row.dob?date(row.dob):"Chưa cập nhật"],["Giới tính",value(row.gender)],
    ["CCCD",value(row.id_card)],["Địa chỉ",value(row.address)],
  ])+section("Tài khoản và quyền truy cập",[
    ["Vai trò",label(row.role_name)],["Trạng thái tài khoản",label(row.account_status)],
    ["Phê duyệt",label(row.approval_status)],
  ])+section("Liên hệ khẩn cấp",[
    ["Người liên hệ khẩn cấp",value(row.emergency_contact_name)],
    ["Số điện thoại khẩn cấp",value(row.emergency_contact_phone)],
    ["Quan hệ với người liên hệ",value(row.emergency_contact_relationship)],
  ])+section("Thông tin hệ thống",[
    ["Ngày tạo",stamp(row.created_at)],["Cập nhật lần cuối",stamp(row.updated_at)],
  ])+`</div>`;
}

export async function saveUserAccount(id, payload, {signal,onSaved=()=>{}}={}) {
  const {account_status,...profile}=payload;
  // Validate self-locking before saving any other edits in this form.
  if(account_status) {
    if(!["ACTIVE","LOCKED"].includes(account_status))throw new Error("Trạng thái tài khoản không hợp lệ.");
    const {user}=await auth.getMe({signal});
    if(String(user.user_id)===String(id))throw new Error("Không thể tự khóa hoặc đổi trạng thái tài khoản của chính mình.");
  }
  let result;
  if(Object.keys(profile).length) {
    result=await auth.updateUser(id,profile,{signal});onSaved(result.user);
  }
  if(account_status) {
    try {result=await auth.setAccountStatus(id,{account_status},{signal});onSaved(result.user);}
    catch(error) {
      if(result)error.message=`Thông tin cá nhân đã được lưu, nhưng chưa đổi được trạng thái tài khoản. ${error.message}`;
      throw error;
    }
  }
  return result;
}
