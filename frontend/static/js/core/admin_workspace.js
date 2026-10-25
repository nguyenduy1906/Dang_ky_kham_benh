import "./date_inputs.js";
import "./table_layout.js";
import {initAdminStatistics} from "./admin_statistics.js";
import {replaceAdminRegion} from "./admin_render.js";
import {initAdminPayments} from "./admin_payments.js";
import {patientHistoryTable,readPatientVisit,patientVisitMarkup} from "./admin_patient_visit.js";
import {configurationMarkup,bindConfigurationHours} from "./admin_configuration_view.js";
import {initActivityLog} from "./admin_activity.js";
import {loadPatientAccount,savePatientAccount} from "./admin_patient_account.js";
import {validateDepartmentImage,saveDepartmentImage,createDepartmentWithImages} from "./admin_department_image.js";
import {thumbnailUrl} from "./articles.js";
import { departmentDetails, departmentMemberGroups, addDepartmentMember, departmentDeputyLimit } from "./admin_department_view.js";
import {saveDepartmentLeadership} from "./admin_department_leadership.js";
import { userAccountDetails, saveUserAccount } from "./admin_user_account.js";
import { loadAdminDoctor, saveAdminDoctor, loadEligibleDoctorAccounts } from "./admin_doctor_data.js";
import { doctorForm, doctorDetails } from "./admin_doctor_view.js";
import { code, codeParams } from "./business_codes.js";
import * as auth from "../api/auth.js";
import * as patients from "../api/patient.js";
import * as doctors from "../api/doctor.js";
import * as catalog from "../api/catalog.js";
import * as schedules from "../api/schedule.js";
import * as articles from "../api/article.js";
import * as configurations from "../api/configuration.js";
import * as leave from "../api/staff_leave.js";
import * as encounters from "../api/encounter.js";
import { $, esc, date, stamp, badge, label, table, facts, panel, options, button, allPages, createAdminContext, today } from "./admin_ui.js";
import {resources,fieldMarkup,resourcePayload,collectionItemMarkup} from "./admin_resources.js";
import {bindLiveSearch} from "./live_search.js";
import {searchAdminSchedules} from "./admin_schedule_search.js";
import {searchAdminEncounters} from "./admin_encounter_search.js";
import {encounterDetails} from "./admin_encounter_detail.js";
import {patientDetails} from "./admin_patient_detail.js";
import {patientEditForm,patientCreateForm} from "./admin_patient_form.js";
import {openBulkAssignment} from "./admin_bulk_assignment.js";
import {openScheduleBuilder} from "./admin_schedule_builder.js";
import {searchAdminDoctors,searchAdminAssignments} from "./admin_staff_date_search.js";
import {leaveRequestDetails} from "./admin_leave_detail.js";
import {openScheduleDetail} from "./admin_schedule_detail.js";
import {initAdminOverview} from "./admin_overview.js";
import {startAutoRefresh} from "./auto_refresh.js";
export {adminPages} from "./admin_resources.js";

const dataForm = form => {
  const data=Object.fromEntries(new FormData(form));
  for(const collection of form.querySelectorAll("[data-collection]")) {
    data[collection.dataset.collection]=JSON.stringify([...collection.querySelectorAll("[data-item]")].map(item=>Object.fromEntries([...item.querySelectorAll("[data-field]")].map(input=>[input.dataset.field,input.value.trim()]))));
  }
  return codeParams(data);
};
const notice = text => `<p class="admin-note">${esc(text)}</p>`;
const feedback = '<p class="form-feedback" role="status" aria-live="polite"></p>';
const formActions = text => `<div class="actions"><button type="submit">${esc(text)}</button><button type="button" class="secondary" data-action="close-dialog">Hủy</button></div>${feedback}`;
const paginationMarkup = result => {
  const pages=Math.max(1,Math.ceil(result.total/result.page_size));
  return `<div class="admin-pagination"><span>${result.total} bản ghi · Trang ${result.page} / ${pages}</span><div><button type="button" class="secondary" data-action="previous" ${result.page<=1?"disabled":""}>Trang trước</button><button type="button" class="secondary" data-action="next" ${result.page>=pages?"disabled":""}>Trang sau</button></div></div>`;
};
async function references(names,signal) {
  const result={};
  await Promise.all([...new Set(names)].map(async name=>{
    if(name==="departments")result[name]=(await catalog.listDepartments({include_inactive:true},{signal})).items.map(r=>[r.department_id,r.name]);
    if(name==="rooms")result[name]=(await catalog.listRooms({include_inactive:true},{signal})).items.map(r=>[r.room_id,`${r.room_name} · ${r.department_name}`]);
    if(name==="doctors")result[name]=(await allPages(doctors.listDoctors,{include_inactive:true},signal)).map(r=>[r.doctor_profile_id,r.full_name]);
    if(name==="roles")result[name]=(await auth.listRoles({signal})).items.map(r=>[r.role_name,label(r.role_name)]);
    if(name==="doctorUsers")result[name]=(await loadEligibleDoctorAccounts({signal})).map(r=>[r.user_id,`${r.full_name} (${code("TK", r.user_id)})`]);
    if(name==="nurses")result[name]=(await allPages(auth.listUsers,{role:"NURSE",account_status:"ACTIVE",approval_status:"APPROVED"},signal)).map(r=>[r.user_id,`${r.full_name} (${code("TK", r.user_id)})`]);
    if(name==="schedules")result[name]=(await allPages(schedules.listAdminSchedules,{from_date:today()},signal)).filter(r=>["OPEN","FULL"].includes(r.schedule_status)).map(r=>[r.schedule_id,`${code("CA", r.schedule_id)} · ${date(r.work_date)} · ${r.start_time.slice(0,5)} · ${r.room_name} · ${r.doctor_name}`]);
  }));
  return result;
}
export function fieldsForm(key,row,refs) {
  const config=resources[key], edit=Boolean(row), values=row?{...row,role:row.role_name}:{};
  const fields=config.fields.filter(f=>!(edit&&f.createOnly || !edit&&f.editOnly || key==="departments"&&f.name==="cover_image_url"));
  if(key==="patients")return edit?patientEditForm(row,fields,refs,formActions("Lưu thay đổi")):patientCreateForm(fields,refs,formActions("Thêm bệnh nhân"));
  if(key==="doctors")return doctorForm(row,fields,refs,formActions(edit?"Lưu thay đổi":"Tạo hồ sơ bác sĩ"));
  if(key==="users"&&!edit)refs.roles=refs.roles.filter(([role])=>["DOCTOR","NURSE","RECEPTIONIST"].includes(role));
  const normal=fields.filter(f=>!f.advanced).map(f=>{
    const markup=fieldMarkup({...f,clearable:key==="departments"||edit&&["users","doctors"].includes(key),imagePicker:key==="departments"||edit},values,refs,edit);
    return key==="departments"&&f.name==="name"?`<div class="admin-department-name-row">${markup}<button type="button" data-action="choose-department-image">Tải ảnh chuyên khoa</button></div><div class="admin-department-image-area"><input type="file" data-department-image accept="image/jpeg,image/png,image/webp" hidden><input type="hidden" name="cover_image_url" value="${esc(row?.cover_image_url||"")}"><img class="admin-department-image-preview" alt="Ảnh chuyên khoa" ${thumbnailUrl(row?.cover_image_url)?`src="${esc(thumbnailUrl(row?.cover_image_url))}"`:"hidden"}><p class="admin-department-image-feedback" role="status"></p></div>`:markup;
  }).join("");
  const advanced=fields.filter(f=>f.advanced).map(f=>fieldMarkup({...f,clearable:key==="departments"||edit&&["users","doctors"].includes(key),imagePicker:key==="departments"||edit},values,refs,edit)).join("");
  return `${key==="users"&&edit?`<div class="admin-user-edit-meta">${facts([["Mã tài khoản",code("TK",row.user_id)],["Ngày tạo",stamp(row.created_at)],["Cập nhật lần cuối",stamp(row.updated_at)]])}</div>`:""}<form class="${key==='doctors'?'admin-doctor-form':''}" data-form="resource" data-department-version="${key==='departments'&&edit?esc(row.version):''}" data-id="${esc(row?.[config.id] ?? "")}" autocomplete="off"><div class="admin-contact-fields">${normal}</div>${key==="departments"?`<div class="admin-department-tools"><div class="actions">${edit?button("leadership",row.department_id,"Thành viên khoa"):""}<button type="button" data-action="toggle-department-content" aria-expanded="false" aria-controls="department-content-fields">Nội dung giới thiệu chuyên khoa</button></div></div>`:""}${advanced?(key==="departments"?`<div id="department-content-fields" class="admin-advanced" hidden><div class="admin-contact-fields">${advanced}</div></div>`:`<details class="admin-advanced"><summary>Nội dung giới thiệu chuyên khoa</summary><div class="admin-contact-fields">${advanced}</div></details>`):""}${key==="patients"?notice("Cần ngày sinh hoặc CCCD để phân biệt hồ sơ. Số điện thoại liên kết của hồ sơ đã có được quản lý ở tài khoản."):""}${key==="schedule"&&Number(row?.booked_count)>0?notice("Ca đã có lượt khám: giữ nguyên phòng, ngày, giờ và thời lượng khung giờ."):""}${formActions(edit?"Lưu thay đổi":"Tạo mới")}</form>`;
}
function detailMarkup(key,row) {
  if(key==="departments")return departmentDetails(row);
  if(key==="encounters")return encounterDetails(row);
  if(key==="patients")return patientDetails(row);
  if(key==="doctors")return doctorDetails(row);
  if(key==="assignments") {
    const section=(title,entries)=>`<section class="admin-basic-detail-section"><h3>${esc(title)}</h3>${facts(entries)}</section>`;
    return `<div class="admin-basic-detail"><div class="admin-basic-detail-summary"><div><small>${esc(code("PC",row.assignment_id))}</small><h3>${esc(row.nurse_name||"Y tá")}</h3></div><span class="badge ${row.revoked_at?"assignment-revoked":"green"}">${row.revoked_at?"Đã thu hồi":"Đang phân công"}</span></div>${section("Thông tin ca làm việc",[["Mã ca",code("CA",row.schedule_id)],["Phòng khám",row.room_name],["Ngày làm việc",date(row.work_date)],["Khung giờ",`${row.start_time?.slice(0,5)||"—"} – ${row.end_time?.slice(0,5)||"—"}`]])}<section class="admin-basic-detail-section"><h3>Ghi chú phân công</h3><p class="admin-basic-detail-note">${esc(row.note||"Chưa có ghi chú.")}</p></section>${section("Thông tin phân công",[["Ngày phân công",stamp(row.assigned_at)],["Người phân công",row.assigned_by_id?code("TK",row.assigned_by_id):"—"],["Trạng thái",row.revoked_at?"Đã thu hồi":"Đang phân công"]])}${row.revoked_at?section("Thông tin thu hồi",[["Ngày thu hồi",stamp(row.revoked_at)],["Người thu hồi",row.revoked_by_id?code("TK",row.revoked_by_id):"—"]]):""}</div>`;
  }
  if(key==="rooms")return `<div class="admin-basic-detail"><div class="admin-basic-detail-summary"><div><small>${esc(code("PH",row.room_id))}</small><h3>${esc(row.room_name)}</h3></div>${badge(row.is_active?"ACTIVE":"LOCKED")}</div><section class="admin-basic-detail-section"><h3>Thông tin phòng khám</h3>${facts([["Chuyên khoa",row.department_name],["Mã phòng",code("PH",row.room_id)]])}</section><section class="admin-basic-detail-section"><h3>Mô tả</h3><p class="admin-basic-detail-note">${esc(row.description||"Chưa có mô tả.")}</p></section></div>`;
  if(key==="articles")return `<div class="admin-basic-detail"><div class="admin-basic-detail-summary"><div><small>${esc(code("BV",row.article_id))}</small><h3>${esc(row.title)}</h3></div></div><section class="admin-basic-detail-section"><h3>Thông tin bài viết</h3>${facts([["Danh mục",row.category||"—"],["Tác giả",row.author_name||row.author_id||"—"],["Ngày đăng",stamp(row.published_at)],["Trạng thái",!row.is_active?"Bản nháp / đã ẩn":!row.published_at?"Chưa xuất bản":new Date(row.published_at)>new Date()?"Hẹn giờ":"Đã xuất bản"]])}</section><section class="admin-basic-detail-section"><h3>Nội dung bài viết</h3><p class="admin-basic-detail-note">${esc(row.content||"Chưa có nội dung.")}</p></section><div class="actions">${button("article-image",row.article_id,"Tải ảnh bài viết")}</div></div>`;
  const config=resources[key];
  const extra={users:[["Đã xóa",row.is_deleted?"Có":"Không"],["Ngày tạo",stamp(row.created_at)]],patients:[["CCCD",row.id_card],["Giới tính",row.gender],["Địa chỉ",row.address],["BHYT",row.health_insurance],["Tài khoản liên kết",code("TK", row.user_id)]],doctors:[["Mã tài khoản",code("TK", row.user_id)],["Chuyên môn",row.specialization],["Giới thiệu",row.introduction]],departments:[["Mô tả",row.description],["Giới thiệu",row.overview],["Chức năng, nhiệm vụ",row.mission]],assignments:[["Ghi chú",row.note],["Ngày phân công",stamp(row.assigned_at)],["Người phân công",code("TK", row.assigned_by_id)],["Ngày thu hồi",stamp(row.revoked_at)],["Người thu hồi",code("TK", row.revoked_by_id)]]}[key] || [];
  return (key==="users"?userAccountDetails(row):facts(config.columns.map((name,index)=>[name,config.cells(row)[index].replace(/<[^>]*>/g,"").replace(/&(amp|lt|gt|quot|#39);/g,(_,name)=>({amp:"&",lt:"<",gt:">",quot:'"',"#39":"'"}[name]))]).concat(extra)))
    +(key==="articles"?`<h3>Nội dung bài viết</h3><pre class="admin-text-content">${esc(row.content)}</pre>`:"")
    +'<div class="actions">'
    +(key==="patients"?button("patient-history",row.patient_id,"Lịch sử khám"):"")


    +(key==="articles"?button("article-image",row.article_id,"Tải ảnh bài viết"):"")
    +'</div>';
}
export async function initAdminWorkspace(key) {
  const ctx=createAdminContext();
  document.querySelector("#page-header").insertAdjacentHTML("afterend",'<p id="admin-status" class="scope-note" role="status" hidden></p>');
  const body=$("#page-body"), modal=$("#admin-dialog"), modalBody=$("#admin-dialog-body");
  if(key==="home"){await initAdminOverview(ctx);return ctx;}
  if(key==="payments"){await initAdminPayments(ctx);return ctx;}
  if(key==="statistics"){await initAdminStatistics(ctx);return ctx;}
  const records=new Map();
  let page=1, reload=async()=>{}, listResult, refs={};
  function bindTextFilters(form,apply,resultId,pagerId) {
    const inputs=[...form.querySelectorAll("input")].filter(input=>["search","text","tel","number"].includes(input.type));
    if(!inputs.length)return false;
    form.querySelector('button[type="submit"]')?.remove();
    const refreshers=[];
    const invalidate=()=>{
      refreshers.forEach(refresh=>refresh.cancel());
      ctx.cancelLoad();
      if(!ctx.active)return;
      $(resultId).setAttribute('aria-busy','true');
    };
    const safelyApply=async()=>{try { await apply(); } catch(error) { ctx.handle(error); } finally {$(resultId)?.removeAttribute('aria-busy');}};
    inputs.forEach(input=>refreshers.push(bindLiveSearch(input,safelyApply,{invalidate})));
    const refresh=refreshers[0];
    form.addEventListener("submit",event=>{event.preventDefault();refresh();});
    form.addEventListener("change",event=>{if(!inputs.includes(event.target))refresh();});
    return true;
  }
  function close(){modal.close();}
  const assignmentSchedulePreview=row=>`<div class="admin-assignment-schedule-info">${facts([["Phòng",row.room_name||"—"],["Ngày làm việc",date(row.work_date)],["Giờ làm việc",`${row.start_time?.slice(0,5)||"—"} – ${row.end_time?.slice(0,5)||"—"}`]])}</div>`;
  modalBody.addEventListener("change",event=>{
    if(!event.target.matches("[data-assignment-preview-schedule]"))return;
    const row=records.get(`assignment-preview:${event.target.value}`);
    $("#assignment-schedule-preview").innerHTML=row?assignmentSchedulePreview(row):"";
  });
  async function editResource(id) {
    if(key==="assignments"&&id) {
      await ctx.show("Chỉnh sửa phân công",async signal=>{
        const {assignment:row}=await schedules.getNurseAssignment(id,{signal});records.set(String(id),row);
        const [choices,calendar]=await Promise.all([references(["nurses"],signal),allPages(schedules.listAdminSchedules,{from_date:today()},signal)]);
        if(!choices.nurses.some(([value])=>String(value)===String(row.nurse_id)))choices.nurses.push([row.nurse_id,row.nurse_name]);
        if(!calendar.some(item=>String(item.schedule_id)===String(row.schedule_id)))calendar.unshift(row);
        const scheduleChoices=calendar.map(item=>[item.schedule_id,`${code("CA",item.schedule_id)} · ${date(item.work_date)} · ${item.start_time?.slice(0,5)}–${item.end_time?.slice(0,5)} · ${item.room_name}`]);
        for(const item of calendar)records.set(`assignment-preview:${item.schedule_id}`,item);
        return `<div class="admin-user-edit-meta">${facts([["Mã phân công",code("PC",row.assignment_id)],["Ngày phân công",stamp(row.assigned_at)],["Người phân công",code("TK",row.assigned_by_id)]])}</div><form class="admin-assignment-edit" data-form="assignment-edit" data-id="${esc(id)}" data-version="${esc(row.version)}"><div class="admin-contact-fields"><label>Y tá<select name="nurse_id" required>${options(choices.nurses,row.nurse_id,"Chọn y tá")}</select></label><label>Ca được giao<select name="schedule_id" required data-assignment-preview-schedule>${options(scheduleChoices,row.schedule_id,"Chọn ca")}</select></label></div><div id="assignment-schedule-preview">${assignmentSchedulePreview(row)}</div><div class="admin-contact-fields"><label>Trạng thái<select name="assignment_status">${options([["ACTIVE","Đang phân công"],["REVOKED","Thu hồi"]],row.revoked_at?"REVOKED":"ACTIVE","Chọn trạng thái")}</select></label><label class="admin-assignment-note">Ghi chú<textarea name="note" rows="3" maxlength="1000">${esc(row.note||"")}</textarea></label></div>${formActions("Lưu thay đổi")}</form>`;
      });return;
    }
    const config=resources[key];
    await ctx.show(id?"Chỉnh sửa thông tin":config.add,async signal=>{
      const row=id?(key==="patients"?await loadPatientAccount(id,{signal}):key==="doctors"?await loadAdminDoctor(id,{signal}):config.get?await config.get(id,{signal}):records.get(String(id))):null;
      if(id&&!row)throw new Error("Không tìm thấy bản ghi.");
      if(row)records.set(String(id),row);
      const fields=config.fields.filter(f=>!(row&&f.createOnly || !row&&f.editOnly));
      const choices=await references(fields.map(f=>f.reference).filter(Boolean),signal);
      return fieldsForm(key,row,choices);
    });
  }
  async function resourcePage() {
    const config=resources[key], pageSize=["users","doctors","assignments","departments"].includes(key)?10:12;
    body.classList.toggle("admin-users-list",key==="users");
    body.classList.toggle("admin-patients-list",key==="patients");
    body.classList.toggle("admin-doctors-list",key==="doctors");
    body.classList.toggle("admin-assignments-list",key==="assignments");
    body.classList.toggle("admin-departments-list",key==="departments");
    body.classList.toggle("admin-rooms-list",key==="rooms");
    body.classList.toggle("admin-schedule-list",key==="schedule");
    if(config.add)$("#page-header").insertAdjacentHTML("beforeend",`<button id="add-record" type="button">＋ ${esc(config.add)}</button>`);
    $("#add-record")?.addEventListener("click",event=>{
      if(key==="assignments"){ctx.cancelLoad();openBulkAssignment({ctx,body,trigger:event.currentTarget,onBack:()=>reload()});}
      else if(key==="schedule"){ctx.cancelLoad();openScheduleBuilder({body,trigger:event.currentTarget,ctx,onSaved:()=>reload()}).catch(error=>ctx.handle(error));}
      else editResource();
    });
    const listTitle={users:"Danh sách tài khoản",patients:"Danh sách bệnh nhân",doctors:"Danh sách bác sĩ",departments:"Danh sách chuyên khoa",rooms:"Danh sách phòng khám",schedule:"Danh sách ca làm việc",assignments:"Danh sách phân công y tá",articles:"Danh sách tin tức",encounters:"Danh sách lượt khám"}[key];
    body.innerHTML=panel(listTitle,'<div id="admin-filters"></div><div id="admin-results"></div><div id="admin-pager"></div>')+(key==="schedule"?panel("Đơn xin nghỉ",'<form id="leave-filter" class="admin-toolbar"><label>Trạng thái<select name="status">'+options(["PENDING","APPROVED","REJECTED","CANCELLED"],"PENDING")+'</select></label><label>Mã nhân viên<input type="text" name="user_id"></label><button type="submit">Xem đơn</button></form><div id="leave-results"></div><div id="leave-pager"></div>'):"");
    reload=async()=>ctx.load(async signal=>{
      const form=$("#resource-filter"), raw=Object.fromEntries(new FormData(form));
      for(const input of form.querySelectorAll('[data-reference-filter]')) {
        const text=input.value.trim(), match=(refs[input.dataset.referenceFilter]||[]).find(([,name])=>name===text);
        if(text&&!match)throw new Error(`Vui lòng chọn ${input.closest('label').querySelector('span').textContent.toLocaleLowerCase('vi')} từ danh sách gợi ý.`);
        raw[input.name]=match?match[0]:"";
      }
      const params=codeParams(raw);
      if(params.from_date&&params.to_date&&params.to_date<params.from_date)throw new Error("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.");
      if(key==="schedule")return searchAdminSchedules(params,page,pageSize,signal);
      if(key==="encounters")return searchAdminEncounters(params,page,pageSize,signal);
      if(key==="doctors")return searchAdminDoctors({...config.params,...params},page,pageSize,signal);
      if(key==="assignments")return searchAdminAssignments({...config.params,...params},page,pageSize,signal);
      const result=await config.list({...config.params,...params,page,page_size:pageSize},{signal});
      if(config.local){
        let items=result.items;
        const q=String(params.q || "").trim().toLocaleLowerCase("vi");
        if(q)items=items.filter(row=>[row.name,row.room_name,row.description].filter(Boolean).join(" ").toLocaleLowerCase("vi").includes(q));
        return {items:items.slice((page-1)*pageSize,page*pageSize),total:items.length,page,page_size:pageSize,
          departmentNames:key==="departments"?[...new Set(result.items.map(row=>row.name).filter(Boolean))]:undefined};
      }
      return result;
    },result=>{
      listResult=result;page=result.page;for(const row of result.items)records.set(String(row[config.id]),row);
      if(key==="departments")$("#department-name-suggestions").innerHTML=result.departmentNames.map(name=>`<option value="${esc(name)}"></option>`).join("");
      const columns=key==="schedule"?[...config.columns,"Thao tác","Xem chi tiết"]:[...config.columns,"Thao tác"];
      const cells=row=>key==="schedule"?[...config.cells(row),rowActions(key,row),button("schedule-view",row.schedule_id,"Xem chi tiết")]:[...config.cells(row),rowActions(key,row)];
      replaceAdminRegion($("#admin-results"),table(columns,result.items.map(cells),config.title || "Danh sách quản trị"));
      replaceAdminRegion($("#admin-pager"),paginationMarkup(result));
    });
    await ctx.load(signal=>references(config.filters.map(f=>f.reference).filter(Boolean),signal),result=>{
      refs=result;
      const initialFilters=["assignments","encounters"].includes(key)?{work_date:today()}:key==="schedule"?{from_date:today(),to_date:today()}:{};
      $("#admin-filters").innerHTML=`<form id="resource-filter" class="admin-toolbar ${config.filters.length===3&&config.filters[0].type==='search'?'admin-toolbar-three':''}">${config.filters.map(f=>fieldMarkup(f,initialFilters,refs,false,true)).join("")}<button type="submit">Lọc danh sách</button></form>`;
    });
    if(!ctx.active||!$("#resource-filter"))return;
    if(key==="departments") {
      const input=$("#resource-filter").elements.q;
      input.setAttribute("list","department-name-suggestions");
      input.setAttribute("autocomplete","off");
      input.insertAdjacentHTML("afterend",'<datalist id="department-name-suggestions"></datalist>');
    }
    // Optional deep links carry only backend ids, never grant access.
    if(key==="encounters") {
      const query=new URLSearchParams(location.search);
      $("#resource-filter").elements.q.value=[["schedule_id","CA"],["patient_id","BN"]].flatMap(([field,prefix])=>{
        const value=query.get(field);return value&&/^[1-9]\d*$/.test(value)?[code(prefix,value)]:[];
      }).join(" ");
    }
    for(const field of ["schedule_id","patient_id"]){const value=new URLSearchParams(location.search).get(field);if(value&&/^\d+$/.test(value)&&$("#resource-filter").elements[field])$("#resource-filter").elements[field].value=value;}
    if(key==="patients") {
      const query=new URLSearchParams(location.search),form=$("#resource-filter");
      if(query.has("patient_status")&&["","ACTIVE","INACTIVE"].includes(query.get("patient_status")))form.elements.patient_status.value=query.get("patient_status");
    }
    const apply=()=>{
      page=1;
      if(key==="patients") {
        const url=new URL(location.href),form=$("#resource-filter");
        url.searchParams.set("patient_status",form.elements.patient_status.value);
        history.replaceState(history.state,"",url);
      }
      return reload();
    };
    if(!bindTextFilters($("#resource-filter"),apply,"#admin-results","#admin-pager"))$("#resource-filter").addEventListener("submit",event=>{event.preventDefault();apply();});
    await reload();
    if(key==="schedule") {
      bindTextFilters($("#leave-filter"),()=>{leavePage=1;return leaveList();},"#leave-results","#leave-pager");
      await leaveList();
    }
  }
  function rowActions(name,row) {
    const config=resources[name],id=row[config.id];
    return `<div class="admin-row-actions">${button("detail",id,"Chi tiết")}${config.update&&!row.is_deleted&&(name==="patients"||!row.is_archived)?button("edit",id,["users","patients","doctors","departments","rooms","schedule"].includes(name)?"Chỉnh sửa":"Sửa"):""}${name==="assignments"?button("edit",id,"Chỉnh sửa"):""}</div>`;
  }
  async function confirmation(action,id) {
    const row=records.get(String(id));if(!row)return;
    const config=resources[key];
    const titles={archive:"Lưu trữ hồ sơ bệnh nhân"};
    await ctx.show(titles[action],async()=>facts([["Mã",code({users:"TK",patients:"BN",doctors:"BS",departments:"CK",rooms:"PH",schedule:"CA",assignments:"PC",articles:"BV",encounters:"LK"}[key], id)],["Tên",row.full_name || row.nurse_name]])+notice("Hồ sơ sẽ ngừng sử dụng; lịch sử khám vẫn được giữ.")+`<form data-form="confirm" data-action="${action}" data-id="${esc(id)}">${formActions(titles[action])}</form>`);
  }
  async function showDetail(id) {
    const config=resources[key];
    await ctx.show("Chi tiết",async signal=>{
      const row=key==="patients"?await loadPatientAccount(id,{signal}):key==="doctors"?await loadAdminDoctor(id,{signal}):config.get?await config.get(id,{signal}):records.get(String(id));
      if(!row)throw new Error("Không tìm thấy bản ghi.");records.set(String(id),row);
      return detailMarkup(key,row);
    });
    const historyButton=$("#patient-history-header");
    if(key==="patients"&&historyButton&&modalBody.querySelector(".admin-patient-detail")?.dataset.patientId===String(id)) {
      historyButton.dataset.id=String(id);historyButton.hidden=false;
    }
  }

  async function configurationPage() {
    reload=async()=>ctx.load(signal=>allPages(configurations.listConfigurations,{},signal),rows=>{
      rows.forEach(r=>records.set(r.config_key,r));
      body.innerHTML=configurationMarkup(rows);
      bindConfigurationHours(body);
    });
    await reload();
  }
  async function auditPage() {
    await initActivityLog(ctx,body);
  }

  let leavePage=1;
  async function leaveList() {
    if(!ctx.active||!$("#leave-filter"))return;
    await ctx.load(signal=>leave.listAdminLeaveRequests({...dataForm($("#leave-filter")),page:leavePage,page_size:10},{signal}),result=>{
      replaceAdminRegion($("#leave-results"),table(["Mã đơn","Nhân viên","Vai trò","Từ ngày","Đến ngày","Buổi nghỉ","Trạng thái","Thao tác"],result.items.map(r=>[esc(code("NP", r.request_id)),esc(r.staff_name),badge(r.role_name),date(r.from_date),date(r.to_date),esc(label(r.period)),badge(r.status),button("leave-detail",r.request_id,r.status==="PENDING"?"Xem / xét duyệt":"Chi tiết")])));
      const pages=Math.max(1,Math.ceil(result.total/result.page_size));
      $("#leave-pager").innerHTML=`<div class="admin-pagination"><span>${result.total} đơn · Trang ${result.page} / ${pages}</span><div><button type="button" class="secondary" data-action="leave-prev" ${leavePage<=1?"disabled":""}>Trang trước</button><button type="button" class="secondary" data-action="leave-next" ${leavePage>=pages?"disabled":""}>Trang sau</button></div></div>`;
    });
  }
  async function leaveDetail(id) {
    await ctx.show("Đơn xin nghỉ",async signal=>{
      const result=await leave.getAdminLeaveRequest(id,{signal});
      return leaveRequestDetails(result,id);
    });
  }
  let historyPatientId;
  async function patientHistory(id) {
    historyPatientId=id;
    $("#patient-visit-back")?.remove();
    await ctx.show("Lịch sử khám",async signal=>{
      const rows=await allPages((params,opt)=>patients.listEncounters(id,params,opt),{},signal);
      return patientHistoryTable(rows);
    });
  }
  async function patientVisit(id) {
    if(!historyPatientId)return;
    const patientId=historyPatientId;
    if(!$("#patient-visit-back")) {
      $("#admin-dialog-title").insertAdjacentHTML("beforebegin",'<button type="button" class="secondary" id="patient-visit-back">← Lịch sử khám</button>');
      $("#patient-visit-back").addEventListener("click",()=>patientHistory(patientId));
    }
    await ctx.show(`Hồ sơ lần khám ${code("LK",id)}`,async signal=>patientVisitMarkup(await readPatientVisit(id,patientId,{signal})));
    modal.scrollTop=0;
  }
  modal.addEventListener("close",()=>{$("#patient-visit-back")?.remove();historyPatientId=null;});
  let memberDraft=[],memberCandidates=[],memberDepartmentId,memberVersion,departmentEditor;
  async function leadership(id) {
    memberDepartmentId=id;
    if(modalBody.querySelector('form[data-form="resource"]'))departmentEditor={id,nodes:[...modalBody.childNodes],title:$("#admin-dialog-title").textContent};
    const title=$("#admin-dialog-title");
    $("#department-dialog-back")?.remove();
    title.insertAdjacentHTML("beforebegin",`<button type="button" id="department-dialog-back" class="admin-member-inline-back" data-id="${esc(id)}">← Quay lại</button>`);
    $("#department-dialog-back").addEventListener("click",()=>{
      $("#department-dialog-back")?.remove();
      if(departmentEditor&&String(departmentEditor.id)===String(id)) {
        modalBody.replaceChildren(...departmentEditor.nodes);$("#admin-dialog-title").textContent=departmentEditor.title;departmentEditor=null;modal.scrollTop=0;
      } else editResource(id).catch(error=>ctx.handle(error));
    });
    await ctx.show("Lãnh đạo và thành viên khoa",async signal=>{
      const members=await catalog.getDepartmentMembers(id,{signal});
      const history=await catalog.getDepartmentLeadership(id,{signal});
      if(history.version!==members.version)throw new Error("Khoa vừa được thay đổi. Bấm Quay lại và mở lại danh sách thành viên.");
      const department={department:members.department};
      const candidates=(await allPages(doctors.listDoctors,{include_inactive:true},signal)).filter(r=>r.is_active&&r.account_ok);
      memberCandidates=candidates;
      memberVersion=members.version;
      memberDraft=members.items;
      return `<h3>${esc(department.department.name)}</h3><section class="admin-department-section"><div class="admin-member-section-heading"><h3>Thành viên khoa</h3></div><div id="department-members">${departmentMemberGroups(memberDraft,id)}</div><form class="admin-member-add-form"><div class="admin-contact-fields"><label>Thêm bác sĩ<input type="text" name="member_doctor" list="department-doctor-suggestions" placeholder="Tên hoặc mã bác sĩ" autocomplete="off" required><datalist id="department-doctor-suggestions">${candidates.map(r=>`<option value="${esc(`${r.full_name} (${code("BS",r.doctor_profile_id)})`)}">${esc(r.department_name||"Chưa có khoa")}</option>`).join("")}</datalist></label><label>Chức vụ<select name="position"><option value="HEAD" ${memberDraft.some(r=>r.position==="HEAD")?"disabled":""}>Trưởng khoa${memberDraft.some(r=>r.position==="HEAD")?" (đã có)":""}</option><option value="DEPUTY" ${memberDraft.filter(r=>r.position==="DEPUTY").length>=departmentDeputyLimit(memberDraft.length+1)?"disabled":""}>Phó khoa</option><option value="DOCTOR" selected>Bác sĩ</option></select></label></div><div class="actions"><button type="submit">Thêm thành viên</button></div><p class="form-feedback" role="status"></p></form></section>`
        +'<div class="admin-department-history">'+panel("Lịch sử phân công",table(["Bác sĩ","Chức vụ","Bắt đầu","Kết thúc"],history.items.map(r=>[esc(r.full_name),r.position==="HEAD"?"Trưởng khoa":"Phó khoa",stamp(r.appointed_at),stamp(r.ended_at)])))+'</div>';
    });
  }
  async function uploadForm(id) {
    await ctx.show("Ảnh bài viết",async()=>`<form data-form="upload" data-id="${esc(id)}"><label>Ảnh JPEG, PNG hoặc WebP<input type="file" name="file" accept="image/jpeg,image/png,image/webp" required></label>${notice("Tối đa 5 MB. Ảnh được dùng làm ảnh đại diện bài viết.")}${formActions("Tải và lưu ảnh")}</form>`);
  }
  async function action(event) {
    const target=event.target.closest("[data-action]");if(!target||target.disabled||!ctx.active)return;
    const name=target.dataset.action,id=target.dataset.id;
    if(name==="schedule-view"&&key==="schedule") {
      const row=records.get(String(id));if(!row)return;
      openScheduleDetail({ctx,body,row,information:detailMarkup("schedule",row),trigger:target,
        showEncounter:item=>{if(item)ctx.show("Chi tiết lượt khám",async signal=>detailMarkup("encounters",(await encounters.getEncounter(item.encounter_id,{signal})).encounter));}});
      return;
    }
    if(name==="back-department-edit"){await editResource(id);return;}
        if(name==="revoke-member-role") {
      const form=modalBody.querySelector(".admin-member-add-form");
      await ctx.submit(form,signal=>catalog.revokeDepartmentMemberRole(memberDepartmentId,id,{expected_version:memberVersion},{signal}),async result=>{
        updateDepartmentEditorVersion(result);close();await reload();
      });return;
    }
    if(name==="toggle-department-content") {
      const content=$("#department-content-fields");content.hidden=false;
      modalBody.classList.add("admin-department-content-view");
      const title=$("#admin-dialog-title"),previousTitle=title.textContent;
      title.textContent="Nội dung giới thiệu chuyên khoa";
      $("#department-dialog-back")?.remove();
      title.insertAdjacentHTML("beforebegin",'<button type="button" id="department-dialog-back" class="admin-member-inline-back">← Quay lại</button>');
      const back=$("#department-dialog-back");
      back.addEventListener("click",()=>{
        modalBody.classList.remove("admin-department-content-view");content.hidden=true;
        title.textContent=previousTitle;back.remove();modal.scrollTop=0;target.focus();
      });
      modal.scrollTop=0;back.focus();return;
    }
    if(name==="choose-gallery-image") {target.closest("[data-item]").querySelector("[data-gallery-image]").click();return;}
    if(name==="choose-department-image") {target.closest("form").querySelector("[data-department-image]").click();return;}
    if(name==="clear-input") {
      const input=target.closest(".admin-clearable-input")?.querySelector("input,textarea");
      if(input&&!input.disabled&&!input.readOnly){input.value="";input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));input.focus();}return;
    }
    if(name==="collection-add") {target.closest("[data-collection]").querySelector("[data-collection-items]").insertAdjacentHTML("beforeend",collectionItemMarkup(target.dataset.name,{},key==="departments"||Boolean(target.closest("form")?.dataset.id)));return;}
    if(name==="collection-remove") {target.closest("[data-item]").remove();return;}
    if(name==="close-dialog"){close();return;}
    if(name==="previous"||name==="next"){
      page+=name==="next"?1:-1;
      await reload();
      if(ctx.active)$("#admin-results")?.scrollIntoView({block:"start",behavior:"instant"});
      return;
    }
    if(name==="leave-prev"||name==="leave-next"){
      leavePage+=name==="leave-next"?1:-1;
      await leaveList();
      if(ctx.active)$("#leave-results")?.scrollIntoView({block:"start",behavior:"instant"});
      return;
    }
    if(name==="detail")await showDetail(id);
    if(name==="edit")await editResource(id);
    if(name==="archive")await confirmation(name,id);
    if(name==="leave-detail")await leaveDetail(id);
    if(name==="patient-history")await patientHistory(id);
    if(name==="patient-visit")await patientVisit(id);
    if(name==="leadership")await leadership(id);
    if(name==="article-image")await uploadForm(id);
  }
  body.addEventListener("click",event=>action(event).catch(error=>ctx.handle(error)));
  modalBody.addEventListener("click",event=>action(event).catch(error=>ctx.handle(error)));
  function updateDepartmentEditorVersion(result) {
    const form=departmentEditor?.nodes.find(node=>node.nodeType===1&&node.matches?.('form[data-form="resource"]'));
    if(form&&Number(form.dataset.departmentVersion)===memberVersion)form.dataset.departmentVersion=String(result.version??result.department.version);
    records.set(String(memberDepartmentId),result.department);
  }
  modalBody.addEventListener("submit",event=>{
    const form=event.target.closest(".admin-member-add-form");if(!form)return;
    event.preventDefault();
    ctx.submit(form,async signal=>{
      const chosen=form.elements.member_doctor.value.trim();
      const doctor=memberCandidates.find(r=>`${r.full_name} (${code("BS",r.doctor_profile_id)})`===chosen);
      const existing=doctor&&memberDraft.find(row=>String(row.doctor_profile_id)===String(doctor.doctor_profile_id));
      if(existing) {
        const position=form.elements.position.value;
        const head=position==="HEAD"?doctor.doctor_profile_id:memberDraft.find(row=>row.position==="HEAD"&&String(row.doctor_profile_id)!==String(doctor.doctor_profile_id))?.doctor_profile_id??null;
        const deputies=memberDraft.filter(row=>row.position==="DEPUTY"&&String(row.doctor_profile_id)!==String(doctor.doctor_profile_id)).map(row=>row.doctor_profile_id);
        if(position==="DEPUTY")deputies.push(doctor.doctor_profile_id);
        return saveDepartmentLeadership(memberDepartmentId,memberDraft,memberCandidates,head,deputies,memberVersion,{signal});
      }
      addDepartmentMember(memberDraft,doctor,form.elements.position.value);
      return catalog.addDepartmentMember(memberDepartmentId,{doctor_profile_id:doctor.doctor_profile_id,position:form.elements.position.value,expected_version:memberVersion,expected_source_department_id:doctor.department_id},{signal});
    },async result=>{updateDepartmentEditorVersion(result);close();await reload();});
  });
  async function submitForm(event) {
    const form=event.target.closest("[data-form]");if(!form||!ctx.active)return;event.preventDefault();
    const type=form.dataset.form,id=form.dataset.id,raw=dataForm(form);
    await ctx.submit(form,async signal=>{
      if(type==="assignment-edit") {
        const payload=resourcePayload("assignments",raw,records.get(String(id)));
        return schedules.updateNurseAssignment(id,{...payload,assignment_status:raw.assignment_status,expected_version:form.dataset.version},{signal});
      }
      if(type==="resource") {
        const row=id?records.get(String(id)):null;
        const payload=key==="patients"&&id&&(row.is_archived||row.archived_at)?{}:resourcePayload(key,raw,row);
        if(key==="patients"&&id) {
          const relatives=[...form.querySelectorAll("[data-relative-id]")].map(block=>({
            patient_id:block.dataset.relativeId,
            values:Object.fromEntries([...block.querySelectorAll("[data-relative-field]")].filter(input=>!input.disabled&&!input.closest("fieldset[disabled]")).map(input=>[input.dataset.relativeField,input.value])),
          }));
          return savePatientAccount(row,payload,relatives,{signal,accountStatus:raw.account_status,
            onPatientSaved:patient=>{if(String(patient.patient_id)!==String(id))records.set(String(patient.patient_id),patient);},
          });
        }
        if(key==="departments") {
          const file=form.querySelector("[data-department-image]")?.files[0];
          const options={signal,galleryFiles:[...form.querySelectorAll('[data-collection="gallery"] [data-item]')].map(item=>item.querySelector("[data-gallery-image]")?.files[0])};
          if(id)return saveDepartmentImage(id,{...payload,expected_version:Number(form.dataset.departmentVersion)},file,options);
          return createDepartmentWithImages(payload,file,{...options,onCreated:department=>{
            form.dataset.id=String(department.department_id);form.dataset.departmentVersion=String(department.version);
            records.set(String(department.department_id),department);
            form.querySelector('button[type="submit"]').textContent="Lưu thông tin và hình ảnh";
          }});
        }
        if(key==="doctors"&&id)return saveAdminDoctor(row,payload,raw.account_status,{signal,onSaved:doctor=>records.set(String(id),doctor)});
        if(key==="users"&&id)return saveUserAccount(id,payload,{signal,onSaved:user=>records.set(String(id),user)});
        return id?resources[key].update(id,payload,{signal}):resources[key].create(payload,{signal});
      }
      if(type==="confirm") {
        const row=records.get(String(id));
        if(form.dataset.action==="archive")return patients.archivePatient(id,{signal});
      }
      if(type==="review") {
        if(!["APPROVED","REJECTED"].includes(raw.decision)||!raw.note?.trim())throw new Error("Chọn quyết định và nhập ý kiến xét duyệt.");
        return leave.reviewLeaveRequest(id,{decision:raw.decision,note:raw.note.trim()},{signal});
      }
      if(type==="configuration") {
        const current=records.get(form.dataset.key);if(!current||current.read_only)throw new Error("Cấu hình này chỉ được xem.");
        return configurations.updateConfiguration(form.dataset.key,{config_value:String(raw.config_value || "").trim()},{signal});
      }
      if(type==="upload") {
        const file=form.elements.file.files[0];
        if(!file||!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>5*1024*1024)throw new Error("Chọn ảnh JPEG, PNG hoặc WebP trong giới hạn dung lượng.");
        if(!form.dataset.uploadedUrl)form.dataset.uploadedUrl=(await articles.uploadImage(file,{signal})).url;
        return articles.updateArticle(id,{thumbnail_url:form.dataset.uploadedUrl},{signal});
      }
      throw new Error("Thao tác chưa được hỗ trợ.");
    },async result=>{
      if(type==="configuration") {
        const row=result.configuration;records.set(row.config_key,row);form.elements.config_value.value=row.effective_value ?? row.config_value;return;
      }
      close();
      if(type==="review"){await reload();await leaveList();return;}
      await reload();
    });
  }
  body.addEventListener("submit",event=>{if(event.target.closest("[data-form]"))submitForm(event).catch(error=>ctx.handle(error));});
  modalBody.addEventListener("submit",event=>submitForm(event).catch(error=>ctx.handle(error)));
  body.addEventListener("change",event=>{if(event.target.type==="file"){const form=event.target.closest("[data-form]");if(form)delete form.dataset.uploadedUrl;}});
  const galleryPreviewUrls=new Set();
  let departmentPreviewUrl;
  const releasePreview=()=>{for(const url of galleryPreviewUrls)URL.revokeObjectURL(url);galleryPreviewUrls.clear();if(departmentPreviewUrl){URL.revokeObjectURL(departmentPreviewUrl);departmentPreviewUrl=null;}};
  modal.addEventListener("close",releasePreview);
  $("#patient-history-header")?.addEventListener("click",event=>patientHistory(event.currentTarget.dataset.id));
  modal.addEventListener("close",()=>{$("#department-dialog-back")?.remove();modalBody.classList.remove("admin-department-content-view");departmentEditor=null;});
  window.addEventListener("pagehide",releasePreview,{once:true});
  modalBody.addEventListener("change",event=>{
    const input=event.target;if(!input.matches("[data-gallery-image]"))return;
    const item=input.closest("[data-item]"),image=item.querySelector("img"),feedback=item.querySelector('[role="status"]'),file=input.files[0];
    if(!file)return;
    try {
      validateDepartmentImage(file);
      const old=image.getAttribute("src");if(galleryPreviewUrls.has(old)){URL.revokeObjectURL(old);galleryPreviewUrls.delete(old);}
      const url=URL.createObjectURL(file);galleryPreviewUrls.add(url);image.src=url;image.hidden=false;
      feedback.textContent=file.name;feedback.dataset.error="false";
    } catch(error){input.value="";feedback.textContent=error.message;feedback.dataset.error="true";}
  });
  modalBody.addEventListener("change",event=>{
    const input=event.target;if(!input.matches("[data-department-image]"))return;
    const area=input.closest(".admin-department-image-area"),image=area.querySelector("img"),feedback=area.querySelector('[role="status"]');
    const file=input.files[0];if(!file)return;
    try {
      validateDepartmentImage(file);if(departmentPreviewUrl)URL.revokeObjectURL(departmentPreviewUrl);departmentPreviewUrl=URL.createObjectURL(file);
      image.src=departmentPreviewUrl;image.hidden=false;feedback.textContent=`${file.name} · Ảnh sẽ được lưu khi bấm Lưu thay đổi.`;feedback.dataset.error="false";
    } catch(error){input.value="";releasePreview();const original=thumbnailUrl(input.closest("form").elements.cover_image_url.value);if(original){image.src=original;image.hidden=false;}else{image.removeAttribute("src");image.hidden=true;}feedback.textContent=error.message;feedback.dataset.error="true";}
  });
  modalBody.addEventListener("change",event=>{if(event.target.type==="file"){const form=event.target.closest("[data-form]");if(form)delete form.dataset.uploadedUrl;}});
  if(resources[key])await resourcePage();
  else if(key==="configuration")await configurationPage();
  const linkParams=new URLSearchParams(location.search);
  const detailId=linkParams.get("detail_id"),leaveId=linkParams.get("leave_request_id");
  if(key==="schedule"&&leaveId&&/^[1-9]\d*$/.test(leaveId))await leaveDetail(leaveId);
  else if(resources[key]&&detailId&&/^[1-9]\d*$/.test(detailId)) {
    if(!records.has(detailId)&&!resources[key].get){
      const rows=await allPages(resources[key].list,resources[key].params||{});
      const row=rows.find(item=>String(item[resources[key].id])===detailId);
      if(row)records.set(detailId,row);
    }
    await showDetail(detailId);
  }
  else if(key==="audit")await auditPage();
  // Editors and the bulk assignment screen keep their current contents.
  if(key!=="configuration"&&key!=="statistics")startAutoRefresh(async()=>{await reload();if(key==="schedule")await leaveList();},{
    canRefresh:()=>ctx.active&&!body.querySelector("[data-form], #bulk-assignment-form")&&
      Boolean(body.querySelector("#resource-filter, #payment-search")),
  });
  return ctx;
}
