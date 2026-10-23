import { listEncounters } from "../api/encounter.js";
import { getWorkSchedules } from "../api/staff_leave.js";
import { overviewRows } from "./staff_overview.js";

export async function loadReceptionCalendar(day, userId, options = {}) {
  const [year, month] = day.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const result = await getWorkSchedules({from_date: `${day.slice(0, 7)}-01`, to_date: `${day.slice(0, 7)}-${last}`}, options);
  if (String(result?.user_id) !== String(userId) || result?.role_name !== "RECEPTIONIST" || !Array.isArray(result.items)) {
    throw new Error("Không nhận được lịch hợp lệ của tài khoản lễ tân hiện tại.");
  }
  return result.items.flatMap(item => (item.shifts || []).map(shift => ({
    ...shift, work_date: item.work_date,
    schedule_status: shift.status === "ON_LEAVE" ? "UNAVAILABLE" : "OPEN",
  })));
}

export async function loadReceptionOverview(day, userId, options = {}) {
  const [rows, calendar] = await Promise.all([
    overviewRows(listEncounters, {work_date: day}, {from: day, to: day}, options),
    loadReceptionCalendar(day, userId, options).then(shifts => ({shifts})).catch(error => {
      if ([401, 403].includes(error.status) || error.code === "CLIENT_ABORTED" || options.signal?.aborted) throw error;
      return {error: error.message || "Không tải được lịch làm việc."};
    }),
  ]);
  return {rows, calendar};
}
