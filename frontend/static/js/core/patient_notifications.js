import { getSessionUser, hasSession } from "./session.js";

// Presentation only: no notification requests, generated reminders or read-state storage.
export function initPatientNotifications() {
  const header = document.querySelector("body > .site-header, body > .patient-header");
  const identity = header?.querySelector(".identity");
  if (!identity || identity.querySelector(".patient-notifications")) return;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = new URL("../../css/patient_notifications.css", import.meta.url).href;
  document.head.append(stylesheet);

  const host = document.createElement("div");
  host.className = "patient-notifications";
  host.hidden = true;
  host.innerHTML = `
    <button type="button" class="patient-notification-bell" aria-label="Thông báo" title="Thông báo" aria-expanded="false" aria-controls="patient-notification-panel">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4M12 2V1"/></svg>
    </button>
    <section id="patient-notification-panel" class="patient-notification-panel" aria-labelledby="patient-notification-title" hidden>
      <div class="patient-notification-heading"><h2 id="patient-notification-title">Thông báo</h2><button type="button" class="patient-notification-close" aria-label="Đóng thông báo">×</button></div>
      <div class="patient-notification-filters" role="group" aria-label="Lọc thông báo"><button type="button" aria-pressed="true">Tất cả</button><button type="button" aria-pressed="false">Chưa đọc</button></div>
      <div class="patient-notification-empty" role="status"><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg></span><h3>Chưa có thông báo</h3><p>Lời nhắc lịch khám và thông báo khi có kết quả khám sẽ xuất hiện tại đây.</p></div>
    </section>`;
  const avatar = identity.querySelector(".patient-account-link");
  if (avatar) identity.insertBefore(host, avatar);
  else identity.append(host);
  const bell = host.querySelector(".patient-notification-bell");
  const panel = host.querySelector(".patient-notification-panel");
  const title = host.querySelector(".patient-notification-empty h3");
  const filters = [...host.querySelectorAll(".patient-notification-filters button")];
  function close(restoreFocus = false) {
    panel.hidden = true;
    bell.setAttribute("aria-expanded", "false");
    if (restoreFocus) bell.focus();
  }
  bell.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    bell.setAttribute("aria-expanded", String(!panel.hidden));
  });
  host.querySelector(".patient-notification-close").addEventListener("click", () => close(true));
  filters.forEach((button, index) => button.addEventListener("click", () => {
    filters.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    title.textContent = index ? "Không có thông báo chưa đọc" : "Chưa có thông báo";
  }));
  document.addEventListener("click", event => { if (!host.contains(event.target)) close(); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.hidden) { close(true); event.preventDefault(); }
  });
  document.addEventListener("focusin", event => { if (!host.contains(event.target)) close(); });
  let version = 0;
  async function refresh() {
    const current = ++version;
    host.hidden = true;
    close();
    if (!hasSession()) return;
    try {
      const user = await getSessionUser();
      if (current === version && hasSession()) host.hidden = user?.role_name !== "USER";
    } catch { /* Keep the bell hidden until the existing session is verified. */ }
  }
  window.addEventListener("neu:auth-change", refresh);
  window.addEventListener("pageshow", refresh);
  window.addEventListener("pagehide", () => { version++; host.hidden = true; close(); });
  refresh();
}
