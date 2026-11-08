import {listTreatmentAppointments} from '../api/treatment.js';
import {allPages} from '../core/booking.js';
import {protectPatientPage} from '../core/patient_access.js';
import {startAutoRefresh} from '../core/auto_refresh.js';
import {hasSession} from '../core/session.js';
import {thumbnailUrl} from '../core/articles.js';
import {listPatients} from '../api/patient.js';

const list=document.querySelector('#treatment-list'),status=document.querySelector('#treatment-status');
const retry=document.querySelector('#treatment-retry');
const patient=document.querySelector('#treatment-patient');
const pager=document.querySelector('#treatment-pagination'),previous=document.querySelector('#treatment-prev'),next=document.querySelector('#treatment-next');
const tabs=[...document.querySelectorAll('[data-treatment-view]')];
let view=new URLSearchParams(location.search).get('view')==='history'?'history':'upcoming';
const dayFormatter=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Saigon',day:'2-digit',month:'2-digit',year:'numeric'});
const timeFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Saigon',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function timeLabel(value){const [hour,minute]=timeFormatter.format(new Date(value)).split(':');return `${Number(hour)}h${minute==='00'?'':minute}`;}
let rows=[],total=0,page=Math.max(1,Number.parseInt(new URLSearchParams(location.search).get('page'),10)||1),version=0,controller;
let profilesCache=null;
const pageSize=6;
function text(tag,value,className='') {
  const node=document.createElement(tag);node.textContent=value;node.className=className;return node;
}
function doctorPortrait(row) {
  const holder=text('span','','booking-portrait');
  const fallback=text('span','Chưa có ảnh','booking-portrait-missing');holder.append(fallback);
  const src=thumbnailUrl(row.doctor_avatar_url);
  if(src){
    const image=document.createElement('img');image.alt=`Ảnh ${row.doctor_name}`;image.loading='lazy';
    image.addEventListener('load',()=>{fallback.hidden=true;});
    image.addEventListener('error',()=>{image.remove();fallback.hidden=false;});
    image.src=src;holder.append(image);
  }
  return holder;
}
function render() {
  tabs.forEach(tab=>{
    const selected=tab.dataset.treatmentView===view;
    tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
    if(selected)document.querySelector('#treatment-panel').setAttribute('aria-labelledby',tab.id);
  });
  list.replaceChildren(...rows.map(row=>{
    const card=text('article','','appointment-card');
    const heading=text('div','','appointment-card-heading');
    const info=text('div','','appointment-card-doctor');
    const content=row.content;
    info.append(text('h2',row.doctor_name));heading.append(doctorPortrait(row),info);card.append(heading);
    const details=text('dl','','booking-review-list');
    for(const [label,value] of [['Người khám',row.patient_name],['Ngày hẹn',dayFormatter.format(new Date(row.starts_at))],['Thời gian',`${timeLabel(row.starts_at)}–${timeLabel(row.ends_at)}`],['Nội dung điều trị',content],['Địa điểm',row.location],['Lời dặn',row.notes||'Bác sĩ chưa có lời dặn.']]){
      const valueNode=text('dd',value);
      if(label==='Ngày hẹn'||label==='Thời gian')valueNode.className='treatment-nowrap';
      else valueNode.style.whiteSpace='pre-wrap';
      details.append(text('dt',label),valueNode);
    }
    card.append(details);
    return card;
  }));
  status.textContent=total?`${total} buổi hẹn ${view==='upcoming'?'sắp tới':'trong lịch sử'}.`:view==='upcoming'?'Chưa có lịch hẹn điều trị sắp tới.':'Chưa có lịch sử hẹn điều trị.';
  const pages=Math.max(1,Math.ceil(total/pageSize));
  pager.hidden=pages<=1;previous.disabled=page<=1;next.disabled=page>=pages;
  document.querySelector('#treatment-page').textContent=`Trang ${page} / ${pages}`;
}
async function load() {
  const current=++version;controller?.abort();controller=new AbortController();
  const selectedPatient=patient.value||new URLSearchParams(location.search).get('patient_id')||'';
  retry.hidden=true;status.textContent='Đang tải lịch hẹn điều trị…';
  list.setAttribute('aria-busy','true');patient.disabled=true;previous.disabled=next.disabled=true;
  try {
    const [result,profiles]=await Promise.allSettled([
      listTreatmentAppointments({view,page,page_size:pageSize,...(selectedPatient?{patient_id:selectedPatient}:{})},{signal:controller.signal}),
      !profilesCache?.length?allPages(listPatients,{include_archived:true}, {signal:controller.signal}):Promise.resolve(profilesCache),
    ]);
    if(current!==version)return;
    if(result.status==='rejected')throw result.reason;
    const data=result.value;
    if(!Array.isArray(data.items)||!Number.isInteger(data.total)||data.total<0)throw Error('Phản hồi lịch hẹn không hợp lệ. Vui lòng thử lại.');
    if(page>Math.max(1,Math.ceil(data.total/pageSize))){page=Math.max(1,Math.ceil(data.total/pageSize));saveFilters();return load();}
    if(profiles.status==='fulfilled')profilesCache=profiles.value;
    const availablePatients=new Map();
    for(const item of profilesCache||[])availablePatients.set(String(item.patient_id),item.full_name+(item.dob?' — '+dayFormatter.format(new Date(item.dob+'T00:00:00+07:00')):'')+(item.is_archived?' (đã lưu trữ)':''));
    for(const item of data.items)if(!availablePatients.has(String(item.patient_id)))availablePatients.set(String(item.patient_id),item.patient_name);
    if(selectedPatient&&!availablePatients.has(selectedPatient))availablePatients.set(selectedPatient,'Hồ sơ đã chọn');
    const all=text('option','Tất cả hồ sơ');all.value='';
    patient.replaceChildren(all,...[...availablePatients].map(([id,name])=>{const option=text('option',name);option.value=id;return option;}));
    patient.value=availablePatients.has(selectedPatient)?selectedPatient:'';
    rows=data.items;total=data.total;render();
    if(profiles.status==='rejected'){status.textContent+=' Chưa tải được đầy đủ danh sách người khám. Vui lòng thử lại.';retry.hidden=false;}
    else if(!availablePatients.size)status.textContent+=' Tài khoản chưa có hồ sơ người khám để lựa chọn.';
  } catch(error) {
    if(current!==version)return;
    rows=[];list.replaceChildren();pager.hidden=true;status.textContent=error.message;retry.hidden=false;
  } finally {
    if(current===version){list.setAttribute('aria-busy','false');patient.disabled=false;}
  }
}
function saveFilters(){
  const url=new URL(location.href);url.searchParams.set('view',view);
  if(patient.value)url.searchParams.set('patient_id',patient.value);else url.searchParams.delete('patient_id');
  if(page>1)url.searchParams.set('page',String(page));else url.searchParams.delete('page');
  history.replaceState(null,'',url);
}
function switchView(value){
  view=value;page=1;saveFilters();return load();
}
tabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>switchView(tab.dataset.treatmentView));
  tab.addEventListener('keydown',event=>{
    const target=event.key==='Home'?tabs[0]:event.key==='End'?tabs.at(-1):['ArrowLeft','ArrowRight'].includes(event.key)?tabs[(index+1)%tabs.length]:null;
    if(target){event.preventDefault();switchView(target.dataset.treatmentView);target.focus();}
  });
});
retry.addEventListener('click',load);
patient.addEventListener('change',()=>{
  page=1;saveFilters();return load();
});
previous.addEventListener('click',()=>{if(page>1){page--;saveFilters();return load();}});
next.addEventListener('click',()=>{if(page*pageSize<total){page++;saveFilters();return load();}});
protectPatientPage({status:document.querySelector('#treatment-auth-status'),main:document.querySelector('#main'),onAccess:load,
  onSuspend:()=>{version++;controller?.abort();rows=[];total=0;profilesCache=null;patient.replaceChildren();list.replaceChildren();pager.hidden=true;status.textContent='';}});
startAutoRefresh(load,{canRefresh:()=>hasSession()&&!document.body.classList.contains('auth-pending')});
