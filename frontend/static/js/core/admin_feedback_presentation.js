import { reviewPreview, notificationPreview } from "../data/admin_feedback_preview.js";
import { esc, table, facts, stamp, options } from "./admin_ui.js";
import { code } from "./business_codes.js";

const normalize=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLocaleLowerCase("vi");
const day=value=>String(value).slice(0,10); // Preview timestamps are explicitly in UTC+07:00.
const types={STAFF_LEAVE:"Đơn xin nghỉ",SYSTEM:"Hệ thống"};
const readBadge=row=>`<span class="badge ${row.is_read?"blue":"amber"}">${row.is_read?"Đã đọc":"Chưa đọc"}</span>`;
export const ratingStars=rating=>`<span class="feedback-rating" aria-label="${Number(rating)} trên 5 sao"><span aria-hidden="true">${"★".repeat(rating)}<span class="feedback-star-empty">${"★".repeat(5-rating)}</span></span><strong>${Number(rating)}/5</strong></span>`;

export function feedbackPage(rows,filters={},page=1,size=6) {
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
  return `<div class="feedback-detail"><div class="feedback-detail-hero">${ratingStars(row.rating)}<p>Phản hồi sau khám · Dữ liệu minh họa</p></div><section><h3>Thông tin đánh giá</h3>${facts([["Mã đánh giá",code("DG",row.id)],["Bác sĩ",row.doctor],["Chuyên khoa",row.department],["Thời điểm",stamp(row.created_at)]])}</section><section><h3>Nội dung phản hồi</h3><blockquote>${esc(row.comment||"Người đánh giá chỉ chấm sao, không để lại nhận xét.")}</blockquote></section><p class="feedback-detail-note">Đánh giá gắn với lượt khám đã hoàn thành, có bệnh án; mỗi lượt khám có tối đa một đánh giá từ 1–5 sao. Trang quản trị không chỉnh sửa nội dung người bệnh đã gửi.</p></div>`;
}

export function notificationDetail(row) {
  return `<div class="feedback-detail"><div class="feedback-detail-hero">${readBadge(row)}<h3>${esc(row.title)}</h3><p>${esc(types[row.type]||row.type)} · ${esc(stamp(row.created_at))}</p></div><section><h3>Nội dung thông báo</h3><p class="feedback-notification-content">${esc(row.content)}</p></section>${facts([["Mã thông báo",code("TB",row.id)],["Người nhận","Tài khoản quản trị viên minh họa"],["Đối tượng liên quan",row.reference||"Thông báo chung"],["Kênh","Trong ứng dụng"]])}<p class="feedback-detail-note">Bản xem trước giao diện. Trạng thái đọc chỉ thay đổi trong lần xem này và sẽ trở về ban đầu khi tải lại trang.</p>${!row.is_read?'<div class="actions"><button type="button" data-feedback-action="read" data-id="'+row.id+'">Đánh dấu đã đọc</button></div>':""}</div>`;
}

function filtersMarkup(reviews) {
  return `<form id="feedback-filters" class="admin-toolbar" role="search" aria-label="${reviews?"Lọc đánh giá":"Lọc thông báo"}"><label>Tìm kiếm<input type="search" name="q" placeholder="${reviews?"Mã đánh giá, bác sĩ, nội dung…":"Mã thông báo, tiêu đề, nội dung…"}"></label>${reviews?`<label>Bác sĩ<select name="doctor">${options([...new Set(reviewPreview.map(r=>r.doctor))])}</select></label><label>Số sao<select name="rating">${options([["5","5 sao"],["4","4 sao"],["3","3 sao"],["2","2 sao"],["1","1 sao"],["low","1–2 sao"]])}</select></label>`:`<label>Loại thông báo<select name="type">${options(Object.entries(types))}</select></label><label>Trạng thái<select name="read">${options([["unread","Chưa đọc"],["read","Đã đọc"]])}</select></label>`}<label>Từ ngày<input type="date" name="from_date"></label><label>Đến ngày<input type="date" name="to_date"></label></form>`;
}

export function feedbackMarkup(reviews) {
  return `<p class="feedback-preview-note"><strong>Bản xem trước · Dữ liệu minh họa</strong><span>${reviews?"Phản hồi mẫu để xem bố cục quản lý đánh giá sau khám.":"Hộp thư mẫu dành cho quản trị viên; chưa kết nối thông báo của tài khoản."} Chưa kết nối API; dữ liệu và thao tác không được lưu.</span></p>
  ${reviews?'<div id="review-overview" class="feedback-review-overview"></div>':""}
  <section class="admin-card feedback-list"><div class="admin-panel-heading"><div><h2>${reviews?"Danh sách đánh giá":"Thông báo của tôi"}</h2><p>${reviews?"Tra cứu phản hồi và theo dõi chất lượng trải nghiệm sau khám.":"Theo dõi thông tin liên quan đến tài khoản quản trị viên."}</p></div><span class="feedback-source">Dữ liệu minh họa</span></div>${filtersMarkup(reviews)}<p id="feedback-error" class="feedback-filter-error" role="status" aria-live="polite" hidden></p><div id="feedback-results"></div><div id="feedback-pager" class="admin-pagination"></div></section><p id="feedback-status" class="feedback-status" role="status" aria-live="polite"></p>`;
}

function reviewOverview(rows) {
  const average=rows.length?rows.reduce((sum,row)=>sum+row.rating,0)/rows.length:0;
  return `<section class="admin-card feedback-score"><span>Điểm đánh giá trung bình</span><strong>${average.toLocaleString("vi-VN",{maximumFractionDigits:1})}<small>/ 5</small></strong><p>${rows.length} đánh giá minh họa</p></section><section class="admin-card feedback-distribution" aria-label="Phân bố số sao trong dữ liệu minh họa"><h2>Phân bố đánh giá</h2>${[5,4,3,2,1].map(rating=>{const count=rows.filter(row=>row.rating===rating).length;return `<div><span>${rating} sao</span><meter min="0" max="${rows.length||1}" value="${count}" aria-label="${rating} sao: ${count} đánh giá">${count}</meter><strong>${count}</strong></div>`;}).join("")}</section><section class="admin-card feedback-low"><span>Phản hồi 1–2 sao</span><strong>${rows.filter(r=>r.rating<=2).length}</strong><p>Xem nội dung để nắm bắt các điểm cần cải thiện.</p><button type="button" class="secondary" data-feedback-action="low">Xem phản hồi 1–2 sao</button></section>`;
}

export function initFeedbackPresentation(key) {
  const reviews=key==="reviews", rows=(reviews?reviewPreview:notificationPreview).map(row=>({...row}));
  const body=document.querySelector("#page-body"), header=document.querySelector("#page-header");
  const modal=document.querySelector("#admin-dialog"), modalBody=document.querySelector("#admin-dialog-body");
  body.innerHTML=feedbackMarkup(reviews);
  header.querySelector("#page-description").textContent=reviews?"Theo dõi phản hồi của người bệnh sau khám.":"Hộp thư thông báo dành cho tài khoản quản trị viên.";
  if(!reviews)header.insertAdjacentHTML("beforeend",'<button type="button" class="secondary" id="feedback-read-all">Đánh dấu tất cả đã đọc</button>');
  if(reviews)document.querySelector("#review-overview").innerHTML=reviewOverview(rows);
  const form=document.querySelector("#feedback-filters"), error=document.querySelector("#feedback-error"), status=document.querySelector("#feedback-status");
  let page=1, trigger;
  function render() {
    const values=Object.fromEntries(new FormData(form));
    const invalid=Boolean(values.from_date&&values.to_date&&values.to_date<values.from_date);
    form.elements.to_date.setCustomValidity(invalid?"Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.":"");
    form.elements.to_date.setAttribute("aria-invalid",String(invalid));
    error.hidden=!invalid;
    if(invalid){error.textContent="Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.";document.querySelector("#feedback-results").innerHTML="";document.querySelector("#feedback-pager").innerHTML="";return;}
    const result=feedbackPage(rows,values,page);page=result.page;
    document.querySelector("#feedback-results").innerHTML=reviews?table(["Mã đánh giá","Bác sĩ / chuyên khoa","Số sao","Nội dung đánh giá","Thời điểm","Thao tác"],result.items.map(row=>[
      `<strong class="feedback-code">${esc(code("DG",row.id))}</strong>`,`<div class="feedback-person"><strong>${esc(row.doctor)}</strong><small>${esc(row.department)}</small></div>`,ratingStars(row.rating),`<p class="feedback-excerpt">${esc(row.comment||"Chỉ chấm sao")}</p>`,esc(stamp(row.created_at)),`<button type="button" class="row-action" data-feedback-action="detail" data-id="${row.id}">Chi tiết</button>`]),"Danh sách đánh giá minh họa"):
      table(["Mã thông báo","Thông báo","Loại","Thời điểm","Trạng thái","Thao tác"],result.items.map(row=>[
        `<strong class="feedback-code">${esc(code("TB",row.id))}</strong>`,`<div class="feedback-notification-title ${row.is_read?"":"is-unread"}"><strong>${!row.is_read?'<span class="feedback-unread-dot" aria-hidden="true"></span>':""}${esc(row.title)}</strong><p>${esc(row.content)}</p></div>`,esc(types[row.type]||row.type),esc(stamp(row.created_at)),readBadge(row),`<button type="button" class="row-action" data-feedback-action="detail" data-id="${row.id}">Chi tiết</button>`]),"Danh sách thông báo minh họa");
    document.querySelector("#feedback-pager").innerHTML=`<span role="status">${result.total?`${(page-1)*6+1}–${Math.min(page*6,result.total)} / ${result.total}`:"0"} ${reviews?"đánh giá":"thông báo"} minh họa${!reviews?` · ${rows.filter(row=>!row.is_read).length} chưa đọc trong hộp thư`:""}</span><div><button type="button" class="secondary" data-feedback-action="previous" ${page<=1?"disabled":""}>Trang trước</button><button type="button" class="secondary" data-feedback-action="next" ${page>=result.pages?"disabled":""}>Trang sau</button></div>`;
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
  function action(event) {
    const button=event.target.closest("[data-feedback-action]");if(!button||button.disabled)return;
    const action=button.dataset.feedbackAction;
    if(action==="detail") {const row=rows.find(row=>String(row.id)===button.dataset.id);if(row)open(row);}
    if(action==="previous"||action==="next"){
      page+=action==="next"?1:-1;render();
      const next=body.querySelector(`[data-feedback-action="${action}"]`);
      (next&&!next.disabled?next:body.querySelector('#feedback-pager button:not(:disabled)')||form.elements.q).focus();
    }
    if(action==="low"){form.elements.rating.value="low";apply();form.elements.rating.focus();}
    if(action==="read"&&!reviews){const row=rows.find(row=>String(row.id)===button.dataset.id);if(row){row.is_read=true;render();open(row);status.textContent="Đã đổi trạng thái trên bản xem trước; chưa lưu vào hệ thống.";modal.querySelector("#dialog-close").focus();}}
  }
  body.addEventListener("click",action);modalBody.addEventListener("click",action);
  document.querySelector("#feedback-read-all")?.addEventListener("click",()=>{rows.forEach(row=>row.is_read=true);render();status.textContent="Tất cả thông báo mẫu đã được đánh dấu đã đọc trong lần xem này; chưa lưu vào hệ thống.";});
  modal.addEventListener("close",()=>{
    const replacement=trigger?.dataset.id?body.querySelector(`[data-feedback-action="detail"][data-id="${trigger.dataset.id}"]`):null;
    (trigger?.isConnected?trigger:replacement||form.elements.q).focus();
  });
  render();
}
