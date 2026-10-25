import {listDoctors} from "../api/doctor.js";
import {listDepartments,listRooms} from "../api/catalog.js";
import {listAdminSchedules,createSchedule} from "../api/schedule.js";
import {allPages} from "./admin_ui.js";
import {code} from "./business_codes.js";

export async function readScheduleChoices(signal) {
  const [doctorRows,roomResult,departmentResult]=await Promise.all([allPages(listDoctors,{include_inactive:true},signal),listRooms({include_inactive:true},{signal}),listDepartments({},{signal})]);
  const departments=departmentResult.items.filter(row=>row.is_active);
  const active=new Set(departments.map(row=>Number(row.department_id)));
  const doctors=doctorRows.filter(row=>row.is_active&&row.account_ok&&active.has(Number(row.department_id))).map(row=>({...row,choice:`${row.full_name} (${code("BS",row.doctor_profile_id)})`}));
  const rooms=roomResult.items.filter(row=>row.is_active&&active.has(Number(row.department_id))).map(row=>({...row,choice:`${row.room_name} (${code("PH",row.room_id)})`}));
  return {doctors,rooms,suggestions:[...departments.map(row=>({department_id:row.department_id,department_name:row.name})),...doctors.map(row=>({department_id:row.department_id,doctor_name:row.choice})),...rooms.map(row=>({department_id:row.department_id,room_name:row.choice}))]};
}

export function resolveScheduleDraft(rows,choices,department="") {
  return rows.map(row=>{
    const doctor=choices.doctors.find(item=>item.choice===row.doctor&&(!department||String(item.department_id)===String(department)));
    const room=choices.rooms.find(item=>item.choice===row.room&&(!department||String(item.department_id)===String(department)));
    if(!doctor||!room)throw new Error("Chọn đúng bác sĩ và phòng khám từ danh sách gợi ý.");
    const minutes=value=>{const [h,m]=value.split(":").map(Number);return h*60+m;};
    const maxQuota=Math.floor((minutes(row.end)-minutes(row.start))/Number(row.minutes));
    if(!Number.isInteger(maxQuota)||maxQuota<1||maxQuota>1000)throw new Error("Thời lượng ca không hợp lệ.");
    return {...row,payload:{doctor_profile_id:doctor.doctor_profile_id,room_id:room.room_id,work_date:row.date,start_time:row.start,end_time:row.end,slot_minutes:Number(row.minutes),max_quota:maxQuota}};
  });
}

export const scheduleIdentity=row=>[row.doctor_profile_id,row.room_id,row.work_date,String(row.start_time).slice(0,5),String(row.end_time).slice(0,5)].join("|");
export const scheduleOverlaps=(a,b)=>a.work_date===b.work_date&&String(a.start_time).slice(0,5)<String(b.end_time).slice(0,5)&&String(b.start_time).slice(0,5)<String(a.end_time).slice(0,5)&&(Number(a.doctor_profile_id)===Number(b.doctor_profile_id)||Number(a.room_id)===Number(b.room_id));
const conflictMessage=(row,conflict)=>Number(conflict.doctor_profile_id)===Number(row.doctor_profile_id)?"Bác sĩ đã có ca làm việc trùng thời gian này, không thể phân công thêm.":"Phòng khám đã có ca trùng thời gian này.";

export async function readScheduleConflicts(rows,signal) {
  const conflicts=new Map();if(!rows.length)return conflicts;
  const batchId=crypto.randomUUID();
  const days=rows.map(row=>row.payload.work_date).sort();
  const existing=await allPages(listAdminSchedules,{from_date:days[0],to_date:days.at(-1)},signal);
  for(const row of rows) {
    const conflict=existing.find(item=>scheduleOverlaps(row.payload,item));
    if(conflict)conflicts.set(scheduleIdentity(row.payload),{blocked:true,message:conflictMessage(row.payload,conflict)});
  }
  return conflicts;
}

// Successful or uncertain writes are never submitted again within this editor.
export async function createScheduleBatch(rows,{signal,isActive=()=>true,outcomes=new Map(),onResult=()=>{}}={}) {
  if(!rows.length||signal?.aborted||!isActive()||[...outcomes.values()].some(result=>result.uncertain))return [];
  const batchId=crypto.randomUUID();
  const days=rows.map(row=>row.payload.work_date).sort();
  const existing=await allPages(listAdminSchedules,{from_date:days[0],to_date:days.at(-1)},signal);
  const results=[];
  for(const row of rows) {
    if(signal?.aborted||!isActive())break;
    const identity=scheduleIdentity(row.payload);
    const previous=outcomes.get(identity);
    if(previous?.success||previous?.uncertain||previous?.blocked)continue;
    let result;
    const conflict=existing.find(item=>scheduleOverlaps(row.payload,item));
    if(conflict)result={row,success:false,blocked:true,message:conflictMessage(row.payload,conflict)};
    else {
      try {
        const response=await createSchedule(row.payload,{signal,headers:rows.length>1?{"X-Assignment-Batch":batchId}:{}});
        if(!Number.isSafeInteger(response?.schedule?.schedule_id)||response.schedule.schedule_id<1)throw new Error("Máy chủ chưa xác nhận mã ca vừa tạo.");
        result={row,success:true,schedule:response.schedule,message:"Đã tạo ca"};
        existing.push(row.payload);
      }catch(error){
        const uncertain=!error.status||error.status>=500;
        result={row,success:false,uncertain,blocked:[400,409,422].includes(error.status),error,stop:uncertain||error.status===401||error.status===403||error.status===429,message:uncertain?"Chưa xác định kết quả tạo ca. Đóng và mở lại danh sách để kiểm tra trước khi tạo tiếp.":error.message};
      }
    }
    outcomes.set(identity,result);results.push(result);onResult(result);
    if(result.stop)break;
  }
  return results;
}
