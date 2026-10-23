import {apiRequest,pathSegment} from './api.js';
import {esc,options,table,facts,stamp,today} from './admin_ui.js';
const actions={CREATE:'Tạo mới',UPDATE:'Cập nhật',DELETE:'Xóa / ngừng sử dụng',LOCK:'Khóa tài khoản',UNLOCK:'Mở tài khoản'};
const targets={USER:'Tài khoản',PATIENT:'Hồ sơ bệnh nhân',DOCTOR:'Bác sĩ',DEPARTMENT:'Chuyên khoa',ROOM:'Phòng khám',WORK_SCHEDULE:'Lịch làm việc',ASSIGNMENT:'Phân công nhân viên',ARTICLE:'Bài viết',CONFIGURATION:'Cấu hình hệ thống',PAYMENT:'Thanh toán',REVIEW:'Đánh giá',STAFF_LEAVE:'Đơn xin nghỉ'};
const fields={full_name:'Họ tên',role_id:'Vai trò',account_status:'Trạng thái tài khoản',approval_status:'Trạng thái duyệt',deleted_at:'Thời điểm ngừng sử dụng',archived_at:'Thời điểm lưu trữ',gender:'Giới tính',user_id:'Mã tài khoản',department_id:'Mã chuyên khoa',academic_degree:'Học vị',specialization:'Chuyên môn',experience_years:'Số năm kinh nghiệm',consultation_fee:'Phí khám',introduction:'Giới thiệu',is_active:'Đang hoạt động',name:'Tên',description:'Mô tả',group_type:'Khối',overview:'Giới thiệu tổng quan',mission:'Chức năng, nhiệm vụ',cover_image_url:'Ảnh bìa',specialties:'Chuyên môn',clinical_services:'Dịch vụ',equipment:'Trang thiết bị',achievements:'Thành tựu',patient_guide:'Hướng dẫn người bệnh',gallery:'Thư viện ảnh',extra_sections:'Nội dung thêm',room_name:'Tên phòng',doctor_profile_id:'Mã bác sĩ',room_id:'Mã phòng',work_date:'Ngày làm việc',start_time:'Giờ bắt đầu',end_time:'Giờ kết thúc',slot_minutes:'Thời lượng khung giờ',max_quota:'Sức chứa',schedule_status:'Trạng thái ca',nurse_id:'Mã y tá',schedule_id:'Mã ca',revoked_at:'Thời điểm thu hồi',author_id:'Mã tác giả',title:'Tiêu đề',slug:'Đường dẫn',category:'Danh mục',thumbnail_url:'Ảnh đại diện',content:'Nội dung',published_at:'Thời điểm đăng',config_key:'Tên cấu hình',config_value:'Giá trị cấu hình',encounter_id:'Mã lượt khám',payment_type:'Loại giao dịch',amount:'Số tiền',payment_method:'Phương thức',transaction_status:'Trạng thái giao dịch',original_payment_id:'Giao dịch gốc',reason:'Lý do',is_hidden:'Đang ẩn',from_date:'Từ ngày',to_date:'Đến ngày',period:'Buổi nghỉ',status:'Trạng thái',review_note:'Nội dung xét duyệt',position:'Chức vụ',ended_at:'Thời điểm kết thúc'};
const prefixes={USER:'TK',PATIENT:'BN',DOCTOR:'BS',DEPARTMENT:'CK',ROOM:'PH',WORK_SCHEDULE:'CA',ASSIGNMENT:'PC',ARTICLE:'BV',PAYMENT:'TT',REVIEW:'DG',STAFF_LEAVE:'NP'};
Object.assign(fields,{phone:'Số điện thoại',email:'Email',dob:'Ngày sinh',id_card:'CCCD / mã định danh',address:'Địa chỉ',health_insurance:'Mã thẻ BHYT',relationship:'Quan hệ với chủ hồ sơ',emergency_contact_name:'Người liên hệ khẩn cấp',emergency_contact_phone:'Số điện thoại khẩn cấp',emergency_contact_relationship:'Quan hệ người liên hệ khẩn cấp',avatar_url:'Ảnh đại diện',email_verified:'Email đã xác minh',note:'Ghi chú',assigned_by_id:'Người phân công',revoked_by_id:'Người thu hồi',unavailable_reason:'Lý do báo nghỉ'});
const reference=row=>prefixes[row.target]?`${prefixes[row.target]}_${String(row.target_id).padStart(3,'0')}`:row.target_id;
const logCode=id=>`NK_${String(id).padStart(3,'0')}`;
export const listActivities=(params,signal)=>apiRequest('/admin/activity-logs',{params,signal});
export const getActivity=(id,signal)=>apiRequest(`/admin/activity-logs/${pathSegment(id)}`,{signal});
export function activityChanges(row){
  const before=row.before_data||{},after=row.after_data||{};
  return [...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key])).map(key=>({key,before:before[key],after:after[key]}));
}
function valueMarkup(value){
  if(value==null)return '<span class="activity-no-value">—</span>';
  const text=typeof value==='boolean'?(value?'Có':'Không'):typeof value==='object'?JSON.stringify(value,null,2):String(value);
  return text.length>350?`<details class="activity-long-value"><summary>Xem đầy đủ</summary><pre>${esc(text)}</pre></details>`:`<div class="activity-value">${esc(text)}</div>`;
}
export function activityDetail(row){
  const changes=activityChanges(row);
  return `<div class="activity-detail"><div class="activity-detail-summary"><span class="badge blue">${esc(actions[row.action]||row.action)}</span><strong>${esc(logCode(row.log_id))}</strong><span>${esc(stamp(row.created_at))}</span></div>${facts([['Người thực hiện',row.actor_name],['Mã admin',`TK_${String(row.actor_id).padStart(3,'0')}`],['Đối tượng',targets[row.target]||row.target],['Mã đối tượng',reference(row)]])}<section class="activity-changes"><h3>Chi tiết thay đổi <span>${changes.length} trường</span></h3>${table(['Thông tin','Trước thay đổi','Sau thay đổi'],changes.map(change=>[esc(fields[change.key]||change.key),valueMarkup(change.before),valueMarkup(change.after)]),'Giá trị trước và sau thay đổi')}</section></div>`;
}
export async function initActivityLog(ctx,body){
  body.innerHTML=`<section class="admin-card admin-activity-log"><div class="admin-panel-heading"><div><h2>Danh sách nhật ký</h2></div></div><form id="activity-log-filter" class="admin-toolbar"><label>Tìm kiếm<input type="search" name="q" maxlength="255" placeholder="Mã log, người thực hiện, nội dung…"></label><label>Hành động<select name="action">${options(Object.entries(actions))}</select></label><label>Đối tượng<select name="target">${options(Object.entries(targets))}</select></label><label>Từ ngày<input name="from_date" type="date" value="${today()}"></label><label>Đến ngày<input name="to_date" type="date" value="${today()}"></label></form><p id="activity-log-feedback" role="status" class="admin-audit-feedback" hidden></p><div id="activity-results"></div><div id="activity-pager"></div></section>`;
  let page=1,timer;
  const form=body.querySelector('form'),feedback=body.querySelector('#activity-log-feedback');
  async function reload(){
    const params=Object.fromEntries(new FormData(form));
    const invalid=params.from_date&&params.to_date&&params.from_date>params.to_date;
    feedback.hidden=!invalid;feedback.dataset.error='true';feedback.textContent=invalid?'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.':'';
    if(invalid){ctx.cancelLoad();return;}
    await ctx.load(signal=>listActivities({...params,page,page_size:12},signal),result=>{
      body.querySelector('#activity-results').innerHTML=table(['Mã log','Thời điểm','Người thực hiện','Hành động','Đối tượng','Nội dung','Thao tác'],result.items.map(row=>[esc(logCode(row.log_id)),esc(stamp(row.created_at)),`<strong>${esc(row.actor_name)}</strong><small class="activity-actor-id">TK_${esc(String(row.actor_id).padStart(3,'0'))}</small>`,esc(actions[row.action]||row.action),esc(targets[row.target]||row.target),esc(`${actions[row.action]||row.action} ${targets[row.target]||row.target} ${reference(row)}`),`<button type="button" class="row-action" data-activity-id="${esc(row.log_id)}">Chi tiết thay đổi</button>`]),'Nhật ký thay đổi của admin');
      const pages=Math.max(1,Math.ceil(result.total/result.page_size));
      body.querySelector('#activity-pager').innerHTML=`<div class="admin-pagination"><span>${result.total} bản ghi · Trang ${page} / ${pages}</span><div><button type="button" class="secondary" data-activity-page="-1" ${page<=1?'disabled':''}>Trang trước</button><button type="button" class="secondary" data-activity-page="1" ${page>=pages?'disabled':''}>Trang sau</button></div></div>`;
    });
  }
  form.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{page=1;void reload();},250);});
  form.addEventListener('change',()=>{clearTimeout(timer);page=1;void reload();});
  form.addEventListener('submit',event=>{event.preventDefault();clearTimeout(timer);page=1;void reload();});
  body.addEventListener('click',event=>{const button=event.target.closest('button');if(!button||button.disabled)return;if(button.dataset.activityId)void ctx.show('Chi tiết thay đổi',async signal=>activityDetail((await getActivity(button.dataset.activityId,signal)).activity));if(button.dataset.activityPage){page+=Number(button.dataset.activityPage);void reload();}});
  window.addEventListener('pagehide',()=>clearTimeout(timer),{once:true});
  await reload();
}
