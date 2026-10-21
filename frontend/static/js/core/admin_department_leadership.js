import { departmentDeputyLimit } from "./admin_department_view.js";
import { replaceDepartmentLeadership } from "../api/catalog.js";

const eligibleIds = candidates => new Set(candidates.filter(row => row.is_active && row.account_ok).map(row => String(row.doctor_profile_id)));

export function departmentLeadershipPayload(members, candidates, head, deputies, version) {
  const eligible = eligibleIds(candidates);
  const ids = new Set(members.map(row => String(row.doctor_profile_id)));
  const payload = { head_doctor_id: head === "" || head == null ? null : Number(head), deputy_doctor_ids: deputies.map(Number), expected_version: Number(version) };
  if (!Number.isSafeInteger(payload.expected_version) || payload.expected_version < 1) throw new Error("Hãy tải lại danh sách thành viên trước khi phân công.");
  const leaders = [...(payload.head_doctor_id == null ? [] : [payload.head_doctor_id]), ...payload.deputy_doctor_ids];
  if (new Set(leaders).size !== leaders.length) throw new Error("Một bác sĩ chỉ được giữ một chức vụ lãnh đạo trong khoa.");
  if (payload.deputy_doctor_ids.length > departmentDeputyLimit(members.length)) throw new Error(`Khoa chỉ được tối đa ${departmentDeputyLimit(members.length)} phó khoa.`);
  if (leaders.some(id => !Number.isSafeInteger(id) || !ids.has(String(id)) || !eligible.has(String(id)))) throw new Error("Lãnh đạo phải là bác sĩ đang hoạt động, đã duyệt và thuộc khoa này.");
  return payload;
}

export function saveDepartmentLeadership(id, members, candidates, head, deputies, version, options) {
  const payload = departmentLeadershipPayload(members, candidates, head, deputies, version);
  return replaceDepartmentLeadership(id, payload, options);
}
