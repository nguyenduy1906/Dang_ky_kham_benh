import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as session from "../static/js/core/session.js";

const values = new Map();
globalThis.window = new EventTarget();
globalThis.location = session.homeUrl;
globalThis.sessionStorage = {
  getItem: key => values.get(key) || null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
};
let requests;
let response;
globalThis.fetch = async (url, options) => {
  requests.push({ url, ...options });
  return response(url, options);
};
beforeEach(() => {
  requests = []; values.clear(); session.clearSession();
  response = () => Response.json({ access_token: "test-token", token_type: "Bearer", expires_in: 7200,
    user: { user_id: 1, role_name: "USER" } });
});
const login = () => session.signIn({ identifier: "frontend@example.test", password: "Test-password-123" });

test("changing password replaces the revoked token without storing passwords", async () => {
  await login();
  response = () => Response.json({ access_token: "rotated-token", token_type: "Bearer", expires_in: 7200, message: "Đã đổi mật khẩu" });
  await session.changeOwnPassword({ current_password: "Old-password-123", new_password: "New-password-123" });
  assert.equal(new URL(requests.at(-1).url).pathname, "/me/change-password");
  assert.equal(requests.at(-1).headers.get("Authorization"), "Bearer test-token");
  const saved = JSON.parse(values.get("neu-medical.auth")); assert.equal(saved.token, "rotated-token");
  assert.deepEqual(Object.keys(saved).sort(), ["expiresAt", "token"]);
});
test("late password change cannot overwrite a new session", async () => {
  await login(); let finish;
  response = () => new Promise(resolve => { finish = resolve; });
  const changing = session.changeOwnPassword({ current_password: "Old-password-123", new_password: "New-password-123" });
  session.clearSession(); values.set("neu-medical.auth", JSON.stringify({ token: "another-session", expiresAt: Date.now() + 60000 }));
  finish(Response.json({ access_token: "stale-token", token_type: "Bearer", expires_in: 7200 }));
  await assert.rejects(changing, error => error.code === "SESSION_CHANGED");
  assert.equal(JSON.parse(values.get("neu-medical.auth")).token, "another-session");
});

test("login stores only the backend token and expiry, never credentials or user data", async () => {
  await login();
  assert.equal(session.hasSession(), true);
  assert.deepEqual(Object.keys(JSON.parse(values.get("neu-medical.auth"))).sort(), ["expiresAt", "token"]);
  assert.equal(requests[0].headers.has("Authorization"), false);
});
test("expired and malformed sessions cannot enter the portal or call me", async () => {
  for (const value of ['{"token":"old","expiresAt":1}', '{broken']) {
    values.set("neu-medical.auth", value);
    assert.equal(await session.verifySession(), false);
    assert.equal(values.size, 0);
  }
  assert.equal(requests.length, 0);
});
test("unusable login responses and blocked storage cannot create a session", async () => {
  response = () => Response.json({ access_token: {}, token_type: "Bearer", expires_in: 7200 });
  await assert.rejects(login()); assert.equal(session.hasSession(), false);
  response = () => Response.json({ access_token: "test-token", token_type: "Bearer", expires_in: 7200,
    user: { user_id: 1, role_name: "USER" } });
  const save = sessionStorage.setItem;
  sessionStorage.setItem = () => { throw new Error("blocked"); };
  try { await assert.rejects(login(), /không cho phép lưu phiên/); }
  finally { sessionStorage.setItem = save; }
  assert.equal(session.hasSession(), false);
});
test("401/403 clears a session but connection failures preserve it for retry", async () => {
  await login();
  response = () => { throw new Error("offline"); };
  await assert.rejects(session.verifySession(), { code: "CLIENT_NETWORK_ERROR" });
  assert.equal(session.hasSession(), true);
  response = () => Response.json({ error: { code: "TOKEN_EXPIRED", message: "Phiên đăng nhập đã hết hạn" } }, { status: 401 });
  assert.equal(await session.verifySession(), false);
  assert.equal(session.hasSession(), false);
});
test("simultaneous checks reuse me and a late response cannot undo logout", async () => {
  await login();
  let finish;
  response = () => new Promise(resolve => { finish = resolve; });
  const first = session.verifySession(); const second = session.verifySession();
  assert.equal(requests.filter(r => new URL(r.url).pathname === "/me").length, 1);
  session.clearSession();
  finish(Response.json({ user: { user_id: 1, role_name: "USER" } }));
  assert.deepEqual(await Promise.all([first, second]), [false, false]);
});
test("logout removes the local session even if the backend is unreachable", async () => {
  await login();
  response = () => { throw new Error("offline"); };
  await assert.rejects(session.signOut());
  assert.equal(session.hasSession(), false);
});
test("next preserves a chosen doctor and rejects external/unsupported destinations", () => {
  const portal = new URL(session.portalUrl); portal.searchParams.set("doctor", "7");
  assert.equal(session.returnUrl(portal.href).href, portal.href);
  assert.equal(session.loginUrl(portal).searchParams.get("next"), portal.href);
  const booking = new URL(session.bookingUrl); booking.searchParams.set("encounter", "42");
  assert.equal(session.loginUrl(booking).searchParams.get("next"), booking.href);
  const review = new URL(session.bookingReviewUrl); review.searchParams.set("draft", "test-draft");
  assert.equal(session.loginUrl(review).searchParams.get("next"), review.href);
  const appointments = new URL(session.appointmentsUrl); appointments.searchParams.set("view", "history");
  assert.equal(session.loginUrl(appointments).searchParams.get("next"), appointments.href);
  for (const value of ["https://unlisted.example/", "javascript:alert(1)", "../auth/login.html", "//unlisted.example"]) {
    assert.equal(session.returnUrl(value).href, session.homeUrl.href);
  }
});
test("hospital staff can sign in, while unknown or missing roles cannot", async () => {
  for (const role of ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"]) {
    response = () => Response.json({ access_token: "staff-token", token_type: "Bearer", expires_in: 7200,
      user: { user_id: 2, role_name: role } });
    assert.equal((await login()).role_name, role);
    assert.equal(session.hasSession(), true);
    response = () => Response.json({ user: { user_id: 2, role_name: role } });
    assert.equal(await session.verifySession(), false, "staff must not pass the patient-page guard");
    assert.equal(session.hasSession(), true, "patient guard must not destroy a valid staff session");
    assert.equal((await session.getSessionUser()).role_name, role);
    session.clearSession();
  }
  for (const role of ["UNKNOWN", "constructor", "__proto__", undefined]) {
    response = () => Response.json({ access_token: "staff-token", token_type: "Bearer", expires_in: 7200,
      user: { user_id: 2, role_name: role } });
    await assert.rejects(login(), { code: "CLIENT_ROLE_NOT_SUPPORTED" });
    assert.equal(session.hasSession(), false);
  }
});
test("role-specific return URLs reject cross-role and crafted destinations", () => {
  for (const [role, folder] of [["ADMIN", "admin"], ["DOCTOR", "doctor"], ["NURSE", "nurse"], ["RECEPTIONIST", "reception"]]) {
    const home = session.workspaceUrl(role);
    const own = new URL(`../(${folder})/home.html`, session.profileUrl);
    assert.equal(session.returnUrl(own.href, role).href, own.href);
    for (const input of ["https://unlisted.example/", session.portalUrl.href, new URL("../(other)/home.html", home).href, "javascript:alert(1)", "//unlisted.example"])
      assert.equal(session.returnUrl(input, role).href, home.href);
    assert.equal(session.returnUrl(null, role).href, home.href);
    const profile = new URL("../components/profile.html?role=admin", session.profileUrl);
    assert.equal(session.returnUrl(profile.href, role).pathname, profile.pathname, "shared profile derives actual role from /me");
  }
});
test("a backend role change is rechecked and invalid backend roles clear the session", async () => {
  await login();
  response = () => Response.json({ user: { user_id: 1, role_name: "DOCTOR" } });
  assert.equal(await session.verifySession(), false);
  assert.equal((await session.getSessionUser()).role_name, "DOCTOR");
  response = () => Response.json({ user: { user_id: 1, role_name: "UNKNOWN" } });
  assert.equal(await session.getSessionUser(), null);
  assert.equal(session.hasSession(), false);
});
