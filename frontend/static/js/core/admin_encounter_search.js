import {normalizeSearchText, matchesSearch} from "./search_text.js";
import { listEncounters } from "../api/encounter.js";
import { allPages } from "./admin_ui.js";
import { code } from "./business_codes.js";
import { chronologicalPage } from "./clinical_list_order.js";

const normalize = normalizeSearchText;

export async function searchAdminEncounters(params, page, pageSize, signal) {
  const { q, ...filters } = params;
  const query = normalize(q);
  const rows = await allPages(listEncounters, filters, signal);
  const items = rows.filter(row => {
    const values = [row.patient_name, row.doctor_name, row.room_name, row.ticket_code,
      code("LK", row.encounter_id), code("BN", row.patient_id), code("CA", row.schedule_id),
      code("BS", row.doctor_profile_id), code("PH", row.room_id)].map(normalize);
    return matchesSearch(values.join(" "),query);
  });
  return chronologicalPage(items, page, pageSize);
}
