export function allAvailableSelected(rows, selected, key, canSelect = () => true) {
  return rows.some(row => selected.has(key(row)))
    && rows.every(row => selected.has(key(row)) || !canSelect(row));
}

export function toggleAllAvailable(rows, selected, key, canSelect = () => true) {
  if (allAvailableSelected(rows, selected, key, canSelect)) selected.clear();
  else for (const row of rows) if (canSelect(row)) selected.add(key(row));
}
