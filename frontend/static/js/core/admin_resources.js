import {thumbnailUrl} from "./articles.js";
import { code, prefixes } from "./business_codes.js";
import * as auth from "../api/auth.js";
import * as patients from "../api/patient.js";
import * as doctors from "../api/doctor.js";
import * as catalog from "../api/catalog.js";
import * as schedules from "../api/schedule.js";
import * as articles from "../api/article.js";
import * as encounters from "../api/encounter.js";
import {esc, date, stamp, money, badge, label, options} from "./admin_ui.js";

export const adminPages = {
  home:{title:"Tổng quan quản trị",description:"Theo dõi hoạt động khám bệnh và truy cập nhanh các khu vực quản lý."},
  encounters:{title:"Quản lý lượt khám",description:"Tra cứu lượt khám, khung giờ và mã phiếu của người bệnh."},
  patients:{title:"Quản lý bệnh nhân",description:"Quản lý hồ sơ người được khám, thông tin liên hệ và lịch sử khám."},
  schedule:{title:"Lịch làm việc",description:"Bố trí ca khám, phòng và theo dõi đơn xin nghỉ của nhân viên."},
  assignments:{title:"Phân công y tá",description:"Phân công y tá theo ca và lưu lịch sử thu hồi."},
  doctors:{title:"Quản lý bác sĩ",description:"Quản lý hồ sơ chuyên môn, chuyên khoa và phí khám."},
  departments:{title:"Quản lý chuyên khoa",description:"Quản lý chuyên khoa, thông tin giới thiệu và lãnh đạo khoa."},
  rooms:{title:"Quản lý phòng khám",description:"Quản lý phòng khám theo chuyên khoa."},
  users:{title:"Quản lý tài khoản",description:"Quản lý tài khoản, vai trò và trạng thái nhân viên."},
  articles:{title:"Quản lý tin tức",description:"Soạn thảo và quản lý các bài viết trên website."},
  reviews:{title:"Đánh giá",description:"",placeholder:true},
  notifications:{title:"Thông báo",description:"",placeholder:true},
  payments:{title:"Lịch sử thanh toán",description:"Lịch sử giao dịch toàn hệ thống, tối đa 20 bản ghi mỗi trang."},
  statistics:{title:"Báo cáo & thống kê",description:"Thống kê lượt khám, dòng tiền và đánh giá trong khoảng thời gian đã chọn."},
  audit:{title:"Nhật ký hoạt động",description:"Đối soát lượt khám và tra cứu lịch sử trạng thái, điều phối, thanh toán, bệnh án."},
  configuration:{title:"Cấu hình hệ thống",description:"Quản lý thông tin cơ sở và các cài đặt được phép thay đổi."},
};
const f=(name,title,type="text",extra={})=>({name,title,type,...extra});
const active=f("is_active","Trạng thái","select",{choices:[[true,"Đang hoạt động"],[false,"Ngừng hoạt động"]],boolean:true,default:true});
const dept=f("department_id","Chuyên khoa","select",{reference:"departments",required:true,number:true});
const choice=(name,title,values)=>f(name,title,"select",{choices:values});
const id=(name,title)=>f(name,title,"text",{businessId:true,required:true});
export const resources = {
  users:{id:"user_id",list:auth.listUsers,get:async(id,opt)=>(await auth.getUser(id,opt)).user,create:auth.createUser,update:auth.updateUser,add:"Tạo tài khoản",columns:["Mã","Người dùng","Liên hệ","Vai trò","Trạng thái","Phê duyệt"],
    cells:r=>[esc(code("TK", r.user_id)),esc(r.full_name),esc([r.email,r.phone].filter(Boolean).join(" · ")),badge(r.role_name),badge(r.account_status),badge(r.approval_status)],
    filters:[f("q","Tên / email / điện thoại","search"),f("role","Vai trò","select",{reference:"roles"}),choice("account_status","Trạng thái",["ACTIVE","LOCKED"]),choice("approval_status","Phê duyệt",["PENDING","APPROVED","REJECTED"])],
    fields:[f("full_name","Họ và tên","text",{required:true,max:150}),f("email","Email","email",{max:254,omitEmpty:true}),f("phone","Điện thoại","tel",{max:20,omitEmpty:true}),f("password","Mật khẩu ban đầu","password",{required:true,minLength:12,max:128,createOnly:true}),f("role","Vai trò","select",{reference:"roles",required:true}),{...choice("approval_status","Phê duyệt",["APPROVED","PENDING","REJECTED"]),default:"APPROVED",createOnly:true},{...choice("account_status","Trạng thái tài khoản",[["ACTIVE","Hoạt động"],["LOCKED","Đã khóa"]]),editOnly:true,required:true},
      f("dob","Ngày sinh","date",{editOnly:true}),{...choice("gender","Giới tính",["Nam","Nữ","Khác"]),editOnly:true},
      f("id_card","CCCD","text",{editOnly:true,max:12,pattern:"[0-9]{12}"}),f("address","Địa chỉ","text",{editOnly:true,max:255}),
      f("emergency_contact_name","Người liên hệ khẩn cấp","text",{editOnly:true,max:150}),f("emergency_contact_phone","Số điện thoại khẩn cấp","tel",{editOnly:true,max:30})],
  },
  patients:{id:"patient_id",list:patients.listPatients,get:async(id,opt)=>(await patients.getPatient(id,opt)).patient,create:patients.createPatient,update:patients.updatePatient,add:"Thêm bệnh nhân",columns:["Mã BN","Họ và tên","Ngày sinh","Điện thoại","CCCD","Trạng thái"],
    cells:r=>[esc(code("BN", r.patient_id)),esc(r.full_name),date(r.dob),esc(r.phone),esc(r.id_card || "—"),esc(r.is_archived?"Đã lưu trữ":"Đang sử dụng")],
    filters:[f("q","Họ tên / CCCD","search"),f("phone","Số điện thoại","tel"),f("include_archived","Bao gồm hồ sơ lưu trữ","checkbox")],
    fields:[f("full_name","Họ tên","text",{required:true,max:150}),f("dob","Ngày sinh","date"),f("phone","Điện thoại","tel",{required:true,max:20,readOnEdit:true}),choice("gender","Giới tính",["Nam","Nữ","Khác"]),f("id_card","CCCD / mã định danh","text",{max:12,pattern:"([0-9]{9}|[0-9]{12})"}),f("address","Địa chỉ","text",{max:255}),f("health_insurance","Mã thẻ BHYT","text",{max:15,pattern:"[A-Za-z0-9]{10,15}"}),f("confirm_shared_phone","Tôi đã xác nhận đây là người thân dùng chung số điện thoại","checkbox",{createOnly:true})],
  },
  doctors:{id:"doctor_profile_id",list:doctors.listDoctors,get:async(id,opt)=>(await doctors.getDoctor(id,opt)).doctor,create:doctors.createDoctor,update:doctors.updateDoctor,add:"Thêm hồ sơ bác sĩ",params:{include_inactive:true},columns:["Mã BS","Bác sĩ","Chuyên khoa","Học vị","Kinh nghiệm","Phí khám","Trạng thái"],
    cells:r=>[esc(code("BS", r.doctor_profile_id)),esc(r.full_name),esc(r.department_name),esc(r.academic_degree || "—"),esc(r.experience_years==null?"—":`${r.experience_years} năm`),money(r.consultation_fee),badge(r.is_active?"ACTIVE":"LOCKED")],
    filters:[f("q","Tên bác sĩ","search"),dept],fields:[f("user_id","Tài khoản bác sĩ","select",{reference:"doctorUsers",required:true,number:true,createOnly:true}),dept,f("academic_degree","Học vị","text",{max:100}),f("specialization","Chuyên môn","text",{max:200}),f("experience_years","Số năm kinh nghiệm","number",{min:0,maxNumber:80,default:0}),f("consultation_fee","Phí khám (đồng)","number",{min:0,default:0,required:true}),f("introduction","Giới thiệu","textarea",{max:5000}),{...active,createOnly:true}],
  },
  departments:{id:"department_id",list:catalog.listDepartments,get:async(id,opt)=>(await catalog.getDepartment(id,opt)).department,create:catalog.createDepartment,update:catalog.updateDepartment,add:"Thêm chuyên khoa",params:{include_inactive:true},local:true,columns:["Mã","Chuyên khoa","Khối","Số bác sĩ","Trưởng khoa","Trạng thái"],
    cells:r=>[esc(code("CK", r.department_id)),esc(r.name),esc(label(r.group_type)),esc(r.doctor_count ?? "—"),esc(r.leadership?.head?.full_name || "Chưa phân công"),badge(r.is_active?"ACTIVE":"LOCKED")],
    filters:[f("q","Tên chuyên khoa","search")],fields:[f("name","Tên chuyên khoa","text",{required:true,max:150}),f("description","Mô tả ngắn","textarea",{max:1000}),{...choice("group_type","Khối",["CLINICAL","PARACLINICAL"]),default:"CLINICAL"},active,f("overview","Giới thiệu tổng quan","textarea",{max:12000,advanced:true}),f("mission","Chức năng, nhiệm vụ","textarea",{max:4000,advanced:true}),f("cover_image_url","Đường dẫn ảnh bìa","text",{max:2000,advanced:true}),...[["specialties","Chuyên môn"],["clinical_services","Dịch vụ"],["equipment","Trang thiết bị"],["achievements","Thành tựu"],["patient_guide","Hướng dẫn người bệnh"]].map(([name,title])=>f(name,`${title} (mỗi dòng một mục)`,"lines",{advanced:true})),f("gallery","Thư viện ảnh","json",{advanced:true}),f("extra_sections","Mục nội dung thêm","json",{advanced:true}),f("content_is_demo","Đánh dấu nội dung minh họa","checkbox",{advanced:true})],
  },
  rooms:{id:"room_id",list:catalog.listRooms,create:catalog.createRoom,update:catalog.updateRoom,add:"Thêm phòng khám",params:{include_inactive:true},local:true,columns:["Mã","Phòng khám","Chuyên khoa","Mô tả","Trạng thái"],cells:r=>[esc(code("PH", r.room_id)),esc(r.room_name),esc(r.department_name),esc(r.description || "—"),badge(r.is_active?"ACTIVE":"LOCKED")],
    filters:[f("q","Tên phòng","search"),dept],fields:[dept,f("room_name","Tên phòng","text",{required:true,max:100}),f("description","Mô tả","textarea",{max:1000}),active],
  },
  schedule:{id:"schedule_id",list:schedules.listAdminSchedules,create:schedules.createSchedule,update:schedules.updateSchedule,add:"Tạo ca làm việc",columns:["Mã ca","Bác sĩ","Phòng","Ngày","Thời gian","Đã đặt / sức chứa","Trạng thái"],
    cells:r=>[esc(code("CA", r.schedule_id)),esc(r.doctor_name),esc(r.room_name),date(r.work_date),esc(`${r.start_time?.slice(0,5)} – ${r.end_time?.slice(0,5)}`),esc(`${r.booked_count} / ${r.max_quota}`),badge(r.schedule_status)],
    filters:[f("doctor_profile_id","Bác sĩ","select",{reference:"doctors"}),dept,f("room_id","Phòng","select",{reference:"rooms"}),f("from_date","Từ ngày","date"),f("to_date","Đến ngày","date"),choice("status","Trạng thái",["OPEN","FULL","CLOSED","UNAVAILABLE"])],
    fields:[f("doctor_profile_id","Bác sĩ","select",{reference:"doctors",number:true,required:true,createOnly:true}),f("room_id","Phòng khám","select",{reference:"rooms",number:true,required:true,lockedWhenBooked:true}),f("work_date","Ngày làm việc","date",{required:true,lockedWhenBooked:true}),f("start_time","Giờ bắt đầu","time",{required:true,lockedWhenBooked:true}),f("end_time","Giờ kết thúc","time",{required:true,lockedWhenBooked:true}),f("slot_minutes","Thời lượng khung giờ","select",{choices:[[15,"15 phút"],[30,"30 phút"]],number:true,required:true,lockedWhenBooked:true}),f("max_quota","Sức chứa","number",{min:1,maxNumber:1000,required:true}),f("schedule_status","Trạng thái ca","select",{choices:["OPEN","CLOSED"],editOnly:true,omitEmpty:true})],
  },
  assignments:{id:"assignment_id",params:{include_revoked:true},list:schedules.listNurseAssignments,get:async(id,opt)=>(await schedules.getNurseAssignment(id,opt)).assignment,create:schedules.createNurseAssignment,add:"Phân công y tá",columns:["Mã","Y tá","Mã ca","Phòng","Ngày","Thời gian","Trạng thái"],
    cells:r=>[esc(code("PC", r.assignment_id)),esc(r.nurse_name),esc(code("CA", r.schedule_id)),esc(r.room_name),date(r.work_date),esc(`${r.start_time?.slice(0,5)} – ${r.end_time?.slice(0,5)}`),`<span class="badge ${r.revoked_at?"assignment-revoked":"green"}">${r.revoked_at?"Thu hồi":"Đang phân công"}</span>`],
    filters:[f("nurse_id","Y tá","select",{reference:"nurses"}),f("schedule_id","Mã ca","text",{businessId:true})],
    fields:[f("nurse_id","Y tá","select",{reference:"nurses",required:true,number:true}),f("schedule_id","Ca làm việc","select",{reference:"schedules",required:true,number:true}),f("note","Ghi chú","textarea",{max:1000})],
  },
  articles:{id:"article_id",list:articles.listAdminArticles,get:async(id,opt)=>(await articles.listAdminArticles({article_id:id,page_size:1},opt)).items[0],create:articles.createArticle,update:articles.updateArticle,add:"Viết bài mới",columns:["Mã bài","Tiêu đề","Danh mục","Tác giả","Ngày đăng","Trạng thái"],
    cells:r=>[esc(code("BV", r.article_id)),esc(r.title),esc(r.category || "—"),esc(r.author_name || r.author_id),stamp(r.published_at),esc(!r.is_active?"Bản nháp":!r.published_at?"Chưa xuất bản":new Date(r.published_at)>new Date()?"Hẹn giờ":"Đã xuất bản")],
    filters:[f("q","Tiêu đề / nội dung","search"),f("category","Danh mục"),choice("is_active","Trạng thái",[[true,"Đang bật"],[false,"Bản nháp / đã ẩn"]])],
    fields:[f("title","Tiêu đề","text",{required:true,max:255}),f("slug","Đường dẫn bài viết","text",{required:true,max:200,pattern:"[a-z0-9]+(?:-[a-z0-9]+)*"}),f("category","Danh mục","text",{max:100}),f("thumbnail_url","Đường dẫn ảnh đại diện","text",{max:2000}),f("content","Nội dung bài viết","textarea",{required:true,max:100000}),f("is_active","Hiển thị bài viết","select",{choices:[[false,"Bản nháp / đã ẩn"],[true,"Xuất bản / hẹn giờ"]],boolean:true,default:false}),f("published_at","Thời điểm đăng (giờ Việt Nam)","datetime-local")],
  },
  encounters:{id:"encounter_id",list:encounters.listEncounters,get:async(id,opt)=>(await encounters.getEncounter(id,opt)).encounter,columns:["Mã lượt","Người bệnh","Bác sĩ","Hình thức","Ngày khám","Khung giờ","Mã phiếu","Trạng thái"],
    cells:r=>[esc(code("LK", r.encounter_id)),esc(r.patient_name),esc(r.doctor_name),badge(r.encounter_type),date(r.work_date),esc(r.estimated_exam_at?new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit"}).format(new Date(r.estimated_exam_at)):"—"),esc(r.ticket_code || "Chưa phát phiếu"),badge(r.encounter_status)],
    filters:[id("patient_id","Mã bệnh nhân"),id("schedule_id","Mã ca"),f("doctor_profile_id","Bác sĩ","select",{reference:"doctors"}),f("work_date","Ngày khám","date"),choice("encounter_type","Hình thức",["ONLINE","WALK_IN"]),choice("encounter_status","Trạng thái",["HOLDING","CONFIRMED","CHECKED_IN","IN_PROGRESS","COMPLETED","CANCELLED","NO_SHOW","EXPIRED"])],
  },
};
export function collectionItemMarkup(name, row={},imagePicker=true) {
  if(name==="gallery"&&imagePicker) {
    const src=thumbnailUrl(row.url);
    return `<div class="admin-collection-item admin-gallery-item" data-item><label class="admin-gallery-caption">Chú thích<textarea data-field="caption" maxlength="500" rows="4">${esc(row.caption||"")}</textarea></label><div class="admin-gallery-image"><input type="hidden" data-field="url" value="${esc(row.url||"")}"><input type="file" data-gallery-image accept="image/jpeg,image/png,image/webp" hidden><button type="button" data-action="choose-gallery-image">Chọn ảnh</button><img alt="Ảnh thư viện chuyên khoa" ${src?`src="${esc(src)}"`:"hidden"}><p role="status" class="admin-gallery-feedback"></p></div><button type="button" class="secondary" data-action="collection-remove">Bỏ mục</button></div>`;
  }
  const fields=name==="gallery"?[["url","Đường dẫn ảnh",2000],["caption","Chú thích",500]]:[["title","Tiêu đề mục",200],["content","Nội dung",12000]];
  return `<div class="admin-collection-item" data-item>${fields.map(([key,title,max])=>`<label>${title}${key==="content"?`<textarea data-field="${key}" maxlength="${max}" rows="3" required>${esc(row[key] || "")}</textarea>`:`<input type="text" data-field="${key}" maxlength="${max}" value="${esc(row[key] || "")}" ${key!=="caption"?"required":""}>`}</label>`).join("")}<button type="button" class="secondary" data-action="collection-remove">Bỏ mục</button></div>`;
}
export function fieldMarkup(field, row={}, references={}, edit=false, filter=false) {
  const value=row[field.name] ?? field.default ?? "";
  if(field.type==="json") {
    const items=Array.isArray(value)?value:[];
    return `<fieldset class="admin-collection" data-collection="${field.name}"><legend>${esc(field.title)}</legend><div data-collection-items>${items.map(item=>collectionItemMarkup(field.name,item,edit)).join("")}</div><button type="button" class="secondary" data-action="collection-add" data-name="${field.name}">Thêm mục</button></fieldset>`;
  }
  const locked=edit&&(field.readOnEdit || field.lockedWhenBooked&&Number(row.booked_count)>0);
  const attrs=`name="${esc(field.name)}" ${!filter&&field.required?"required":""} ${locked?"disabled":""} ${field.max?`maxlength="${field.max}"`:""} ${field.minLength?`minlength="${field.minLength}"`:""} ${field.pattern?`pattern="${field.pattern}"`:""} ${field.type==="number"?`step="1" ${field.min!=null?`min="${field.name==="max_quota"?Math.max(field.min,Number(row.booked_count)||0):field.min}"`:""} ${field.maxNumber!=null?`max="${field.maxNumber}"`:""}`:""}`;
  let input;
  if(field.type==="select") {
    const choices=field.reference?references[field.reference] || []:field.choices;
    input=`<select ${attrs}>${options(choices,value,filter?"Tất cả":"Chọn…")}</select>`;
  } else if(field.type==="checkbox") input=`<input type="checkbox" ${attrs} ${value?"checked":""}>`;
  else if(["textarea","lines","json"].includes(field.type)) {
    const text=field.type==="json"?JSON.stringify(value || [],null,2):field.type==="lines"?(Array.isArray(value)?value.join("\n"):value):value;
    input=`<textarea ${attrs} rows="${field.name==="content"?12:4}">${esc(text)}</textarea>`;
  } else {
    const text=field.type==="datetime-local"&&value?new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(" ","T"):field.type==="time"?String(value).slice(0,5):value;
    input=`<input type="${field.type}" ${attrs} value="${esc(text)}" ${field.businessId?`placeholder="${prefixes[field.name]}_001"`:""} ${field.name==="dob"?`max="${new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}"`:""}>`;
  }
  if(field.clearable&&!locked&&!["select","checkbox"].includes(field.type)) {
    input=`<span class="admin-clearable-input">${input}<button type="button" class="admin-input-clear" data-action="clear-input" aria-label="Xóa nội dung ${esc(field.title)}" title="Xóa nội dung">×</button></span>`;
  }
  return `<label class="${field.type==="checkbox"?"admin-checkbox":""}">${field.type==="checkbox"?input:""}<span>${esc(field.title)}${!filter&&field.required?" *":""}</span>${field.type!=="checkbox"?input:""}</label>`;
}
export function resourcePayload(key, raw, row) {
  const edit=Boolean(row), config=resources[key], payload={};
  for(const field of config.fields) {
    if(edit&&field.createOnly || !edit&&field.editOnly || edit&&(field.readOnEdit || field.lockedWhenBooked&&Number(row.booked_count)>0))continue;
    let value=raw[field.name];
    if(field.type==="checkbox")value=value===true||value==="on";
    else if(field.boolean)value=value==="true"||value===true;
    else if(field.number||field.type==="number") {if(value===""||value==null){if(field.required)throw new Error(`Vui lòng nhập ${field.title.toLowerCase()}.`);continue;}value=Number(value);if(!Number.isInteger(value)||field.min!=null&&value<field.min||field.maxNumber!=null&&value>field.maxNumber)throw new Error(`${field.title} không hợp lệ.`);}
    else if(field.type==="lines")value=String(value || "").split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
    else if(field.type==="json") {try{value=JSON.parse(value || "[]");}catch{throw new Error(`${field.title}: JSON không hợp lệ.`);}if(!Array.isArray(value))throw new Error(`${field.title} phải là một danh sách.`);}
    else if(field.type==="datetime-local") {if(!value){if(!edit)continue;value=null;}else value=new Date(`${value.length===16?value+":00":value}+07:00`).toISOString();}
    else {value=field.type==="password"?String(value ?? ""):String(value ?? "").trim();if(field.omitEmpty&&!value)continue;if(!value&&!field.required)value=null;}
    if(field.required&&(value==null||value===""))throw new Error(`Vui lòng nhập ${field.title.toLowerCase()}.`);
    payload[field.name]=value;
  }
  if(key==="users"&&!payload.email&&!payload.phone&&!edit)throw new Error("Cần nhập email hoặc số điện thoại.");
  if(key==="patients"&&!edit&&!payload.dob&&!payload.id_card)throw new Error("Cần ngày sinh hoặc CCCD để phân biệt hồ sơ bệnh nhân.");
  if(key==="schedule"&&payload.start_time&&payload.end_time&&payload.end_time<=payload.start_time)throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");
  if(key==="users"&&edit) {
    for(const field of Object.keys(payload))if(payload[field]===row[field==="role"?"role_name":field])delete payload[field];
    if(!Object.keys(payload).length)throw new Error("Chưa có thay đổi để lưu.");
  }
  if(key==="departments"&&edit)payload.expected_version=row.version;
  return payload;
}
