import { table } from "./admin_ui.js";

export function selectOverviewEncounters(rows) {
  // Keep all matching rows; the table's own scroll area shows five at a time.
  return rows.filter(row => ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "NO_SHOW"].includes(row.encounter_status));
}

export function overviewEncounterTable(rows, resource) {
  const ticketColumn = resource.columns.indexOf("Mã phiếu");
  const columns = resource.columns.filter((_, index) => index !== ticketColumn);
  const statusColumn = resource.columns.indexOf("Trạng thái");
  const statusBadges = {
    CONFIRMED: ["blue", "Đã xác nhận"],
    CHECKED_IN: ["amber", "Chờ khám"],
    IN_PROGRESS: ["purple", "Đang khám"],
    COMPLETED: ["green", "Hoàn thành"],
    NO_SHOW: ["red", "Không đến"],
  };
  const cells = selectOverviewEncounters(rows).map(row => {
    const values = resource.cells(row);
    const [color, label] = statusBadges[row.encounter_status];
    values[statusColumn] = `<span class="badge ${color}">${label}</span>`;
    return values.filter((_, index) => index !== ticketColumn);
  });
  return `<div class="admin-overview-encounters">${table(columns, cells, "Lượt khám hôm nay")}</div>`;
}
