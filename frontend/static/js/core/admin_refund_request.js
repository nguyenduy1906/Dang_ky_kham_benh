import {bulkRefundMarkup,bindBulkRefundPreview} from "./admin_refund_bulk_preview.js";
import { openAdminFormDialog } from "./admin_form_dialog.js";
import { readPaymentContext, submitRefundRequest, refundOutcome } from "./admin_payment_data.js";
import { canRequestRefund, paymentMethodLabel } from "./admin_payment_view.js";
import { code, parseCode } from "./business_codes.js";
import { esc, facts, money, label } from "./admin_ui.js";

export function refundRequestMarkup() {
  return `<form class="admin-refund-request" autocomplete="off" data-refund-mode="single">
    <nav class="admin-refund-modes" aria-label="Cách chọn giao dịch hoàn tiền"><button type="button" class="secondary" data-refund-mode="single" aria-pressed="true">Theo giao dịch</button><button type="button" class="secondary" data-refund-mode="bulk" aria-pressed="false">Theo phòng / ca khám</button></nav>
    <div data-refund-single>
    <section class="admin-payment-section"><h3>Chọn giao dịch cần hoàn</h3>
      <div class="admin-payment-fields"><label>Mã thanh toán hoặc mã giao dịch<input type="search" name="payment_query" placeholder="TT_001 hoặc mã giao dịch"></label><label>Mã lượt khám<input type="text" name="encounter_query" placeholder="LK_001"></label></div>
      <label>Giao dịch đã thanh toán *<select name="source_payment_id" required><option value="">Chọn giao dịch</option></select></label>
      <p class="admin-refund-status" data-lookup-status role="status"></p>
    </section>
    <div class="admin-refund-summary" data-refund-summary><p>Chọn giao dịch để xem thông tin người bệnh, lượt khám và số tiền đã thu.</p></div>
    <section class="admin-payment-section"><h3>Nội dung yêu cầu</h3><div class="admin-payment-fields">
      <label>Nhóm lý do<select name="reason_group"><option value="">Chọn nhóm lý do</option><option>Yêu cầu từ người bệnh</option><option>Thay đổi lịch khám</option><option>Đối soát giao dịch</option><option>Khác</option></select></label>
      <label class="admin-refund-reason">Lý do hoàn tiền *<textarea name="reason" rows="4" maxlength="900" required placeholder="Nhập lý do cụ thể để lưu cùng giao dịch hoàn tiền"></textarea></label>
    </div><p class="admin-patient-field-note">Khoản hoàn và phương thức hoàn được hệ thống xác định theo giao dịch gốc và chính sách áp dụng.</p></section>
    <div class="actions"><button type="submit" disabled>Xác nhận hoàn tiền</button><button type="button" class="secondary" data-refund-close>Hủy</button></div>
    <p class="form-feedback admin-refund-status" data-refund-feedback role="status" aria-live="polite"></p>
    </div>${bulkRefundMarkup()}
  </form>`;
}

export async function openRefundRequest({ ctx, rows, paymentId = null, trigger, onSaved, onClose = () => {} }) {
  let active = true, saving = false, completed = false, version = 0, request, context;
  const candidates = new Map(rows.filter(canRequestRefund).map(row => [String(row.payment_id),row]));
  const opened = openAdminFormDialog({ title: "Yêu cầu hoàn tiền", trigger,
    canClose: () => !saving,
    onClose: () => { active = false; version++; request?.abort(); onClose(); },
  });
  opened.content.innerHTML = refundRequestMarkup();
  const form = opened.content.querySelector("form"), { payment_query, encounter_query, source_payment_id, reason, reason_group } = form.elements;
  const summary = form.querySelector("[data-refund-summary]"), lookupStatus = form.querySelector("[data-lookup-status]"), feedback = form.querySelector("[data-refund-feedback]");
  const submit = form.querySelector('[type="submit"]');
  const alive = current => active && ctx.active && current === version;
  function showError(error, target = feedback) {
    target.textContent = error.message || "Không thể xử lý yêu cầu. Vui lòng thử lại."; target.dataset.error = "true";
    if (error.status === 401 || error.status === 403) { ctx.handle(error); opened.dialog.close(); }
  }
  function choices(selected = "") {
    const query = payment_query.value.trim().toLowerCase(), encounterText = encounter_query.value.trim();
    let encounterId;
    try { encounterId = encounterText ? parseCode(encounterText,"LK") : null; }
    catch (error) { showError(error,lookupStatus); return; }
    const matching = [...candidates.values()].filter(row => (!encounterId || Number(row.encounter_id) === encounterId) &&
      (!query || `${code("TT",row.payment_id)} ${row.transaction_code || ""}`.toLowerCase().includes(query)));
    source_payment_id.innerHTML = '<option value="">Chọn giao dịch đã thanh toán</option>' + matching.map(row => `<option value="${esc(row.payment_id)}">${esc(code("TT",row.payment_id))} · ${esc(code("LK",row.encounter_id))} · ${esc(money(row.amount))} · ${esc(paymentMethodLabel(row.payment_method))}</option>`).join("");
    source_payment_id.value = selected;
    lookupStatus.dataset.error = "false";
    lookupStatus.textContent = matching.length ? `${matching.length} giao dịch phù hợp.` : "Không có giao dịch thu thành công phù hợp.";
  }
  async function select(id) {
    const current = ++version; request?.abort(); context = null; submit.disabled = true;
    if (!id) { summary.innerHTML = '<p>Chọn giao dịch để xem thông tin.</p>'; return; }
    request = new AbortController(); lookupStatus.textContent = "Đang kiểm tra giao dịch…";
    try {
      const loaded = await readPaymentContext(id,{signal:request.signal});
      if (!alive(current)) return;
      if (encounter_query.value.trim() && Number(loaded.payment.encounter_id)!==parseCode(encounter_query.value,"LK")) throw new Error("Giao dịch không thuộc mã lượt khám đang tra cứu.");
      context = loaded;
      if (canRequestRefund(loaded.payment)) candidates.set(String(loaded.payment.payment_id),loaded.payment);
      const { payment, encounter } = loaded;
      summary.innerHTML = `<h3>Thông tin giao dịch gốc</h3>${facts([
        ["Mã thanh toán",code("TT",payment.payment_id)],["Mã lượt khám",code("LK",payment.encounter_id)],
        ["Người bệnh",encounter.patient_name || "Chưa cập nhật"],["Bác sĩ",encounter.doctor_name || "Chưa cập nhật"],
        ["Số tiền đã thu",money(payment.amount)],["Phương thức",paymentMethodLabel(payment.payment_method)],
        ["Trạng thái lượt khám",label(encounter.encounter_status)],...(encounter.cancel_reason?[["Lý do hủy",encounter.cancel_reason]]:[]),
      ])}`;
      const eligibleStatus = encounter.encounter_status === "CANCELLED" || encounter.encounter_status === "NO_SHOW" && encounter.policy_snapshot?.NO_SHOW_FORFEIT_DEPOSIT === false && payment.payment_type === "DEPOSIT";
      const allowed = canRequestRefund(payment) && eligibleStatus;
      lookupStatus.dataset.error = String(!allowed);
      lookupStatus.textContent = !canRequestRefund(payment) ? "Giao dịch chưa thu thành công hoặc đã được hoàn tiền." : !eligibleStatus ? "Lượt khám cần hủy hoặc đủ điều kiện hoàn cọc khi không đến khám." : "Kiểm tra thông tin và nhập lý do trước khi xác nhận hoàn tiền.";
      submit.disabled = !allowed || completed;
      return { ...loaded, version: current };
    } catch (error) { if (alive(current)) showError(error,lookupStatus); }
  }
  function selectedResult(id, loaded, prefill = false) {
    if (!loaded || !alive(loaded.version) || String(loaded.payment.payment_id)!==String(id)) return;
    if (prefill) { payment_query.value=code("TT",id);encounter_query.value=code("LK",loaded.payment.encounter_id); }
    const notice=lookupStatus.textContent, error=lookupStatus.dataset.error;
    if(canRequestRefund(loaded.payment))candidates.set(String(id),loaded.payment);
    choices(String(id));lookupStatus.textContent=notice;lookupStatus.dataset.error=error;
  }
  for (const input of [payment_query,encounter_query]) {
    input.addEventListener("input",() => { if (!saving && !completed) { void select(""); choices(); } });
    input.addEventListener("keydown",event => { if (event.key === "Enter") event.preventDefault(); });
  }
  source_payment_id.addEventListener("change",() => { if (!saving && !completed) void select(source_payment_id.value); });
  form.querySelector("[data-refund-close]").addEventListener("click",opened.close);
  form.addEventListener("submit",async event => {
    event.preventDefault();
    if (form.dataset.refundMode === "bulk" || saving || completed || !context || submit.disabled || !form.reportValidity()) return;
    const detail = reason.value.trim();
    if (!detail) { reason.setCustomValidity("Vui lòng nhập lý do hoàn tiền."); reason.reportValidity(); return; }
    const current = version, selected = context.payment.payment_id;
    const controls = [...opened.dialog.querySelectorAll("input,select,textarea,button")], states = controls.map(node=>node.disabled);
    saving = true; request = new AbortController(); form.setAttribute("aria-busy","true"); controls.forEach(node=>node.disabled=true);
    feedback.textContent = "Đang xử lý hoàn tiền…"; feedback.dataset.error = "false";
    try {
      const result = await submitRefundRequest(selected,[reason_group.value,detail].filter(Boolean).join(": "),{signal:request.signal});
      if (!alive(current)) return;
      const outcome = refundOutcome(result); completed = outcome.completed;
      feedback.textContent = outcome.message; feedback.dataset.error = "false";
      try { await onSaved?.(result); }
      catch { if (alive(current)) feedback.textContent += " Chưa cập nhật được danh sách; vui lòng tải lại để đối chiếu."; }
    } catch (error) {
      if (!alive(current)) return;
      showError(error);
      // Read back after an uncertain result; never repeat the refund POST.
      if (error.code === "CLIENT_TIMEOUT" || error.code === "CLIENT_NETWORK_ERROR") {
        feedback.textContent += " Vui lòng đối chiếu lịch sử trước khi gửi lại.";
        try { const result = await readPaymentContext(selected,{signal:request.signal}); if (alive(current) && result.payment.transaction_status === "REFUNDED") { completed = true; await onSaved?.(result); } } catch { /* Keep the reason and error visible. */ }
      }
    } finally {
      saving = false;
      if (active) {
        form.setAttribute("aria-busy","false"); controls.forEach((node,index)=>node.disabled=states[index]);
        if (completed) { form.querySelectorAll("input,select,textarea").forEach(node=>node.disabled=true); submit.disabled=true; form.querySelector("[data-refund-close]").textContent="Đóng"; }
      }
    }
  });
  reason.addEventListener("input",() => reason.setCustomValidity(""));
  bindBulkRefundPreview(form,opened.close);
  choices();
  if (paymentId) {
    const id = String(paymentId);
    source_payment_id.value = id;
    selectedResult(id,await select(id),true);
  }
  return opened;
}
