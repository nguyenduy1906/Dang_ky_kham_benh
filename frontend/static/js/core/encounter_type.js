export const encounterTypeLabel = value => ({ONLINE:'Trực tuyến',WALK_IN:'Trực tiếp'}[value] || '—');
export const encounterTypeBadge = value => `<span class="badge encounter-type-${value === 'ONLINE' ? 'online' : value === 'WALK_IN' ? 'direct' : 'unknown'}">${encounterTypeLabel(value)}</span>`;
