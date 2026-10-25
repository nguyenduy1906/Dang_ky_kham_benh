import { adminSections as sections, adminPageHref } from "../data/admin_navigation.js";
import { adminPages as pages, initAdminWorkspace } from "../core/admin_workspace.js";
import { initializeSidebarCollapse } from "../core/sidebar_collapse.js";
import { staffTopbar } from "../core/staff_topbar.js";
import { enhanceDialogDismiss } from "../core/dialog_dismiss.js";

import { requireAdmin } from "../core/admin_access.js";
import {initAdminNotificationBadge,initAdminActivityBadge} from "../core/admin_notification_badge.js";
import {initAdminTopbar,focusAdminFunction} from '../core/admin_topbar.js';
import { signOut, loginUrl, hasSession } from "../core/session.js";

// Verify the existing administrator session before loading management data.
window.addEventListener("pageshow", event => { if (event.persisted) { suspendAdmin(); location.reload(); } });
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const shapes = {
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  record: '<path d="M8 4H5v17h14V4h-3M9 2h6v4H9zM8 11h8M8 15h8"/>',
  people: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M21 21v-4a6 6 0 0 0-3-5"/>',
  person: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16"/><path d="M3 11h18M8 2v6M16 2v6"/>',
  cross: '<path d="M7 3h10v9a5 5 0 0 1-10 0zM9 8h6M12 5v6M12 17v5M8 20h8"/>',
  doctor: '<path d="M4 3v6a5 5 0 0 0 10 0V3M2 3h4M12 3h4M9 14v3a5 5 0 0 0 10 0v-3"/><circle cx="19" cy="11" r="3"/>',
  building: '<rect x="5" y="3" width="14" height="18"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M10 21v-6h4v6"/>',
  door: '<rect x="6" y="3" width="12" height="18"/><path d="M14 12h1"/>',
  card: '<rect x="2" y="5" width="20" height="14"/><path d="M2 10h20M6 15h4"/>',
  chart: '<path d="M3 21h19M5 17V9M10 17V3M15 17v-5M20 17V6"/>',
  history: '<path d="M3 11a9 9 0 1 1 2 7M3 3v8h8M12 6v6l4 2"/>',
  settings: '<path d="m12 2 3 3 4 1 1 4 2 2-2 3-1 4-4 1-3 2-3-2-4-1-1-4-2-3 2-2 1-4 4-1z"/><circle cx="12" cy="12" r="3"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
  bell: '<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 21h4"/>',
};
const icon = key => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[key] || shapes.record}</svg>`;
const key = Object.hasOwn(pages, document.body.dataset.page) ? document.body.dataset.page : "home";
const page = pages[key];
const profileHref = adminPageHref("profile");
const dialog = $("#admin-dialog");
enhanceDialogDismiss(dialog, {canClose: () => dialog.getAttribute("aria-busy") !== "true"});
$("#dialog-close").addEventListener("click", () => dialog.close());
$("#staff-sidebar").innerHTML = `<a class="staff-brand" href="home.html"><img src="../../static/assets/bieu_trung_neu.png" alt="Biểu trưng NEU"><span><strong>NEU Medical</strong><small>KHÔNG GIAN QUẢN TRỊ</small></span></a><nav aria-label="Điều hướng quản trị">${sections.map(([title, items]) => `<p class="staff-nav-label">${title}</p>${items.map(([id, label, symbol]) => `<a href="${adminPageHref(id)}" ${key === id ? 'aria-current="page"' : ""}>${icon(symbol)}<span>${label}</span></a>`).join("")}`).join("")}</nav><div class="staff-sidebar-bottom admin-logout"><button type="button" id="admin-signout" title="Đăng xuất"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 3H3v18h6M10 12h11M17 8l4 4-4 4"/></svg><span>Đăng xuất</span></button></div>`;
$("#staff-topbar").innerHTML = staffTopbar({ title: page.title, profileHref, name: "Quản trị viên", initials: "QT" });
$("#admin-signout").addEventListener("click", async event => {
  event.currentTarget.disabled = true;
  try { await signOut(); }
  catch { /* The local session is cleared even if the backend is unavailable. */ }
  finally { location.replace(loginUrl().href); }
});
function suspendAdmin() {
  document.body.classList.add("staff-auth-pending");
  $("#main-content").inert = true;
}
window.addEventListener("neu:auth-change", () => {
  if (!hasSession()) { suspendAdmin(); location.replace(loginUrl(new URL(location.href)).href); }
});
document.title = `${page.title} | NEU Medical`;
const menuButton = $(".staff-menu-toggle");
initializeSidebarCollapse("admin");
const backdrop = $("#menu-backdrop");
function setMenu(open, returnFocus = false) {
  document.body.classList.toggle("staff-menu-open", open);
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Đóng menu quản trị" : "Mở menu quản trị");
  backdrop.hidden = !open;
  $(".staff-main").inert = open;
  if (open) $(".staff-brand").focus();
  else if (returnFocus) menuButton.focus();
}
menuButton.addEventListener("click", () => setMenu(true));
backdrop.addEventListener("click", () => setMenu(false, true));
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && document.body.classList.contains("staff-menu-open") && !dialog.open) setMenu(false, true);
  if (event.key === "Tab" && document.body.classList.contains("staff-menu-open") && !dialog.open) {
    const items = [...$("#staff-sidebar").querySelectorAll("a, button")];
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
  }
});
matchMedia("(max-width: 960px)").addEventListener("change", event => { if (!event.matches) setMenu(false); });

const administrator = await requireAdmin();
if (administrator) {
  initAdminTopbar();
  initAdminNotificationBadge();
  initAdminActivityBadge();
  $("#staff-account-name").textContent = administrator.full_name;
  if (key === "reception_assignments") {
    const {initReceptionAssignmentPresentation} = await import("../core/admin_reception_assignment_presentation.js");
    await initReceptionAssignmentPresentation();
  } else if (key === "articles") {
    const { initArticlePresentation } = await import("../core/admin_article_presentation.js");
    await initArticlePresentation(administrator);
  } else if (["reviews", "notifications"].includes(key)) {
    const {initFeedbackPresentation} = await import("../core/admin_feedback_presentation.js");
    await initFeedbackPresentation(key);
  } else if (!page.placeholder) await initAdminWorkspace(key);
  focusAdminFunction();
}
