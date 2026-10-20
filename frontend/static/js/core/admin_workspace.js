import {validateDepartmentImage,saveDepartmentImage} from "./admin_department_image.js";
import {thumbnailUrl} from "./articles.js";
import { departmentDetails, departmentMemberGroups, addDepartmentMember, departmentDeputyLimit } from "./admin_department_view.js";
import { userAccountDetails, saveUserAccount } from "./admin_user_account.js";
import { code, codeParams } from "./business_codes.js";
import * as auth from "../api/auth.js";
import * as patients from "../api/patient.js";
import * as doctors from "../api/doctor.js";
import * as catalog from "../api/catalog.js";
import * as schedules from "../api/schedule.js";
import * as articles from "../api/article.js";
import * as payments from "../api/payment.js";
import * as reports from "../api/statistics.js";
import * as configurations from "../api/configuration.js";
import * as leave from "../api/staff_leave.js";
import * as encounters from "../api/encounter.js";
import {initOverviewPeriod} from "./staff_overview.js";
import {$,esc,date,stamp,money,badge,label,table,facts,panel,options,button,metrics,chart,allPages,createAdminContext,today} from "./admin_ui.js";
import {resources,fieldMarkup,resourcePayload,collectionItemMarkup} from "./admin_resources.js";
import {bindLiveSearch} from "./live_search.js";
import {searchAdminSchedules} from "./admin_schedule_search.js";
import {searchAdminEncounters} from "./admin_encounter_search.js";
import {encounterDetails} from "./admin_encounter_detail.js";
import {patientDetails} from "./admin_patient_detail.js";
import {patientEditForm,patientCreateForm} from "./admin_patient_form.js";
import {openBulkAssignment} from "./admin_bulk_assignment.js";
import {openScheduleBuilder} from "./admin_schedule_builder.js";
import {chronologicalPage} from "./clinical_list_order.js";
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
    if(name==="doctorUsers"||name==="nurses")result[name]=(await allPages(auth.listUsers,{role:name==="nurses"?"NURSE":"DOCTOR",account_status:"ACTIVE",approval_status:"APPROVED"},signal)).map(r=>[r.user_id,`${r.full_name} (${code("TK", r.user_id)})`]);
    if(name==="schedules")result[name]=(await allPages(schedules.listAdminSchedules,{from_date:today()},signal)).filter(r=>["OPEN","FULL"].includes(r.schedule_status)).map(r=>[r.schedule_id,`${code("CA", r.schedule_id)} · ${date(r.work_date)} · ${r.start_time.slice(0,5)} · ${r.room_name} · ${r.doctor_name}`]);
  }));
  return result;
}
function fieldsForm(key,row,refs) {
  const config=resources[key], edit=Boolean(row), values=row?{...row,role:row.role_name}:{};
  const fields=config.fields.filter(f=>!(edit&&f.createOnly || !edit&&f.editOnly || key==="departments"&&edit&&f.name==="cover_image_url"));
  if(key==="patients")return edit?patientEditForm(row,fields,refs,formActions("Lưu thay đổi")):patientCreateForm(fields,refs,formActions("Thêm bệnh nhân"));
  if(key==="users"&&!edit)refs.roles=refs.roles.filter(([role])=>["DOCTOR","NURSE","RECEPTIONIST"].includes(role));
  const normal=fields.filter(f=>!f.advanced).map(f=>{
    const markup=fieldMarkup({...f,clearable:edit&&["users","doctors","departments"].includes(key)},values,refs,edit);
    return key==="departments"&&edit&&f.name==="name"?`<div class="admin-department-name-row">${markup}<button type="button" data-action="choose-department-image">Tải ảnh chuyên khoa</button></div><div class="admin-department-image-area"><input type="file" data-department-image accept="image/jpeg,image/png,image/webp" hidden><input type="hidden" name="cover_image_url" value="${esc(row.cover_image_url||"")}"><img class="admin-department-image-preview" alt="Ảnh chuyên khoa" ${thumbnailUrl(row.cover_image_url)?`src="${esc(thumbnailUrl(row.cover_image_url))}"`:"hidden"}><p class="admin-department-image-feedback" role="status"></p></div>`:markup;
  }).join("");
  const advanced=fields.filter(f=>f.advanced).map(f=>fieldMarkup({...f,clearable:edit&&["users","doctors","departments"].includes(key)},values,refs,edit)).join("");
  return `${key==="users"&&edit?`<div class="admin-user-edit-meta">${facts([["Mã tài khoản",code("TK",row.user_id)],["Ngày tạo",stamp(row.created_at)],["Cập nhật lần cuối",stamp(row.updated_at)]])}</div>`:""}<form class="${key==='doctors'?'admin-doctor-form':''}" data-form="resource" data-department-version="${key==='departments'&&edit?esc(row.version):''}" data-id="${esc(row?.[config.id] ?? "")}" autocomplete="off"><div class="admin-contact-fields">${normal}</div>${key==="departments"&&edit?`<div class="admin-department-tools"><div class="actions">${button("leadership",row.department_id,"Thành viên khoa")}<button type="button" data-action="toggle-department-content" aria-expanded="false" aria-controls="department-content-fields">Nội dung giới thiệu chuyên khoa</button></div></div>`:""}${advanced?(key==="departments"&&edit?`<div id="department-content-fields" class="admin-advanced" hidden><div class="admin-contact-fields">${advanced}</div></div>`:`<details class="admin-advanced"><summary>Nội dung giới thiệu chuyên khoa</summary><div class="admin-contact-fields">${advanced}</div></details>`):""}${key==="patients"?notice("Cần ngày sinh hoặc CCCD để phân biệt hồ sơ. Số điện thoại liên kết của hồ sơ đã có được quản lý ở tài khoản."):""}${key==="schedule"&&Number(row?.booked_count)>0?notice("Ca đã có lượt khám: giữ nguyên phòng, ngày, giờ và thời lượng khung giờ."):""}${formActions(edit?"Lưu thay đổi":"Tạo mới")}</form>`;
}
function detailMarkup(key,row) {
  if(key==="departments")return departmentDetails(row);
  if(key==="encounters")return encounterDetails(row);
  if(key==="patients")return patientDetails(row);
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
      $(resultId).innerHTML='<p class="admin-search-status" role="status">Đang tìm kiếm…</p>';$(pagerId).innerHTML="";
    };
    const safelyApply=async()=>{try { await apply(); } catch(error) { ctx.handle(error); $(resultId).innerHTML=""; $(pagerId).innerHTML=""; }};
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
      const row=id?(config.get?await config.get(id,{signal}):records.get(String(id))):null;
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
      else if(key==="schedule"){ctx.cancelLoad();openScheduleBuilder({body,trigger:event.currentTarget,suggestions:[...records.values()]});}
      else editResource();
    });
    body.innerHTML=panel("Danh sách",'<div id="admin-filters"></div><div id="admin-results"></div><div id="admin-pager"></div>')+(key==="schedule"?panel("Đơn xin nghỉ",'<form id="leave-filter" class="admin-toolbar"><label>Trạng thái<select name="status">'+options(["PENDING","APPROVED","REJECTED","CANCELLED"],"PENDING")+'</select></label><label>Mã nhân viên<input type="text" name="user_id"></label><button type="submit">Xem đơn</button></form><div id="leave-results"></div><div id="leave-pager"></div>'):"");
    reload=async()=>ctx.load(async signal=>{
      const params=codeParams(Object.fromEntries(new FormData($("#resource-filter"))));
      if(params.from_date&&params.to_date&&params.to_date<params.from_date)throw new Error("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.");
      if(key==="schedule")return searchAdminSchedules(params,page,pageSize,signal);
      if(key==="encounters")return searchAdminEncounters(params,page,pageSize,signal);
      if(key==="assignments")return chronologicalPage(await allPages(config.list,{...config.params,...params},signal),page,pageSize);
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
      const columns=key==="schedule"?[...config.columns.slice(0,-1),"Thao tác","Xem chi tiết"]:[...config.columns,"Thao tác"];
      const cells=row=>key==="schedule"?[...config.cells(row).slice(0,-1),rowActions(key,row),button("schedule-view",row.schedule_id,"Xem chi tiết")]:[...config.cells(row),rowActions(key,row)];
      $("#admin-results").innerHTML=table(columns,result.items.map(cells),config.title || "Danh sách quản trị");
      $("#admin-pager").innerHTML=paginationMarkup(result);
    });
    await ctx.load(signal=>references(config.filters.map(f=>f.reference).filter(Boolean),signal),result=>{
      refs=result;
      $("#admin-filters").innerHTML=`<form id="resource-filter" class="admin-toolbar">${config.filters.map(f=>fieldMarkup(f,{},refs,false,true)).join("")}<button type="submit">Lọc danh sách</button></form>`;
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
      const row=config.get?await config.get(id,{signal}):records.get(String(id));
      if(!row)throw new Error("Không tìm thấy bản ghi.");records.set(String(id),row);
      return detailMarkup(key,row);
    });
    const historyButton=$("#patient-history-header");
    if(key==="patients"&&historyButton&&modalBody.querySelector(".admin-patient-detail")?.dataset.patientId===String(id)) {
      historyButton.dataset.id=String(id);historyButton.hidden=false;
    }
  }

  async function fullReport(reader,params,signal) {
    const first=await reader({...params,page:1,page_size:100},{signal}),items=[...first.items];
    for(let next=2;(next-1)*first.page_size<first.total;next++)items.push(...(await reader({...params,page:next,page_size:first.page_size},{signal})).items);
    return {...first,items};
  }
  const reportMetrics = (encounter,payment,review) => metrics([
    ["Tổng lượt khám",encounter.summary.total,"Theo ngày ca khám"],
    ["Đã hoàn thành",encounter.by_status.find(r=>r.encounter_status==="COMPLETED")?.count ?? 0,"Lượt khám hoàn tất"],
    ["Thu ròng",money(payment.summary.net_received),"Thu thành công trừ số hoàn thực tế"],
    ["Đánh giá",review.summary.average_rating==null?"Chưa có":`${review.summary.average_rating} / 5`,`${review.summary.review_count} đánh giá`],
  ]);
  let reportData;
  async function statisticsPage() {
    if(!$("#overview-period-control"))$("#page-header").insertAdjacentHTML("beforeend",'<div id="overview-period-control" class="overview-period-control"></div>');
    $("#page-header").classList.add("overview-period-header");
    await initOverviewPeriod(async(range,{signal})=>{
      try {
        const params={from_date:range.from,to_date:range.to};
        const [encounter,payment,review]=await Promise.all([
          fullReport(reports.getEncounterStatistics,params,signal),
          fullReport(reports.getPaymentStatistics,params,signal),
          fullReport(reports.getReviewStatistics,params,signal),
        ]);
        if(!ctx.active)throw new Error("Trang đã đóng.");
        reportData={encounter,payment,review,range};
        const summary=reportMetrics(encounter,payment,review);
        const graphs=`<div class="admin-grid">${chart("Theo trạng thái",encounter.by_status.map(r=>[label(r.encounter_status),r.count]))}${chart("Theo hình thức tiếp nhận",[["Trực tuyến",encounter.summary.online_count],["Trực tiếp",encounter.summary.walk_in_count]])}</div>`;
        return summary+`<div class="admin-panel-heading"><h2>${date(range.from)} – ${date(range.to)}</h2><button data-action="export-report" type="button" class="secondary">↓ Xuất CSV</button></div>`+graphs
          +panel("Lượt khám theo ngày",table(["Ngày","Tổng lượt","Trực tuyến","Trực tiếp"],encounter.items.map(r=>[date(r.group_value),esc(r.total),esc(r.online_count),esc(r.walk_in_count)])))
          +panel("Dòng tiền theo ngày giao dịch",table(["Ngày","Số giao dịch","Tiền cọc","Phí khám","Hoàn tiền","Thu ròng"],payment.items.map(r=>[date(r.group_value),esc(r.transaction_count),money(r.deposit_received),money(r.exam_fee_received),money(r.refunded_amount),money(r.net_received)])))
          +panel("Đánh giá người bệnh",table(["Ngày","Số đánh giá","Điểm trung bình"],review.items.map(r=>[date(r.group_value),esc(r.review_count),esc(r.average_rating ?? "—")])))
          +chart("Phân bố điểm đánh giá",review.rating_distribution.map(r=>[`${r.rating} sao`,r.count]));
      }catch(error){if(error.status===401||error.status===403)ctx.handle(error);throw error;}
    });
  }
  function exportReport() {
    if(!reportData)return;
    const {encounter,payment,review,range}=reportData;
    const rows=[["Báo cáo NEU Medical",range.from,range.to],["LƯỢT KHÁM"],["Ngày","Tổng lượt","Trực tuyến","Trực tiếp"],...encounter.items.map(r=>[r.group_value,r.total,r.online_count,r.walk_in_count]),["DÒNG TIỀN"],["Ngày","Số giao dịch","Tiền cọc","Phí khám","Hoàn tiền","Thu ròng"],...payment.items.map(r=>[r.group_value,r.transaction_count,r.deposit_received,r.exam_fee_received,r.refunded_amount,r.net_received]),["ĐÁNH GIÁ"],["Ngày","Số đánh giá","Điểm trung bình"],...review.items.map(r=>[r.group_value,r.review_count,r.average_rating ?? ""])];
    const csv="\uFEFF"+rows.map(row=>row.map(value=>`"${String(value).replace(/"/g,'""')}"`).join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const anchor=document.createElement("a");anchor.href=url;anchor.download=`neu-bao-cao-${range.from}-${range.to}.csv`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),0);
  }
  let paymentSearch={};
  function paymentRows(rows) {
    return table(["Mã giao dịch","Lượt khám","Loại","Số tiền","Phương thức","Thời điểm","Trạng thái","Thao tác"],rows.map(r=>[esc(code("TT", r.payment_id)),esc(code("LK", r.encounter_id)),badge(r.payment_type),money(r.amount),esc(r.payment_method),stamp(r.paid_at || r.created_at),badge(r.transaction_status),button("payment-detail",r.payment_id,"Chi tiết")+(r.transaction_status==="SUCCESS"&&r.payment_type!=="REFUND"?button("refund",r.payment_id,"Hoàn tiền"):"")]));
  }
  async function paymentsPage() {
    const query=new URLSearchParams(location.search),linked=query.get("encounter_id");
    body.innerHTML=panel("Lịch sử thanh toán",`<form id="payment-search" class="admin-toolbar"><label>Mã lượt khám<input type="text" name="encounter_id" placeholder="LK_001" value="${linked&&/^\d+$/.test(linked)?esc(linked):""}"></label><label>Mã giao dịch<input type="text" name="payment_id" placeholder="TT_001"></label><button type="submit">Tra cứu</button></form><div id="payment-results"></div><div id="payment-pager"></div>`);
    reload=async()=>ctx.load(async signal=>{
      if(paymentSearch.payment_id){const result=await payments.getPayment(paymentSearch.payment_id,{signal});return {items:[result.payment],total:1,page:1,page_size:20};}
      if(paymentSearch.encounter_id)return payments.listEncounterPayments(paymentSearch.encounter_id,{page,page_size:20},{signal});
      return payments.listAdminPayments({page,page_size:20},{signal});
    },result=>{listResult=result;result.items.forEach(r=>records.set(`payment:${r.payment_id}`,r));$("#payment-results").innerHTML=paymentRows(result.items);$("#payment-pager").innerHTML=paginationMarkup(result);});
    bindTextFilters($("#payment-search"),()=>{
      const value=dataForm($("#payment-search"));page=1;paymentSearch=value;
      if(!value.encounter_id&&!value.payment_id)return reload();
      if(value.encounter_id&&value.payment_id){$("#payment-results").innerHTML=notice("Nhập một mã lượt khám hoặc một mã giao dịch.");return;}
      if(!/^[1-9]\d*$/.test(value.encounter_id || value.payment_id)){$("#payment-results").innerHTML=notice("Vui lòng nhập mã là số nguyên dương.");return;}
      return reload();
    },"#payment-results","#payment-pager");
    if(linked&&/^\d+$/.test(linked))paymentSearch={encounter_id:linked};
    await reload();
  }
  async function paymentDetail(id,refund=false) {
    await ctx.show(refund?"Xác nhận hoàn tiền":"Chi tiết giao dịch",async signal=>{
      const row=(await payments.getPayment(id,{signal})).payment;
      records.set(`payment:${id}`,row);
      return facts([["Mã thanh toán",code("TT", row.payment_id)],["Mã giao dịch",row.transaction_code],["Mã lượt khám",code("LK", row.encounter_id)],["Loại",label(row.payment_type)],["Số tiền",money(row.amount)],["Trạng thái",label(row.transaction_status)],["Phương thức",row.payment_method],["Ngày thanh toán",stamp(row.paid_at)],["Giao dịch gốc",code("TT", row.original_payment_id)],["Lý do",row.reason],["Lý do thất bại",row.failure_reason]])
        +(refund?row.transaction_status!=="SUCCESS"||row.payment_type==="REFUND"?notice("Giao dịch này không còn phù hợp để hoàn tiền."):`${notice("Số tiền được hoàn theo chính sách hủy và số đã hoàn. Hệ thống sẽ kiểm tra điều kiện khi xác nhận.")}<form data-form="refund" data-id="${esc(id)}"><label>Lý do hoàn tiền *<textarea name="reason" required maxlength="1000" rows="3"></textarea></label>${formActions("Xác nhận hoàn tiền")}</form>`:"");
    });
  }
  const configTitles={HOSPITAL_NAME:"Tên cơ sở",SUPPORT_PHONE:"Điện thoại hỗ trợ",SUPPORT_EMAIL:"Email hỗ trợ",EXAM_HOURS:"Giờ khám",REMINDER_BEFORE_HOURS:"Nhắc lịch trước (giờ)",ALLOW_WALK_IN:"Tiếp nhận trực tiếp",APPOINTMENT_HOLD_MINUTES:"Thời gian giữ chỗ (phút)",DEFAULT_DEPOSIT_PERCENT:"Tỷ lệ đặt cọc (%)",CHECKIN_EARLY_MINUTES:"Check-in sớm (phút)",CHECKIN_LATE_MINUTES:"Check-in muộn (phút)",CANCEL_HOURS_LIMIT:"Mốc hủy lịch (giờ)",CANCEL_REFUND_PERCENT:"Tỷ lệ hoàn cọc (%)",NO_SHOW_GRACE_MINUTES:"Chờ sau ca (phút)",NO_SHOW_FORFEIT_DEPOSIT:"Không đến mất cọc",MAX_REVIEW_RATING:"Điểm đánh giá tối đa"};
  async function configurationPage() {
    reload=async()=>ctx.load(signal=>allPages(configurations.listConfigurations,{},signal),rows=>{
      rows.forEach(r=>records.set(r.config_key,r));
      body.innerHTML=panel("Cấu hình hệ thống",`<div class="admin-config-list">${rows.map(row=>{
        const value=row.effective_value ?? row.config_value;
        if(row.read_only)return `<div class="admin-setting"><span>${esc(configTitles[row.config_key] || row.config_key)}<small>Quy tắc cố định</small></span><strong>${esc(value)}</strong></div>`;
        const field=row.config_key==="ALLOW_WALK_IN"?`<select name="config_value">${options([["true","Bật"],["false","Tắt"]],value,"Chọn…")}</select>`:`<input name="config_value" type="${row.config_key==="SUPPORT_EMAIL"?"email":row.config_key==="REMINDER_BEFORE_HOURS"?"number":"text"}" ${row.config_key==="REMINDER_BEFORE_HOURS"?'min="1" max="168" step="1"':""} maxlength="255" value="${esc(value)}" required>`;
        return `<form data-form="configuration" data-key="${esc(row.config_key)}"><label>${esc(configTitles[row.config_key] || row.config_key)}${field}</label><button type="submit">Lưu</button>${feedback}</form>`;
      }).join("") || notice("Chưa có khóa cấu hình.")}</div>`);
    });
    await reload();
  }
  const issues={SCHEDULE_QUOTA_MISMATCH:"Sức chứa ca không khớp số lượt",COMPLETED_WITHOUT_VALID_RECORD:"Hoàn tất nhưng thiếu bệnh án hợp lệ",PRICE_SNAPSHOT_MISSING:"Thiếu giá khám đã chốt",CHARGED_ABOVE_SNAPSHOT:"Thu vượt giá khám đã chốt",REFUND_EXCEEDS_RECEIPTS:"Hoàn vượt số tiền đã thu",ONLINE_DEPOSIT_NOT_FULLY_PAID:"Cọc trực tuyến chưa đủ"};
  async function auditPage() {
    const linked=new URLSearchParams(location.search).get("encounter_id");
    body.innerHTML=notice("Nhật ký hiện hỗ trợ lượt khám. Lịch sử thay đổi tài khoản, danh mục, bài viết và cấu hình chưa được hỗ trợ.")
      +panel("Đối soát lượt khám",`<form id="audit-filter" class="admin-toolbar"><label>Mã lượt khám<input name="encounter_id" type="text" placeholder="LK_001" value="${linked&&/^\d+$/.test(linked)?esc(linked):""}"></label><label>Từ ngày<input name="from_date" type="date"></label><label>Đến ngày<input name="to_date" type="date"></label><button type="submit">Tra cứu</button></form><div id="audit-results"></div><div id="audit-pager"></div>`);
    reload=async()=>ctx.load(async signal=>{
      const params=dataForm($("#audit-filter"));
      if(params.from_date&&params.to_date&&params.to_date<params.from_date)throw new Error("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.");
      return reports.getEncounterAudit({...params,page,page_size:12},{signal});
    },result=>{listResult=result;$("#audit-results").innerHTML=table(["Mã lượt","Trạng thái","Giá chốt","Đã thu","Đã hoàn","Thu ròng","Đối soát","Lịch sử"],result.items.map(r=>[esc(code("LK", r.encounter_id)),badge(r.encounter_status),money(r.consultation_fee_snapshot),money(r.gross_received),money(r.refunded_amount),money(r.net_received),r.issues.map(i=>esc(issues[i] || i)).join("<br>") || "Không phát hiện lệch",button("audit-detail",r.encounter_id,"Xem lịch sử")]));$("#audit-pager").innerHTML=paginationMarkup(result);});
    bindTextFilters($("#audit-filter"),()=>{page=1;return reload();},"#audit-results","#audit-pager");await reload();
  }
  async function auditDetail(id) {
    await ctx.show("Lịch sử lượt khám",async signal=>{
      const result=await reports.getEncounterAudit({encounter_id:id,page_size:1},{signal}),row=result.items[0];
      if(!row)throw new Error("Không tìm thấy lượt khám.");
      const section=(title,rows,columns,mapper)=>panel(title,table(columns,(rows || []).map(mapper)));
      return facts([["Mã lượt khám",code("LK", id)],["Bệnh án",code("BA", row.record_id)],["Phiên bản bệnh án",row.record_version]])+notice(`Hiển thị tối đa ${row.history_limit || 100} bản ghi gần nhất của mỗi loại.`)
        +section("Thay đổi trạng thái",row.status_history,["Thời điểm","Từ","Đến","Người thay đổi","Ghi chú"],r=>[stamp(r.changed_at),esc(label(r.old_status)),esc(label(r.new_status)),esc(code("TK", r.changed_by_id)),esc(r.note || "—")])
        +section("Điều phối bác sĩ",row.transfer_history,["Thời điểm","Bác sĩ cũ","Bác sĩ mới","Người thực hiện","Lý do"],r=>[stamp(r.transferred_at || r.created_at),esc(code("BS", r.old_doctor_id)),esc(code("BS", r.new_doctor_id)),esc(code("TK", r.transferred_by_id || r.changed_by_id)),esc(r.reason || "—")])
        +section("Thanh toán",row.payment_history,["Mã","Loại","Số tiền","Trạng thái"],r=>[esc(code("TT", r.payment_id)),esc(label(r.payment_type)),money(r.amount),badge(r.transaction_status)])
        +section("Bổ sung bệnh án",row.medical_revision_history,["Thời điểm","Người sửa","Lý do","Chi tiết"],r=>[stamp(r.changed_at || r.at),esc(code("TK", r.changed_by_id || r.actor_id)),esc(r.reason),`<details><summary>Nội dung trước / sau</summary><pre class="admin-text-content">${esc(JSON.stringify(r,null,2))}</pre></details>`]);
    });
  }

  let leavePage=1;
  async function leaveList() {
    if(!ctx.active||!$("#leave-filter"))return;
    await ctx.load(signal=>leave.listAdminLeaveRequests({...dataForm($("#leave-filter")),page:leavePage,page_size:10},{signal}),result=>{
      $("#leave-results").innerHTML=table(["Mã đơn","Nhân viên","Vai trò","Từ ngày","Đến ngày","Buổi nghỉ","Trạng thái","Thao tác"],result.items.map(r=>[esc(code("NP", r.request_id)),esc(r.staff_name),badge(r.role_name),date(r.from_date),date(r.to_date),esc(label(r.period)),badge(r.status),button("leave-detail",r.request_id,r.status==="PENDING"?"Xem / xét duyệt":"Chi tiết")]));
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
  async function patientHistory(id) {
    await ctx.show("Lịch sử khám",async signal=>{
      const rows=await allPages((params,opt)=>patients.listEncounters(id,params,opt),{},signal);
      return table(["Mã lượt","Ngày","Bác sĩ","Phòng","Trạng thái"],rows.map(r=>[esc(code("LK", r.encounter_id)),date(r.work_date),esc(r.doctor_name),esc(r.room_name),badge(r.encounter_status)]));
    });
  }
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
      const [history,members]=await Promise.all([catalog.getDepartmentLeadership(id,{signal}),catalog.getDepartmentMembers(id,{signal})]);
      const department={department:members.department};
      const candidates=(await allPages(doctors.listDoctors,{include_inactive:true},signal)).filter(r=>r.is_active&&r.account_ok);
      memberCandidates=candidates;
      memberVersion=members.version;
      memberDraft=members.items;
      return `<h3>${esc(department.department.name)}</h3><section class="admin-department-section"><div class="admin-member-section-heading"><h3>Thành viên khoa</h3></div><div id="department-members">${departmentMemberGroups(memberDraft,id)}</div><form class="admin-member-add-form"><div class="admin-contact-fields"><label>Thêm bác sĩ<input type="text" name="member_doctor" list="department-doctor-suggestions" placeholder="Nhập tên hoặc mã bác sĩ để tìm" autocomplete="off" required><datalist id="department-doctor-suggestions">${candidates.filter(r=>!memberDraft.some(v=>v.doctor_profile_id===r.doctor_profile_id)).map(r=>`<option value="${esc(`${r.full_name} (${code("BS",r.doctor_profile_id)})`)}">${esc(r.department_name||"Chưa có khoa")}</option>`).join("")}</datalist></label><label>Chức vụ<select name="position"><option value="HEAD" ${memberDraft.some(r=>r.position==="HEAD")?"disabled":""}>Trưởng khoa${memberDraft.some(r=>r.position==="HEAD")?" (đã có)":""}</option><option value="DEPUTY" ${memberDraft.filter(r=>r.position==="DEPUTY").length>=departmentDeputyLimit(memberDraft.length+1)?"disabled":""}>Phó khoa</option><option value="DOCTOR" selected>Bác sĩ</option></select></label></div><div class="actions"><button type="submit">Thêm thành viên</button></div><p class="form-feedback" role="status"></p></form></section>`
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
        updateDepartmentEditorVersion(result);await leadership(memberDepartmentId);await reload();
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
    if(name==="collection-add") {target.closest("[data-collection]").querySelector("[data-collection-items]").insertAdjacentHTML("beforeend",collectionItemMarkup(target.dataset.name,{},Boolean(target.closest("form")?.dataset.id)));return;}
    if(name==="collection-remove") {target.closest("[data-item]").remove();return;}
    if(name==="close-dialog"){close();return;}
    if(name==="previous"||name==="next"){page+=name==="next"?1:-1;await reload();return;}
    if(name==="leave-prev"||name==="leave-next"){leavePage+=name==="leave-next"?1:-1;await leaveList();return;}
    if(name==="detail")await showDetail(id);
    if(name==="edit")await editResource(id);
    if(name==="archive")await confirmation(name,id);
    if(name==="export-report")exportReport();
    if(name==="payment-detail"||name==="refund")await paymentDetail(id,name==="refund");
    if(name==="audit-detail")await auditDetail(id);
    if(name==="leave-detail")await leaveDetail(id);
    if(name==="patient-history")await patientHistory(id);
    if(name==="leadership")await leadership(id);
    if(name==="article-image")await uploadForm(id);
  }
  body.addEventListener("click",event=>action(event).catch(error=>ctx.handle(error)));
  modalBody.addEventListener("click",event=>action(event).catch(error=>ctx.handle(error)));
  function updateDepartmentEditorVersion(result) {
    const form=departmentEditor?.nodes.find(node=>node.nodeType===1&&node.matches?.('form[data-form="resource"]'));
    if(form&&Number(form.dataset.departmentVersion)===memberVersion)form.dataset.departmentVersion=String(result.version);
    records.set(String(memberDepartmentId),result.department);
  }
  modalBody.addEventListener("submit",event=>{
    const form=event.target.closest(".admin-member-add-form");if(!form)return;
    event.preventDefault();
    ctx.submit(form,async signal=>{
      const chosen=form.elements.member_doctor.value.trim();
      const doctor=memberCandidates.find(r=>`${r.full_name} (${code("BS",r.doctor_profile_id)})`===chosen);
      addDepartmentMember(memberDraft,doctor,form.elements.position.value);
      return catalog.addDepartmentMember(memberDepartmentId,{doctor_profile_id:doctor.doctor_profile_id,position:form.elements.position.value,expected_version:memberVersion,expected_source_department_id:doctor.department_id},{signal});
    },async result=>{updateDepartmentEditorVersion(result);await leadership(memberDepartmentId);await reload();});
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
        const payload=resourcePayload(key,raw,row);
        if(key==="departments"&&id)return saveDepartmentImage(id,{...payload,expected_version:Number(form.dataset.departmentVersion)},form.querySelector("[data-department-image]")?.files[0],{signal,galleryFiles:[...form.querySelectorAll('[data-collection="gallery"] [data-item]')].map(item=>item.querySelector("[data-gallery-image]")?.files[0])});
        if(key==="users"&&id)return saveUserAccount(id,payload,{signal,onSaved:user=>records.set(String(id),user)});
        return id?resources[key].update(id,payload,{signal}):resources[key].create(payload,{signal});
      }
      if(type==="confirm") {
        const row=records.get(String(id));
        if(form.dataset.action==="archive")return patients.archivePatient(id,{signal});
      }
      if(type==="refund") {
        if(!raw.reason?.trim())throw new Error("Vui lòng nhập lý do hoàn tiền.");
        return payments.refund(id,{reason:raw.reason.trim()},{signal});
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
      if(type==="review"){await leaveList();return;}
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
  else if(key==="statistics")await statisticsPage();
  else if(key==="payments")await paymentsPage();
  else if(key==="configuration")await configurationPage();
  else if(key==="audit")await auditPage();
  // Editors and the bulk assignment screen keep their current contents.
  if(key!=="configuration"&&key!=="statistics")startAutoRefresh(async()=>{await reload();if(key==="schedule")await leaveList();},{
    canRefresh:()=>ctx.active&&!body.querySelector("[data-form], #bulk-assignment-form")&&
      Boolean(body.querySelector("#resource-filter, #payment-search, #audit-filter")),
  });
  return ctx;
}
