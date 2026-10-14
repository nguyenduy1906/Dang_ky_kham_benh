const prefix = "neu:booking-review:";
const maxAge = 30 * 60 * 1000;
export function saveDraft(value, key = crypto.randomUUID()) {
  sessionStorage.setItem(prefix + key, JSON.stringify({ ...value, updatedAt: Date.now() }));
  return key;
}
export function readDraft(key, userId) {
  if (!key || !/^[a-f0-9-]{36}$/i.test(key)) return null;
  try {
    const draft = JSON.parse(sessionStorage.getItem(prefix + key));
    if (!draft || draft.user_id !== userId || !Number.isFinite(draft.updatedAt) || Date.now() - draft.updatedAt > maxAge) return null;
    return draft;
  } catch { return null; }
}
export function draftRequest(draft) {
  return { patient_id: draft.patient_id, schedule_id: draft.schedule_id, appointment_time: draft.appointment_time, symptoms: draft.symptoms };
}
