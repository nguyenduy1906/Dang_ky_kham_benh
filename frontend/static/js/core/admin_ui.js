import {isScheduleStatus,scheduleStatusBadge} from "./schedule_status.js";
import {encounterStatusBadge,encounterStatusLabels} from "./encounter_status.js";
import {encounterTypeBadge} from "./encounter_type.js";
import { clearSession } from "./session.js";
export const $ = selector => document.querySelector(selector);
export const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const today = () => new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
export const date = value => value ? new Intl.DateTimeFormat("vi-VN", {timeZone:"Asia/Ho_Chi_Minh"}).format(new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value)) : "—";
export const stamp = value => value ? new Intl.DateTimeFormat("vi-VN", {timeZone:"Asia/Ho_Chi_Minh",dateStyle:"short",timeStyle:"short"}).format(new Date(value)) : "—";
export const money = value => value == null ? "Chưa có giá chốt" : new Intl.NumberFormat("vi-VN", {style:"currency",currency:"VND"}).format(Number(value));
export const labels = {ADMIN:"Quản trị viên",DOCTOR:"Bác sĩ",NURSE:"Y tá",RECEPTIONIST:"Lễ tân",USER:"Người dùng",ACTIVE:"Hoạt động",LOCKED:"Đã khóa",PENDING:"Chờ duyệt",APPROVED:"Đã duyệt",REJECTED:"Từ chối",CANCELLED:"Đã hủy",HOLDING:"Chờ thanh toán",CONFIRMED:"Đã thanh toán",CHECKED_IN:"Đã check in",IN_PROGRESS:"Đang khám",COMPLETED:"Hoàn thành",NO_SHOW:"Không đến",EXPIRED:"Hết hạn",ONLINE:"Trực tuyến",WALK_IN:"Trực tiếp",OPEN:"Đang hoạt động",FULL:"Đã đầy",CLOSED:"Đã đóng",UNAVAILABLE:"Báo nghỉ",SUCCESS:"Thành công",FAILED:"Thất bại",REFUNDED:"Đã hoàn tiền",DEPOSIT:"Đặt cọc",EXAM_FEE:"Phí khám",REFUND:"Hoàn tiền",FULL_DAY:"Cả ngày",MORNING:"Buổi sáng",AFTERNOON:"Buổi chiều",SELF:"Bản thân",PARENT:"Bố/mẹ",CHILD:"Con",SPOUSE:"Vợ/chồng",OTHER:"Khác",CLINICAL:"Lâm sàng",PARACLINICAL:"Cận lâm sàng"};
export const label = value => labels[value] || value || "—";
export const badge = value => value==="LOCKED" ? `<span class="badge account-locked">Đã khóa</span>` : ["ADMIN","DOCTOR","NURSE","RECEPTIONIST","USER"].includes(value) ? `<span class="badge role-badge" data-role-badge="${value}">${esc(label(value))}</span>` : isScheduleStatus(value) ? scheduleStatusBadge(value) : Object.hasOwn(encounterStatusLabels,value) ? encounterStatusBadge(value) : ["ONLINE","WALK_IN"].includes(value) ? encounterTypeBadge(value) : `<span class="badge ${["ACTIVE","APPROVED","COMPLETED","SUCCESS","OPEN"].includes(value)?"green":["PENDING","HOLDING"].includes(value)?"amber":"blue"}">${esc(label(value))}</span>`;
export const table = (columns, rows, caption = "Danh sách") => `<div class="admin-table-scroll" tabindex="0" role="region" aria-label="${esc(caption)}"><table class="admin-table"><caption class="visually-hidden">${esc(caption)}</caption><thead><tr>${columns.map(c=>`<th scope="col">${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(cells=>`<tr>${cells.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${columns.length}"><div class="admin-empty">Chưa có dữ liệu phù hợp.</div></td></tr>`}</tbody></table></div>`;
export const facts = entries => `<dl class="admin-dialog-facts">${entries.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value ?? "—")}</dd></div>`).join("")}</dl>`;
export const panel = (title, body, extra="") => `<section class="admin-card"><div class="admin-panel-heading"><h2>${esc(title)}</h2>${extra}</div>${body}</section>`;
export const options = (items, selected="", empty="Tất cả") => `<option value="">${esc(empty)}</option>${items.map(item=>{const [value,text] = Array.isArray(item)?item:[item,label(item)];return `<option value="${esc(value)}" ${String(value)===String(selected)?"selected":""}>${esc(text)}</option>`;}).join("")}`;
export const button = (action,id,text) => `<button type="button" class="row-action" data-action="${esc(action)}" data-id="${esc(id)}">${esc(text)}</button>`;
export const metrics = entries => `<div class="admin-summary">${entries.map(([title,value,note])=>`<article class="admin-metric"><div><span>${esc(title)}</span></div><strong>${esc(value)}</strong><small>${esc(note || "")}</small></article>`).join("")}</div>`;
export function chart(title, entries) {
  const max=Math.max(1,...entries.map(([,value])=>Number(value)));
  return `<section class="admin-card admin-chart"><h2>${esc(title)}</h2>${entries.length ? entries.map(([text,value])=>`<div class="admin-bar"><div><span>${esc(text)}</span><strong>${esc(value)}</strong></div><meter min="0" max="${max}" value="${Number(value)}" aria-label="${esc(text)}: ${Number(value)}">${Number(value)}</meter></div>`).join("") : '<p>Chưa có dữ liệu trong khoảng đã chọn.</p>'}</section>`;
}
export async function allPages(reader, params={}, signal) {
  const items=[];
  for (let page=1;;page++) {
    const result=await reader({...params,page,page_size:100},{signal});
    items.push(...result.items);
    if (result.total == null || page*result.page_size>=result.total) return items;
  }
}
export function createAdminContext() {
  let active=true, version=0, modalVersion=0, controller, trigger;
  const requests=new Set();
  const content=$("#page-body"), modal=$("#admin-dialog"), modalBody=$("#admin-dialog-body");
  function stop() { active=false; version++; modalVersion++; for(const item of requests)item.abort(); content.innerHTML=""; modalBody.innerHTML=""; if(modal.open)modal.close(); }
  window.addEventListener("pagehide",stop,{once:true});
  window.addEventListener("neu:auth-change",stop);
  modal.addEventListener("close",()=>{modalVersion++;trigger?.focus();});
  function handle(error,target=$("#admin-status")) {
    if (!active || error.code === "CLIENT_ABORTED") return;
    if (error.status === 401 || error.status === 403 && error.code !== "SELF_CHANGE_FORBIDDEN") { stop(); if(error.status === 401)clearSession(); $("#staff-access").hidden=false; $("#staff-access").textContent=error.message; $("#main-content").inert=true; return; }
    if (target) {target.textContent=error.message || "Không thể tải dữ liệu.";target.dataset.error="true";target.hidden=false;}
  }
  function cancelLoad() {
    version++; controller?.abort();
    if(!active)return;
    content.setAttribute("aria-busy","false");
    const status=$("#admin-status");if(status)status.hidden=true;
  }
  async function load(task,commit) {
    if(!active)return;
    const current=++version; controller?.abort(); controller=new AbortController(); const request=controller; requests.add(request);
    const status=$("#admin-status");
    const loadingTimer=setTimeout(()=>{if(active&&current===version&&status){status.hidden=false;status.textContent="Đang tải…";status.dataset.error="false";}},180);
    content.setAttribute("aria-busy","true");
    try {const result=await task(request.signal);if(active&&current===version){commit(result);if(status)status.hidden=true;}}
    catch(error){if(active&&current===version)handle(error);}
    finally{clearTimeout(loadingTimer);requests.delete(request);if(active&&current===version)content.setAttribute("aria-busy","false");}
  }
  async function show(title, task) {
    if(!active)return;
    const current=++modalVersion, request=new AbortController();requests.add(request);
    const patientHistory=modal.querySelector("#patient-history-header");if(patientHistory)patientHistory.hidden=true;
    $("#admin-dialog-title").textContent=title;modalBody.innerHTML='<p role="status">Đang tải…</p>';
    if(!modal.open){trigger=document.activeElement;modal.showModal();}
    try {const html=await task(request.signal);if(active&&current===modalVersion)modalBody.innerHTML=html;}
    catch(error){if(active&&current===modalVersion){modalBody.innerHTML='<p id="admin-dialog-error" role="status"></p>';handle(error,$("#admin-dialog-error"));}}
    finally{requests.delete(request);}
  }
  async function submit(form, task, done) {
    if(!active||form.dataset.saving==="true")return;
    form.dataset.saving="true";
    const current=modalVersion, request=new AbortController();requests.add(request);
    const controls=[...form.querySelectorAll("button")]; controls.forEach(b=>b.disabled=true);
    const feedback=form.querySelector('[role="status"]');if(feedback){feedback.textContent="Đang lưu…";feedback.dataset.error="false";}
    try {const result=await task(request.signal);if(active&&current===modalVersion){if(feedback)feedback.textContent="Đã lưu.";await done?.(result);}}
    catch(error){if(active&&current===modalVersion)handle(error,feedback);}
    finally{requests.delete(request);form.dataset.saving="false";controls.forEach(b=>b.disabled=false);}
  }
  return {load,show,submit,handle,stop,cancelLoad,get active(){return active;},get signal(){return controller?.signal;}};
}
