import {encounterDailyChart} from "./admin_encounter_chart.js";
import {esc,date,money,label,metrics,table,badge} from './admin_ui.js';
import {reportStatuses,encounterGroup,capacityGroup,percent} from './admin_statistics_data.js';
export const statisticsTabs=[['overview','Tổng hợp'],['encounters','Lượt khám'],['departments','Chuyên khoa'],['doctors','Bác sĩ'],['payments','Thanh toán'],['capacity','Công suất'],['reviews','Đánh giá']];
const number=value=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1}).format(Number(value||0));
const average=value=>value==null?'—':`${number(value)} / 5`;
const card=(title,content,note='')=>`<section class="admin-card statistics-card"><header><h2>${esc(title)}</h2>${note?`<p>${esc(note)}</p>`:''}</header>${content}</section>`;
export const statisticsList=(title,rows,note='')=>card(title,`<dl class="statistics-rows">${rows.length?rows.map(([name,value])=>`<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join(''):'<div><dt>Chưa có dữ liệu phù hợp.</dt><dd>—</dd></div>'}</dl>`,note);
const group=(rows,key)=>[...new Set(rows.map(row=>row[key]))].sort().map(value=>[value,rows.filter(row=>row[key]===value)]);
export function statisticsView(data,tab='overview') {
  const e=encounterGroup(data.encounters),c=capacityGroup(data.shifts),cash=data.cash,r=data.reviews.summary;
  const statusRows=reportStatuses.map(([status,name])=>[name,number(data.encounters.filter(row=>row.encounter_status===status).length)]);
  const departmentRows=data.departments.map(d=>{
    const visits=data.encounters.filter(row=>String(row.department_id)===String(d.department_id));
    const shifts=data.shifts.filter(row=>String(row.department_id)===String(d.department_id));
    const total=encounterGroup(visits),capacity=capacityGroup(shifts);
    return {name:d.name,...total,...capacity,doctors:data.doctors.filter(row=>String(row.department_id)===String(d.department_id)).length,id:d.department_id};
  });
  const doctorRows=data.doctors.map(d=>{
    const visits=data.encounters.filter(row=>String(row.doctor_profile_id)===String(d.doctor_profile_id));
    const shifts=data.shifts.filter(row=>String(row.doctor_profile_id)===String(d.doctor_profile_id));
    return {name:d.full_name,department:data.departments.find(row=>String(row.department_id)===String(d.department_id))?.name||'—',...encounterGroup(visits),...capacityGroup(shifts),rating:data.reviewDoctor.find(row=>String(row.group_value)===String(d.doctor_profile_id))?.average_rating};
  });
  const daily=group(data.encounters,'work_date').reverse().map(([day,rows])=>{const v=encounterGroup(rows);return [date(day),v.total,v.online,v.walkIn,v.completed,v.noShow,v.cancelled];});
  const statusCard=statisticsList('Cơ cấu trạng thái',statusRows,'Số lượt khám theo từng trạng thái');
  const departmentCard=statisticsList('Lượt khám theo chuyên khoa',departmentRows.map(d=>[d.name,number(d.total)]));
  const capacityCard=statisticsList('Tỷ lệ đặt chỗ theo chuyên khoa',departmentRows.map(d=>[d.name,percent(d.booked,d.capacity)]),'Số chỗ đã đặt / sức chứa ca đang mở hoặc đã đầy');
  const dailyCard=statisticsList('Lượt khám theo ngày',daily.map(row=>[row[0],number(row[1])]),'Tổng lượt khám trong kỳ báo cáo');
  const metricsFor=entries=>metrics(entries.map(([name,value,note])=>[name,value,note]));
  const fourVisits=()=>metricsFor([['Lượt khám trong kỳ',number(e.total),'Theo ngày ca khám'],['Trực tuyến',number(e.online),'Lượt đặt khám online'],['Trực tiếp',number(e.walkIn),'Lượt tiếp nhận tại quầy'],['Đã hoàn thành',number(e.completed),'Lượt khám hoàn tất']]);
  let summary,panels,columns,rows,title;
  if(tab==='overview') {
    summary=metricsFor([['Tổng lượt theo lịch',number(e.total),'Trực tuyến và trực tiếp'],['Đã hoàn thành',number(e.completed),'Lượt khám hoàn tất'],['Không đến',number(e.noShow),'Lượt được ghi nhận không đến'],['Thu ròng ghi nhận',money(cash.net_received),'Thu thành công trừ hoàn tiền']]);
    const chartRows=group(data.encounters,'work_date').map(([day,rows])=>({group_value:day,online_count:rows.filter(row=>row.encounter_type==='ONLINE').length,walk_in_count:rows.filter(row=>row.encounter_type==='WALK_IN').length}));
    const chart=encounterDailyChart(chartRows,data.range,{showRange:false,title:'Lượt khám theo ngày'});
    panels=[`<div class="statistics-overview-chart">${chart}</div>`,statusCard,departmentCard.replace('statistics-card','statistics-card statistics-departments')];
  } else if(tab==='encounters') {
    summary=fourVisits();panels=[];title='Danh sách tổng hợp theo ngày';columns=['Ngày khám','Tổng lượt','Trực tuyến','Trực tiếp','Hoàn thành','Không đến','Đã hủy'];rows=daily;
  } else if(tab==='departments') {
    summary=metricsFor([['Chuyên khoa trong bộ lọc',number(data.departments.length),'Các chuyên khoa được chọn'],['Bác sĩ trong bộ lọc',number(data.doctors.length),'Theo chuyên khoa'],['Tổng lượt khám',number(e.total),'Theo ngày ca khám'],['Đã hoàn thành',number(e.completed),'Lượt khám hoàn tất']]);
    panels=[];title='Bảng thống kê chuyên khoa';columns=['Chuyên khoa','Bác sĩ','Tổng lượt','Hoàn thành','Không đến','Đã đặt / sức chứa'];rows=departmentRows.map(d=>[d.name,d.doctors,d.total,d.completed,d.noShow,`${d.booked} / ${d.capacity}`]);
  } else if(tab==='doctors') {
    summary=metricsFor([['Bác sĩ trong bộ lọc',number(data.doctors.length),'Bao gồm bác sĩ chưa có lịch'],['Ca làm việc',number(data.shifts.length),'Theo khoảng ngày đã chọn'],['Tổng lượt khám',number(e.total),'Theo ngày ca khám'],['Đã hoàn thành',number(e.completed),'Lượt khám hoàn tất']]);
    panels=[];
    title='Báo cáo bác sĩ';columns=['Bác sĩ','Chuyên khoa','Ca làm việc','Lượt khám','Hoàn thành','Đã đặt / sức chứa'];rows=doctorRows.map(d=>[d.name,d.department,d.shifts,d.total,d.completed,`${d.booked} / ${d.capacity}`]);
  } else if(tab==='payments') {
    summary=metricsFor([['Thu thành công',money(cash.gross_received),'Tiền cọc và phí khám'],['Hoàn tiền thành công',money(cash.refunded_amount),'Số tiền đã hoàn thực tế'],['Thu ròng',money(cash.net_received),'Thu thành công trừ hoàn tiền'],['Chờ thanh toán',number(data.payments.filter(p=>p.transaction_status==='PENDING').length),'Giao dịch đang chờ xử lý']]);
    panels=[statisticsList('Cơ cấu giao dịch',[['Tiền đặt cọc',money(cash.deposit_received)],['Phí khám',money(cash.exam_fee_received)],['Hoàn tiền',money(cash.refunded_amount)],['Thu ròng',money(cash.net_received)]]),statisticsList('Trạng thái giao dịch',['SUCCESS','PENDING','FAILED','REFUNDED'].map(status=>[status==='PENDING'?'Chờ thanh toán':label(status),number(data.payments.filter(p=>p.transaction_status===status).length)]))];
    title='Giao dịch trong kỳ';columns=['Mã giao dịch','Ngày giao dịch','Loại','Trạng thái','Số tiền'];rows=data.payments.map(p=>[`TT_${String(p.payment_id).padStart(3,'0')}`,date(p.paid_at||p.created_at),label(p.payment_type),p.transaction_status==='PENDING'?'Chờ thanh toán':label(p.transaction_status),money(p.amount)]);
  } else if(tab==='capacity') {
    summary=metricsFor([['Tổng ca làm việc',number(data.shifts.length),'Theo khoảng ngày đã chọn'],['Tổng sức chứa',number(c.capacity),'Ca đang mở hoặc đã đầy'],['Chỗ đã đặt',number(c.booked),'Theo các ca được tính sức chứa'],['Ca kín chỗ',number(c.full),'Đã đạt sức chứa tối đa']]);
    panels=[statisticsList('Tình trạng công suất',[['Tỷ lệ đặt chỗ',percent(c.booked,c.capacity)],['Chỗ còn trống',number(Math.max(0,c.capacity-c.booked))],['Ca đang mở hoặc đã đầy',number(c.open)],['Ca đã đóng hoặc báo nghỉ',number(data.shifts.length-c.open)]]).replace('statistics-card','statistics-card statistics-capacity-summary'),capacityCard.replace('statistics-card','statistics-card statistics-capacity-departments')];
    title='Các ca làm việc';columns=['Ngày','Bác sĩ','Phòng','Giờ khám','Đã đặt / Sức chứa','Tỷ lệ','Trạng thái'];rows=data.shifts.map(s=>[date(s.work_date),s.doctor_name,s.room_name,`${s.start_time.slice(0,5)} – ${s.end_time.slice(0,5)}`,`${s.booked_count} / ${s.max_quota}`,['OPEN','FULL'].includes(s.schedule_status)?percent(s.booked_count,s.max_quota):'—',label(s.schedule_status)]);
  } else {
    const countStars=star=>Number(data.reviews.rating_distribution.find(row=>Number(row.rating)===star)?.count||0);
    summary=metricsFor([['Tổng đánh giá',number(r.review_count),'Đánh giá trong kỳ'],['Điểm trung bình',average(r.average_rating),'Trên thang điểm 5'],['Đánh giá 5 sao',number(countStars(5)),'Phản hồi ở mức cao nhất'],['Đánh giá 1–2 sao',number(countStars(1)+countStars(2)),'Phản hồi cần quan tâm']]);
    panels=[card('Đánh giá theo chuyên khoa',table(['Chuyên khoa','Số đánh giá','Điểm trung bình'],data.departments.map(d=>{const v=data.reviewDepartment.find(row=>String(row.group_value)===String(d.department_id));return [esc(d.name),number(v?.review_count),average(v?.average_rating)];}),'Đánh giá theo chuyên khoa')).replace('statistics-card','statistics-card statistics-review-departments'),statisticsList('Phân bố số sao',[5,4,3,2,1].map(star=>[`${star} sao`,number(countStars(star))]))];
    title='Tổng hợp đánh giá theo ngày';columns=['Ngày đánh giá','Số đánh giá','Điểm trung bình'];rows=[...data.reviews.items].reverse().map(row=>[date(row.group_value),row.review_count,average(row.average_rating)]);
  }
  return {summary,panels,scrollTable:['encounters','departments','doctors','payments','capacity','reviews'].includes(tab),paymentTags:tab==='payments'?data.payments.map(p=>[p.payment_type,p.transaction_status]):[],capacityStatuses:tab==='capacity'?data.shifts.map(s=>s.schedule_status):[],tab,layout:tab==='overview'?'statistics-grid-overview':tab==='capacity'?'statistics-grid-capacity':tab==='reviews'?'statistics-grid-reviews':'',columns:columns||[],rows:rows||[],title:title||'',exportRows:[['Số liệu tổng hợp'],...summaryToRows(summary),...panels.flatMap((panel,index)=>tab==='overview'&&index===0?[["Lượt khám theo ngày"],["Ngày","Trực tuyến","Trực tiếp"],...group(data.encounters,'work_date').map(([day,visits])=>[date(day),visits.filter(row=>row.encounter_type==='ONLINE').length,visits.filter(row=>row.encounter_type==='WALK_IN').length])]:panelToRows(panel)),...(columns?[[title],columns,...rows]:[])]};
}
// Export receives the same visible content as the active report, without HTML.
function panelToRows(markup) {
  // Parsing takes place in the browser only when generating a report.
  if(typeof document==='undefined')return [];
  const holder=document.createElement('div');holder.innerHTML=markup;
  return [[holder.querySelector('h2')?.textContent||''],...[...holder.querySelectorAll('dl > div, tr')].map(row=>[...row.children].map(cell=>cell.textContent.trim()))];
}
function summaryToRows(markup) {
  if(typeof document==='undefined')return [];
  const holder=document.createElement('div');holder.innerHTML=markup;
  return [...holder.querySelectorAll('article')].map(row=>[row.querySelector('span')?.textContent,row.querySelector('strong')?.textContent]);
}
export function statisticsReportMarkup(view,page=1) {
  const size=10,pages=Math.max(1,Math.ceil(view.rows.length/size));
  if(view.scrollTable) {
    const detailRows=view.rows.map((row,index)=>row.map((value,column)=>{
      if(view.tab==='capacity'&&column===6)return badge(view.capacityStatuses[index]);
      if(view.tab!=='payments'||![2,3].includes(column))return esc(value);
      const raw=view.paymentTags[index]?.[column-2];
      const tone=column===2?({DEPOSIT:'blue',EXAM_FEE:'green',REFUND:'purple'}[raw]||'blue'):({SUCCESS:'green',PENDING:'amber',FAILED:'red',REFUNDED:'purple'}[raw]||'blue');
      return `<span class="badge ${tone} statistics-payment-badge">${esc(value)}</span>`;
    }));
    const detail=card(view.title,table(view.columns,detailRows,view.title)+`<div class="statistics-row-count">${view.rows.length} bản ghi</div>`);
    return `${view.summary}${view.panels.length?`<div class="statistics-grid ${view.layout||''}">${view.panels.join('')}</div>`:''}<div class="statistics-scroll-report statistics-report-${view.tab} ${view.tab==='capacity'?'statistics-detail-capacity':''}">${detail}</div>`;
  }
  const detail=view.columns.length?`<div class="statistics-detail-${view.tab}">`+card(view.title,table(view.columns,view.rows.slice((page-1)*size,page*size).map((row,index)=>row.map((value,column)=>view.tab==='capacity'&&column===6?badge(view.capacityStatuses[(page-1)*size+index]):esc(value))),view.title)+`<div class="admin-pagination"><span>${view.rows.length} bản ghi · Trang ${page} / ${pages}</span><div><button type="button" class="secondary" data-report-page="-1" ${page<=1?'disabled':''}>Trang trước</button><button type="button" class="secondary" data-report-page="1" ${page>=pages?'disabled':''}>Trang sau</button></div></div>`)+ '</div>':'';
  return `${view.summary}<div class="statistics-grid ${view.layout||''}">${view.panels.join('')}</div>${detail}`;
}
