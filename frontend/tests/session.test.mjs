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
  for (const value of ["https://unlisted.example/", "javascript:alert(1)", "../auth/login.html", "//unlisted.example"]) {
    assert.equal(session.returnUrl(value).href, session.homeUrl.href);
  }
});
test("staff and missing/unknown roles cannot save a frontend login session", async () => {
  for (const role of ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "UNKNOWN", undefined]) {
    response = () => Response.json({ access_token: "staff-token", token_type: "Bearer", expires_in: 7200,
      user: { user_id: 2, role_name: role } });
    await assert.rejects(login(), { code: "CLIENT_ROLE_NOT_SUPPORTED" });
    assert.equal(session.hasSession(), false);
    assert.equal(values.size, 0);
  }
});
test("me rejects old staff sessions and a patient's role changed by the backend", async () => {
  await login();
  response = () => Response.json({ user: { user_id: 1, role_name: "ADMIN" } });
  assert.equal(await session.verifySession(), false);
  assert.equal(session.hasSession(), false);
  for (const role of ["DOCTOR", "NURSE", "RECEPTIONIST", undefined]) {
    values.set("neu-medical.auth", JSON.stringify({ token: "old-staff-token", expiresAt: Date.now() + 7200000 }));
    response = () => Response.json({ user: { user_id: 2, role_name: role } });
    assert.equal(await session.verifySession(), false);
    assert.equal(values.size, 0);
  }
});
