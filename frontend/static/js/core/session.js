import * as authApi from "../api/auth.js";
import { ApiError, setAccessToken } from "./api.js";

const STORAGE_KEY = "neu-medical.auth";
const templates = new URL("../../../templates/", import.meta.url);
export const homeUrl = new URL("public/home.html", templates);
export const portalUrl = new URL("(patient)/portal.html", templates);
export const bookingUrl = new URL("(patient)/booking.html", templates);
export const bookingReviewUrl = new URL("(patient)/booking_review.html", templates);
export const appointmentsUrl = new URL("(patient)/appointments.html", templates);
export const profileUrl = new URL("(patient)/profile.html", templates);
export const recordsUrl = new URL("(patient)/records.html", templates);
const signInUrl = new URL("auth/login.html", templates);
export const rolePaths = Object.freeze({ USER: "(patient)/portal.html", DOCTOR: "(doctor)/home.html", NURSE: "(nurse)/home.html", RECEPTIONIST: "(reception)/home.html", ADMIN: "(admin)/home.html" });
export function workspaceUrl(role) { return new URL(Object.hasOwn(rolePaths, role) ? rolePaths[role] : "public/home.html", templates); }
let verification;

function announce() { window.dispatchEvent(new Event("neu:auth-change")); }

export function clearSession() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be disabled. */ }
  setAccessToken(null);
  announce();
}

function readSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (value && typeof value.token === "string" && value.token &&
        Number.isFinite(value.expiresAt) && value.expiresAt > Date.now()) {
      setAccessToken(value.token);
      return value;
    }
  } catch { /* Treat malformed/unavailable storage as signed out. */ }
  setAccessToken(null);
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Nothing to restore. */ }
  return null;
}

export function hasSession() { return Boolean(readSession()); }

export async function changeOwnPassword(data, options = {}) {
  const previous = readSession();
  if (!previous) throw new ApiError("Phiên đăng nhập đã hết hạn.", { status: 401 });
  const result = await authApi.changePassword(data, { ...options, token: previous.token });
  if (options.signal?.aborted || readSession()?.token !== previous.token) throw new ApiError("Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.", { code: "SESSION_CHANGED" });
  if (typeof result?.access_token !== "string" || !result.access_token || result.token_type !== "Bearer" || !Number.isFinite(result.expires_in) || result.expires_in <= 0) {
    clearSession();
    throw new ApiError("Mật khẩu có thể đã đổi nhưng không nhận được phiên mới hợp lệ. Vui lòng đăng nhập lại.");
  }
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token: result.access_token, expiresAt: Date.now() + result.expires_in * 1000 })); }
  catch (cause) { clearSession(); throw new ApiError("Không thể lưu phiên mới. Vui lòng đăng nhập lại bằng mật khẩu mới.", { cause }); }
  verification = undefined;
  setAccessToken(result.access_token);
  return result;
}

export async function signIn(credentials) {
  const result = await authApi.login(credentials);
  if (typeof result?.access_token !== "string" || !result.access_token || result.token_type !== "Bearer" ||
      !Number.isFinite(result.expires_in) || result.expires_in <= 0) {
    throw new ApiError("Phản hồi đăng nhập không hợp lệ.");
  }
  // Use the role returned by the backend; never accept a role supplied in the form.
  if (!Object.hasOwn(rolePaths, result.user?.role_name)) {
    clearSession();
    throw new ApiError("Tài khoản chưa có khu vực truy cập phù hợp.", { code: "CLIENT_ROLE_NOT_SUPPORTED" });
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      token: result.access_token, expiresAt: Date.now() + result.expires_in * 1000,
    }));
  } catch (cause) {
    clearSession();
    throw new ApiError("Trình duyệt không cho phép lưu phiên đăng nhập. Vui lòng bật lưu trữ cho trang này.", { cause });
  }
  setAccessToken(result.access_token);
  announce();
  return result.user;
}

export async function getSessionUser() {
  const session = readSession();
  if (!session) return null;
  if (verification?.token === session.token) return verification.promise;
  const promise = (async () => {
    try {
      const result = await authApi.getMe({ token: session.token });
      if (!result?.user?.user_id) throw new ApiError("Không thể xác minh phiên đăng nhập.");
      // Recheck the current backend role; stored client data never grants a role.
      if (!Object.hasOwn(rolePaths, result.user.role_name)) {
        if (readSession()?.token === session.token) clearSession();
        return null;
      }
      // A logout/new login during this request must not revive the previous session.
      return readSession()?.token === session.token ? result.user : null;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        if (readSession()?.token === session.token) clearSession();
        return null;
      }
      throw error;
    } finally {
      if (verification?.token === session.token) verification = undefined;
    }
  })();
  verification = { token: session.token, promise };
  return promise;
}

export async function verifySession() {
  return (await getSessionUser())?.role_name === "USER";
}

export async function signOut() {
  const session = readSession();
  try { if (session) await authApi.logout({ token: session.token }); }
  finally { clearSession(); }
}

export function isPortal(url) {
  return url.origin === portalUrl.origin && url.pathname === portalUrl.pathname;
}

export function returnUrl(value, role = "USER") {
  const fallback = role === "USER" ? homeUrl : workspaceUrl(role);
  try {
    const url = new URL(value || fallback.href, location.href);
    const relative = decodeURIComponent(url.pathname.slice(templates.pathname.length));
    const staffFiles = { ADMIN: ["home", "encounters", "patients", "schedule", "assignments", "doctors", "departments", "rooms", "users", "articles", "payments", "statistics", "audit", "configuration"], DOCTOR: ["home", "schedule", "encounters", "clinical", "history", "professional"], NURSE: ["home", "assignments", "patients", "support"], RECEPTIONIST: ["home", "encounters", "walk_in", "patients", "coordination"] };
    const folder = { ADMIN: "admin", DOCTOR: "doctor", NURSE: "nurse", RECEPTIONIST: "reception" }[role];
    const staffAllowed = role !== "USER" && (relative === "components/profile.html" || (staffFiles[role] || []).some(file => relative === `(${folder})/${file}.html`));
    if (url.origin === homeUrl.origin && url.protocol === homeUrl.protocol &&
        url.pathname.startsWith(templates.pathname) &&
        !url.username && !url.password &&
        (staffAllowed || (role === "USER" && [homeUrl.pathname, portalUrl.pathname, bookingUrl.pathname, bookingReviewUrl.pathname, appointmentsUrl.pathname,
          profileUrl.pathname, recordsUrl.pathname].includes(url.pathname)))) return url;
  } catch { /* Never redirect to an untrusted next URL. */ }
  return new URL(fallback);
}

export function loginUrl(destination = portalUrl) {
  const url = new URL(signInUrl);
  // Destination is validated again against the server-verified role after login.
  const target = new URL(destination.href || destination, homeUrl);
  url.searchParams.set("next", target.origin === homeUrl.origin ? target.href : homeUrl.href);
  return url;
}
