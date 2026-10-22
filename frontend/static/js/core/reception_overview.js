// Count today’s encounters supplied by the existing dashboard reader.
export function receptionOverviewCounts(rows) {
  return {
    pending: rows.filter(row => row.encounter_type === "ONLINE" && row.encounter_status === "CONFIRMED").length,
    waiting: rows.filter(row => row.encounter_status === "CHECKED_IN").length,
    received: rows.filter(row => Boolean(row.checked_in_at) || ["CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(row.encounter_status)).length,
  };
}
