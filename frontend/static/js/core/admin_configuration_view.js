import {esc,options} from "./admin_ui.js";

const groups=[
  {id:"facility",title:"Thông tin cơ sở",description:"Thông tin giới thiệu và liên hệ hỗ trợ người bệnh.",keys:["HOSPITAL_NAME","SUPPORT_PHONE","SUPPORT_EMAIL","EXAM_HOURS"]},
  {id:"operations",title:"Tiếp nhận và nhắc lịch",description:"Thiết lập tiếp nhận trực tiếp và thời điểm nhắc lịch trong ứng dụng.",keys:["ALLOW_WALK_IN","REMINDER_BEFORE_HOURS"]},
  {id:"booking",title:"Đặt lịch và tiếp nhận",description:"Các mốc thời gian áp dụng trong quy trình khám bệnh.",keys:["APPOINTMENT_HOLD_MINUTES","CHECKIN_EARLY_MINUTES","CHECKIN_LATE_MINUTES","NO_SHOW_GRACE_MINUTES"]},
  {id:"payment",title:"Đặt cọc và hoàn tiền",description:"Chính sách đặt cọc, hủy lịch và không đến khám cho các lượt khám mới.",keys:["DEFAULT_DEPOSIT_PERCENT","CANCEL_HOURS_LIMIT","CANCEL_REFUND_PERCENT","NO_SHOW_FORFEIT_DEPOSIT"]},
];
const metadata={
  HOSPITAL_NAME:["Tên cơ sở","Tên hiển thị trong thông tin liên hệ công khai."],
  SUPPORT_PHONE:["Điện thoại hỗ trợ","Số điện thoại để người bệnh liên hệ khi cần hỗ trợ."],
  SUPPORT_EMAIL:["Email hỗ trợ","Địa chỉ email tiếp nhận liên hệ từ người bệnh."],
  EXAM_HOURS:["Giờ khám","Thông tin giờ khám công khai; ca làm việc được quản lý tại trang Lịch làm việc."],
  ALLOW_WALK_IN:["Tiếp nhận trực tiếp","Cho phép tiếp nhận người bệnh đến khám trực tiếp."],
  REMINDER_BEFORE_HOURS:["Nhắc lịch trước giờ khám","Thời gian nhắc trước lịch khám, từ 1 đến 168 giờ.","giờ"],
  APPOINTMENT_HOLD_MINUTES:["Thời gian giữ chỗ","Thời hạn thanh toán để xác nhận lượt đặt khám trực tuyến.","phút"],
  CHECKIN_EARLY_MINUTES:["Đến trước giờ hẹn","Mốc yêu cầu người bệnh đến tiếp nhận trước giờ hẹn.","phút"],
  CHECKIN_LATE_MINUTES:["Thời gian tiếp nhận muộn","Số phút gia hạn sau mốc đến trước giờ hẹn. Ví dụ: đến trước 30 phút và gia hạn 10 phút thì hạn tiếp nhận là trước giờ hẹn 20 phút.","phút"],
  NO_SHOW_GRACE_MINUTES:["Thời gian chờ sau ca","Thời gian chờ sau khi ca kết thúc trước khi xác định không đến khám.","phút"],
  DEFAULT_DEPOSIT_PERCENT:["Tỷ lệ đặt cọc","Tỷ lệ đặt cọc cho lượt khám mới, từ 1 đến 100%.","%"],
  CANCEL_HOURS_LIMIT:["Mốc hủy lịch được hoàn cọc","Mốc thời gian trước giờ hẹn áp dụng cho trường hợp người bệnh hủy.","giờ"],
  CANCEL_REFUND_PERCENT:["Tỷ lệ hoàn cọc khi đủ điều kiện","Tỷ lệ hoàn cọc khi người bệnh hủy đúng mốc; nguyên nhân bệnh viện áp dụng chính sách riêng.","%"],
  NO_SHOW_FORFEIT_DEPOSIT:["Không hoàn cọc khi không đến","Bật để không hoàn cọc khi vắng mặt; tắt để cho phép admin hoàn toàn bộ cọc sau khi xác định không đến khám."],
  MAX_REVIEW_RATING:["Điểm đánh giá tối đa","Điểm tối đa cho lượt khám mới, từ 1 đến 5 sao; không đổi điểm đã đánh giá.","sao"],
};

const hourNames=["morning_start","morning_end","afternoon_start","afternoon_end"];
export function parseExamHours(value) {
  const match=String(value??"").trim().match(/^Sáng:\s*(\d{2}:\d{2})\s*[–—-]\s*(\d{2}:\d{2})\s*(?:\r?\n|;)\s*Chiều:\s*(\d{2}:\d{2})\s*[–—-]\s*(\d{2}:\d{2})$/i);
  return Object.fromEntries(hourNames.map((name,index)=>[name,match?.[index+1]||""]));
}
export function formatExamHours(hours) {
  if(hourNames.some(name=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(hours[name]||"")))throw new Error("Chọn đầy đủ giờ bắt đầu và kết thúc cho buổi sáng và buổi chiều.");
  if(hours.morning_start>=hours.morning_end||hours.afternoon_start>=hours.afternoon_end)throw new Error("Giờ kết thúc phải sau giờ bắt đầu của từng buổi.");
  if(hours.morning_end>hours.afternoon_start)throw new Error("Giờ kết thúc buổi sáng không được sau giờ bắt đầu buổi chiều.");
  return `Sáng: ${hours.morning_start}–${hours.morning_end}\nChiều: ${hours.afternoon_start}–${hours.afternoon_end}`;
}
export function bindConfigurationHours(root) {
  const form=root.querySelector('[data-exam-hours]');if(!form)return;
  const feedback=form.querySelector('[role="status"]');
  const read=()=>Object.fromEntries(hourNames.map(name=>[name,form.elements[name].value]));
  function validate() {
    try {form.elements.config_value.value=formatExamHours(read());feedback.textContent="";feedback.dataset.error="false";return true;}
    catch(error){feedback.textContent=error.message;feedback.dataset.error="true";return false;}
  }
  form.addEventListener("input",validate);
  form.addEventListener("change",validate);
  form.addEventListener("submit",event=>{if(!validate()){event.preventDefault();event.stopImmediatePropagation();}},true);
}

export function configurationRow(row) {
  const key=row.config_key, [title,description="Thiết lập hệ thống.",unit=""]=metadata[key]||[key];
  const value=row.effective_value??row.config_value, id=`config-${key}`;
  const intro=`<div class="configuration-label"><${row.read_only?"span":"label"}${row.read_only?"":` for="${esc(id)}"`}>${esc(title)}</${row.read_only?"span":"label"}><p id="${esc(id)}-help">${esc(description)}</p></div>`;
  if(row.read_only) {
    const display=value==null?"Chưa có giá trị":value==="true"?"Áp dụng":value==="false"?"Không áp dụng":String(value)+(unit?` ${unit}`:"");
    return `<div class="configuration-row is-readonly">${intro}<div class="configuration-policy-value"><strong>${esc(display)}</strong><span>Chỉ xem</span></div></div>`;
  }
  if(key==="EXAM_HOURS") {
    const hours=parseExamHours(value), parsed=hourNames.every(name=>hours[name]);
    return `<form class="configuration-row configuration-hours-row" data-form="configuration" data-key="EXAM_HOURS" data-exam-hours><div class="configuration-label"><span>Giờ khám</span><p id="config-EXAM_HOURS-help">Chọn giờ bắt đầu và kết thúc cho từng buổi. Đây là giờ khám công khai; ca làm việc được quản lý tại trang Lịch làm việc.</p>${!parsed&&value?`<p class="configuration-hours-existing">Giá trị đang lưu: ${esc(value)}. Chọn đủ bốn mốc giờ để cập nhật.</p>`:""}</div><div class="configuration-hours-editor"><input type="hidden" name="config_value" value="${esc(value)}">${[["morning","Buổi sáng"],["afternoon","Buổi chiều"]].map(([period,title])=>`<fieldset><legend>${title}</legend><div><label>Giờ bắt đầu<input type="time" name="${period}_start" value="${esc(hours[`${period}_start`])}" step="60" aria-describedby="config-EXAM_HOURS-help" required></label><span aria-hidden="true">–</span><label>Giờ kết thúc<input type="time" name="${period}_end" value="${esc(hours[`${period}_end`])}" step="60" aria-describedby="config-EXAM_HOURS-help" required></label></div></fieldset>`).join("")}<button type="submit" class="secondary">Lưu giờ khám</button></div><p class="form-feedback" role="status" aria-live="polite"></p></form>`;
  }
  const limits={APPOINTMENT_HOLD_MINUTES:[1,1440],DEFAULT_DEPOSIT_PERCENT:[1,100],CHECKIN_EARLY_MINUTES:[0,1440],CHECKIN_LATE_MINUTES:[0,1440],NO_SHOW_GRACE_MINUTES:[0,1440],CANCEL_HOURS_LIMIT:[0,8760],CANCEL_REFUND_PERCENT:[0,100],MAX_REVIEW_RATING:[1,5],REMINDER_BEFORE_HOURS:[1,168]};
  const limit=limits[key];
  const attrs=`id="${esc(id)}" name="config_value" aria-describedby="${esc(id)}-help" required`;
  const control=["ALLOW_WALK_IN","NO_SHOW_FORFEIT_DEPOSIT"].includes(key)?`<select ${attrs}>${options(key==="ALLOW_WALK_IN"?[["true","Cho phép"],["false","Tạm dừng"]]:[["true","Không hoàn cọc"],["false","Cho phép hoàn toàn bộ cọc"]],value,"Chọn trạng thái")}</select>`:
    `<input ${attrs} type="${key==="SUPPORT_EMAIL"?"email":key==="SUPPORT_PHONE"?"tel":limit?"number":"text"}" ${limit?`min="${limit[0]}" max="${limit[1]}" step="1"`:`maxlength="${key==="SUPPORT_PHONE"?30:255}"`} value="${esc(value)}">`;
  return `<form class="configuration-row" data-form="configuration" data-key="${esc(key)}">${intro}<div class="configuration-control"><div>${control}${unit?`<span class="configuration-unit">${esc(unit)}</span>`:""}</div><button type="submit" class="secondary">Lưu</button></div><p class="form-feedback" role="status" aria-live="polite"></p></form>`;
}

export function configurationMarkup(rows) {
  rows=rows.filter(row=>row.config_key!=="MAX_REVIEW_RATING");
  if(!rows.length)return '<section class="admin-card configuration-empty"><h2>Chưa có cấu hình</h2><p>Không có thiết lập nào được trả về từ hệ thống.</p></section>';
  const known=new Set(groups.flatMap(group=>group.keys));
  const sections=[...groups,{id:"other",title:"Thiết lập khác",description:"Các thiết lập bổ sung của hệ thống.",keys:rows.filter(row=>!known.has(row.config_key)).map(row=>row.config_key)}].map(group=>({...group,rows:group.keys.map(key=>rows.find(row=>row.config_key===key)).filter(Boolean)})).filter(group=>group.rows.length);
  const editable=rows.filter(row=>!row.read_only).length;
  return `<div class="configuration-intro"><p>Quản lý thông tin cơ sở và các thiết lập vận hành. Lưu riêng từng mục sau khi chỉnh sửa. Chính sách đặt khám áp dụng cho lượt khám mới; lượt cũ giữ chính sách đã chốt.</p><span>${editable} mục có thể chỉnh sửa · ${rows.length-editable} mục chỉ xem</span></div>
    <div class="configuration-sections">${sections.map(group=>`<section class="admin-card configuration-section" id="configuration-${group.id}" aria-labelledby="configuration-title-${group.id}"><div class="admin-panel-heading"><div><h2 id="configuration-title-${group.id}">${esc(group.title)}</h2><p>${esc(group.description)}</p></div><span class="configuration-group-kind">${group.rows.every(row=>row.read_only)?"Quy tắc cố định":"Thiết lập"}</span></div><div class="configuration-fields">${group.rows.map(configurationRow).join("")}</div></section>`).join("")}</div>`;
}
