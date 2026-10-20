import { esc, facts, date, stamp, money, label, table } from "./admin_ui.js";
import { code } from "./business_codes.js";

const value = input => input == null || String(input).trim() === "" ? "Chưa cập nhật" : input;
const timestamp = input => input && Number.isFinite(Date.parse(input)) ? stamp(input) : "Chưa cập nhật";
const amount = input => input == null ? "Chưa cập nhật" : money(input);

export const paymentMethodLabel = method => ({ CASH: "Tiền mặt", BANK: "Chuyển khoản", CARD: "Thẻ", EWALLET: "Ví điện tử" })[method] || value(method);
export const canRequestRefund = row => ["DEPOSIT", "EXAM_FEE"].includes(row.payment_type) && row.transaction_status === "SUCCESS";

export function paymentStatusBadge(status) {
  const title = ({ PENDING: "Chờ thanh toán", SUCCESS: "Thành công", FAILED: "Thất bại", REFUNDED: "Đã hoàn tiền" })[status] || value(status);
  const tone = status === "SUCCESS" ? "green" : status === "PENDING" ? "amber" : status === "FAILED" ? "red" : "blue";
  return `<span class="badge ${tone}">${esc(title)}</span>`;
}

const detailButton = row => `<button type="button" class="row-action" data-payment-detail="${esc(row.payment_id)}">Chi tiết</button>`;

export function paymentTable(rows) {
  return table(["Mã thanh toán", "Lượt khám", "Loại giao dịch", "Số tiền", "Phương thức", "Thời điểm", "Trạng thái", "Thao tác"], rows.map(row => [
    esc(code("TT", row.payment_id)), esc(code("LK", row.encounter_id)), esc(label(row.payment_type)), esc(amount(row.amount)),
    esc(paymentMethodLabel(row.payment_method)), esc(timestamp(row.paid_at || row.created_at)), paymentStatusBadge(row.transaction_status), detailButton(row),
  ]), "Lịch sử thanh toán");
}

export function refundHistoryTable(rows) {
  return table(["Mã hoàn tiền", "Giao dịch gốc", "Lượt khám", "Số tiền hoàn", "Phương thức", "Thời điểm", "Trạng thái", "Thao tác"], rows.map(row => [
    esc(code("TT", row.payment_id)), esc(code("TT", row.original_payment_id)), esc(code("LK", row.encounter_id)), esc(amount(row.amount)),
    esc(paymentMethodLabel(row.payment_method)), esc(timestamp(row.refunded_at || row.paid_at || row.created_at)), paymentStatusBadge(row.transaction_status), detailButton(row),
  ]), "Lịch sử hoàn tiền");
}

function section(title, entries) {
  return `<section class="admin-payment-section"><h3>${esc(title)}</h3>${facts(entries)}</section>`;
}

export function paymentDetails(row, encounter = null) {
  const transaction = [
    ["Mã thanh toán", code("TT", row.payment_id)], ["Mã giao dịch", value(row.transaction_code)],
    ["Loại giao dịch", label(row.payment_type)], ["Phương thức", paymentMethodLabel(row.payment_method)],
    ...(row.original_payment_id ? [["Giao dịch gốc", code("TT", row.original_payment_id)]] : []),
  ];
  const visit = [["Mã lượt khám", code("LK", row.encounter_id)]];
  if (encounter) visit.push(
    ["Người bệnh", value(encounter.patient_name)], ["Bác sĩ", value(encounter.doctor_name)],
    ["Chuyên khoa", value(encounter.department_name)], ["Phòng khám", value(encounter.room_name)],
    ["Ngày khám", encounter.work_date && Number.isFinite(Date.parse(encounter.work_date)) ? date(encounter.work_date) : "Chưa cập nhật"],
    ["Trạng thái lượt khám", label(encounter.encounter_status)],
  );
  const processing = [
    ["Ngày tạo", timestamp(row.created_at)],
    ...(row.paid_at ? [["Thời điểm thanh toán", timestamp(row.paid_at)]] : []),
    ...(row.refunded_at ? [["Thời điểm hoàn tiền", timestamp(row.refunded_at)]] : []),
    ...(row.result_received_at ? [["Thời điểm nhận kết quả", timestamp(row.result_received_at)]] : []),
    ...(row.created_by_id ? [["Người tạo", code("TK", row.created_by_id)]] : []),
    ...(row.processed_by_id ? [["Người xử lý", code("TK", row.processed_by_id)]] : []),
    ...(row.reason ? [["Lý do", row.reason]] : []),
    ...(row.failure_reason ? [["Thông tin lỗi", row.failure_reason]] : []),
  ];
  const refund = canRequestRefund(row)
    ? `<div class="admin-payment-detail-actions"><p>Điều kiện và số tiền hoàn sẽ được hệ thống kiểm tra khi xác nhận.</p><button type="button" data-request-refund="${esc(row.payment_id)}">Hoàn tiền</button></div>`
    : `<p class="admin-payment-state-note">${row.payment_type === "REFUND" ? "Đây là giao dịch hoàn tiền." : row.transaction_status === "REFUNDED" ? "Giao dịch đã được hoàn tiền." : "Giao dịch chưa thu thành công nên chưa thể yêu cầu hoàn tiền."}</p>`;
  return `<div class="admin-payment-detail" data-payment-id="${esc(row.payment_id)}">
    <div class="admin-payment-summary"><div><span class="admin-payment-code">${esc(code("TT", row.payment_id))} · ${esc(label(row.payment_type))}</span><strong>${esc(amount(row.amount))}</strong></div>${paymentStatusBadge(row.transaction_status)}</div>
    ${section("Thông tin giao dịch", transaction)}${section("Thông tin lượt khám", visit)}${section("Xử lý và ghi chú", processing)}${refund}
  </div>`;
}
