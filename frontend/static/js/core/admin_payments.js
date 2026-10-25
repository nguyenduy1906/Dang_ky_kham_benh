import {replaceAdminRegion} from "./admin_render.js";
import { readAdminPaymentHistory, paymentPage, readPaymentContext } from "./admin_payment_data.js";
import { paymentTable, refundHistoryTable, paymentDetails } from "./admin_payment_view.js";
import { openUnifiedRefundRequest as openRefundRequest } from "./admin_refund_selection.js";
import { startAutoRefresh } from "./auto_refresh.js";
import { bindLiveSearch } from "./live_search.js";
import { esc, panel, options, today } from "./admin_ui.js";
import { code } from "./business_codes.js";

export function paymentsPageMarkup(encounterId = "") {
  const linkedId=/^[1-9]\d*$/.test(String(encounterId))?encounterId:"";
  const initialDay=linkedId?"":today();
  return panel("Danh sách thanh toán",`<form id="payment-search" class="admin-toolbar" role="search" aria-label="Tìm thanh toán">
    <label>Mã thanh toán / giao dịch / lượt khám<input type="search" name="q" placeholder="TT_001, mã giao dịch hoặc LK_001" value="${linkedId?esc(code('LK',linkedId)):''}"></label>
    <label>Trạng thái<select name="transaction_status">${options([["PENDING","Chờ thanh toán"],["SUCCESS","Thành công"],["FAILED","Thất bại"],["REFUNDED","Đã hoàn tiền"]])}</select></label>
    <label>Từ ngày<input type="date" name="from_date" value="${initialDay}"></label><label>Đến ngày<input type="date" name="to_date" value="${initialDay}"></label>
    </form><p data-payment-error class="admin-search-status" role="status" hidden></p><div id="payment-results"></div><div id="payment-pager"></div>`)
    + panel("Lịch sử hoàn tiền",`<form id="refund-search" class="admin-toolbar admin-toolbar-three" role="search" aria-label="Tìm lịch sử hoàn tiền">
      <label>Mã hoàn tiền / lý do / giao dịch gốc / lượt khám<input type="search" name="q" placeholder="Mã hoàn tiền, giao dịch gốc, LK_001 hoặc lý do" value="${linkedId?esc(code('LK',linkedId)):''}"></label>
      <label>Từ ngày<input type="date" name="from_date" value="${initialDay}"></label><label>Đến ngày<input type="date" name="to_date" value="${initialDay}"></label>
      </form><p data-refund-error class="admin-search-status" role="status" hidden></p><div id="refund-results"></div><div id="refund-pager"></div>`);
}

export async function initAdminPayments(ctx) {
  const body = document.querySelector("#page-body"), modal = document.querySelector("#admin-dialog");
  const modalBody = document.querySelector("#admin-dialog-body"), header = document.querySelector("#page-header");
  const linked = new URLSearchParams(location.search).get("encounter_id");
  body.classList.add("admin-payments-list");
  header.insertAdjacentHTML("beforeend",'<button class="primary" type="button" id="request-refund">＋ Yêu cầu hoàn tiền</button>');
  const requestButton = document.querySelector("#request-refund");
  body.innerHTML = paymentsPageMarkup(linked && /^[1-9]\d*$/.test(linked) ? linked : "");
  const paymentForm = document.querySelector("#payment-search"), refundForm = document.querySelector("#refund-search");
  let rows = [], page = 1, refundPage = 1, active = true, detailVersion = 0, loaded = false, refundDialogOpen = false;
  const refreshers = [];
  const values = form => Object.fromEntries(new FormData(form));
  function pager(result, kind) {
    const pages = Math.max(1,Math.ceil(result.total/result.page_size));
    return `<div class="admin-pagination"><span>${result.total} giao dịch · Trang ${result.page} / ${pages}</span><div><button type="button" class="secondary" data-payment-page="${kind}" data-step="-1" ${result.page<=1?"disabled":""}>Trang trước</button><button type="button" class="secondary" data-payment-page="${kind}" data-step="1" ${result.page>=pages?"disabled":""}>Trang sau</button></div></div>`;
  }
  function render(kind) {
    if (!active || !ctx.active) return;
    const refunds = kind === "refund", form = refunds ? refundForm : paymentForm;
    const error = body.querySelector(refunds ? "[data-refund-error]" : "[data-payment-error]");
    const results = document.querySelector(refunds ? "#refund-results" : "#payment-results"), pages = document.querySelector(refunds ? "#refund-pager" : "#payment-pager");
    try {
      const result = paymentPage(rows,values(form),refunds?refundPage:page,{refunds});
      if (refunds) refundPage=result.page; else page=result.page;
      replaceAdminRegion(results,refunds ? refundHistoryTable(result.items) : paymentTable(result.items));
      replaceAdminRegion(pages,pager(result,kind)); error.hidden=true;
    } catch (cause) { error.textContent=cause.message;error.hidden=false;results.innerHTML="";pages.innerHTML=""; }
  }
  async function reload() {
    await ctx.load(signal=>readAdminPaymentHistory({signal}),data=>{
      if (!active) return;
      rows=data;loaded=true;render("payment");render("refund");
    });
    if (!loaded && active && ctx.active) {
      document.querySelector("#payment-results").innerHTML='<p class="admin-search-status">Không tải được lịch sử. <button type="button" class="secondary" data-payment-retry>Thử lại</button></p>';
      document.querySelector("#refund-results").innerHTML='<p class="admin-search-status">Chưa tải được lịch sử hoàn tiền.</p>';
    }
  }
  async function requestRefund(id = null, trigger = requestButton) {
    if (!active || !ctx.active || refundDialogOpen) return;
    refundDialogOpen=true;
    if (modal.open) modal.close();
    try { await openRefundRequest({ctx,rows,paymentId:id,trigger,onSaved:async()=>{await reload();},onClose:()=>{refundDialogOpen=false;}}); }
    catch(error){refundDialogOpen=false;ctx.handle(error);}
  }
  requestButton.addEventListener("click",event=>{void requestRefund(null,event.currentTarget);});
  function bind(form, kind) {
    const apply = () => { if(kind==="refund")refundPage=1;else page=1;render(kind); };
    form.querySelectorAll('input[type="text"],input[type="search"]').forEach(input=>refreshers.push(bindLiveSearch(input,apply)));
    form.addEventListener("change",apply);
    form.addEventListener("submit",event=>{event.preventDefault();refreshers.forEach(refresh=>refresh.cancel());apply();});
    form.addEventListener("reset",()=>{refreshers.forEach(refresh=>refresh.cancel());queueMicrotask(apply);});
  }
  bind(paymentForm,"payment");bind(refundForm,"refund");
  async function detail(id) {
    const version = ++detailVersion;
    await ctx.show("Chi tiết giao dịch",async signal=>{
      const context = await readPaymentContext(id,{signal,includeDepartment:true});
      if (!active || version!==detailVersion) return "";
      return paymentDetails(context.payment,context.encounter);
    });
  }
  function action(event) {
    const button = event.target.closest("button");if(!button||button.disabled)return;
    if(button.hasAttribute("data-payment-detail"))void detail(button.dataset.paymentDetail);
    else if(button.hasAttribute("data-request-refund"))void requestRefund(button.dataset.requestRefund,requestButton);
    else if(button.hasAttribute("data-payment-retry"))void reload();
    else if(button.hasAttribute("data-payment-page")) {
      const kind=button.dataset.paymentPage;if(kind==="refund")refundPage+=Number(button.dataset.step);else page+=Number(button.dataset.step);render(kind);
    }
  }
  body.addEventListener("click",action);modalBody.addEventListener("click",action);
  const stop = () => { active=false;detailVersion++;refreshers.forEach(refresh=>refresh.cancel()); };
  window.addEventListener("pagehide",stop,{once:true});window.addEventListener("neu:auth-change",stop,{once:true});
  await reload();
  const linkedPayment=new URLSearchParams(location.search).get("payment_id");
  if(linkedPayment&&/^[1-9]\d*$/.test(linkedPayment))await detail(linkedPayment);
  startAutoRefresh(reload,{canRefresh:()=>active&&ctx.active});
  return { reload };
}
