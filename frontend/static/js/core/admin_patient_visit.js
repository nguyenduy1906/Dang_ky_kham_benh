import {getEncounter} from "../api/encounter.js";
import {getRecord,listPrescriptionItems} from "../api/medical_record.js";
import {getEncounterAudit} from "../api/statistics.js";
import {esc,table,date,stamp,facts,panel,label,money,allPages,button} from "./admin_ui.js";
import {code} from "./business_codes.js";
import {encounterDetails} from "./admin_encounter_detail.js";
import {paymentMethodLabel,paymentStatusBadge} from "./admin_payment_view.js";

export function patientVisitStatus(status) {
  const known=["HOLDING","CONFIRMED","CHECKED_IN","IN_PROGRESS","COMPLETED","CANCELLED","NO_SHOW","EXPIRED"];
  return `<span class="badge patient-visit-status ${known.includes(status)?`visit-${status.toLowerCase()}`:"visit-unknown"}">${esc(label(status))}</span>`;
}

export function patientHistoryTable(rows) {
  return table(["Mã lượt","Ngày","Bác sĩ","Phòng","Trạng thái","Hồ sơ"],rows.map(row=>[
    esc(code("LK",row.encounter_id)),date(row.work_date),esc(row.doctor_name),esc(row.room_name),patientVisitStatus(row.encounter_status),button("patient-visit",row.encounter_id,"Xem hồ sơ"),
  ]),"Lịch sử khám của bệnh nhân");
}

export async function readPatientVisit(encounterId,patientId,{signal}={}) {
  const {encounter}=await getEncounter(encounterId,{signal});
  if(String(encounter.encounter_id)!==String(encounterId)||String(encounter.patient_id)!==String(patientId))throw new Error("Lượt khám không thuộc hồ sơ bệnh nhân đang xem.");
  const [recordResult,auditResult]=await Promise.all([
    getRecord(encounterId,{signal}).catch(error=>{if(error.status===404&&error.code==="MEDICAL_RECORD_NOT_FOUND")return {medical_record:null};throw error;}),
    getEncounterAudit({encounter_id:encounterId,page_size:1},{signal}),
  ]);
  const record=recordResult.medical_record;
  if(record&&String(record.encounter_id)!==String(encounterId))throw new Error("Bệnh án không khớp với lượt khám.");
  const audit=auditResult.items.find(row=>String(row.encounter_id)===String(encounterId));
  if(!audit)throw new Error("Không tải được lịch sử đối soát của lượt khám.");
  const prescriptions=record?await allPages((params,options)=>listPrescriptionItems(record.record_id,params,options),{},signal):[];
  return {encounter,record,prescriptions,audit};
}

export function patientVisitMarkup({encounter:row,record,prescriptions,audit}) {
  const text=(title,value)=>`<section class="patient-visit-text"><h3>${esc(title)}</h3><p>${esc(value||"Chưa ghi nhận")}</p></section>`;
  return `<div class="patient-visit-file">${encounterDetails(row,{showActions:false})}
    ${panel("Thông tin hồ sơ lần khám",facts([["Mã bệnh nhân",code("BN",row.patient_id)],["Mã ca khám",code("CA",row.schedule_id)],["Ngày tạo lượt khám",stamp(row.created_at)],["Tiền cọc đã chốt",money(row.deposit_amount_snapshot)],["Ngày hủy",row.cancelled_at?stamp(row.cancelled_at):"Không có"],["Nguồn hủy",({PATIENT:"Người bệnh",HOSPITAL:"Bệnh viện"})[row.cancel_origin]||"Không có"]]))}
    ${panel("Kết quả khám",record?facts([["Mã bệnh án",code("BA",record.record_id)],["Thời điểm khám",stamp(record.examined_at)],["Phiên bản bệnh án",record.version]])+text("Chẩn đoán",record.diagnosis)+text("Hướng điều trị",record.treatment)+text("Ghi chú bác sĩ",record.doctor_notes):'<p class="patient-visit-note">Lượt khám này chưa có bệnh án được ghi nhận.</p>')}
    ${panel("Đơn thuốc",record?table(["Thuốc","Liều dùng","Số lượng","Hướng dẫn"],prescriptions.map(item=>[esc(item.medication_name),esc(item.dosage),esc(item.quantity),esc(item.instructions||"—")]),"Đơn thuốc của lần khám"):'<p class="patient-visit-note">Chưa có bệnh án để hiển thị đơn thuốc.</p>')}
    ${panel("Giao dịch thanh toán",table(["Mã giao dịch","Loại","Số tiền","Phương thức","Trạng thái","Thời điểm","Lý do / ghi chú"],(audit.payment_history||[]).map(item=>[esc(code("TT",item.payment_id)),esc(label(item.payment_type)),esc(money(item.amount)),esc(paymentMethodLabel(item.payment_method)),paymentStatusBadge(item.transaction_status),esc(stamp(item.paid_at||item.refunded_at||item.created_at)),esc(item.reason||"—")]),"Giao dịch của lần khám"))}
    <p class="patient-visit-note">Lịch sử thanh toán hiển thị tối đa ${esc(audit.history_limit||100)} bản ghi gần nhất. Hồ sơ chỉ dùng để tra cứu.</p>
  </div>`;
}
