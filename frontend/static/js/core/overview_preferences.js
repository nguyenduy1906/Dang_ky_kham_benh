export const NURSE_OVERVIEW_STORAGE_KEY = "neu-medical.overview.nurse";

export function resetOverviewPreferences() {
  try { sessionStorage.removeItem(NURSE_OVERVIEW_STORAGE_KEY); } catch { /* Optional UI preference storage. */ }
}
