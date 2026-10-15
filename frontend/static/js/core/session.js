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
const signInUrl = new URL("auth/login.html", templates);
const patientOnlyMessage = "Giao diện hiện chỉ hỗ trợ đăng nhập bằng tài khoản bệnh nhân. Giao diện cho các vai trò khác chưa được triển khai.";
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

export async function signIn(credentials) {
  const result = await authApi.login(credentials);
  if (typeof result?.access_token !== "string" || !result.access_token || result.token_type !== "Bearer" ||
      !Number.isFinite(result.expires_in) || result.expires_in <= 0) {
    throw new ApiError("Phản hồi đăng nhập không hợp lệ.");
  }
  // Use the role returned by the backend; never accept a role supplied in the form.
  if (result.user?.role_name !== "USER") {
    clearSession();
    throw new ApiError(patientOnlyMessage, { code: "CLIENT_ROLE_NOT_SUPPORTED" });
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
}

export async function getSessionUser() {
  const session = readSession();
  if (!session) return null;
  if (verification?.token === session.token) return verification.promise;
  const promise = (async () => {
    try {
      const result = await authApi.getMe({ token: session.token });
      if (!result?.user?.user_id) throw new ApiError("Không thể xác minh phiên đăng nhập.");
      // Also reject staff sessions saved before this frontend restriction was added.
      if (result.user.role_name !== "USER") {
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
  return Boolean(await getSessionUser());
}

export async function signOut() {
  const session = readSession();
  try { if (session) await authApi.logout({ token: session.token }); }
  finally { clearSession(); }
}

export function isPortal(url) {
  return url.origin === portalUrl.origin && url.pathname === portalUrl.pathname;
}

export function returnUrl(value) {
  try {
    const url = new URL(value || homeUrl.href, location.href);
    if (url.origin === homeUrl.origin && url.protocol === homeUrl.protocol &&
        !url.username && !url.password &&
        [homeUrl.pathname, portalUrl.pathname, bookingUrl.pathname, bookingReviewUrl.pathname, appointmentsUrl.pathname,
          profileUrl.pathname].includes(url.pathname)) return url;
  } catch { /* Never redirect to an untrusted next URL. */ }
  return new URL(homeUrl);
}

export function loginUrl(destination = portalUrl) {
  const url = new URL(signInUrl);
  url.searchParams.set("next", returnUrl(destination.href || destination).href);
  return url;
}
