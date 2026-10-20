import * as patients from "../api/patient.js";
import * as auth from "../api/auth.js";
import { allPages } from "./admin_ui.js";

export const patientProfileFields = Object.freeze([
  "full_name", "dob", "gender", "id_card", "address", "health_insurance", "email",
  "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship",
]);

export async function loadPatientAccount(patientId, { signal } = {}) {
  const { patient } = await patients.getPatient(patientId, { signal });
  if (!patient.user_id) return { ...patient, account: null, relatives: [], family_scope: "same-account" };
  const [{ user }, profiles] = await Promise.all([
    auth.getUser(patient.user_id, { signal }),
    allPages(patients.listPatients, { include_archived: true }, signal),
  ]);
  if (String(user.user_id) !== String(patient.user_id)) throw new Error("Tài khoản không khớp hồ sơ bệnh nhân.");
  const relatives = profiles.filter(profile => String(profile.user_id) === String(patient.user_id) &&
    String(profile.patient_id) !== String(patient.patient_id) && profile.relationship !== "SELF");
  return { ...patient, account: user, relatives, family_scope: "same-account" };
}

const normalized = value => value == null ? "" : String(value).trim();
function profileChanges(profile, input) {
  const changes = {};
  for (const field of patientProfileFields) {
    if (!Object.hasOwn(input, field)) continue;
    const value = normalized(input[field]);
    if (field === "full_name" && !value) throw new Error("Vui lòng nhập họ tên cho từng hồ sơ.");
    if (value !== normalized(profile[field])) changes[field] = value || null;
  }
  if (Object.keys(changes).length && (profile.is_archived || profile.archived_at)) {
    throw new Error(`Hồ sơ ${profile.full_name || profile.patient_id} đã ngừng hoạt động, không thể chỉnh sửa.`);
  }
  return changes;
}

// Account access and patient records use separate existing endpoints. Retain
// confirmed results so a partial failure can be retried without repeating them.
export async function savePatientAccount(row, mainInput, relativeInputs, {
  accountStatus, signal, onPatientSaved = () => {}, onAccountSaved = () => {},
} = {}) {
  const jobs = [{ profile: row, changes: profileChanges(row, mainInput) }], seen = new Set();
  for (const input of relativeInputs) {
    const id = String(input.patient_id);
    const profile = row.relatives?.find(item => String(item.patient_id) === id);
    if (!profile || seen.has(id)) throw new Error("Hồ sơ người thân không thuộc danh sách đang chỉnh sửa.");
    seen.add(id);
    jobs.push({ profile, changes: profileChanges(profile, input.values) });
  }
  const statusChanged = Boolean(accountStatus && accountStatus !== row.account?.account_status);
  if (accountStatus && !["ACTIVE", "LOCKED"].includes(accountStatus)) throw new Error("Trạng thái tài khoản không hợp lệ.");
  if (statusChanged) {
    if (!row.user_id || row.account?.is_deleted || String(row.account?.user_id) !== String(row.user_id)) {
      throw new Error("Hồ sơ chưa có tài khoản hợp lệ để khóa hoặc mở.");
    }
    const { user } = await auth.getMe({ signal });
    if (String(user.user_id) === String(row.user_id)) throw new Error("Không thể đổi trạng thái tài khoản của chính mình.");
  }
  let saved = 0;
  try {
    for (const { profile, changes } of jobs) {
      if (!Object.keys(changes).length) continue;
      const { patient } = await patients.updatePatient(profile.patient_id, changes, { signal });
      Object.assign(profile, patient); saved++; onPatientSaved(patient);
    }
    if (statusChanged) {
      const { user } = await auth.setAccountStatus(row.user_id, { account_status: accountStatus }, { signal });
      row.account = user; onAccountSaved(user);
    }
  } catch (error) {
    if (saved) error.message = `Đã lưu ${saved} hồ sơ; các thay đổi còn lại chưa được xác nhận. ${error.message} Nội dung đang nhập được giữ lại để thử lưu tiếp.`;
    throw error;
  }
  return { patient: row };
}
