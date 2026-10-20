import { listPatients } from "../api/patient.js";
import { allPages } from "./admin_ui.js";

export async function listAdminPatients(params, options = {}) {
  const { patient_status = "ACTIVE", ...filters } = params;
  if (patient_status === "ACTIVE") {
    return listPatients({ ...filters, include_archived: false }, options);
  }
  const { page = 1, page_size = 20, ...query } = filters;
  const rows = await allPages(listPatients, { ...query, include_archived: true }, options.signal);
  const items = rows.filter(row => patient_status !== "INACTIVE" || row.is_archived)
    .sort((a, b) => Number(Boolean(a.is_archived)) - Number(Boolean(b.is_archived))
      || Number(b.patient_id) - Number(a.patient_id));
  const current = Math.min(Math.max(1, page), Math.max(1, Math.ceil(items.length / page_size)));
  return { items: items.slice((current - 1) * page_size, current * page_size),
    total: items.length, page: current, page_size };
}
