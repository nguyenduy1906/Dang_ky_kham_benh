const periods = {full:"FULL_DAY", morning:"MORNING", afternoon:"AFTERNOON"};
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "")
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const invalid = (field, message) => { throw Object.assign(new Error(message), {field}); };

export function staffLeavePayload(values, today, now = Date.now()) {
  const {start_date:from, end_date:to} = values;
  if (!validDate(from) || from < today) invalid("start_date", "Chọn ngày bắt đầu từ hôm nay trở đi.");
  if (!validDate(to) || to < from || (Date.parse(to)-Date.parse(from))/86400000 > 30) {
    invalid("end_date", "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu; tối đa 31 ngày.");
  }
  const period = periods[values.period];
  if (!period) invalid("period", "Vui lòng chọn buổi xin nghỉ hợp lệ.");
  // Exact assigned shift times are validated by the server, including weekends.
  const reason = String(values.reason || "").trim(), handover = String(values.handover || "").trim();
  if (!reason) invalid("reason", "Vui lòng nhập lý do xin nghỉ.");
  const text = reason + (handover ? `\n\nGhi chú bàn giao: ${handover}` : "");
  if (text.length > 1000) invalid("handover", "Tổng lý do và ghi chú bàn giao tối đa 1.000 ký tự.");
  return {from_date:from, to_date:to, period, reason:text};
}
