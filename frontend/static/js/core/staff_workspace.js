import { getSessionUser, loginUrl, workspaceUrl, signOut, clearSession, hasSession } from "./session.js";
import { API_CONFIG } from "../config.js";
import { getOwnProfile } from "../api/doctor.js";
import { mountStaffWorkspace, getStaffRole } from "./staff_shell.js";
export { staffRoles, resolveStaffRole, getStaffRole } from "./staff_shell.js";

export const backendRoles = Object.freeze({ DOCTOR: "doctor", NURSE: "nurse", RECEPTIONIST: "reception", ADMIN: "admin" });
export function canOpenStaffPage(roleName, requestedRole, page) {
  const actual = Object.hasOwn(backendRoles, roleName) ? backendRoles[roleName] : null;
  return Boolean(actual && (page === "profile" || actual === requestedRole));
}
export function avatarUrl(value) {
  if (typeof value !== "string" || !/^\/uploads\/avatars\/[0-9a-f]{32}\.(jpg|png|webp)$/.test(value)) return "";
  return new URL(value, API_CONFIG.baseUrl).href;
}
export async function requireStaff() {
  const main = document.querySelector("#main-content");
  const status = document.querySelector("#staff-access");
  const suspend = () => { document.body.classList.add("staff-auth-pending"); if (main) main.inert = true; };
  suspend();
  // Render public navigation before waiting for /me; private content stays gated.
  const previewRole = getStaffRole();
  const shellMounted = Boolean(previewRole);
  if (shellMounted) mountStaffWorkspace();
  let active = true;
  window.addEventListener("pagehide", () => { active = false; }, { once: true });
  try {
    const user = await getSessionUser();
    if (!active) return null;
    if (!user) { location.replace(loginUrl(new URL(location.href)).href); return null; }
    const actualRole = backendRoles[user.role_name];
    const requestedRole = getStaffRole();
    if (!canOpenStaffPage(user.role_name, requestedRole, document.body.dataset.page)) {
      if (status) {
        status.replaceChildren();
        const p = document.createElement("p"); p.textContent = "Tài khoản của bạn không có quyền truy cập khu vực này.";
        const link = document.createElement("a"); link.href = workspaceUrl(user.role_name).href; link.textContent = "Về khu vực của tôi";
        status.append(p, link);
      }
      return null;
    }
    if (shellMounted && actualRole !== previewRole) {
      // A shared profile may be opened with another role's presentation hint.
      // Re-enter with the verified role rather than mounting two sets of controls.
      const url = new URL(location.href); url.searchParams.set("role", actualRole);
      location.replace(url.href); return null;
    }
    document.body.dataset.role = actualRole;
    if (!shellMounted) mountStaffWorkspace();
    document.querySelector("#staff-account-name").textContent = user.full_name;
    if (actualRole === "doctor") {
      getOwnProfile().then(({ doctor }) => {
        const url = avatarUrl(doctor.avatar_url), container = document.querySelector(".staff-initials");
        if (!url || !container) return;
        const img = document.createElement("img"); img.src = url; img.alt = "";
        img.addEventListener("error", () => { container.textContent = "BS"; }); container.replaceChildren(img);
      }).catch(() => { /* A missing professional profile does not block account access. */ });
    }
    document.querySelector("#staff-signout").addEventListener("click", async event => {
      event.currentTarget.disabled = true;
      try { await signOut(); } catch { /* Local session is cleared by signOut. */ }
      location.replace(loginUrl(workspaceUrl(user.role_name)).href);
    });
    // Keep the outgoing frame intact for native navigation snapshots.
    // A restored document must verify its session again before showing data.
    window.addEventListener("pageshow", event => { if (event.persisted) { suspend(); location.reload(); } });
    window.addEventListener("neu:auth-change", () => { if (!hasSession()) { suspend(); location.replace(loginUrl(location.href).href); } });
    document.body.classList.remove("staff-auth-pending");
    if (main) main.inert = false;
    if (status) status.hidden = true;
    return user;
  } catch (error) {
    if (!active) return null;
    if (status) { status.textContent = error.message; const retry = document.createElement("button"); retry.textContent = "Thử lại"; retry.addEventListener("click", () => location.reload()); status.append(retry); }
    return null;
  }
}
export function sessionError(error) {
  if (error.status === 401) clearSession();
  return error.message || "Không thể tải dữ liệu.";
}
export const staffReady = typeof document !== "undefined" && document.body.classList.contains("staff-page") ? requireStaff() : Promise.resolve(null);
