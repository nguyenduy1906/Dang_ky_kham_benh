import {apiRequest,pathSegment} from './api.js';
import {esc,options,table,facts,stamp,today,money} from './admin_ui.js';
export const activityActions={CREATE:'Tạo mới',ASSIGN:'Phân công',UPDATE:'Cập nhật',REVOKE:'Thu hồi',APPROVE:'Duyệt',REJECT:'Từ chối',LOCK:'Khóa',UNLOCK:'Mở khóa',HIDE:'Ẩn',SHOW:'Hiện',OPEN:'Mở ca',CLOSE:'Đóng ca',CHANGE_DOCTOR:'Đổi bác sĩ',CHANGE_ROOM:'Đổi phòng',MOVE:'Chuyển ca',REFUND:'Hoàn tiền',DELETE:'Ngừng sử dụng'};
const actions=activityActions;
const targets={RECEPTION_ASSIGNMENT:'Phân công lễ tân',RECEPTION_WORKSTATION:'Khu vực lễ tân',USER:'Tài khoản',PATIENT:'Hồ sơ bệnh nhân',DOCTOR:'Bác sĩ',DEPARTMENT:'Chuyên khoa',ROOM:'Phòng khám',WORK_SCHEDULE:'Lịch làm việc',ASSIGNMENT:'Phân công y tá',ARTICLE:'Bài viết',CONFIGURATION:'Cấu hình hệ thống',PAYMENT:'Thanh toán',REVIEW:'Đánh giá',STAFF_LEAVE:'Đơn xin nghỉ'};
const fields={full_name:'Họ tên',role_id:'Vai trò',account_status:'Trạng thái tài khoản',approval_status:'Trạng thái duyệt',deleted_at:'Thời điểm ngừng sử dụng',archived_at:'Thời điểm lưu trữ',gender:'Giới tính',user_id:'Mã tài khoản',department_id:'Mã chuyên khoa',academic_degree:'Học vị',specialization:'Chuyên môn',experience_years:'Số năm kinh nghiệm',consultation_fee:'Phí khám',introduction:'Giới thiệu',is_active:'Đang hoạt động',name:'Tên',description:'Mô tả',group_type:'Khối',overview:'Giới thiệu tổng quan',mission:'Chức năng, nhiệm vụ',cover_image_url:'Ảnh bìa',specialties:'Chuyên môn',clinical_services:'Dịch vụ',equipment:'Trang thiết bị',achievements:'Thành tựu',patient_guide:'Hướng dẫn người bệnh',gallery:'Thư viện ảnh',extra_sections:'Nội dung thêm',room_name:'Tên phòng',doctor_profile_id:'Mã bác sĩ',room_id:'Mã phòng',work_date:'Ngày làm việc',start_time:'Giờ bắt đầu',end_time:'Giờ kết thúc',slot_minutes:'Thời lượng khung giờ',max_quota:'Sức chứa',schedule_status:'Trạng thái ca',nurse_id:'Mã y tá',schedule_id:'Mã ca',revoked_at:'Thời điểm thu hồi',author_id:'Mã tác giả',title:'Tiêu đề',slug:'Đường dẫn',category:'Danh mục',thumbnail_url:'Ảnh đại diện',content:'Nội dung',published_at:'Thời điểm đăng',config_key:'Tên cấu hình',config_value:'Giá trị cấu hình',encounter_id:'Mã lượt khám',payment_type:'Loại giao dịch',amount:'Số tiền',payment_method:'Phương thức',transaction_status:'Trạng thái giao dịch',original_payment_id:'Giao dịch gốc',reason:'Lý do',is_hidden:'Đang ẩn',from_date:'Từ ngày',to_date:'Đến ngày',period:'Buổi nghỉ',status:'Trạng thái',review_note:'Nội dung xét duyệt',position:'Chức vụ',ended_at:'Thời điểm kết thúc'};
const prefixes={RECEPTION_ASSIGNMENT:'PC',RECEPTION_WORKSTATION:'QT',USER:'TK',PATIENT:'BN',DOCTOR:'BS',DEPARTMENT:'CK',ROOM:'PH',WORK_SCHEDULE:'CA',ASSIGNMENT:'PC',ARTICLE:'BV',PAYMENT:'TT',REVIEW:'DG',STAFF_LEAVE:'NP'};
Object.assign(fields,{receptionist_id:'Lễ tân',workstation_id:'Khu vực',area:'Khu vực',name:'Tên khu vực',revoke_reason:'Lý do thu hồi',phone:'Số điện thoại',email:'Email',dob:'Ngày sinh',id_card:'CCCD / mã định danh',address:'Địa chỉ',health_insurance:'Mã thẻ BHYT',relationship:'Quan hệ với chủ hồ sơ',emergency_contact_name:'Người liên hệ khẩn cấp',emergency_contact_phone:'Số điện thoại khẩn cấp',emergency_contact_relationship:'Quan hệ người liên hệ khẩn cấp',avatar_url:'Ảnh đại diện',email_verified:'Email đã xác minh',note:'Ghi chú',assigned_by_id:'Người phân công',revoked_by_id:'Người thu hồi',unavailable_reason:'Lý do báo nghỉ'});
const reference=row=>prefixes[row.target]?`${prefixes[row.target]}_${String(row.target_id).padStart(3,'0')}`:row.target_id;
const logCode=id=>`NK_${String(id).padStart(3,'0')}`;
export function activityType(row){
  const before=row.before_data||{},after=row.after_data||{},data={...before,...after};
  if(row.target==='PAYMENT'&&data.payment_type==='REFUND')return 'REFUND';
  if(['WORK_SCHEDULE','ASSIGNMENT','RECEPTION_ASSIGNMENT'].includes(row.target)&&row.action==='CREATE')return 'ASSIGN';
  if(['ASSIGNMENT','RECEPTION_ASSIGNMENT'].includes(row.target)&&row.action==='DELETE')return 'REVOKE';
  if(row.target==='STAFF_LEAVE'&&row.action==='UPDATE'){
    if(after.status==='APPROVED')return 'APPROVE';
    if(after.status==='REJECTED')return 'REJECT';
  }
  if(row.target==='USER'&&row.action==='UPDATE'&&after.approval_status==='APPROVED')return 'APPROVE';
  if(row.target==='USER'&&row.action==='UPDATE'&&after.approval_status==='REJECTED')return 'REJECT';
  if(row.target==='REVIEW'&&row.action==='UPDATE'&&Object.hasOwn(after,'is_hidden'))return after.is_hidden?'HIDE':'SHOW';
  if(row.target==='WORK_SCHEDULE'&&row.action==='UPDATE'){
    if(after.move===true||after.move===1)return 'MOVE';
    if(Object.hasOwn(after,'doctor_profile_id')&&before.doctor_profile_id!==after.doctor_profile_id)return 'CHANGE_DOCTOR';
    if(Object.hasOwn(after,'room_id')&&before.room_id!==after.room_id)return 'CHANGE_ROOM';
    if(after.schedule_status==='CLOSED')return 'CLOSE';
    if(after.schedule_status==='OPEN'&&before.schedule_status==='CLOSED')return 'OPEN';
  }
  return row.action;
}
export function activityDescription(row){
  const type=activityType(row),action=actions[type]||type,target=targets[row.target]||row.target;
  if(row.batch_count>1)return {action,target,content:`${action} · ${row.batch_count} ca${row.from_date?` · ${row.from_date.split('-').reverse().join('/')} – ${row.to_date.split('-').reverse().join('/')}`:''}`};
  const data={...(row.before_data||{}),...(row.after_data||{})};
  if(type==='REFUND')return {action,target,content:`${data.transaction_status==='SUCCESS'?'Hoàn tiền thành công':'Giao dịch hoàn tiền'} ${data.amount==null?'':money(data.amount)} · ${reference(row)}${data.original_payment_id?` · Giao dịch gốc TT_${String(data.original_payment_id).padStart(3,'0')}`:''}${data.encounter_id?` · LK_${String(data.encounter_id).padStart(3,'0')}`:''}${data.reason?` · Lý do: ${data.reason}`:''}`};
  return {action,target,content:`${action} · ${target} · ${reference(row)}`};
}
export async function listActivities(params,signal){
  const selected=params.action||'';
  if(!selected&&params.target&&params.target!=='PAYMENT')return readActivityPage(params,signal);
  if(selected==='REFUND'&&params.target&&params.target!=='PAYMENT')return {items:[],total:0,page:Number(params.page)||1,page_size:Number(params.page_size)||12};
  const serverAction={ASSIGN:'CREATE',REVOKE:'DELETE',APPROVE:'UPDATE',REJECT:'UPDATE',HIDE:'UPDATE',SHOW:'UPDATE',OPEN:'UPDATE',CLOSE:'UPDATE',CHANGE_DOCTOR:'UPDATE',CHANGE_ROOM:'UPDATE',MOVE:'UPDATE',REFUND:'CREATE'}[selected]||selected;
  const matching=[];let current=1,result;
  do {
    result=await readActivityPage({...params,action:serverAction,target:selected==='REFUND'?'PAYMENT':params.target,page:current,page_size:100},signal);
    matching.push(...result.items.filter(row=>{
      const duplicateRefund=row.target==='PAYMENT'&&row.action==='UPDATE'&&row.after_data?.transaction_status==='REFUNDED';
      return !duplicateRefund&&(!selected||activityType(row)===selected);
    }));
    current++;
  }while((current-1)*result.page_size<result.total);
  const size=Number(params.page_size)||12,last=Math.max(1,Math.ceil(matching.length/size)),page=Math.min(Number(params.page)||1,last);
  return {items:matching.slice((page-1)*size,page*size),total:matching.length,page,page_size:size};
}
async function readActivityPage(params,signal){
  const result=await apiRequest('/admin/activity-logs',{params,signal});
  const items=await Promise.all(result.items.map(async row=>row.target==='PAYMENT'||(['UPDATE','DELETE'].includes(row.action)&&['WORK_SCHEDULE','ASSIGNMENT','RECEPTION_ASSIGNMENT','STAFF_LEAVE','USER','REVIEW'].includes(row.target))?{...row,...(await getActivity(row.log_id,signal)).activity}:row));
  return {...result,items};
}
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
  if(row.batch_items?.length>1)return `<div class="activity-detail"><h3>Phân công · ${row.batch_items.length} ca</h3>${facts([['Người thực hiện',row.actor_name],['Đối tượng',targets[row.target]||row.target]])}${row.batch_items.map(item=>`<details class="activity-batch-item"><summary>${esc(logCode(item.log_id))} · ${esc(reference(item))} · ${esc(item.after_data?.work_date||'')}</summary>${activityDetail({...item,batch_items:null})}</details>`).join('')}</div>`;

  const changes=activityChanges(row);
  const description=activityDescription(row);
  return `<div class="activity-detail"><div class="activity-detail-summary"><span class="badge blue">${esc(description.action)}</span><strong>${esc(logCode(row.log_id))}</strong><span>${esc(stamp(row.created_at))}</span></div>${facts([['Người thực hiện',row.actor_name],['Mã admin',`TK_${String(row.actor_id).padStart(3,'0')}`],['Đối tượng',description.target],['Mã đối tượng',reference(row)],['Hoạt động',description.content]])}<section class="activity-changes"><h3>Chi tiết thay đổi <span>${changes.length} trường</span></h3>${table(['Thông tin','Trước thay đổi','Sau thay đổi'],changes.map(change=>[esc(fields[change.key]||change.key),valueMarkup(change.before),valueMarkup(change.after)]),'Giá trị trước và sau thay đổi')}</section></div>`;
}
export async function initActivityLog(ctx,body){
  body.innerHTML=`<section class="admin-card admin-activity-log"><div class="admin-panel-heading"><div><h2>Danh sách nhật ký</h2></div><span id="activity-total" class="badge role-badge" role="status">0 hoạt động</span></div><form id="activity-log-filter" class="admin-toolbar"><label>Tìm kiếm<input type="search" name="q" maxlength="255" placeholder="Mã log, người thực hiện, nội dung…"></label><label>Hành động<select name="action">${options(Object.entries(actions))}</select></label><label>Đối tượng<select name="target">${options(Object.entries(targets))}</select></label><label>Từ ngày<input name="from_date" type="date" value="${today()}"></label><label>Đến ngày<input name="to_date" type="date" value="${today()}"></label></form><p id="activity-log-feedback" role="status" class="admin-audit-feedback" hidden></p><div id="activity-results"></div><div id="activity-pager"></div></section>`;
  let page=1,timer;
  const form=body.querySelector('form'),feedback=body.querySelector('#activity-log-feedback');
  async function reload(){
    const params=Object.fromEntries(new FormData(form));
    const invalid=params.from_date&&params.to_date&&params.from_date>params.to_date;
    feedback.hidden=!invalid;feedback.dataset.error='true';feedback.textContent=invalid?'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.':'';
    if(invalid){ctx.cancelLoad();return;}
    await ctx.load(signal=>listActivities({...params,page,page_size:12},signal),result=>{
      body.querySelector('#activity-results').innerHTML=table(['Mã log','Thời điểm','Người thực hiện','Hành động','Đối tượng','Nội dung','Thao tác'],result.items.map(row=>{const description=activityDescription(row);return [esc(logCode(row.log_id)),esc(stamp(row.created_at)),`<strong>${esc(row.actor_name)}</strong><small class="activity-actor-id">TK_${esc(String(row.actor_id).padStart(3,'0'))}</small>`,esc(description.action),esc(description.target),esc(description.content),`<button type="button" class="row-action" data-activity-id="${esc(row.log_id)}">Chi tiết thay đổi</button>`];}),'Nhật ký thay đổi của admin');
      body.querySelector('#activity-total').textContent=`${result.total} hoạt động`;
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
