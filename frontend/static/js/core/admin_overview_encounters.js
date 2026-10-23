import { badge, table } from "./admin_ui.js";

export function selectOverviewEncounters(rows) {
  // Keep all matching rows; the table's own scroll area shows five at a time.
  return rows.filter(row => ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "NO_SHOW"].includes(row.encounter_status));
}

export function overviewEncounterTable(rows, resource) {
  const ticketColumn = resource.columns.indexOf("Mã phiếu");
  const columns = resource.columns.filter((_, index) => index !== ticketColumn);
  const statusColumn = resource.columns.indexOf("Trạng thái");
  const cells = selectOverviewEncounters(rows).map(row => {
    const values = resource.cells(row);
    values[statusColumn] = badge(row.encounter_status);
    return values.filter((_, index) => index !== ticketColumn);
  });
  return `<div class="admin-overview-encounters">${table(columns, cells, "Lượt khám hôm nay")}</div>`;
}
