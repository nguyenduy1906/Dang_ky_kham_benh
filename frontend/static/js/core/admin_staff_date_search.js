import { listDoctors } from "../api/doctor.js";
import { listAdminSchedules, listNurseAssignments } from "../api/schedule.js";
import { allPages } from "./admin_ui.js";
import { chronologicalPage } from "./clinical_list_order.js";

function validateDay(day) {
  if (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0,10) !== day)) {
    throw new Error("Vui lòng chọn ngày làm việc hợp lệ.");
  }
}

export async function searchAdminDoctors(params, page, pageSize, signal) {
  const {work_date, ...filters} = params;
  validateDay(work_date);
  if (!work_date) return listDoctors({...filters, page, page_size:pageSize}, {signal});
  const [doctors, shifts] = await Promise.all([
    allPages(listDoctors, filters, signal),
    allPages(listAdminSchedules, {from_date:work_date, to_date:work_date}, signal),
  ]);
  const ids = new Set(shifts.filter(row=>row.work_date===work_date).map(row=>String(row.doctor_profile_id)));
  const items = doctors.filter(row=>ids.has(String(row.doctor_profile_id)));
  const current = Math.min(Math.max(1,page),Math.max(1,Math.ceil(items.length/pageSize)));
  return {items:items.slice((current-1)*pageSize,current*pageSize),total:items.length,page:current,page_size:pageSize};
}

export async function searchAdminAssignments(params, page, pageSize, signal) {
  const {work_date, ...filters} = params;
  validateDay(work_date);
  const rows = await allPages(listNurseAssignments, filters, signal);
  return chronologicalPage(work_date ? rows.filter(row=>row.work_date===work_date) : rows, page, pageSize);
}
