// Shared alignment rules for staff tables, independent of column positions.
export function tableColumnLayout(title) {
  const text=String(title||'').trim().toLocaleLowerCase('vi').replace(/\s+/g,' ');
  if(/^(thao tác|hành động|chi tiết|xem chi tiết|chọn|chọn hồ sơ)$/.test(text))return 'actions';
  if(/(?:tên|họ tên|nội dung)/.test(text))return 'left';
  if(/^mã(?:\s|$)/.test(text)||/^(stt|id|trạng thái|hình thức|kết quả|vai trò|phê duyệt|ngày|ngày khám|ngày đăng|ngày sinh|thời gian|khung giờ|giờ|ca|buổi|ca khám|ca làm việc|số lượng|số lượt|đã đặt \/ sức chứa|sức chứa|học vị|kinh nghiệm|phí khám|số tiền|tổng tiền)$/.test(text))return 'center';
  return 'left';
}
export function alignStaffTables(root=document) {
  for(const table of root.querySelectorAll('.staff-page table')) {
    const heads=table.tHead?.rows;
    if(!heads?.length)continue;
    const columns=Array.from(heads[heads.length-1].cells);
    if(columns.some(cell=>cell.colSpan>1||cell.rowSpan>1))continue;
    const layouts=columns.map(cell=>tableColumnLayout(cell.textContent));
    for(const row of table.rows) {
      if(row.cells.length!==layouts.length||Array.from(row.cells).some(cell=>cell.colSpan>1))continue;
      Array.from(row.cells).forEach((cell,index)=>{
        for(const kind of ['left','center','actions'])cell.classList.toggle('table-align-'+kind,layouts[index]===kind);
      });
    }
  }
}
if(typeof document!=='undefined'&&typeof MutationObserver!=='undefined') {
  let queued=false;
  const refresh=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;alignStaffTables();});};
  const observer=new MutationObserver(refresh);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  refresh();
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
}
