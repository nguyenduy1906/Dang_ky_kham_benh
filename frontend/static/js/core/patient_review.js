export function reviewChoices(rows,doctorId){
 return rows.filter(row=>row.encounter_status==='COMPLETED'&&String(row.doctor_profile_id)===String(doctorId))
  .sort((a,b)=>String(b.estimated_exam_at||b.work_date).localeCompare(String(a.estimated_exam_at||a.work_date))||b.encounter_id-a.encounter_id);
}
export function selectedReview(rows,id,doctorId){
 const row=reviewChoices(rows,doctorId).find(row=>String(row.encounter_id)===String(id));
 if(!row)throw new Error('Vui lòng chọn đúng lượt khám đã hoàn thành để đánh giá.');
 return row;
}
