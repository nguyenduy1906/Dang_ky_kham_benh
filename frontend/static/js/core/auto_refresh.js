import { hasPendingApiRequests } from "./api.js";

export const AUTO_REFRESH_MS = 30_000;

// Refresh only existing readers. Mutations must always remain user initiated.
export function startAutoRefresh(read, {
  canRefresh = () => true,
  environment = globalThis,
} = {}) {
  const { document, window } = environment;
  let timer, retry, running = false, disposed = false, paused = false, lastAttempt = Date.now();
  async function tick() {
    if (disposed || paused || running || document.visibilityState === "hidden" || !canRefresh()) return;
    // Several readers can share a page (home/news). Wait for an in-flight
    // request instead of letting the same reader miss every 30-second cycle.
    if (hasPendingApiRequests()) {
      if (retry === undefined) retry = environment.setTimeout(() => { retry = undefined; void tick(); }, 1000);
      return;
    }
    if (document.querySelector('dialog[open], [aria-busy="true"], [data-saving="true"], [data-busy="true"], .staff-auth-pending, main[inert]') ||
        document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) return;
    environment.clearTimeout(retry);
    retry = undefined;
    running = true;
    lastAttempt = Date.now();
    try { await read(); }
    catch (error) { console.warn("Không thể tự cập nhật dữ liệu; sẽ thử lại sau 30 giây.", error); }
    finally { running = false; }
  }
  function resume() {
    if (disposed || timer !== undefined) return;
    paused = false;
    lastAttempt = Date.now();
    timer = environment.setInterval(tick, AUTO_REFRESH_MS);
    timer.unref?.();
  }
  function pause() {
    paused = true;
    environment.clearInterval(timer);
    environment.clearTimeout(retry);
    retry = undefined;
    timer = undefined;
  }
  function visible() {
    if (document.visibilityState !== "hidden" && Date.now() - lastAttempt >= AUTO_REFRESH_MS) void tick();
  }
  window.addEventListener("pagehide", pause);
  window.addEventListener("pageshow", resume);
  window.addEventListener("visibilitychange", visible);
  resume();
  return () => {
    disposed = true;
    pause();
    window.removeEventListener("pagehide", pause);
    window.removeEventListener("pageshow", resume);
    window.removeEventListener("visibilitychange", visible);
  };
}
