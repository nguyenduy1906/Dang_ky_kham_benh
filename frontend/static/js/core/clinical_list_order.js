function instant(row, end = false) {
  const timestamp = end ? row.appointment_end_at : row.estimated_exam_at;
  if (timestamp && Number.isFinite(Date.parse(timestamp))) return Date.parse(timestamp);
  const time = end ? row.end_time : row.start_time;
  if (!row.work_date) return Infinity;
  const value = Date.parse(`${row.work_date}T${time || "23:59:59"}+07:00`);
  return Number.isFinite(value) ? value : Infinity;
}

export function compareClinicalTime(a, b) {
  for (const end of [false, true]) {
    const left = instant(a, end), right = instant(b, end);
    if (left !== right) return left < right ? -1 : 1;
  }
  for (const field of ["schedule_id", "encounter_id", "assignment_id"]) {
    const left = Number(a[field]) || 0, right = Number(b[field]) || 0;
    if (left !== right) return left - right;
  }
  return String(a.doctor_name || "").localeCompare(String(b.doctor_name || ""), "vi");
}

export function chronologicalPage(rows, page, pageSize) {
  const items = [...rows].sort(compareClinicalTime);
  const current = Math.min(Math.max(1, page), Math.max(1, Math.ceil(items.length / pageSize)));
  return { items: items.slice((current - 1) * pageSize, current * pageSize), total: items.length, page: current, page_size: pageSize };
}
