import {replaceAdminRegion} from "./admin_render.js";
import {readAdminNotifications,openNotification,readAllNotifications} from "./admin_notification_data.js";
import {startAutoRefresh} from "./auto_refresh.js";
import {readAdminReviews, readAdminReview, setReviewVisibility} from "./admin_review_data.js";
import {notificationTypes as baseTypes} from "../data/admin_notification_templates.js";
import { esc, table, facts, stamp, options } from "./admin_ui.js";
import { code } from "./business_codes.js";

const types={...baseTypes};
const normalize=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLocaleLowerCase("vi");
const day=value=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value)); // Preview timestamps are explicitly in UTC+07:00.

const readBadge=row=>`<span class="badge ${row.is_read?"blue":"amber"}">${row.is_read?"Đã đọc":"Chưa đọc"}</span>`;
export const ratingStars=rating=>`<span class="feedback-rating" aria-label="${Number(rating)} trên 5 sao"><span aria-hidden="true">${"★".repeat(rating)}<span class="feedback-star-empty">${"★".repeat(5-rating)}</span></span><strong>${Number(rating)}/5</strong></span>`;

export function feedbackPage(rows,filters={},page=1,size=10) {
  if(filters.from_date&&filters.to_date&&filters.to_date<filters.from_date)throw new Error("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.");
  const q=normalize(filters.q?.trim());
  const items=rows.filter(row=>(!q||normalize([row.id,code(row.rating?"DG":"TB",row.id),row.doctor,row.department,row.comment,row.title,row.content,row.reference].join(" ")).includes(q))
    &&(!filters.doctor||row.doctor===filters.doctor)
    &&(!filters.rating||(filters.rating==="low"?row.rating<=2:String(row.rating)===filters.rating))
    &&(!filters.type||row.type===filters.type)
    &&(!filters.read||(filters.read==="read"?row.is_read:!row.is_read))
    &&(!filters.from_date||day(row.created_at)>=filters.from_date)&&(!filters.to_date||day(row.created_at)<=filters.to_date))
    .sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id-a.id);
  const total=items.length, pages=Math.max(1,Math.ceil(total/size)), current=Math.min(pages,Math.max(1,page));
  return {items:items.slice((current-1)*size,current*size),total,page:current,pages};
}

export function reviewDetail(row) {
  return `<div class="feedback-detail"><div class="feedback-detail-hero">${ratingStars(row.rating)}<p>Phản hồi sau khám</p></div><section><h3>Thông tin đánh giá</h3>${facts([["Mã đánh giá",code("DG",row.id)],["Bác sĩ",row.doctor],["Chuyên khoa",row.department],["Thời điểm",stamp(row.created_at)]])}</section><section><h3>Nội dung phản hồi</h3><blockquote>${esc(row.comment||"Người đánh giá chỉ chấm sao, không để lại nhận xét.")}</blockquote></section><p class="feedback-detail-note">Đánh giá gắn với lượt khám đã hoàn thành, có bệnh án; điểm đánh giá từ 1–5 sao. Trang quản trị không chỉnh sửa nội dung người bệnh đã gửi.</p></div>`;
}

export function notificationDetail(row) {
  return `<div class="feedback-detail notification-detail"><div class="notification-detail-meta">${readBadge(row)}<span>${esc(types[row.type]||row.type)}</span><time>${esc(stamp(row.created_at))}</time></div><h3 class="notification-detail-title">${esc(row.title)}</h3><p class="feedback-notification-content">${esc(row.content)}</p>${facts([["Mã thông báo",code("TB",row.id)],["Đối tượng liên quan",row.reference||"Thông báo chung"]])}<div class="actions notification-detail-actions">${row.target?`<a class="button-link" href="${esc(row.target)}">Xem nội dung liên quan</a>`:""}</div></div>`;
}


function filtersMarkup(reviews) {
  return `<form id="feedback-filters" class="admin-toolbar" role="search" aria-label="${reviews?"Lọc đánh giá":"Lọc thông báo"}"><label>Tìm kiếm<input type="search" name="q" placeholder="${reviews?"Mã đánh giá, bác sĩ, nội dung…":"Mã thông báo, tiêu đề, nội dung…"}"></label>${reviews?`<label>Số sao<select name="rating">${options([["5","5 sao"],["4","4 sao"],["3","3 sao"],["2","2 sao"],["1","1 sao"],["low","1–2 sao"]])}</select></label>`:`<label>Loại thông báo<select name="type">${options(Object.entries(types))}</select></label><label>Trạng thái<select name="read">${options([["unread","Chưa đọc"],["read","Đã đọc"]])}</select></label>`}<label>Từ ngày<input type="date" name="from_date"></label><label>Đến ngày<input type="date" name="to_date"></label></form>`;
}

export function feedbackMarkup(reviews) {
  return `  <section class="admin-card feedback-list"><div class="admin-panel-heading"><div><h2>${reviews?"Danh sách đánh giá":"Thông báo toàn hệ thống"}</h2><p>${reviews?"Tra cứu phản hồi và theo dõi chất lượng trải nghiệm sau khám.":"Theo dõi đặt lịch, thanh toán, nhân sự, bài viết và các sự kiện hệ thống."}</p></div></div>${filtersMarkup(reviews)}<p id="feedback-error" class="feedback-filter-error" role="status" aria-live="polite" hidden></p><div id="feedback-results"></div><div id="feedback-pager" class="admin-pagination"></div></section><p id="feedback-status" class="feedback-status" role="status" aria-live="polite"></p>`;
}

export async function initFeedbackPresentation(key) {
  const reviews=key==="reviews";
  let rows=[], saving=false;
  const body=document.querySelector("#page-body"), header=document.querySelector("#page-header");
  const modal=document.querySelector("#admin-dialog"), modalBody=document.querySelector("#admin-dialog-body");
  body.innerHTML=feedbackMarkup(reviews);
  header.querySelector("#page-description").textContent=reviews?"Theo dõi phản hồi của người bệnh sau khám.":"Thông báo từ các hoạt động trong toàn hệ thống.";
  if(!reviews)header.insertAdjacentHTML("beforeend",'<button type="button" class="secondary" id="feedback-read-all">Đánh dấu tất cả đã đọc</button>');
  const form=document.querySelector("#feedback-filters"), error=document.querySelector("#feedback-error"), status=document.querySelector("#feedback-status");
  let page=1, trigger;
  function render() {
    const values=Object.fromEntries(new FormData(form));
    const invalid=Boolean(values.from_date&&values.to_date&&values.to_date<values.from_date);
    form.elements.to_date.setCustomValidity(invalid?"Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.":"");
    form.elements.to_date.setAttribute("aria-invalid",String(invalid));
    error.hidden=!invalid;
    if(invalid){error.textContent="Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.";document.querySelector("#feedback-results").innerHTML="";replaceAdminRegion(document.querySelector("#feedback-pager"),"");return;}
    const pageSize=10;
    const result=feedbackPage(rows,values,page,pageSize);page=result.page;
    replaceAdminRegion(document.querySelector("#feedback-results"),reviews?table(["Mã đánh giá","Bác sĩ / chuyên khoa","Số sao","Nội dung đánh giá","Thời điểm","Thao tác"],result.items.map(row=>[
      `<strong class="feedback-code">${esc(code("DG",row.id))}</strong>`,`<div class="feedback-person"><strong>${esc(row.doctor)}</strong><small>${esc(row.department)}</small></div>`,ratingStars(row.rating),`<p class="feedback-excerpt">${esc(row.comment||"Chỉ chấm sao")}</p>`,esc(stamp(row.created_at)),`<div class="feedback-review-actions"><button type="button" class="row-action" data-feedback-action="detail" data-id="${row.id}">Chi tiết</button><button type="button" class="row-action feedback-visibility" data-feedback-action="visibility" data-id="${row.id}" aria-pressed="${Boolean(row.is_hidden)}" aria-label="${row.is_hidden ? "Hiện lại" : "Ẩn"} đánh giá ${esc(code("DG",row.id))}">${row.is_hidden ? "Đang ẩn" : "Ẩn"}</button></div>`]),"Danh sách đánh giá"):
      table(["Mã thông báo","Thông báo","Loại","Thời điểm","Trạng thái","Thao tác"],result.items.map(row=>[
        `<strong class="feedback-code">${esc(code("TB",row.id))}</strong>`,`<div class="feedback-notification-title ${row.is_read?"":"is-unread"}"><p>${esc(row.content)}</p></div>`,esc(types[row.type]||row.type),esc(stamp(row.created_at)),readBadge(row),`<button type="button" class="row-action" data-feedback-action="detail" data-id="${row.id}">Chi tiết</button>`]),"Danh sách thông báo"));
    replaceAdminRegion(document.querySelector("#feedback-pager"),`<span role="status">${result.total?`${(page-1)*pageSize+1}–${Math.min(page*pageSize,result.total)} / ${result.total}`:"0"} ${reviews?"đánh giá":"thông báo"}${!reviews?` · ${rows.filter(row=>!row.is_read).length} chưa đọc trong hộp thư`:""}</span><div><button type="button" class="secondary" data-feedback-action="previous" ${page<=1?"disabled":""}>Trang trước</button><button type="button" class="secondary" data-feedback-action="next" ${page>=result.pages?"disabled":""}>Trang sau</button></div>`);
    if(!reviews)document.querySelector("#feedback-read-all").disabled=rows.every(row=>row.is_read);
  }
  function open(row) {
    document.querySelector("#admin-dialog-title").textContent=reviews?"Chi tiết đánh giá":"Chi tiết thông báo";
    modalBody.innerHTML=reviews?reviewDetail(row):notificationDetail(row);
    if(!modal.open){trigger=document.activeElement;modal.showModal();}
  }
  const apply=()=>{page=1;render();};
  form.addEventListener("input",event=>{if(!event.isComposing)apply();});form.addEventListener("compositionend",apply);form.addEventListener("change",apply);
  form.addEventListener("submit",event=>{event.preventDefault();apply();});
  async function action(event) {
    const button=event.target.closest("[data-feedback-action]");if(!button||button.disabled)return;
    const action=button.dataset.feedbackAction;
    if(saving)return;
    if(action==="visibility" && reviews) {
      const row=rows.find(row=>String(row.id)===button.dataset.id);
      if(row) {
        if(!row.is_hidden) {
          trigger=button;
          document.querySelector("#admin-dialog-title").textContent="Xác nhận ẩn đánh giá";
          modalBody.innerHTML=`<p>Bạn có muốn ẩn đánh giá <strong>${esc(code("DG",row.id))}</strong> khỏi trang công khai?</p><div class="actions"><button type="button" data-feedback-action="confirm-hide" data-id="${row.id}">Ẩn đánh giá</button><button type="button" class="secondary" data-feedback-action="cancel-hide">Hủy</button></div>`;
          if(!modal.open)modal.showModal();
          modalBody.querySelector('[data-feedback-action="cancel-hide"]').focus();
          return;
        }
        button.disabled=true;
        saving=true;
        try {await setReviewVisibility(row.id,false);row.is_hidden=false;render();}
        catch(err){error.hidden=false;error.textContent=err.message;}
        finally{saving=false;button.disabled=false;}
        body.querySelector(`[data-feedback-action="visibility"][data-id="${row.id}"]`)?.focus();
      }
    }
    if(action==="cancel-hide")modal.close();
    if(action==="confirm-hide"&&reviews) {
      const row=rows.find(row=>String(row.id)===button.dataset.id);
      if(row){
        saving=true;modal.setAttribute("aria-busy","true");
        const buttons=[...modal.querySelectorAll("button")];buttons.forEach(b=>b.disabled=true);
        try {await setReviewVisibility(row.id,true);row.is_hidden=true;render();modal.close();}
        catch(err){let note=modalBody.querySelector('[role="alert"]');if(!note){note=document.createElement("p");note.setAttribute("role","alert");modalBody.append(note);}note.textContent=err.message;}
        finally{saving=false;modal.removeAttribute("aria-busy");buttons.forEach(b=>b.disabled=false);}
      }
    }
    if(action==="detail") {
      button.disabled=true;
      try {const row=reviews?await readAdminReview(button.dataset.id):await openNotification(rows.find(row=>String(row.id)===button.dataset.id));if(row){const index=rows.findIndex(item=>item.id===row.id);if(index>=0)rows[index]=row;render();open(row);}}
      catch(err){error.hidden=false;error.textContent=err.message;}
      finally{button.disabled=false;}
    }
    if(action==="previous"||action==="next"){
      page+=action==="next"?1:-1;render();
      const next=body.querySelector(`[data-feedback-action="${action}"]`);
      (next&&!next.disabled?next:body.querySelector('#feedback-pager button:not(:disabled)')||form.elements.q).focus();
    }
    if(action==="low"){form.elements.rating.value="low";apply();form.elements.rating.focus();}

  }
  body.addEventListener("click",action);modalBody.addEventListener("click",action);
  document.querySelector("#feedback-read-all")?.addEventListener("click",async event=>{
    if(saving)return;saving=true;event.currentTarget.disabled=true;
    try {await readAllNotifications();rows=await readAdminNotifications();render();status.textContent="Đã đánh dấu tất cả thông báo là đã đọc.";}
    catch(err){error.hidden=false;error.textContent=err.message;}
    finally{saving=false;document.querySelector("#feedback-read-all").disabled=rows.every(row=>row.is_read);}
  });
  modal.addEventListener("close",()=>{
    document.querySelector("#notification-back")?.remove();
    const replacement=trigger?.dataset.id?body.querySelector(`[data-feedback-action="${trigger.dataset.feedbackAction || "detail"}"][data-id="${trigger.dataset.id}"]`):null;
    (trigger?.isConnected?trigger:replacement||form.elements.q).focus();
  });
  modal.addEventListener("cancel",event=>{if(saving)event.preventDefault();});
  {
    document.querySelector("#feedback-results").textContent="Đang tải…";
    try {rows=reviews?await readAdminReviews():await readAdminNotifications();
      if(!reviews)for(const type of new Set(rows.map(row=>row.type)))if(!types[type]){types[type]=type;form.elements.type.add(new Option(type,type));}}
    catch(err){error.hidden=false;error.textContent=err.message;document.querySelector("#feedback-results").innerHTML='<button type="button" data-review-retry>Thử lại</button>';body.querySelector("[data-review-retry]").addEventListener("click",()=>location.reload());return;}
  }
  render();
  if(!reviews) {
    let active=true;
    window.addEventListener('pagehide',()=>{active=false;},{once:true});
    window.addEventListener('neu:auth-change',()=>{active=false;},{once:true});
    startAutoRefresh(async()=>{const latest=await readAdminNotifications();if(active){rows=latest;render();}}, {canRefresh:()=>active&&!saving&&!modal.open});
  }
  if(reviews){const id=new URLSearchParams(location.search).get("review_id");if(id&&/^[1-9]\d*$/.test(id))try{open(await readAdminReview(id));}catch(err){error.hidden=false;error.textContent=err.message;}}
}
