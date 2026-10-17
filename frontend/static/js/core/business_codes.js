// Display references only. API routes, form option values and relations retain numeric IDs.
export const prefixes = Object.freeze({user_id:"TK",patient_id:"BN",doctor_profile_id:"BS",department_id:"CK",room_id:"PH",schedule_id:"CA",encounter_id:"LK",payment_id:"TT",record_id:"BA",article_id:"BV",assignment_id:"PC",request_id:"NP"});
export function code(prefix, id) {
  const value = String(id ?? "");
  return /^[1-9]\d*$/.test(value) ? `${prefix}_${value.padStart(3, "0")}` : "—";
}
export function parseCode(value, prefix) {
  const text = String(value ?? "").trim();
  const match = text.match(new RegExp(`^(?:${prefix}_)?(\\d+)$`, "i"));
  const number = match ? Number(match[1]) : NaN;
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`Mã không hợp lệ. Ví dụ: ${prefix}_001.`);
  return number;
}
export function codeParams(params) {
  return Object.fromEntries(Object.entries(params).map(([key,value]) => [key, prefixes[key] && value !== "" && value != null ? parseCode(value,prefixes[key]) : value]));
}
