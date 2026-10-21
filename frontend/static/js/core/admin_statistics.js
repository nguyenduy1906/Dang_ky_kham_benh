import {esc,date,today} from './admin_ui.js';
import {reportRange,reportCsv} from './admin_statistics_data.js';
import {statisticsPreview} from './admin_statistics_preview.js';
import {statisticsTabs,statisticsView,statisticsReportMarkup} from './admin_statistics_view.js';

export function statisticsShell(range) {
  const departments=statisticsPreview(range).departments;
  return `<div class="statistics-workspace"><section class="admin-card statistics-filter"><header><div><h2>Bộ lọc báo cáo</h2><p>Áp dụng cho tất cả các mục báo cáo bên dưới.</p></div><span class="statistics-preview-label">Dữ liệu minh họa</span></header><form id="statistics-filter"><div class="statistics-filter-fields"><label>Khoảng thời gian<select name="period"><option value="30">30 ngày gần nhất</option><option value="today">Hôm nay</option><option value="week">Tuần này</option><option value="month">Tháng này</option><option value="custom">Tùy chọn</option></select></label><label>Từ ngày<input type="date" name="from" value="${esc(range.from)}" required></label><label>Đến ngày<input type="date" name="to" value="${esc(range.to)}" required></label><label>Chuyên khoa<select name="department"><option value="">Tất cả chuyên khoa</option>${departments.map(d=>`<option value="${d.department_id}">${esc(d.name)}</option>`).join('')}</select></label></div><p id="statistics-filter-feedback" class="statistics-filter-feedback" role="status" hidden></p><p id="statistics-period-note" class="statistics-period-note"></p></form></section><nav class="statistics-tabs" aria-label="Các mục báo cáo">${statisticsTabs.map(([key,title],i)=>`<button type="button" data-report-tab="${key}" aria-pressed="${i===0}" aria-controls="statistics-results" class="secondary">${esc(title)}</button>`).join('')}</nav><div id="statistics-results" aria-live="polite" aria-atomic="false"></div><p class="statistics-scope-note">Giao diện xem trước · Các số liệu và bảng đang dùng dữ liệu minh họa, chưa kết nối API.</p></div>`;
}
export async function initAdminStatistics(ctx) {
  const body=document.querySelector('#page-body');
  let range={...reportRange('30',today()),department:''},tab='overview',page=1,view;
  body.innerHTML=statisticsShell(range);
  document.querySelector('#page-description').textContent='Tổng hợp lượt khám, thanh toán, công suất và đánh giá.';
  document.querySelector('#page-header').insertAdjacentHTML('beforeend','<button type="button" class="secondary statistics-export" id="statistics-export">Xuất CSV mục hiện tại</button>');
  const form=body.querySelector('#statistics-filter');
  const render=()=>{
    if(!ctx.active)return;
    view=statisticsView(statisticsPreview(range),tab);
    body.querySelector('#statistics-results').innerHTML=statisticsReportMarkup(view,page);
    body.querySelector('#statistics-period-note').textContent=`Kỳ báo cáo: ${date(range.from)} – ${date(range.to)} · Bản xem trước giao diện`;
    body.querySelectorAll('[data-report-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.reportTab===tab)));
  };
  const apply=()=>{
    const feedback=body.querySelector('#statistics-filter-feedback');
    if(!form.reportValidity())return;
    if(form.elements.from.value>form.elements.to.value){feedback.textContent='Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.';feedback.hidden=false;form.elements.to.setAttribute('aria-invalid','true');return;}
    feedback.hidden=true;form.elements.to.removeAttribute('aria-invalid');
    range={from:form.elements.from.value,to:form.elements.to.value,department:form.elements.department.value};page=1;render();
  };
  form.addEventListener('submit',event=>{event.preventDefault();apply();});
  form.addEventListener('change',event=>{
    if(event.target.name==='period'&&event.target.value!=='custom'){
      const chosen=reportRange(event.target.value,today());form.elements.from.value=chosen.from;form.elements.to.value=chosen.to;
    }else if(['from','to'].includes(event.target.name))form.elements.period.value='custom';
    apply();
  });
  body.addEventListener('click',event=>{
    const button=event.target.closest('[data-report-tab],[data-report-page]');if(!button||button.disabled)return;
    if(button.dataset.reportTab){tab=button.dataset.reportTab;page=1;}else page+=Number(button.dataset.reportPage);
    render();
    if(button.dataset.reportPage)body.querySelector('[data-report-page]:not(:disabled)')?.focus();
  });
  document.querySelector('#statistics-export').addEventListener('click',()=>{
    if(!ctx.active||!view)return;
    const title=statisticsTabs.find(([key])=>key===tab)[1];
    const rows=[['BẢN MINH HỌA GIAO DIỆN — CHƯA KẾT NỐI API'],[title,range.from,range.to],['Chuyên khoa',form.elements.department.selectedOptions[0].textContent],...view.exportRows];
    const url=URL.createObjectURL(new Blob([reportCsv(rows)],{type:'text/csv;charset=utf-8'})),anchor=document.createElement('a');
    anchor.href=url;anchor.download=`minh-hoa-${tab}-${range.from}-${range.to}.csv`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  render();
}
