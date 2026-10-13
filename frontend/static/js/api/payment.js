import { apiRequest, pathSegment } from "../core/api.js";

/** createIntent/collectExamFee nhận { payment_method }; refund nhận { reason }. setDemoResult gọi API demo hiện có với { result: 'SUCCESS' | 'FAILED' }, chỉ hoạt động khi backend bật SEND_EMAIL=1; không giả lập kết quả ở FE. */

/** GET /encounters/<int:encounter_id>/payments */
export function listEncounterPayments(encounterId, params = {}, options = {}) {
  return apiRequest(`/encounters/${pathSegment(encounterId)}/payments`, { ...options, method: "GET", params });
}

/** GET /payments/<int:payment_id> */
export function getPayment(paymentId, options = {}) {
  return apiRequest(`/payments/${pathSegment(paymentId)}`, { ...options, method: "GET" });
}

/** POST /encounters/<int:encounter_id>/payment-intents */
export function createIntent(encounterId, data, options = {}) {
  return apiRequest(`/encounters/${pathSegment(encounterId)}/payment-intents`, { ...options, method: "POST", data });
}

/** POST /demo/payments/<int:payment_id>/result */
export function setDemoResult(paymentId, data, options = {}) {
  return apiRequest(`/demo/payments/${pathSegment(paymentId)}/result`, { ...options, method: "POST", data });
}

/** POST /staff/encounters/<int:encounter_id>/exam-fees */
export function collectExamFee(encounterId, data, options = {}) {
  return apiRequest(`/staff/encounters/${pathSegment(encounterId)}/exam-fees`, { ...options, method: "POST", data });
}

/** POST /admin/payments/<int:payment_id>/refund */
export function refund(paymentId, data, options = {}) {
  return apiRequest(`/admin/payments/${pathSegment(paymentId)}/refund`, { ...options, method: "POST", data });
}

