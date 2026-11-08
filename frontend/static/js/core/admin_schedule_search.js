import {normalizeSearchText, matchesSearch} from "./search_text.js";
import { listAdminSchedules } from "../api/schedule.js";
import { allPages } from "./admin_ui.js";
import {code} from "./business_codes.js";
import { chronologicalPage } from "./clinical_list_order.js";

const normalize = normalizeSearchText;

export async function searchAdminSchedules(params, page, pageSize, signal) {
  const { q, ...filters } = params;
  const query = normalize(q);
  if (!query) return listAdminSchedules({ ...filters, page, page_size: pageSize }, { signal });
  const rows = await allPages(listAdminSchedules, filters, signal);
  const items = rows.filter(row => matchesSearch([row.department_name, row.doctor_name, row.room_name,code("CA",row.schedule_id),code("BS",row.doctor_profile_id),code("PH",row.room_id)].join(" "),query));
  return chronologicalPage(items, page, pageSize);
}
