import { loadDoctorEncounterRows } from "./doctor_encounter_list.js";
import { getEncounter } from "../api/encounter.js";
import { listPatients, getPatient } from "../api/patient.js";
import { getRecord, listPrescriptionItems, listDoctorPatientHistory, getDoctorPatientHistory } from "../api/medical_record.js";
import { allPages } from "./nurse_encounter_data.js";
import { code } from "./business_codes.js";
import { time } from "./staff_ui.js";

async function clinicalData(id) {
  let record;
  try { record = (await getRecord(id)).medical_record; }
  catch (error) { if (error.code === "MEDICAL_RECORD_NOT_FOUND") return {diagnosis:"",treatment:"",note:"",meds:[],record_id:null,record_version:0}; throw error; }
  const items = await allPages(async params => {
    const result=await listPrescriptionItems(record.record_id,params);
    if(result.record_version !== undefined && result.record_version !== record.version) throw new Error("Bệnh án vừa thay đổi. Vui lòng đọc lại hồ sơ.");
    return result;
  });
  return {record_id:record.record_id,record_version:record.version,diagnosis:record.diagnosis || "",treatment:record.treatment || "",note:record.doctor_notes || "",meds:items.map(m => [m.medication_name,m.dosage || "",String(m.quantity),m.instructions || ""])};
}
export async function loadClinicalProfile(id) {
  const {encounter:e} = await getEncounter(id);
  if (String(e.encounter_id) !== String(id)) throw new Error("Không nhận được đúng lượt khám đã chọn.");
  const [{patient:p}, clinical] = await Promise.all([getPatient(e.patient_id),clinicalData(e.encounter_id)]);
  if (String(p.patient_id) !== String(e.patient_id)) throw new Error("Hồ sơ không thuộc lượt khám đã chọn.");
  const profile = {encounter_id:e.encounter_id,patient_id:e.patient_id,payment_confirmed:e.payment_confirmed,estimated_exam_at:e.estimated_exam_at,id:code("LK",e.encounter_id),patient:code("BN",p.patient_id),name:p.full_name,dob:p.dob,gender:({MALE:"Nam",FEMALE:"Nữ",OTHER:"Khác"})[p.gender] || p.gender,phone:p.phone || "",insurance:p.health_insurance || "Chưa cung cấp",room:e.room_name || "",doctor:e.doctor_name || "",department:e.department_name || "",clock:`${time(e.estimated_exam_at)} – ${time(e.appointment_end_at)}`,symptom:e.symptoms || "",status:e.encounter_status,schedule_status:e.schedule_status,work_date:e.work_date,start_time:e.start_time,end_time:e.end_time,actual:true,...clinical,history:[]};
  try {
    const visits = await allPages(params => listDoctorPatientHistory(e.patient_id,params));
    profile.history = visits.filter(v => String(v.patient_id) === String(p.patient_id) && String(v.encounter_id) !== String(e.encounter_id) && ["COMPLETED","NO_SHOW"].includes(v.encounter_status)).sort((a,b)=>String(b.work_date).localeCompare(String(a.work_date))).map(v => ({id:code("LK",v.encounter_id),ticket:v.ticket_code || "Chưa phát phiếu",day:v.work_date,clock:`${time(v.estimated_exam_at)} – ${time(v.appointment_end_at)}`,doctor:v.doctor_name,room:v.room_name,department:v.department_name,status:v.encounter_status,type:v.encounter_type === "ONLINE" ? "Đặt trực tuyến" : "Khám trực tiếp",symptom:v.symptoms,fee:v.consultation_fee_snapshot,loadClinical: async () => {
      const result=await getDoctorPatientHistory(e.patient_id,v.encounter_id);
      if(String(result.encounter?.patient_id)!==String(e.patient_id)||String(result.encounter?.encounter_id)!==String(v.encounter_id)) throw new Error("Kết quả không thuộc hồ sơ đang xem.");
      const r=result.medical_record;
      return {diagnosis:r?.diagnosis || "",treatment:r?.treatment || "",note:r?.doctor_notes || "",meds:result.items.map(m=>[m.medication_name,m.dosage || "",String(m.quantity),m.instructions || ""])};
    }}));
  } catch { profile.historyError = "Chưa tải được lịch sử khám. Vui lòng tải lại trang để thử lại."; }
  return profile;
}

export async function loadClinicalRows(day) {
  const visits = await loadDoctorEncounterRows({work_date:day});
  if (!visits.length) return [];
  const patients = await allPages(params => listPatients({...params,include_archived:true}));
  const byId = new Map(patients.map(p=>[String(p.patient_id),p]));
  return visits.map(e=>{
    const p=byId.get(String(e.patient_id)) || {};
    return {id:code("LK",e.encounter_id),encounter_id:e.encounter_id,patient_id:e.patient_id,payment_confirmed:e.payment_confirmed,estimated_exam_at:e.estimated_exam_at,patient:code("BN",e.patient_id),name:e.patient_name,phone:p.phone || "",dob:p.dob,gender:p.gender,insurance:p.health_insurance || "",room:e.room_name,doctor:e.doctor_name,department:e.department_name || "",clock:`${time(e.estimated_exam_at)} – ${time(e.appointment_end_at)}`,symptom:e.symptoms || "",status:e.encounter_status,schedule_status:e.schedule_status,work_date:e.work_date,start_time:e.start_time,end_time:e.end_time,actual:true,diagnosis:"",treatment:"",note:"",meds:[],history:[],needsDetail:true};
  });
}
