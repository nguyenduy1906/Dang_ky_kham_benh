import { esc, facts, date, stamp } from "./admin_ui.js";
import { code } from "./business_codes.js";

const relationships = { SELF: "Bản thân", PARENT: "Cha / mẹ", CHILD: "Con", SPOUSE: "Vợ / chồng", OTHER: "Khác" };
const value = input => input == null || String(input).trim() === "" ? "Chưa cập nhật" : input;
const section = (title, fields, className = "") => `<section class="admin-patient-section ${className}"><h3>${title}</h3>${facts(fields)}</section>`;

export function patientDetails(row) {
  return `<div class="admin-patient-detail" data-patient-id="${esc(row.patient_id)}">
    ${patientSummary(row)}
    ${section("Thông tin cá nhân", [
      ["Ngày sinh", row.dob ? date(row.dob) : "Chưa cập nhật"], ["Giới tính", value(row.gender)],
      ["CCCD / mã định danh", value(row.id_card)], ["Mã thẻ BHYT", value(row.health_insurance)],
    ])}
    ${section("Thông tin liên hệ", [
      ["Số điện thoại", value(row.phone)], ["Email", value(row.email)], ["Địa chỉ", value(row.address)],
    ])}
    ${section("Liên hệ khẩn cấp", [
      ["Họ và tên", value(row.emergency_contact_name)], ["Số điện thoại", value(row.emergency_contact_phone)],
      ["Quan hệ với bệnh nhân", value(row.emergency_contact_relationship)],
    ])}
    ${section("Thông tin hồ sơ", [
      ["Tài khoản liên kết", row.user_id ? code("TK", row.user_id) : "Chưa liên kết tài khoản"],
      ["Quan hệ với chủ tài khoản", value(relationships[row.relationship] || row.relationship)],
      ["Ngày tạo hồ sơ", row.created_at ? stamp(row.created_at) : "Chưa cập nhật"],
      ["Cập nhật gần nhất", row.updated_at ? stamp(row.updated_at) : "Chưa cập nhật"],
      ...(row.archived_at ? [["Thời điểm ngừng hoạt động", stamp(row.archived_at)]] : []),
    ], "admin-patient-metadata")}
  </div>`;
}

export function patientSummary(row) {
  const inactive = Boolean(row.is_archived || row.archived_at);
  return `<div class="admin-patient-summary"><div><span class="admin-patient-code">${esc(code("BN", row.patient_id))}</span><h3>${esc(value(row.full_name))}</h3></div><span class="badge ${inactive ? "red" : "green"}">${inactive ? "Không hoạt động" : "Đang hoạt động"}</span></div>`;
}
