import * as payments from "../api/payment.js";
import { getEncounter } from "../api/encounter.js";
import { code, parseCode } from "./business_codes.js";

export async function readAdminPaymentHistory({ signal } = {}) {
  const items = new Map();
  for (let page = 1; ; page++) {
    signal?.throwIfAborted();
    const result = await payments.listAdminPayments({ page, page_size: 20 }, { signal });
    for (const row of result.items) if (!items.has(String(row.payment_id))) items.set(String(row.payment_id),row);
    if (page * result.page_size >= result.total) return [...items.values()];
    if (!result.items.length) throw new Error("Không tải được đầy đủ lịch sử thanh toán. Vui lòng thử lại.");
  }
}

const text = value => String(value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[đĐ]/g,"d").toLowerCase();
function dayOf(row) {
  const date = new Date(row.refunded_at || row.paid_at || row.created_at);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(date) : "";
}
export function paymentPage(rows, filters = {}, page = 1, { refunds = false, size = 10 } = {}) {
  const id = filters.encounter_id ? parseCode(filters.encounter_id, "LK") : null;
  const source = filters.original_payment_id ? parseCode(filters.original_payment_id, "TT") : null;
  if (filters.from_date && filters.to_date && filters.from_date > filters.to_date) throw new Error("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.");
  const query = text(filters.q).trim();
  const matches = rows.filter(row => (row.payment_type === "REFUND") === refunds &&
    (!id || Number(row.encounter_id) === id) && (!source || Number(row.original_payment_id) === source) &&
    (!filters.payment_type || row.payment_type === filters.payment_type) &&
    (!filters.transaction_status || row.transaction_status === filters.transaction_status) &&
    (!filters.payment_method || row.payment_method === filters.payment_method) &&
    (!filters.from_date || dayOf(row) >= filters.from_date) && (!filters.to_date || dayOf(row) <= filters.to_date) &&
    (!query || text([code("TT",row.payment_id),row.payment_code,row.transaction_code,row.reason,code("TT",row.original_payment_id)].join(" ")).includes(query)));
  const current = Math.min(Math.max(1,page),Math.max(1,Math.ceil(matches.length / size)));
  return { items: matches.slice((current-1)*size,current*size), total: matches.length, page: current, page_size: size };
}

export async function readPaymentContext(paymentId, { signal } = {}) {
  const id = parseCode(paymentId,"TT");
  const { payment } = await payments.getPayment(id, { signal });
  if (Number(payment.payment_id) !== id) throw new Error("Thông tin thanh toán không khớp mã đã chọn.");
  const { encounter } = await getEncounter(payment.encounter_id, { signal });
  if (Number(encounter.encounter_id) !== Number(payment.encounter_id)) throw new Error("Thông tin lượt khám không khớp giao dịch.");
  return { payment, encounter };
}

export function submitRefundRequest(paymentId, reason, options = {}) {
  const id = parseCode(paymentId, "TT"), detail = String(reason ?? "").trim();
  if (!detail || detail.length > 1000) throw new Error("Vui lòng nhập lý do hoàn tiền, tối đa 1.000 ký tự.");
  return payments.refund(id, { reason: detail }, options);
}

export function refundOutcome(result) {
  if (result.refund?.payment_type === "REFUND" && result.refund.transaction_status === "SUCCESS") {
    return { completed: true, message: `Đã hoàn tiền thành công · ${code("TT",result.refund.payment_id)}.`, refund: result.refund };
  }
  if (result.amount_refunded === 0) return { completed: false, message: result.message || "Không phát sinh khoản hoàn tiền." };
  throw new Error("Chưa nhận được xác nhận hoàn tiền. Vui lòng đối chiếu lịch sử trước khi thử lại.");
}
