export function checkInInstruction(encounter) {
  if(encounter.encounter_type==='WALK_IN')return 'Chỉ xác nhận check-in khi người bệnh đã đến, trong đúng ngày khám và trước khi kết thúc ca.';
  const policy=encounter.policy_snapshot||{};
  const early=policy.CHECKIN_EARLY_MINUTES??30, late=policy.CHECKIN_LATE_MINUTES??0;
  const deadline=new Date(encounter.estimated_exam_at).getTime()+(late-early)*60000;
  if(!Number.isFinite(deadline))return "Vui lòng kiểm tra giờ hẹn và thời hạn tiếp nhận của lượt khám.";
  const text=new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",dateStyle:"short",timeStyle:"short"}).format(new Date(deadline));
  return `Vui lòng đến làm thủ tục chậm nhất lúc ${text} (giờ Việt Nam).`;
}

export function canCheckIn(encounter, now = new Date()) {
  if(encounter.encounter_status!=='CONFIRMED'||!['OPEN','FULL'].includes(encounter.schedule_status))return false;
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  if(encounter.work_date!==day)return false;
  const policy=encounter.policy_snapshot||{};
  const deadline=encounter.encounter_type==='WALK_IN'
    ? Date.parse(`${encounter.work_date}T${encounter.end_time}+07:00`)
    : Date.parse(encounter.estimated_exam_at)+((policy.CHECKIN_LATE_MINUTES??0)-(policy.CHECKIN_EARLY_MINUTES??30))*60000;
  return Number.isFinite(deadline)&&now.getTime()<=deadline;
}
