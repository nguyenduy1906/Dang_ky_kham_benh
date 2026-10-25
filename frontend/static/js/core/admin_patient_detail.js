import { esc, facts, date, stamp } from "./admin_ui.js";
import { code } from "./business_codes.js";

const value = input => input == null || String(input).trim() === "" ? "Chưa cập nhật" : input;
const section = (title, fields, className = "") => `<section class="admin-patient-section ${className}"><h3>${title}</h3>${facts(fields)}</section>`;

export function patientAccountStatus(row) {
  if (!row.user_id) return "Chưa liên kết tài khoản";
  if (row.account?.is_deleted) return "Tài khoản đã xóa";
  return ({ ACTIVE: "Đang hoạt động", LOCKED: "Đã khóa" })[row.account?.account_status] || "Chưa xác định";
}

function relativeDetails(relative) {
  return `<section class="admin-patient-relative" data-relative-id="${esc(relative.patient_id)}"><h4>${esc(value(relative.full_name))}</h4>${facts([
    ["Mã hồ sơ", code("BN", relative.patient_id)],
    ["Ngày sinh", relative.dob ? date(relative.dob) : "Chưa cập nhật"], ["Giới tính", value(relative.gender)],
    ["CCCD / mã định danh", value(relative.id_card)], ["Mã thẻ BHYT", value(relative.health_insurance)],
    ["Số điện thoại", value(relative.phone)], ["Email", value(relative.email)], ["Địa chỉ", value(relative.address)],
    ["Người liên hệ khẩn cấp", value(relative.emergency_contact_name)],
    ["Số điện thoại khẩn cấp", value(relative.emergency_contact_phone)],
    ["Quan hệ với người liên hệ", value(relative.emergency_contact_relationship)],
    ...(relative.is_archived || relative.archived_at ? [["Trạng thái hồ sơ", "Đã ngừng hoạt động"]] : []),
  ])}</section>`;
}

function relativesDetails(row) {
  const relatives = row.relatives;
  const content = !Array.isArray(relatives) ? '<p class="admin-patient-field-note">Chưa tải được hồ sơ người thân.</p>'
    : relatives.length ? relatives.map(relativeDetails).join("")
    : '<p class="admin-patient-field-note">Chưa có hồ sơ người thân trong tài khoản này.</p>';
  return `<section class="admin-patient-section admin-patient-relatives"><h3>Hồ sơ người thân</h3>${row.family_scope === "same-account" ? '<p class="admin-patient-field-note">Hiển thị các hồ sơ người thân cùng tài khoản.</p>' : ""}${content}</section>`;
}

export function patientDetails(row, {showRelatives = true, showAccountStatus = true} = {}) {
  return `<div class="admin-patient-detail" data-patient-id="${esc(row.patient_id)}">
    ${patientSummary(row)}
    ${section("Thông tin cá nhân", [
      ["Ngày sinh", row.dob ? date(row.dob) : "Chưa cập nhật"], ["Giới tính", value(row.gender)],
      ["CCCD / mã định danh", value(row.id_card)], ["Mã thẻ BHYT", value(row.health_insurance)],
      ...(showAccountStatus ? [["Trạng thái tài khoản", patientAccountStatus(row)]] : []),
    ])}
    ${section("Thông tin liên hệ", [
      ["Số điện thoại", value(row.phone)], ["Email", value(row.email)], ["Địa chỉ", value(row.address)],
    ])}
    ${section("Liên hệ khẩn cấp", [
      ["Họ và tên", value(row.emergency_contact_name)], ["Số điện thoại", value(row.emergency_contact_phone)],
      ["Quan hệ với bệnh nhân", value(row.emergency_contact_relationship)],
    ])}
    ${section("Thông tin hồ sơ", [
      ["Mã tài khoản", row.user_id ? code("TK", row.user_id) : "Chưa liên kết tài khoản"],
      ["Ngày tạo hồ sơ", row.created_at ? stamp(row.created_at) : "Chưa cập nhật"],
      ["Cập nhật gần nhất", row.updated_at ? stamp(row.updated_at) : "Chưa cập nhật"],
      ...(row.archived_at ? [["Thời điểm ngừng hoạt động", stamp(row.archived_at)]] : []),
    ], "admin-patient-metadata")}
    ${showRelatives ? relativesDetails(row) : ""}
  </div>`;
}

export function patientSummary(row) {
  const inactive = Boolean(row.is_archived || row.archived_at);
  return `<div class="admin-patient-summary"><div><span class="admin-patient-code">${esc(code("BN", row.patient_id))}</span><h3>${esc(value(row.full_name))}</h3></div><span class="badge ${inactive ? "red" : "green"}">${inactive ? "Không hoạt động" : "Đang hoạt động"}</span></div>`;
}
