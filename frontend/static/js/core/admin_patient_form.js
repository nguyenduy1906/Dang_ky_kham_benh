import { esc, facts, stamp } from "./admin_ui.js";
import { code } from "./business_codes.js";
import { fieldMarkup } from "./admin_resources.js";
import { patientSummary, patientAccountStatus } from "./admin_patient_detail.js";

const relativeFieldNames = ["full_name", "dob", "gender", "id_card", "health_insurance", "phone", "email", "address",
  "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship"];

function accountStatusField(row) {
  if (!row.user_id || !row.account || row.account.is_deleted) {
    return `<label><span>Trạng thái tài khoản</span><input type="text" value="${esc(patientAccountStatus(row))}" disabled></label>`;
  }
  const status = row.account.account_status;
  return `<label><span>Trạng thái tài khoản</span><select name="account_status" required>
    ${!["ACTIVE", "LOCKED"].includes(status) ? '<option value="" selected>Chưa xác định — chọn trạng thái</option>' : ""}
    <option value="ACTIVE" ${status === "ACTIVE" ? "selected" : ""}>Đang hoạt động</option>
    <option value="LOCKED" ${status === "LOCKED" ? "selected" : ""}>Đã khóa</option>
  </select></label>`;
}

function relativesForm(row, fields, references) {
  if (!Array.isArray(row.relatives)) return '<section class="admin-patient-section admin-patient-relatives"><h3>Hồ sơ người thân</h3><p class="admin-patient-field-note">Chưa tải được hồ sơ người thân.</p></section>';
  const cards = row.relatives.map(relative => {
    const archived = Boolean(relative.is_archived || relative.archived_at);
    const inputs = relativeFieldNames.map(name => {
      const field = fields.find(field => field.name === name);
      if (!field) return "";
      return fieldMarkup({ ...field, readOnEdit: name === "phone" || field.readOnEdit,
        clearable: !archived && name !== "phone" && ["text", "email", "tel"].includes(field.type) }, relative, references, true)
        .replace(`name="${name}"`, `data-relative-field="${name}"`);
    }).join("");
    return `<fieldset class="admin-patient-relative admin-patient-relative-edit" data-relative-id="${esc(relative.patient_id)}" ${archived ? "disabled" : ""}>
      <legend>${esc(relative.full_name || "Hồ sơ người thân")}</legend><p class="admin-patient-field-note">${esc(code("BN", relative.patient_id))}${archived ? " · Hồ sơ đã ngừng hoạt động, chỉ xem" : ""}</p>
      <div class="admin-patient-fields">${inputs}</div>
      <p class="admin-patient-field-note">Số điện thoại liên kết được quản lý tại tài khoản chủ hồ sơ.</p>
    </fieldset>`;
  }).join("");
  return `<section class="admin-patient-section admin-patient-relatives"><h3>Hồ sơ người thân</h3>${row.family_scope === "same-account" ? '<p class="admin-patient-field-note">Hiển thị các hồ sơ người thân cùng tài khoản.</p>' : ""}${cards || '<p class="admin-patient-field-note">Chưa có hồ sơ người thân trong tài khoản này.</p>'}</section>`;
}

function patientForm(row, fields, references, actions, {showAccountStatus=true, phoneEditable=false}={}) {
  const edit = Boolean(row), values = row || {};
  const render = names => names.map(name => fields.find(field => field.name === name))
    .filter(Boolean).map(field => fieldMarkup({ ...field, readOnEdit: field.readOnEdit || edit && Boolean(row.is_archived || row.archived_at), clearable: ["text", "email", "tel"].includes(field.type) && !(edit && (field.readOnEdit || row.is_archived || row.archived_at)) }, values, references, edit)).join("");
  const section = (title, names, extra = "", controls = "") => `<section class="admin-patient-section"><h3>${title}</h3><div class="admin-patient-fields">${render(names)}${controls}</div>${extra}</section>`;
  return `<form class="admin-patient-detail admin-patient-${edit ? "edit" : "create"}" data-form="resource" data-id="${esc(row?.patient_id || "")}" autocomplete="off">
    ${edit ? patientSummary(row) : ""}
    ${section("Thông tin cá nhân", ["full_name", "dob", "gender", "id_card", "health_insurance", "phone", "email", "address"], edit ? (phoneEditable ? "" : '<p class="admin-patient-field-note">Số điện thoại liên kết được quản lý tại tài khoản chủ hồ sơ.</p>') : '<p class="admin-patient-field-note">Nhập ngày sinh hoặc CCCD / mã định danh để phân biệt hồ sơ bệnh nhân.</p>', showAccountStatus ? accountStatusField(row || {}) : "")}
    ${section("Liên hệ khẩn cấp", ["emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship"])}
    ${edit ? `<section class="admin-patient-section admin-patient-metadata"><h3>Thông tin hồ sơ</h3>${facts([
      ["Mã tài khoản", row.user_id ? code("TK", row.user_id) : "Chưa liên kết tài khoản"],
      ["Ngày tạo hồ sơ", row.created_at ? stamp(row.created_at) : "Chưa cập nhật"],
      ["Cập nhật gần nhất", row.updated_at ? stamp(row.updated_at) : "Chưa cập nhật"],
    ])}</section>${relativesForm(row, fields, references)}` : ""}
    <div class="admin-patient-form-footer">${actions}</div>
  </form>`;
}

export const patientEditForm = (row, fields, references, actions, options) => patientForm(row, fields, references, actions, options);
export const patientCreateForm = (fields, references, actions) => patientForm(null, fields, references, actions);
