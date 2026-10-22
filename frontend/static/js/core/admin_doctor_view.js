import { esc, facts, stamp, money, badge, label, options } from './admin_ui.js';
import {fieldMarkup} from './admin_resources.js';
import {avatarUrl} from './avatar.js';
import {code} from './business_codes.js';

const accountBadge=row=>`<span class="badge ${row.account?.account_status==='ACTIVE'&&!row.account?.is_deleted?'green':'red'}">${row.account?.is_deleted?'Tài khoản đã ngừng sử dụng':row.account?.account_status==='ACTIVE'?'Tài khoản hoạt động':row.account?.account_status==='LOCKED'?'Tài khoản đã khóa':'Chưa xác định tài khoản'}</span>`;
const identity=row=>{
  const image=avatarUrl(row.avatar_url);
  return `<div class="admin-doctor-identity"><div class="admin-doctor-portrait">${image?`<img src="${esc(image)}" alt="Ảnh bác sĩ ${esc(row.full_name)}">`:'<span aria-hidden="true">BS</span>'}</div><div class="admin-doctor-identity-text"><h3>${esc(row.full_name)}</h3><p>${esc(row.department_name||'Chưa có chuyên khoa')}</p><div class="admin-doctor-codes"><span>${esc(code('BS',row.doctor_profile_id))}</span><span>${esc(code('TK',row.user_id))}</span></div></div>${accountBadge(row)}</div>`;
};

export function doctorForm(row,fields,refs,actions){
  const render=names=>names.map(name=>fields.find(field=>field.name===name)).filter(Boolean).map(field=>fieldMarkup({...field,clearable:Boolean(row),...(field.name==='introduction'?{title:'Giới thiệu bác sĩ'}:{})},row||{},refs,Boolean(row))).join('');
  const canChangeAccount=row?.account&&!row.account.is_deleted&&row.account.role_name==='DOCTOR';
  const account=row?`<section class="admin-doctor-section"><h3>Tài khoản</h3><div class="admin-contact-fields"><label><span>Trạng thái tài khoản</span>${canChangeAccount?`<select name="account_status" required>${options([['ACTIVE','Đang hoạt động'],['LOCKED','Đã khóa']],row.account.account_status,'Chọn trạng thái')}</select>`:`<input value="${esc(row.account?.is_deleted?'Đã ngừng sử dụng':label(row.account?.role_name))}" disabled>`}</label><div class="admin-doctor-contact"><span>Email / điện thoại</span><p>${esc([row.account?.email,row.account?.phone].filter(Boolean).join(' · ')||'Chưa cập nhật')}</p></div></div></section>`:`<section class="admin-doctor-section"><h3>Tài khoản bác sĩ</h3><div class="admin-contact-fields">${render(['user_id','is_active'])}</div></section>`;
  return `<form class="admin-doctor-form" data-form="resource" data-id="${esc(row?.doctor_profile_id||'')}" autocomplete="off">${row?identity(row):''}${account}<section class="admin-doctor-section"><h3>Thông tin chuyên môn</h3><div class="admin-contact-fields">${render(['department_id','academic_degree','experience_years','consultation_fee','specialization'])}</div></section><section class="admin-doctor-section admin-doctor-introduction"><h3>Giới thiệu bác sĩ</h3><div class="admin-contact-fields">${render(['introduction']).replace('rows="4"','rows="10"')}</div></section><div class="admin-doctor-footer">${actions}</div></form>`;
}

export function doctorDetails(row){
  return `<div class="admin-doctor-detail">${identity(row)}<div class="admin-doctor-detail-grid"><section class="admin-doctor-section"><h3>Thông tin chuyên môn</h3>${facts([['Chuyên khoa',row.department_name],['Học vị',row.academic_degree||'Chưa cập nhật'],['Chuyên môn',row.specialization||'Chưa cập nhật'],['Kinh nghiệm',row.experience_years==null?'Chưa cập nhật':`${row.experience_years} năm`],['Phí khám',money(row.consultation_fee)],['Hồ sơ chuyên môn',row.is_active?'Đang hoạt động':'Ngừng hoạt động']])}</section><section class="admin-doctor-section"><h3>Thông tin tài khoản</h3>${facts([['Mã tài khoản',code('TK',row.user_id)],['Email',row.account?.email||'Chưa cập nhật'],['Điện thoại',row.account?.phone||'Chưa cập nhật'],['Trạng thái tài khoản',row.account?.is_deleted?'Đã ngừng sử dụng':label(row.account?.account_status)],['Ngày tạo hồ sơ',stamp(row.created_at)],['Cập nhật hồ sơ',stamp(row.updated_at)]])}</section></div><section class="admin-doctor-section admin-doctor-introduction"><h3>Giới thiệu bác sĩ</h3><div class="admin-doctor-biography">${esc(row.introduction||'Chưa có nội dung giới thiệu.')}</div></section></div>`;
}
