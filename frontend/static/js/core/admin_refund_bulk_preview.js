import {esc,date,money,today,table} from './admin_ui.js';
import {openAdminFormDialog} from './admin_form_dialog.js';
import {code} from './business_codes.js';

export function bulkRefundMarkup() {
  return `<section class="admin-refund-bulk" data-refund-bulk>
    <section class="admin-payment-section"><h3>Chọn giao dịch cần hoàn</h3>
      <p class="admin-refund-preview-note">Bản xem trước giao diện · Dữ liệu minh họa, chưa kết nối tra cứu hoặc thực hiện hoàn tiền.</p>
      <div class="admin-payment-fields">
        <label>Phòng khám<select name="bulk_room"><option value="">Tất cả phòng khám</option><option value="103">Phòng Nội 103 — minh họa</option><option value="201">Phòng Tim mạch 201 — minh họa</option><option value="202">Phòng Da liễu 202 — minh họa</option></select></label>
        <label>Ngày khám<input type="date" name="bulk_date"></label>
        <label>Ca khám<select name="bulk_period"><option value="">Tất cả ca khám</option><option value="MORNING">Buổi sáng · 08:00 – 11:30</option><option value="AFTERNOON">Buổi chiều · 13:30 – 16:30</option></select></label>
        <label>Tìm người bệnh / giao dịch<input type="search" name="bulk_query" placeholder="Tên người bệnh, mã lượt khám hoặc mã thanh toán"></label>
      </div>
      <p class="admin-refund-filter-note">Tìm bằng tên hoặc mã để chọn một giao dịch; lọc thêm phòng, ngày và ca khám khi cần chọn cả nhóm. Danh sách tự cập nhật theo các điều kiện đã nhập.</p>
      <p data-bulk-status class="admin-refund-status" role="status">Nhập tìm kiếm hoặc chọn bộ lọc để hiển thị danh sách phù hợp.</p>
    </section>
    <section class="admin-payment-section"><div class="admin-refund-selection-heading"><h3>Danh sách giao dịch phù hợp</h3><span data-bulk-count>Đã chọn 0 giao dịch</span></div>
      <div data-bulk-results><p class="admin-refund-status">Chưa có điều kiện tìm kiếm. Nhập tên, mã hoặc chọn phòng / ca khám để bắt đầu.</p></div>
    </section>
    <section class="admin-payment-section"><h3>Nội dung yêu cầu hoàn tiền</h3><div class="admin-payment-fields">
      <label>Nhóm lý do<select name="bulk_reason_group"><option>Yêu cầu từ người bệnh</option><option>Phòng / ca khám bị hủy</option><option>Bác sĩ ngừng khám</option><option>Thay đổi lịch từ cơ sở khám</option><option>Khác</option></select></label>
      <label class="admin-refund-reason">Lý do hoàn tiền<textarea name="bulk_reason" rows="3" maxlength="900" placeholder="Nhập lý do áp dụng cho giao dịch hoặc nhóm giao dịch đã chọn"></textarea></label>
    </div></section>
    <p class="admin-refund-status" data-bulk-feedback role="status" aria-live="polite" hidden></p>
    <div class="admin-refund-bulk-actions"><span data-bulk-total>Chưa chọn giao dịch</span><div class="actions"><button type="button" data-bulk-confirm disabled>Xác nhận hoàn tiền</button><button type="button" class="secondary" data-bulk-close>Đóng</button></div></div>
  </section>`;
}
const normalized=value=>String(value).normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[đĐ]/g,'d').toLowerCase();
// Fixtures are scoped to this presentation section; never passed to the payment API.
function previewRows(room,day,period) {
  const offset=['103','201','202'].indexOf(room)*12+(period==='AFTERNOON'?6:0);
  return Array.from({length:6},(_,i)=>({id:`MINHHOA-${room}-${period}-${i+1}`,name:`Người bệnh minh họa ${String(offset+i+1).padStart(2,'0')}`,payment:`TT_MH${String(offset+i+1).padStart(3,'0')}`,encounter:`LK_MH${String(offset+i+1).padStart(3,'0')}`,amount:180000,room,day,period,time:`${String((period==='MORNING'?8:13)+Math.floor((30+i*10)/60)).padStart(2,'0')}:${String((30+i*10)%60).padStart(2,'0')}`}));
}
export function bindBulkRefundPreview(form,close) {
  const bulk=form.querySelector('[data-refund-bulk]');
  const fields=form.elements,selected=new Set();let rows=[],searched=false;
  const results=bulk.querySelector('[data-bulk-results]'),status=bulk.querySelector('[data-bulk-status]'),feedback=bulk.querySelector('[data-bulk-feedback]'),confirmButton=bulk.querySelector('[data-bulk-confirm]');
  const chosen=()=>rows.filter(row=>selected.has(row.id));
  function count() {
    const picked=chosen();bulk.querySelector('[data-bulk-count]').textContent=`Đã chọn ${picked.length} / ${rows.length} giao dịch`;
    bulk.querySelector('[data-bulk-total]').textContent=picked.length?`Đã thu: ${money(picked.reduce((n,row)=>n+row.amount,0))} · Số hoàn sẽ được xác định sau`:'Chưa chọn giao dịch';
    confirmButton.disabled=!picked.length;
    const all=results.querySelector('[data-bulk-all]');if(all){all.checked=rows.length>0&&picked.length===rows.length;all.indeterminate=picked.length>0&&picked.length<rows.length;}
    feedback.hidden=true;
  }
  function search() {
    selected.clear();feedback.hidden=true;
    const query=normalized(fields.bulk_query.value.trim());
    if(!query&&!fields.bulk_room.value&&!fields.bulk_date.value&&!fields.bulk_period.value){
      status.textContent='Nhập tìm kiếm hoặc chọn bộ lọc để hiển thị danh sách phù hợp.';status.dataset.error='false';rows=[];searched=false;results.innerHTML='<p class="admin-refund-status">Chưa có điều kiện tìm kiếm.</p>';count();return;
    }
    const rooms=fields.bulk_room.value?[fields.bulk_room.value]:['103','201','202'];
    const periods=fields.bulk_period.value?[fields.bulk_period.value]:['MORNING','AFTERNOON'];
    rows=rooms.flatMap(room=>periods.flatMap(period=>previewRows(room,fields.bulk_date.value||today(),period))).filter(row=>!query||normalized(`${row.name} ${row.payment} ${row.encounter}`).includes(query));searched=true;
    const room=fields.bulk_room.selectedOptions[0].textContent,period=fields.bulk_period.selectedOptions[0].textContent;
    status.dataset.error='false';status.textContent=`${room} · ${fields.bulk_date.value?date(fields.bulk_date.value):'Tất cả ngày'} · ${period} · ${rows.length} giao dịch minh họa phù hợp.`;
    results.innerHTML=rows.length?table(['Chọn','Người bệnh / lượt khám','Phòng / ngày khám','Giờ hẹn','Giao dịch / số đã thu','Trạng thái'],rows.map(row=>[
      `<input type="checkbox" data-bulk-row="${esc(row.id)}" aria-label="Chọn ${esc(row.name)}">`,
      `<strong>${esc(row.name)}</strong><small>${esc(row.encounter)}</small>`,`${esc([...fields.bulk_room.options].find(option=>option.value===row.room)?.textContent)}<small>${date(row.day)} · ${row.period==='MORNING'?'Sáng':'Chiều'}</small>`,esc(row.time),`${esc(row.payment)}<small>${money(row.amount)}</small>`,'<span class="badge amber">Đã hủy</span><small>Phòng ngừng khám · Minh họa</small>'
    ]),'Danh sách giao dịch minh họa phù hợp bộ lọc').replace('<th scope="col">Chọn</th>','<th scope="col"><label class="admin-refund-check-all"><input type="checkbox" data-bulk-all aria-label="Chọn tất cả giao dịch trong danh sách đã lọc"> Chọn tất cả</label></th>'):'<p class="admin-refund-status">Không có giao dịch phù hợp với các điều kiện đã nhập.</p>';
    count();
  }
  for(const name of ['bulk_room','bulk_date','bulk_period'])fields[name].addEventListener('change',search);
  fields.bulk_date.addEventListener('input',search);
  fields.bulk_query.addEventListener('input',search);
  fields.bulk_query.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();search();}});
  results.addEventListener('change',event=>{
    if(!searched)return;
    if(event.target.matches('[data-bulk-all]')){rows.forEach(row=>event.target.checked?selected.add(row.id):selected.delete(row.id));results.querySelectorAll('[data-bulk-row]').forEach(node=>node.checked=event.target.checked);}
    else if(event.target.matches('[data-bulk-row]'))event.target.checked?selected.add(event.target.dataset.bulkRow):selected.delete(event.target.dataset.bulkRow);
    count();
  });
  confirmButton.addEventListener('click',()=>{
    if(!chosen().length)return;
    feedback.textContent='Chức năng xác nhận hoàn tiền hiện chỉ có giao diện, chưa kết nối API. Chưa có giao dịch nào được hoàn tiền.';
    feedback.hidden=false;
  });
  for(const name of ['bulk_reason','bulk_reason_group'])fields[name].addEventListener('input',()=>{feedback.hidden=true;});
  bulk.querySelector('[data-bulk-close]').addEventListener('click',close);
}

export async function openUnifiedRefundRequest({ctx,paymentId=null,trigger,onClose=()=>{}}) {
  const opened=openAdminFormDialog({title:'Yêu cầu hoàn tiền',trigger,onClose});
  opened.content.innerHTML=`<form class="admin-refund-request" autocomplete="off">${bulkRefundMarkup()}</form>`;
  const form=opened.content.querySelector('form');
  form.addEventListener('submit',event=>event.preventDefault());
  bindBulkRefundPreview(form,opened.close);
  if(paymentId){
    form.elements.bulk_query.value=code('TT',paymentId);
    form.elements.bulk_query.dispatchEvent(new Event('input',{bubbles:true}));
    form.querySelector('[data-bulk-status]').textContent=`Đang xem trước bộ lọc theo ${code('TT',paymentId)}. Chưa kết nối dữ liệu giao dịch thực tế.`;
  }
  if(!ctx.active)opened.close();
  return opened;
}
