import * as schedules from "../api/schedule.js";
import { listAdminLeaveRequests } from "../api/staff_leave.js";
import { allPages } from "./admin_ui.js";
import { compareClinicalTime } from "./clinical_list_order.js";

export const normalizeAssignmentText = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLocaleLowerCase("vi").trim();
export const shiftsOverlap = (a, b) => a.work_date === b.work_date && a.start_time < b.end_time && b.start_time < a.end_time;
export const shiftEnd = row => Date.parse(`${row.work_date}T${row.end_time}+07:00`);

export function assignmentBlockReason(row, assignments, leaves, selected = [], now = Date.now()) {
  if (!["OPEN", "FULL"].includes(row.schedule_status)) return row.schedule_status === "UNAVAILABLE" ? "Bác sĩ báo nghỉ" : "Ca đã đóng";
  if (!Number.isFinite(shiftEnd(row)) || shiftEnd(row) <= now) return "Ca đã kết thúc";
  const active = assignments.filter(item => !item.revoked_at);
  if (active.some(item => String(item.schedule_id) === String(row.schedule_id))) return "Đã phân công y tá vào ca này";
  if (active.some(item => shiftsOverlap(row, item))) return "Trùng giờ với ca đã phân công";
  if (leaves.some(leave => leave.status === "APPROVED" && leave.from_date <= row.work_date && row.work_date <= leave.to_date
    && (leave.period === "FULL_DAY" || leave.period === "MORNING" && row.start_time < "12:00:00" || leave.period === "AFTERNOON" && row.end_time > "12:00:00"))) return "Y tá có lịch nghỉ đã duyệt";
  if (selected.some(item => String(item.schedule_id) !== String(row.schedule_id) && shiftsOverlap(row, item))) return "Trùng giờ với ca đang chọn";
  return "";
}

export function filterAssignmentShifts(rows, { weekdays, period, q }) {
  const query = normalizeAssignmentText(q);
  return rows.filter(row => {
    const day = new Date(`${row.work_date}T12:00:00+07:00`).getUTCDay();
    if (!weekdays.includes(day)) return false;
    if (period === "MORNING" && row.start_time >= "12:00:00") return false;
    if (period === "AFTERNOON" && row.end_time <= "12:00:00") return false;
    return !query || [row.department_name, row.doctor_name, row.room_name].some(value => normalizeAssignmentText(value).includes(query));
  }).sort(compareClinicalTime);
}

export async function loadNurseAvailability(nurseId, signal) {
  const [assignments, leaves] = await Promise.all([
    allPages(schedules.listNurseAssignments, { nurse_id: nurseId, include_revoked: false }, signal),
    allPages(listAdminLeaveRequests, { user_id: nurseId, status: "APPROVED" }, signal),
  ]);
  return { assignments, leaves };
}

// Each existing API call commits one assignment. Keep successful results and stop
// on uncertain network outcomes; reloading availability reconciles before retry.
export async function saveAssignmentBatch({ nurseId, rows, note, availability, signal, onResult = () => {}, isActive = () => true }) {
  const batchId=crypto.randomUUID();
  const results = [];
  for (const row of rows) {
    if (signal?.aborted || !isActive()) break;
    const reason = assignmentBlockReason(row, availability.assignments, availability.leaves);
    let result;
    if (reason) result = { row, success: false, message: reason };
    else {
      try {
        const response = await schedules.createNurseAssignment({ nurse_id: nurseId, schedule_id: row.schedule_id, note }, { signal, headers:rows.length>1?{"X-Assignment-Batch":batchId}:{} });
        if (!response.assignment || String(response.assignment.nurse_id) !== String(nurseId) || String(response.assignment.schedule_id) !== String(row.schedule_id)) throw new Error("Phản hồi không xác định. Hãy tải lại danh sách ca để kiểm tra.");
        availability.assignments.push({ ...row, ...response.assignment });
        result = { row, success: true, assignment: response.assignment, message: "Đã phân công" };
      } catch (error) {
        if (signal?.aborted || !isActive()) break;
        const stop = !error.status || error.status === 401 || error.status === 403 || error.status >= 500;
        result = { row, success: false, message: error.message || "Chưa phân công được", error, stop };
      }
    }
    results.push(result); onResult(result);
    if (result.stop) break;
  }
  return results;
}
