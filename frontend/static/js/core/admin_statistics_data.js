export const reportStatuses=[['HOLDING','Chờ thanh toán'],['CONFIRMED','Đã xác nhận'],['CHECKED_IN','Đã check-in'],['IN_PROGRESS','Đang khám'],['COMPLETED','Hoàn thành'],['CANCELLED','Đã hủy'],['NO_SHOW','Không đến'],['EXPIRED','Hết hạn']];
export function reportRange(preset,day) {
  const end=new Date(`${day}T00:00:00Z`),start=new Date(end);
  if(preset==='30')start.setUTCDate(start.getUTCDate()-29);
  if(preset==='week')start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7));
  if(preset==='month')start.setUTCDate(1);
  return {from:start.toISOString().slice(0,10),to:day};
}
export const sum=(rows,key)=>rows.reduce((total,row)=>total+Number(row[key]||0),0);
export const percent=(a,b)=>b?`${Math.round(Number(a)/Number(b)*100)}%`:'—';
export function encounterGroup(rows) {
  return {total:rows.length,online:rows.filter(r=>r.encounter_type==='ONLINE').length,walkIn:rows.filter(r=>r.encounter_type==='WALK_IN').length,completed:rows.filter(r=>r.encounter_status==='COMPLETED').length,noShow:rows.filter(r=>r.encounter_status==='NO_SHOW').length,cancelled:rows.filter(r=>r.encounter_status==='CANCELLED').length};
}
export function capacityGroup(rows) {
  // Ca đóng hoặc báo nghỉ không cung cấp chỗ đặt khám.
  const usable=rows.filter(r=>['OPEN','FULL'].includes(r.schedule_status));
  return {shifts:rows.length,capacity:sum(usable,'max_quota'),booked:sum(usable,'booked_count'),full:usable.filter(r=>Number(r.max_quota)>0&&Number(r.booked_count)>=Number(r.max_quota)).length,open:usable.length};
}
export function reportCsv(rows) {
  return '\uFEFF'+rows.map(row=>row.map(value=>{
    let cell=String(value??'');
    if(/^[=+@\-\t\r]/.test(cell))cell="'"+cell;
    return '"'+cell.replace(/"/g,'""')+'"';
  }).join(',')).join('\r\n');
}
