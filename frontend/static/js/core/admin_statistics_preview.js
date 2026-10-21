// Dữ liệu trình bày cho giao diện thống kê, không gọi API hoặc ghi dữ liệu hệ thống.
export function statisticsPreview(range) {
  const departments=['Tim mạch','Nội tổng quát','Nhi khoa','Tai Mũi Họng','Da liễu','Cơ xương khớp','Mắt'].map((name,i)=>({department_id:i+1,name}));
  const doctors=['Nguyễn Hồng Phúc','Trần Minh Khang','Lê Thu Trang','Phạm Đức Anh','Đỗ Ngọc Mai','Nguyễn Việt Hoàng'].map((full_name,i)=>({doctor_profile_id:i+1,department_id:i+1,full_name}));
  const day=range.to;
  const span=Math.max(1,Math.min(4,Math.round((new Date(range.to)-new Date(range.from))/86400000)+1));
  const sampleDay=i=>{const value=new Date(`${day}T00:00:00Z`);value.setUTCDate(value.getUTCDate()-i%span);return value.toISOString().slice(0,10);};
  const encounters=Array.from({length:21},(_,i)=>({encounter_id:i+1,department_id:i%6+1,doctor_profile_id:i%6+1,work_date:sampleDay(i),encounter_type:i<15?'ONLINE':'WALK_IN',encounter_status:i<7?'COMPLETED':i<13?'CONFIRMED':i<16?'CHECKED_IN':i<19?'IN_PROGRESS':i===19?'NO_SHOW':'CANCELLED'}));
  const shifts=doctors.flatMap(d=>[0,1].map((offset)=>({schedule_id:d.doctor_profile_id*2+offset,doctor_profile_id:d.doctor_profile_id,department_id:d.department_id,doctor_name:d.full_name,room_name:`Phòng ${100+d.doctor_profile_id}`,work_date:sampleDay(offset),start_time:offset?'13:30':'08:00',end_time:offset?'16:30':'11:30',max_quota:20,booked_count:12+d.doctor_profile_id,schedule_status:'OPEN'})));
  const payments=encounters.map((e,i)=>({payment_id:i+1,department_id:e.department_id,paid_at:sampleDay(i),payment_type:i%2?'EXAM_FEE':'DEPOSIT',transaction_status:i<19?'SUCCESS':'PENDING',amount:180000}));
  const reviews=Array.from({length:7},(_,i)=>({department_id:i%3+1,doctor_profile_id:i%3+1,rating:[5,4,3,5,4,3,5][i]}));
  const chosen=row=>!range.department||String(row.department_id)===String(range.department);
  const selectedReviews=reviews.filter(chosen),selectedPayments=payments.filter(chosen),good=selectedPayments.filter(p=>p.transaction_status==='SUCCESS');
  const groupReview=key=>[...new Set(selectedReviews.map(r=>r[key]))].map(id=>{const rows=selectedReviews.filter(r=>r[key]===id);return {group_value:id,review_count:rows.length,average_rating:rows.reduce((n,r)=>n+r.rating,0)/rows.length};});
  return {range,departments:departments.filter(chosen),doctors:doctors.filter(chosen),encounters:encounters.filter(chosen),shifts:shifts.filter(chosen),payments:selectedPayments,
    cash:{gross_received:good.length*180000,net_received:good.length*180000,refunded_amount:0,deposit_received:good.filter(p=>p.payment_type==='DEPOSIT').length*180000,exam_fee_received:good.filter(p=>p.payment_type==='EXAM_FEE').length*180000},
    reviews:{summary:{review_count:selectedReviews.length,average_rating:selectedReviews.length?selectedReviews.reduce((n,r)=>n+r.rating,0)/selectedReviews.length:null},rating_distribution:[1,2,3,4,5].map(rating=>({rating,count:selectedReviews.filter(r=>r.rating===rating).length})),items:selectedReviews.length?[{group_value:day,review_count:selectedReviews.length,average_rating:selectedReviews.reduce((n,r)=>n+r.rating,0)/selectedReviews.length}]:[]},reviewDepartment:groupReview('department_id'),reviewDoctor:groupReview('doctor_profile_id')};
}
