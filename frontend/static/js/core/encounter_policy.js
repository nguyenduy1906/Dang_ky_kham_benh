export function checkInInstruction(encounter) {
  const policy=encounter.policy_snapshot||{};
  const early=policy.CHECKIN_EARLY_MINUTES??30, late=policy.CHECKIN_LATE_MINUTES??0;
  const deadline=new Date(encounter.estimated_exam_at).getTime()+(late-early)*60000;
  if(!Number.isFinite(deadline))return "Vui lòng kiểm tra giờ hẹn và thời hạn tiếp nhận của lượt khám.";
  const text=new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",dateStyle:"short",timeStyle:"short"}).format(new Date(deadline));
  return `Vui lòng đến làm thủ tục chậm nhất lúc ${text} (giờ Việt Nam).`;
}
