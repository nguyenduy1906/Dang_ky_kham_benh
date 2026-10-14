import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Test doubles only intercept fetch in these tests; no demo API is added to the app.
let calls = [];
let respond = () => Response.json({ marker: "backend-response" });
globalThis.fetch = async (url, options) => {
  calls.push({ url: new URL(url), ...options });
  return respond(url, options);
};
const api = await import("../static/js/api/index.js");
assert.equal(calls.length, 0, "Importing API modules must not send requests");

beforeEach(() => {
  calls = [];
  respond = () => Response.json({ marker: "backend-response" });
  api.setAccessToken(null);
});

test("each existing backend endpoint has one JS wrapper with the correct method and payload", async () => {
  // Read actual Python decorators, not a hand-maintained copy of endpoint URLs.
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const script = String.raw`
import ast,json
from pathlib import Path
routes=[]
for p in sorted(Path('backend/app/routes').glob('*.py')):
    tree=ast.parse(p.read_text(encoding='utf-8-sig')); prefixes={}
    for node in tree.body:
        if isinstance(node,ast.Assign) and isinstance(node.value,ast.Call) and getattr(node.value.func,'id','')=='Blueprint':
            prefixes[node.targets[0].id]=next((ast.literal_eval(k.value) for k in node.value.keywords if k.arg=='url_prefix'),'')
    for node in tree.body:
        if not isinstance(node,ast.FunctionDef): continue
        protected=any(getattr(d,'id','')=='login_required' or isinstance(d,ast.Call) and getattr(d.func,'id','')=='roles_required' for d in node.decorator_list)
        for d in node.decorator_list:
            if isinstance(d,ast.Call) and isinstance(d.func,ast.Attribute) and d.func.attr in ('get','post','patch','put','delete'):
                routes.append({'method':d.func.attr.upper(),'path':prefixes[d.func.value.id]+ast.literal_eval(d.args[0]),'protected':protected})
print(json.dumps(routes))
`;
  const routes = JSON.parse(execFileSync("python", ["-X", "utf8", "-c", script], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = (route) => new RegExp("^" + route.split(/(<[^>]+>)/).map((part) => part.startsWith("<")
    ? part.startsWith("<int:") ? "\\d+" : "[^/]+" : escape(part)).join("") + "$");
  const covered = new Set();
  const body = { reason: "Giữ nguyên nội dung", items: [], expected_version: 0, confirm_shared_phone: false };
  const params = { page: 2, page_size: 5, include_inactive: false, q: "Nguyễn & An" };
  let count = 0;
  for (const [group, namespace] of Object.entries(api).filter(([name]) => name.endsWith("Api"))) {
    for (const [name, fn] of Object.entries(namespace)) {
      const argumentsList = fn.toString().match(/\(([^)]*)\)/)[1].split(",").map((arg) => arg.trim().split("=")[0].trim());
      const args = argumentsList.map((arg) => {
        if (arg === "options") return { token: "test-token", timeoutMs: 0 };
        if (arg === "data") return body;
        if (arg === "params") return params;
        if (arg === "file") return new Blob(["test-image"], { type: "image/png" });
        if (arg === "slug") return "sample-article";
        if (arg === "key") return "HOSPITAL_NAME";
        if (arg === "filename") return "a".repeat(32) + ".png";
        return 7;
      });
      const result = await fn(...args);
      const call = calls.at(-1);
      const route = routes.find((candidate) => candidate.method === call.method && pattern(candidate.path).test(call.url.pathname));
      assert.ok(route, `${group}.${name} points to an endpoint absent from the backend`);
      const key = `${route.method} ${route.path}`;
      assert.ok(!covered.has(key), `Duplicate wrapper: ${key}`);
      covered.add(key);
      if (route.protected) assert.equal(call.headers.get("Authorization"), "Bearer test-token", key);
      assert.equal(call.url.origin, "http://127.0.0.1:5000");
      assert.ok(!call.url.pathname.includes("/api/v1"));
      if (argumentsList.includes("data")) assert.deepEqual(JSON.parse(call.body), body, `${key} must not alter body fields`);
      if (argumentsList.includes("params")) {
        assert.equal(call.url.searchParams.get("page"), "2");
        assert.equal(call.url.searchParams.get("include_inactive"), "false");
        assert.equal(call.url.searchParams.get("q"), params.q);
      }
      if (argumentsList.includes("file")) {
        assert.ok(call.body instanceof FormData);
        assert.equal(call.body.get("file").type, "image/png");
        assert.equal(call.headers.get("Content-Type"), null);
      }
      if (["getAvatar", "getImage"].includes(name)) assert.ok(result instanceof Blob);
      else assert.deepEqual(result, { marker: "backend-response" });
      count++;
    }
  }
  assert.equal(count, routes.length);
  assert.equal(covered.size, routes.length);
  for (const route of routes) assert.ok(covered.has(`${route.method} ${route.path}`));
});

test("backend errors retain their exact status, code, message and response body", async () => {
  for (const [status, code, message] of [
    [400, "VALIDATION_ERROR", "Thiếu trường full_name"],
    [401, "TOKEN_EXPIRED", "Phiên đăng nhập đã hết hạn"],
    [403, "ACCOUNT_LOCKED", "Tài khoản đã bị khóa"],
    [404, "PATIENT_NOT_FOUND", "Không tìm thấy hồ sơ bệnh nhân"],
    [409, "CONFIRM_SHARED_PHONE", "Xác nhận lưu hồ sơ người thân?"],
    [409, "RECORD_VERSION_CONFLICT", "Bệnh án đã thay đổi"],
    [500, "INTERNAL_ERROR", "Lỗi hệ thống"],
  ]) {
    const payload = { error: { code, message } };
    respond = () => Response.json(payload, { status });
    await assert.rejects(api.patientApi.getPatient(1), (error) => {
      assert.ok(error instanceof api.ApiError);
      assert.equal(error.status, status);
      assert.equal(error.code, code);
      assert.equal(error.message, message);
      assert.deepEqual(error.data, payload);
      return true;
    });
  }
});

test("token use is explicit, public auth endpoints omit it, and 401 does not change a session", async () => {
  api.setAccessToken("stored-token");
  await api.authApi.getMe();
  assert.equal(calls.at(-1).headers.get("Authorization"), "Bearer stored-token");
  await api.authApi.login({ identifier: "sample@example.test", password: "test-password" });
  assert.equal(calls.at(-1).headers.get("Authorization"), null);
  await api.authApi.getMe({ token: "override" });
  assert.equal(calls.at(-1).headers.get("Authorization"), "Bearer override");
  await api.authApi.getMe({ token: null });
  assert.equal(calls.at(-1).headers.get("Authorization"), null);
  respond = () => Response.json({ error: { code: "TOKEN_INVALID", message: "Token không hợp lệ" } }, { status: 401 });
  await assert.rejects(api.authApi.getMe(), { code: "TOKEN_INVALID" });
  respond = () => Response.json({ user: { user_id: 1 } });
  await api.authApi.getMe();
  assert.equal(calls.at(-1).headers.get("Authorization"), "Bearer stored-token");
});

test("query values preserve false and zero, and string path parameters are encoded", async () => {
  const url = new URL(api.apiUrl("/notifications", { unread_only: false, page: 0, missing: null, empty: "", absent: undefined }));
  assert.equal(url.searchParams.get("unread_only"), "false");
  assert.equal(url.searchParams.get("page"), "0");
  assert.equal(url.searchParams.size, 2);
  await api.articleApi.getBySlug("bài viết?#");
  assert.equal(calls[0].url.pathname, "/articles/" + encodeURIComponent("bài viết?#"));
  for (const path of ["https://other.example/me", "//other.example/me", "/\\other.example/me"]) {
    assert.throws(() => api.apiUrl(path), TypeError);
  }
});

test("image requests return a Blob and still preserve backend JSON errors", async () => {
  respond = () => new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } });
  const result = await api.doctorApi.getAvatar("a".repeat(32) + ".png");
  assert.equal(result.type, "image/png");
  assert.equal(result.size, 3);
  respond = () => Response.json({ error: { code: "NOT_FOUND", message: "Không tìm thấy ảnh" } }, { status: 404 });
  await assert.rejects(api.doctorApi.getAvatar("missing.png"), { code: "NOT_FOUND", status: 404, message: "Không tìm thấy ảnh" });
});

test("network failure and malformed responses have distinct client errors", async () => {
  respond = () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(api.healthApi.check(), { code: "CLIENT_NETWORK_ERROR", status: 0 });
  assert.equal(calls.length, 1, "A failed request must not be retried automatically");
  respond = () => new Response("<html>Unexpected proxy response</html>");
  await assert.rejects(api.healthApi.check(), { code: "CLIENT_INVALID_RESPONSE", status: 200 });
  respond = () => new Response("Service unavailable", { status: 503 });
  await assert.rejects(api.healthApi.check(), { code: "HTTP_ERROR", status: 503 });
  respond = () => new Response(null, { status: 204 });
  assert.equal(await api.healthApi.check(), null);
});

test("timeout and caller cancellation abort the request with different error codes", async () => {
  respond = (url, { signal }) => new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
  await assert.rejects(api.healthApi.check({ timeoutMs: 15 }), { code: "CLIENT_TIMEOUT" });
  const controller = new AbortController();
  const pending = api.healthApi.check({ signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { code: "CLIENT_ABORTED" });
});
