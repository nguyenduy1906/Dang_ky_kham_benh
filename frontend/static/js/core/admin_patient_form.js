import { esc, facts, stamp } from "./admin_ui.js";
import { code } from "./business_codes.js";
import { fieldMarkup } from "./admin_resources.js";
import { patientSummary } from "./admin_patient_detail.js";

function patientForm(row, fields, references, actions) {
  const edit = Boolean(row), values = row || {};
  const render = names => names.map(name => fields.find(field => field.name === name))
    .filter(Boolean).map(field => fieldMarkup({ ...field, clearable: ["text", "email", "tel"].includes(field.type) && !(edit && field.readOnEdit) }, values, references, edit)).join("");
  const section = (title, names, extra = "") => `<section class="admin-patient-section"><h3>${title}</h3><div class="admin-patient-fields">${render(names)}</div>${extra}</section>`;
  return `<form class="admin-patient-detail admin-patient-${edit ? "edit" : "create"}" data-form="resource" data-id="${esc(row?.patient_id || "")}" autocomplete="off">
    ${edit ? patientSummary(row) : ""}
    ${section("Thông tin cá nhân", ["full_name", "dob", "gender", "id_card", "health_insurance", "relationship"], edit ? "" : '<p class="admin-patient-field-note">Nhập ngày sinh hoặc CCCD / mã định danh để phân biệt hồ sơ bệnh nhân.</p>')}
    ${section("Thông tin liên hệ", ["phone", "email", "address"], edit ? '<p class="admin-patient-field-note">Số điện thoại liên kết được quản lý tại tài khoản chủ hồ sơ.</p>' : `<div class="admin-patient-shared-phone">${render(["confirm_shared_phone"])}</div>`)}
    ${section("Liên hệ khẩn cấp", ["emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship"])}
    ${edit ? `<section class="admin-patient-section admin-patient-metadata"><h3>Thông tin hồ sơ</h3>${facts([
      ["Tài khoản liên kết", row.user_id ? code("TK", row.user_id) : "Chưa liên kết tài khoản"],
      ["Ngày tạo hồ sơ", row.created_at ? stamp(row.created_at) : "Chưa cập nhật"],
      ["Cập nhật gần nhất", row.updated_at ? stamp(row.updated_at) : "Chưa cập nhật"],
    ])}</section>` : ""}
    <div class="admin-patient-form-footer">${actions}</div>
  </form>`;
}

export const patientEditForm = (row, fields, references, actions) => patientForm(row, fields, references, actions);
export const patientCreateForm = (fields, references, actions) => patientForm(null, fields, references, actions);
