import { esc, date, facts, badge, label } from "./admin_ui.js";
import { code } from "./business_codes.js";

export function leaveRequestDetails(result, id) {
  const row=result.leave_request, pending=row.status==="PENDING";
  const schedules=result.affected_schedule_ids || [];
  const count=result.affected_encounters;
  const impactNote=row.role_name==="DOCTOR"?"Các ca bị ảnh hưởng sẽ ngừng nhận lịch mới khi duyệt nghỉ.":row.role_name==="NURSE"?"Các phân công trùng thời gian nghỉ sẽ được thu hồi khi duyệt nghỉ.":"";
  return `<div class="admin-leave-detail">
    <div class="admin-leave-summary"><div><span class="admin-leave-code">${esc(code("NP",row.request_id ?? id))} · ${esc(label(row.role_name))}</span><h3>${esc(row.staff_name)}</h3></div>${badge(row.status)}</div>
    <div class="admin-leave-columns">
      <section class="admin-leave-card"><h3>Thời gian nghỉ</h3>${facts([["Từ ngày",date(row.from_date)],["Đến ngày",date(row.to_date)],["Buổi nghỉ",label(row.period)]])}<div class="admin-leave-reason"><h4>Lý do xin nghỉ</h4><p>${esc(row.reason || "Chưa ghi nhận lý do")}</p></div></section>
      <section class="admin-leave-card"><h3>Phạm vi ảnh hưởng</h3><dl class="admin-leave-impact"><div><dt>Ca làm việc</dt><dd>${schedules.length}</dd></div><div><dt>Lượt khám</dt><dd>${count==null?"Chưa xác định":esc(count)}</dd></div></dl><div class="admin-leave-shifts">${schedules.length?schedules.map(value=>`<span>${esc(code("CA",value))}</span>`).join(""):'<span class="admin-leave-no-shift">Không có ca bị ảnh hưởng</span>'}</div>${pending&&impactNote?`<p class="admin-leave-impact-note">${esc(impactNote)}${Number(count)>0?" Các lượt khám cần được điều phối riêng.":""}</p>`:""}</section>
    </div>
    ${pending?`<section class="admin-leave-card admin-leave-review"><h3>Xét duyệt đơn</h3><form data-form="review" data-id="${esc(id)}"><div class="admin-leave-review-fields"><label>Quyết định *<select name="decision" required><option value="">Chọn quyết định</option><option value="APPROVED">Duyệt nghỉ</option><option value="REJECTED">Từ chối</option></select></label><label>Ý kiến xét duyệt *<textarea name="note" required maxlength="1000" rows="3" placeholder="Nhập ý kiến xét duyệt"></textarea></label></div><div class="actions"><button type="submit">Xác nhận xét duyệt</button><button type="button" class="secondary" data-action="close-dialog">Hủy</button></div><p class="form-feedback" role="status"></p></form></section>`:`<section class="admin-leave-card"><h3>Ý kiến xét duyệt</h3><p class="admin-leave-reviewed-note">${esc(row.review_note || "Chưa có ý kiến xét duyệt")}</p></section>`}
  </div>`;
}
