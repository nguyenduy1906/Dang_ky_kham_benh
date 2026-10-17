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
import {initOverviewPeriod,overviewRange,overviewRows,overviewDayParams} from "./staff_overview.js";
import {$,esc,date,stamp,money,badge,label,table,facts,panel,options,button,metrics,chart,allPages,createAdminContext,today} from "./admin_ui.js";
import {resources,fieldMarkup,resourcePayload,collectionItemMarkup} from "./admin_resources.js";
import {bindLiveSearch} from "./live_search.js";
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
  return `<div class="admin-pagination"><span>${result.total} bản ghi · Trang ${result.page} / ${pages}</span><div><button type="button" class="secondary" data-action="previous" ${result.page<=1?"disabled":""}>Trước</button><button type="button" class="secondary" data-action="next" ${result.page>=pages?"disabled":""}>Sau</button></div></div>`;
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
  const fields=config.fields.filter(f=>!(edit&&f.createOnly || !edit&&f.editOnly));
  if(key==="users"&&!edit)refs.roles=refs.roles.filter(([role])=>["DOCTOR","NURSE","RECEPTIONIST"].includes(role));
  const normal=fields.filter(f=>!f.advanced).map(f=>fieldMarkup(f,values,refs,edit)).join("");
  const advanced=fields.filter(f=>f.advanced).map(f=>fieldMarkup(f,values,refs,edit)).join("");
  return `<form data-form="resource" data-id="${esc(row?.[config.id] ?? "")}" autocomplete="off"><div class="admin-contact-fields">${normal}</div>${advanced?`<details class="admin-advanced"><summary>Nội dung giới thiệu chuyên khoa</summary><div class="admin-contact-fields">${advanced}</div></details>`:""}${key==="patients"?notice("Cần ngày sinh hoặc CCCD để phân biệt hồ sơ. Số điện thoại liên kết của hồ sơ đã có được quản lý ở tài khoản."):""}${key==="schedule"&&Number(row?.booked_count)>0?notice("Ca đã có lượt khám: giữ nguyên phòng, ngày, giờ và thời lượng khung giờ."):""}${formActions(edit?"Lưu thay đổi":"Tạo mới")}</form>`;
}
function detailMarkup(key,row) {
  const config=resources[key];
  const extra={users:[["Email đã xác minh",row.email_verified?"Có":"Chưa"],["Đã xóa",row.is_deleted?"Có":"Không"],["Ngày tạo",stamp(row.created_at)]],patients:[["CCCD",row.id_card],["Giới tính",row.gender],["Địa chỉ",row.address],["BHYT",row.health_insurance],["Tài khoản liên kết",code("TK", row.user_id)]],doctors:[["Mã tài khoản",code("TK", row.user_id)],["Chuyên môn",row.specialization],["Giới thiệu",row.introduction]],departments:[["Mô tả",row.description],["Giới thiệu",row.overview],["Chức năng, nhiệm vụ",row.mission]],assignments:[["Ghi chú",row.note],["Ngày phân công",stamp(row.assigned_at)],["Người phân công",code("TK", row.assigned_by_id)],["Ngày thu hồi",stamp(row.revoked_at)],["Người thu hồi",code("TK", row.revoked_by_id)]],encounters:[["Phòng",row.room_name],["Triệu chứng",row.symptoms],["Phí khám đã chốt",money(row.consultation_fee_snapshot)],["Cọc đã chốt",money(row.deposit_amount_snapshot)],["Lý do hủy",row.cancel_reason]]}[key] || [];
  return facts(config.columns.map((name,index)=>[name,config.cells(row)[index].replace(/<[^>]*>/g,"").replace(/&(amp|lt|gt|quot|#39);/g,(_,name)=>({amp:"&",lt:"<",gt:">",quot:'"',"#39":"'"}[name]))]).concat(extra))
    +(key==="articles"?`<h3>Nội dung bài viết</h3><pre class="admin-text-content">${esc(row.content)}</pre>`:"")
    +'<div class="actions">'
    +(key==="patients"?button("patient-history",row.patient_id,"Lịch sử khám"):"")
    +(key==="departments"?button("leadership",row.department_id,"Lãnh đạo khoa")+button("department-image",row.department_id,"Tải ảnh khoa"):"")
    +(key==="doctors"?button("doctor-avatar",row.doctor_profile_id,"Thay ảnh đại diện"):"")
    +(key==="articles"?button("article-image",row.article_id,"Tải ảnh bài viết"):"")
    +(key==="users"&&["DOCTOR","NURSE","RECEPTIONIST"].includes(row.role_name)?button("staff-calendar",row.user_id,"Lịch nhân viên"):"")
    +(key==="encounters"?`<a class="button-link secondary" href="payments.html?encounter_id=${row.encounter_id}">Giao dịch của lượt khám</a><a class="button-link secondary" href="audit.html?encounter_id=${row.encounter_id}">Lịch sử và đối soát</a>`:"")+'</div>';
}
export async function initAdminWorkspace(key) {
  const ctx=createAdminContext();
  document.querySelector("#page-header").insertAdjacentHTML("afterend",'<p id="admin-status" class="scope-note" role="status" hidden></p>');
  const body=$("#page-body"), modal=$("#admin-dialog"), modalBody=$("#admin-dialog-body");
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
      $(resultId).innerHTML='<p role="status">Đang tìm kiếm…</p>';$(pagerId).innerHTML="";
    };
    const safelyApply=async()=>{try { await apply(); } catch(error) { ctx.handle(error); $(resultId).innerHTML=""; $(pagerId).innerHTML=""; }};
    inputs.forEach(input=>refreshers.push(bindLiveSearch(input,safelyApply,{invalidate})));
    const refresh=refreshers[0];
    form.addEventListener("submit",event=>{event.preventDefault();refresh();});
    form.addEventListener("change",event=>{if(!inputs.includes(event.target))refresh();});
    return true;
  }
  function close(){modal.close();}
  async function editResource(id) {
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
    const config=resources[key];
    if(config.add)$("#page-header").insertAdjacentHTML("beforeend",`<button id="add-record" type="button">＋ ${esc(config.add)}</button>`);
    $("#add-record")?.addEventListener("click",()=>editResource());
    body.innerHTML=panel("Danh sách",'<div id="admin-filters"></div><div id="admin-results"></div><div id="admin-pager"></div>')+(key==="schedule"?panel("Đơn xin nghỉ",'<form id="leave-filter" class="admin-toolbar"><label>Trạng thái<select name="status">'+options(["PENDING","APPROVED","REJECTED","CANCELLED"],"PENDING")+'</select></label><label>Mã nhân viên<input type="text" name="user_id"></label><button type="submit">Xem đơn</button></form><div id="leave-results"></div><div id="leave-pager"></div>'):"");
    reload=async()=>ctx.load(async signal=>{
      const params=codeParams(Object.fromEntries(new FormData($("#resource-filter"))));
      if(params.from_date&&params.to_date&&params.to_date<params.from_date)throw new Error("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.");
      const result=await config.list({...config.params,...params,page,page_size:12},{signal});
      if(config.local){
        let items=result.items;
        const q=String(params.q || "").trim().toLocaleLowerCase("vi");
        if(q)items=items.filter(row=>[row.name,row.room_name,row.description].filter(Boolean).join(" ").toLocaleLowerCase("vi").includes(q));
        return {items:items.slice((page-1)*12,page*12),total:items.length,page,page_size:12};
      }
      return result;
    },result=>{
      listResult=result;for(const row of result.items)records.set(String(row[config.id]),row);
      $("#admin-results").innerHTML=table([...config.columns,"Thao tác"],result.items.map(row=>[...config.cells(row),rowActions(key,row)]),config.title || "Danh sách quản trị");
      $("#admin-pager").innerHTML=paginationMarkup(result);
    });
    await ctx.load(signal=>references(config.filters.map(f=>f.reference).filter(Boolean),signal),result=>{
      refs=result;
      $("#admin-filters").innerHTML=`<form id="resource-filter" class="admin-toolbar">${config.filters.map(f=>fieldMarkup(f,{},refs,false,true)).join("")}<button type="submit">Lọc danh sách</button></form>`;
    });
    if(!ctx.active||!$("#resource-filter"))return;
    // Optional deep links carry only backend ids, never grant access.
    for(const field of ["schedule_id","patient_id"]){const value=new URLSearchParams(location.search).get(field);if(value&&/^\d+$/.test(value)&&$("#resource-filter").elements[field])$("#resource-filter").elements[field].value=value;}
    const apply=()=>{page=1;return reload();};
    if(!bindTextFilters($("#resource-filter"),apply,"#admin-results","#admin-pager"))$("#resource-filter").addEventListener("submit",event=>{event.preventDefault();apply();});
    await reload();
    if(key==="schedule") {
      bindTextFilters($("#leave-filter"),()=>{leavePage=1;return leaveList();},"#leave-results","#leave-pager");
      await leaveList();
    }
  }
  function rowActions(name,row) {
    const config=resources[name],id=row[config.id];
    return `<div class="admin-row-actions">${button("detail",id,"Chi tiết")}${config.update&&!row.is_deleted&&!row.is_archived?button("edit",id,"Sửa"):""}${name==="users"&&!row.is_deleted?button("account-status",id,row.account_status==="ACTIVE"?"Khóa":"Mở khóa")+button("delete-user",id,"Xóa tài khoản"):""}${name==="patients"&&!row.is_archived?button("archive",id,"Lưu trữ"):""}${name==="assignments"&&!row.revoked_at?button("revoke",id,"Thu hồi"):""}</div>`;
  }
  async function confirmation(action,id) {
    const row=records.get(String(id));if(!row)return;
    const config=resources[key];
    const titles={"account-status":row.account_status==="ACTIVE"?"Khóa tài khoản":"Mở khóa tài khoản","delete-user":"Xóa tài khoản","archive":"Lưu trữ hồ sơ bệnh nhân","revoke":"Thu hồi phân công"};
    await ctx.show(titles[action],async()=>facts([["Mã",code({users:"TK",patients:"BN",doctors:"BS",departments:"CK",rooms:"PH",schedule:"CA",assignments:"PC",articles:"BV",encounters:"LK"}[key], id)],["Tên",row.full_name || row.nurse_name]])+notice(action==="delete-user"?"Tài khoản sẽ ngừng sử dụng. Lịch sử liên quan vẫn được giữ.":action==="archive"?"Hồ sơ sẽ ngừng sử dụng; lịch sử khám vẫn được giữ.":"Xác nhận thao tác cho đúng bản ghi trước khi tiếp tục.")+`<form data-form="confirm" data-action="${action}" data-id="${esc(id)}">${formActions(titles[action])}</form>`);
  }
  async function showDetail(id) {
    const config=resources[key];
    await ctx.show("Chi tiết",async signal=>{
      const row=config.get?await config.get(id,{signal}):records.get(String(id));
      if(!row)throw new Error("Không tìm thấy bản ghi.");records.set(String(id),row);
      return detailMarkup(key,row);
    });
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
  async function overviewPage(statistics=false) {
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
        if(statistics)return summary+`<div class="admin-panel-heading"><h2>${date(range.from)} – ${date(range.to)}</h2><button data-action="export-report" type="button" class="secondary">↓ Xuất CSV</button></div>`+graphs
          +panel("Lượt khám theo ngày",table(["Ngày","Tổng lượt","Trực tuyến","Trực tiếp"],encounter.items.map(r=>[date(r.group_value),esc(r.total),esc(r.online_count),esc(r.walk_in_count)])))
          +panel("Dòng tiền theo ngày giao dịch",table(["Ngày","Số giao dịch","Tiền cọc","Phí khám","Hoàn tiền","Thu ròng"],payment.items.map(r=>[date(r.group_value),esc(r.transaction_count),money(r.deposit_received),money(r.exam_fee_received),money(r.refunded_amount),money(r.net_received)])))
          +panel("Đánh giá người bệnh",table(["Ngày","Số đánh giá","Điểm trung bình"],review.items.map(r=>[date(r.group_value),esc(r.review_count),esc(r.average_rating ?? "—")])))
          +chart("Phân bố điểm đánh giá",review.rating_distribution.map(r=>[`${r.rating} sao`,r.count]));
        const [recent,departments,rooms,doctorCount,patientCount]=await Promise.all([
          overviewRows(encounters.listEncounters,overviewDayParams(range),range,{signal}),
          catalog.listDepartments({include_inactive:true},{signal}),catalog.listRooms({include_inactive:true},{signal}),
          doctors.listDoctors({include_inactive:true,page_size:1},{signal}),patients.listPatients({include_archived:true,page_size:1},{signal}),
        ]);
        if(!ctx.active)throw new Error("Trang đã đóng.");
        return summary+panel("Truy cập nhanh",'<div class="admin-shortcuts"><a href="users.html"><strong>Tài khoản nhân viên ↗</strong><small>Quản lý thông tin và trạng thái tài khoản</small></a><a href="schedule.html"><strong>Lịch làm việc ↗</strong><small>Bố trí ca và xét duyệt đơn nghỉ</small></a><a href="articles.html"><strong>Nội dung website ↗</strong><small>Quản lý tin tức và bài viết</small></a></div>')+graphs
          +panel("Danh mục quản lý",facts([["Bác sĩ",doctorCount.total],["Chuyên khoa",departments.items.length],["Phòng khám",rooms.items.length],["Hồ sơ bệnh nhân",patientCount.total]]))
          +panel("Lượt khám gần đây trong khoảng đã chọn",table(resources.encounters.columns,recent.slice(0,4).map(r=>resources.encounters.cells(r))),'<a href="encounters.html">Xem danh sách →</a>');
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
    body.innerHTML=notice("Tra cứu giao dịch bằng mã lượt khám hoặc mã giao dịch. Danh sách giao dịch toàn viện hiện chưa được hỗ trợ.")
      +panel("Tra cứu giao dịch",`<form id="payment-search" class="admin-toolbar"><label>Mã lượt khám<input type="text" name="encounter_id" placeholder="LK_001" value="${linked&&/^\d+$/.test(linked)?esc(linked):""}"></label><label>Mã giao dịch<input type="text" name="payment_id" placeholder="TT_001"></label><button type="submit">Tra cứu</button></form><div id="payment-results"></div><div id="payment-pager"></div>`);
    reload=async()=>ctx.load(async signal=>{
      if(paymentSearch.payment_id){const result=await payments.getPayment(paymentSearch.payment_id,{signal});return {items:[result.payment],total:1,page:1,page_size:12};}
      if(paymentSearch.encounter_id)return payments.listEncounterPayments(paymentSearch.encounter_id,{page,page_size:12},{signal});
      return {items:[],total:0,page:1,page_size:12};
    },result=>{listResult=result;result.items.forEach(r=>records.set(`payment:${r.payment_id}`,r));$("#payment-results").innerHTML=paymentRows(result.items);$("#payment-pager").innerHTML=paginationMarkup(result);});
    bindTextFilters($("#payment-search"),()=>{
      const value=dataForm($("#payment-search"));page=1;paymentSearch=value;
      if(!value.encounter_id&&!value.payment_id){$("#payment-results").innerHTML=notice("Nhập mã để xem giao dịch.");return;}
      if(value.encounter_id&&value.payment_id){$("#payment-results").innerHTML=notice("Nhập một mã lượt khám hoặc một mã giao dịch.");return;}
      if(!/^[1-9]\d*$/.test(value.encounter_id || value.payment_id)){$("#payment-results").innerHTML=notice("Vui lòng nhập mã là số nguyên dương.");return;}
      return reload();
    },"#payment-results","#payment-pager");
    if(linked&&/^\d+$/.test(linked)){paymentSearch={encounter_id:linked};await reload();}
    else $("#payment-results").innerHTML=notice("Nhập mã để xem giao dịch.");
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
      $("#leave-pager").innerHTML=`<div class="admin-pagination"><span>${result.total} đơn · Trang ${result.page} / ${pages}</span><div><button type="button" class="secondary" data-action="leave-prev" ${leavePage<=1?"disabled":""}>Trước</button><button type="button" class="secondary" data-action="leave-next" ${leavePage>=pages?"disabled":""}>Sau</button></div></div>`;
    });
  }
  async function leaveDetail(id) {
    await ctx.show("Đơn xin nghỉ",async signal=>{
      const result=await leave.getAdminLeaveRequest(id,{signal}),row=result.leave_request;
      return facts([["Nhân viên",row.staff_name],["Vai trò",label(row.role_name)],["Từ ngày",date(row.from_date)],["Đến ngày",date(row.to_date)],["Buổi nghỉ",label(row.period)],["Lý do",row.reason],["Trạng thái",label(row.status)],["Ý kiến duyệt",row.review_note],["Các ca ảnh hưởng",result.affected_schedule_ids.map(id=>code("CA", id)).join(", ") || "Không có"],["Lượt khám ảnh hưởng",result.affected_encounters]])
        +(row.status==="PENDING"?notice("Duyệt nghỉ bác sĩ sẽ ngừng nhận lịch mới ở ca ảnh hưởng; duyệt nghỉ y tá sẽ thu hồi phân công trùng ca. Các lượt khám cần được điều phối riêng.")+`<form data-form="review" data-id="${esc(id)}"><label>Quyết định<select name="decision" required>${options(["APPROVED","REJECTED"],"","Chọn quyết định")}</select></label><label>Ý kiến xét duyệt *<textarea name="note" required maxlength="1000" rows="3"></textarea></label>${formActions("Xác nhận xét duyệt")}</form>`:"");
    });
  }
  async function staffCalendar(id,range=overviewRange("week",today())) {
    await ctx.show("Lịch làm việc nhân viên",async signal=>{
      const result=await leave.getStaffWorkSchedules(id,{from_date:range.from,to_date:range.to},{signal});
      return `<h3>${esc(result.full_name)}</h3><form data-form="calendar" data-id="${esc(id)}" class="admin-toolbar"><label>Từ ngày<input type="date" name="from_date" value="${esc(range.from)}" required></label><label>Đến ngày<input type="date" name="to_date" value="${esc(range.to)}" required></label><button type="submit">Xem lịch</button>${feedback}</form>`
        +table(["Ngày","Ca làm việc","Trạng thái"],result.items.map(day=>[date(day.work_date),day.shifts.map(s=>esc(`${label(s.period)} · ${s.start_time.slice(0,5)} – ${s.end_time.slice(0,5)}`)).join("<br>") || "Ngày nghỉ",day.shifts.map(s=>esc(s.status==="ON_LEAVE"?"Đã duyệt nghỉ":s.pending_leave?"Có đơn đang chờ duyệt":"Đi làm")).join("<br>") || "—"]));
    });
  }
  async function patientHistory(id) {
    await ctx.show("Lịch sử khám",async signal=>{
      const rows=await allPages((params,opt)=>patients.listEncounters(id,params,opt),{},signal);
      return table(["Mã lượt","Ngày","Bác sĩ","Phòng","Trạng thái"],rows.map(r=>[esc(code("LK", r.encounter_id)),date(r.work_date),esc(r.doctor_name),esc(r.room_name),badge(r.encounter_status)]));
    });
  }
  async function leadership(id) {
    await ctx.show("Lãnh đạo chuyên khoa",async signal=>{
      const [history,department]=await Promise.all([catalog.getDepartmentLeadership(id,{signal}),catalog.getDepartment(id,{signal})]);
      const all=await allPages(doctors.listDoctors,{department_id:id,include_inactive:true},signal);
      const current=history.items.filter(r=>!r.ended_at);
      const head=current.find(r=>r.position==="HEAD")?.doctor_profile_id || "";
      const deputy=current.filter(r=>r.position==="DEPUTY").map(r=>String(r.doctor_profile_id));
      const choices=all.map(r=>[r.doctor_profile_id,`${r.full_name}${r.is_active&&r.account_ok?"":" (ngừng hoạt động / chưa đủ điều kiện)"}`]);
      return `<h3>${esc(department.department.name)}</h3><form data-form="leadership" data-id="${esc(id)}" data-version="${esc(history.version)}"><label>Trưởng khoa<select name="head_doctor_id">${options(choices,head,"Chưa phân công")}</select></label><label>Phó khoa (có thể chọn nhiều)<select name="deputy_doctor_ids" multiple size="${Math.min(6,Math.max(2,choices.length))}">${choices.map(([value,name])=>`<option value="${value}" ${deputy.includes(String(value))?"selected":""}>${esc(name)}</option>`).join("")}</select></label>${notice("Để trống trưởng khoa hoặc bỏ chọn phó khoa để gỡ phân công. Trưởng và phó khoa phải là bác sĩ đủ điều kiện thuộc khoa này.")}${formActions("Lưu phân công lãnh đạo")}</form>`
        +panel("Lịch sử phân công",table(["Bác sĩ","Chức vụ","Bắt đầu","Kết thúc"],history.items.map(r=>[esc(r.full_name),r.position==="HEAD"?"Trưởng khoa":"Phó khoa",stamp(r.appointed_at),stamp(r.ended_at)])));
    });
  }
  async function uploadForm(kind,id) {
    await ctx.show(kind==="doctor-avatar"?"Ảnh đại diện bác sĩ":kind==="department-image"?"Ảnh chuyên khoa":"Ảnh bài viết",async()=>`<form data-form="upload" data-kind="${kind}" data-id="${esc(id)}"><label>Ảnh JPEG, PNG hoặc WebP<input type="file" name="file" accept="image/jpeg,image/png,image/webp" required></label>${notice(kind==="doctor-avatar"?"Tối đa 2 MB. Ảnh sẽ thay thế ảnh đại diện bác sĩ.":kind==="department-image"?"Tối đa 5 MB. Ảnh được dùng làm ảnh bìa chuyên khoa.":"Tối đa 5 MB. Ảnh được dùng làm ảnh đại diện bài viết.")}${formActions("Tải và lưu ảnh")}</form>`);
  }
  async function action(event) {
    const target=event.target.closest("[data-action]");if(!target||target.disabled||!ctx.active)return;
    const name=target.dataset.action,id=target.dataset.id;
    if(name==="collection-add") {target.closest("[data-collection]").querySelector("[data-collection-items]").insertAdjacentHTML("beforeend",collectionItemMarkup(target.dataset.name));return;}
    if(name==="collection-remove") {target.closest("[data-item]").remove();return;}
    if(name==="close-dialog"){close();return;}
    if(name==="previous"||name==="next"){page+=name==="next"?1:-1;await reload();return;}
    if(name==="leave-prev"||name==="leave-next"){leavePage+=name==="leave-next"?1:-1;await leaveList();return;}
    if(name==="detail")await showDetail(id);
    if(name==="edit")await editResource(id);
    if(["account-status","delete-user","archive","revoke"].includes(name))await confirmation(name,id);
    if(name==="export-report")exportReport();
    if(name==="payment-detail"||name==="refund")await paymentDetail(id,name==="refund");
    if(name==="audit-detail")await auditDetail(id);
    if(name==="leave-detail")await leaveDetail(id);
    if(name==="patient-history")await patientHistory(id);
    if(name==="staff-calendar")await staffCalendar(id);
    if(name==="leadership")await leadership(id);
    if(["doctor-avatar","department-image","article-image"].includes(name))await uploadForm(name,id);
  }
  body.addEventListener("click",event=>action(event).catch(error=>ctx.handle(error)));
  modalBody.addEventListener("click",event=>action(event).catch(error=>ctx.handle(error)));
  async function submitForm(event) {
    const form=event.target.closest("[data-form]");if(!form||!ctx.active)return;event.preventDefault();
    const type=form.dataset.form,id=form.dataset.id,raw=dataForm(form);
    if(type==="calendar") {
      const start=raw.from_date,end=raw.to_date;
      if(!start||!end||end<start||(Date.parse(end)-Date.parse(start))/86400000>30){ctx.handle(new Error("Chọn khoảng lịch hợp lệ, tối đa 31 ngày."),form.querySelector('[role="status"]'));return;}
      await staffCalendar(id,{from:start,to:end});return;
    }
    await ctx.submit(form,async signal=>{
      if(type==="resource") {
        const row=id?records.get(String(id)):null;
        const payload=resourcePayload(key,raw,row);
        return id?resources[key].update(id,payload,{signal}):resources[key].create(payload,{signal});
      }
      if(type==="confirm") {
        const row=records.get(String(id));
        if(form.dataset.action==="account-status")return auth.setAccountStatus(id,{account_status:row.account_status==="ACTIVE"?"LOCKED":"ACTIVE"},{signal});
        if(form.dataset.action==="delete-user")return auth.deleteUser(id,{signal});
        if(form.dataset.action==="archive")return patients.archivePatient(id,{signal});
        if(form.dataset.action==="revoke")return schedules.revokeNurseAssignment(id,{signal});
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
      if(type==="leadership") {
        const deputies=new FormData(form).getAll("deputy_doctor_ids").map(Number),head=raw.head_doctor_id?Number(raw.head_doctor_id):null;
        if(deputies.includes(head))throw new Error("Một bác sĩ không thể đồng thời là trưởng và phó khoa.");
        return catalog.replaceDepartmentLeadership(id,{head_doctor_id:head,deputy_doctor_ids:deputies,expected_version:Number(form.dataset.version)},{signal});
      }
      if(type==="upload") {
        const file=form.elements.file.files[0],kind=form.dataset.kind;
        if(!file||!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>(kind==="doctor-avatar"?2:5)*1024*1024)throw new Error("Chọn ảnh JPEG, PNG hoặc WebP trong giới hạn dung lượng.");
        if(kind==="doctor-avatar")return doctors.uploadDoctorAvatar(id,file,{signal});
        if(!form.dataset.uploadedUrl) {
          const result=kind==="department-image"?await catalog.uploadDepartmentImage(id,file,{signal}):await articles.uploadImage(file,{signal});
          form.dataset.uploadedUrl=result.url;
        }
        if(kind==="department-image") {
          const {department}=await catalog.getDepartment(id,{signal});
          return catalog.updateDepartment(id,{cover_image_url:form.dataset.uploadedUrl,expected_version:department.version},{signal});
        }
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
  modalBody.addEventListener("change",event=>{if(event.target.type==="file"){const form=event.target.closest("[data-form]");if(form)delete form.dataset.uploadedUrl;}});
  if(resources[key])await resourcePage();
  else if(key==="home"||key==="statistics")await overviewPage(key==="statistics");
  else if(key==="payments")await paymentsPage();
  else if(key==="configuration")await configurationPage();
  else if(key==="audit")await auditPage();
  return ctx;
}
