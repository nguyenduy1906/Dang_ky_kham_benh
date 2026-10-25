import {getRecord,listPrescriptionItems} from '../api/medical_record.js';
import {allPages} from './booking.js';

// Never mix a diagnosis from one revision with a prescription from another.
export async function readPatientRecord(encounterId,options={}) {
 const {medical_record:record}=await getRecord(encounterId,options);
 if(!record?.record_id||String(record.encounter_id)!==String(encounterId)||!Number.isInteger(record.version))throw new Error('Không xác minh được bệnh án và phiên bản của lượt khám đã chọn.');
 const medications=await allPages(async(params,request)=>{
  const result=await listPrescriptionItems(record.record_id,params,request);
  if(result.record_version!==record.version)throw new Error('Bệnh án vừa thay đổi. Vui lòng tải lại kết quả trước khi xem hoặc xuất hồ sơ.');
  return result;
 },{},options);
 const {medical_record:current}=await getRecord(encounterId,options);
 if(String(current?.record_id)!==String(record.record_id)||String(current?.encounter_id)!==String(encounterId)||current.version!==record.version)throw new Error('Bệnh án vừa thay đổi. Vui lòng tải lại kết quả trước khi xem hoặc xuất hồ sơ.');
 return {record,medications};
}
