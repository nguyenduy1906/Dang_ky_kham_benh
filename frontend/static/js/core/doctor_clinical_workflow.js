import {getEncounter,startExamination} from "../api/encounter.js";
import {saveAndCompleteEncounter,completeEncounter} from "../api/medical_record.js";
import {canEditClinicalShift,canBeginClinical,canEditClinicalRecord} from "./clinical_shift_access.js";

export function clinicalPayload(data, rows) {
  const diagnosis=String(data.diagnosis || "").trim();
  if (!diagnosis) throw new Error("Vui lòng nhập chẩn đoán.");
  if(diagnosis.length>10000) throw new Error("Chẩn đoán tối đa 10.000 ký tự.");
  if(String(data.treatment || "").length>10000 || String(data.doctor_notes || "").length>10000) throw new Error("Hướng điều trị và ghi chú tối đa 10.000 ký tự mỗi trường.");
  const meds=rows.filter(row=>row.some((value,i)=>i!==2 && String(value || "").trim())).map(row=>{
    const [name,dosage,quantity,instructions]=row.map(v=>String(v ?? "").trim());
    if(!name || name.length>255 || dosage.length>1000 || instructions.length>3000) throw new Error("Kiểm tra tên thuốc, liều dùng và hướng dẫn sử dụng.");
    const count=Number(quantity);
    if(!Number.isInteger(count)||count<1||count>100000) throw new Error("Số lượng thuốc phải là số nguyên từ 1 đến 100.000.");
    return {medication_name:name,dosage:dosage || null,quantity:count,instructions:instructions || null};
  });
  if(meds.length>100) throw new Error("Đơn thuốc tối đa 100 dòng.");
  return {diagnosis,treatment:String(data.treatment || "").trim() || null,doctor_notes:String(data.doctor_notes || "").trim() || null,items:meds};
}
function verifyEncounter(profile,e) {
  if(String(e?.encounter_id)!==String(profile.encounter_id)) throw new Error("Không nhận được đúng lượt khám đang mở.");
}
async function currentEncounter(profile,options) {
  const {encounter}=await getEncounter(profile.encounter_id,options);verifyEncounter(profile,encounter);return encounter;
}
function requireShift(e,now) {
  if(["CLOSED","UNAVAILABLE"].includes(e.schedule_status)) throw new Error("Ca đã đóng hoặc bác sĩ nghỉ.");
  if(e.payment_confirmed!==true) throw new Error("Lượt khám chưa xác nhận thanh toán thành công.");
  if(!canEditClinicalShift(e,now)) throw new Error("Đã ngoài giờ ca làm việc, không thể thực hiện thao tác này.");
}
export async function saveClinicalProfile(profile,payload,options={},now) {
  const e=await currentEncounter(profile,options);
  if(e.encounter_status!=='COMPLETED'){
    requireShift(e,now || new Date());
    if(e.encounter_status!=='IN_PROGRESS')throw new Error('Vui lòng bắt đầu khám trước khi lưu hồ sơ và hoàn tất lượt khám.');
  }else if(profile.status==='COMPLETED')throw new Error('Lượt khám đã hoàn tất, hồ sơ chỉ được xem.');
  const result=await saveAndCompleteEncounter(e.encounter_id,{diagnosis:payload.diagnosis,treatment:payload.treatment,doctor_notes:payload.doctor_notes,items:payload.items,expected_version:profile.record_version ?? 0},options);
  const record=result.medical_record;
  verifyEncounter(profile,result.encounter);
  if(result.encounter.encounter_status!=='COMPLETED'||String(record?.encounter_id)!==String(e.encounter_id)||!record.record_id||!Number.isInteger(record.version)||!record.examined_at||!Array.isArray(result.items))throw new Error('Chưa xác nhận được kết quả lưu và hoàn tất. Nội dung đang nhập được giữ lại; hãy kiểm tra trước khi thử lại.');
  return {...profile,status:'COMPLETED',record_id:record.record_id,record_version:record.version,diagnosis:record.diagnosis,treatment:record.treatment || "",note:record.doctor_notes || "",meds:result.items.map(m=>[m.medication_name,m.dosage || "",String(m.quantity),m.instructions || ""])};
}
export async function finishClinicalProfile(profile,options={},now) {
  const e=await currentEncounter(profile,options);
  if(e.encounter_status==="COMPLETED") return e;
  requireShift(e,now || new Date());
  if(e.encounter_status!=="IN_PROGRESS") throw new Error("Lượt khám không còn ở trạng thái đang khám.");
  const {encounter}=await completeEncounter(e.encounter_id,options);verifyEncounter(profile,encounter);
  if(encounter.encounter_status!=="COMPLETED") throw new Error("Chưa nhận được xác nhận hoàn tất từ hệ thống.");
  return encounter;
}
export async function beginClinicalProfile(profile,options={},now) {
  const e=await currentEncounter(profile,options);requireShift(e,now || new Date());
  if(!canBeginClinical(e,now || new Date())) throw new Error("Chỉ bắt đầu khám lượt đã check-in trong ca đang hoạt động.");
  const {encounter}=await startExamination(e.encounter_id,options);verifyEncounter(profile,encounter);
  if(encounter.encounter_status!=="IN_PROGRESS") throw new Error("Chưa nhận được xác nhận bắt đầu khám.");
  return encounter;
}
