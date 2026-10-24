import * as api from '../api/reception_assignment.js';

export const receptionPeriods={MORNING:['08:00','11:30'],AFTERNOON:['13:30','17:00']};
export function receptionShiftRows(from,to,period,weekdays,now=Date.now()) {
  const valid=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  if(!valid(from)||!valid(to)||to<from||(Date.parse(to)-Date.parse(from))/86400000>30)throw new Error('Chọn khoảng ngày hợp lệ, tối đa 31 ngày.');
  if(!['FULL_DAY','MORNING','AFTERNOON'].includes(period))throw new Error('Chọn ca làm việc hợp lệ.');
  const result=[];
  for(let stamp=Date.parse(from);stamp<=Date.parse(to);stamp+=86400000){
    const date=new Date(stamp),day=date.toISOString().slice(0,10);
    if(!weekdays.includes(date.getUTCDay()))continue;
    for(const [kind,[start,end]] of Object.entries(receptionPeriods)){
      if(period!=='FULL_DAY'&&period!==kind)continue;
      result.push({key:`${day}:${kind}`,work_date:day,start_time:start,end_time:end,period:kind,
        past:Date.parse(`${day}T${start}:00+07:00`)<=now});
    }
  }
  return result;
}
export function receptionShiftBlocked(row,staff,station,assignments=[],leaves=[]) {
  if(!staff||!station)return 'Chọn lễ tân và khu vực';
  if(row.past)return 'Ca đã bắt đầu';
  if(assignments.some(a=>!a.revoked_at&&a.work_date===row.work_date&&String(a.start_time).slice(0,5)<row.end_time&&String(a.end_time).slice(0,5)>row.start_time&&String(a.receptionist_id)===String(staff.user_id)))return 'Lễ tân đã có ca trùng giờ';
  const weekday=new Date(`${row.work_date}T00:00:00Z`).getUTCDay();
  if(weekday!==0&&weekday!==6&&leaves.some(l=>l.status==='APPROVED'&&l.from_date<=row.work_date&&l.to_date>=row.work_date&&(l.period==='FULL_DAY'||l.period===row.period)))return 'Đã được duyệt nghỉ';
  return '';
}
export async function saveReceptionAssignmentBatch(staff,station,rows,note,options={}) {
  if(!staff||!station||!rows.length||rows.length>62)throw new Error('Chọn lễ tân, khu vực và ít nhất một ca.');
  const shifts=rows.map(({work_date,start_time,end_time})=>({work_date,start_time,end_time}));
  const result=await api.createReceptionAssignments({receptionist_id:Number(staff.user_id),...(station.workstation_id?{workstation_id:Number(station.workstation_id)}:{area_name:String(station.area_name).trim()}),shifts,note:String(note||'').trim()||null},options);
  if(!Array.isArray(result.items)||result.items.length!==shifts.length||new Set(result.items.map(r=>r.assignment_id)).size!==shifts.length||shifts.some(s=>!result.items.some(r=>Number(r.assignment_id)>0&&String(r.receptionist_id)===String(staff.user_id)&&(station.workstation_id?String(r.workstation_id)===String(station.workstation_id):String(r.workstation_name).normalize('NFC').toLocaleLowerCase('vi')===String(station.area_name).trim().normalize('NFC').toLocaleLowerCase('vi'))&&r.work_date===s.work_date&&String(r.start_time).slice(0,5)===s.start_time&&String(r.end_time).slice(0,5)===s.end_time)))throw new Error('Phản hồi chưa khớp phân công đã gửi. Tải lại danh sách để kiểm tra trước khi thao tác tiếp.');
  return result;
}
