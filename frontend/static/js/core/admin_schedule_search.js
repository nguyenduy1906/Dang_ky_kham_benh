import { listAdminSchedules } from "../api/schedule.js";
import { allPages } from "./admin_ui.js";
import { chronologicalPage } from "./clinical_list_order.js";

const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("vi").trim();

export async function searchAdminSchedules(params, page, pageSize, signal) {
  const { q, ...filters } = params;
  const query = normalize(q);
  if (!query) return listAdminSchedules({ ...filters, page, page_size: pageSize }, { signal });
  const rows = await allPages(listAdminSchedules, filters, signal);
  const items = rows.filter(row => [row.department_name, row.doctor_name, row.room_name].some(name => normalize(name).includes(query)));
  return chronologicalPage(items, page, pageSize);
}
