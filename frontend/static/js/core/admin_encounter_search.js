import { listEncounters } from "../api/encounter.js";
import { allPages } from "./admin_ui.js";
import { code } from "./business_codes.js";
import { chronologicalPage } from "./clinical_list_order.js";

const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("vi").trim();

export async function searchAdminEncounters(params, page, pageSize, signal) {
  const { q, ...filters } = params;
  const query = normalize(q);
  const rows = await allPages(listEncounters, filters, signal);
  const terms = query.split(/\s+/);
  const items = rows.filter(row => {
    const values = [row.patient_name, row.doctor_name, row.room_name, row.ticket_code,
      code("LK", row.encounter_id), code("BN", row.patient_id), code("CA", row.schedule_id),
      code("BS", row.doctor_profile_id), code("PH", row.room_id)].map(normalize);
    return terms.every(term => values.some(value => value.includes(term)));
  });
  return chronologicalPage(items, page, pageSize);
}
