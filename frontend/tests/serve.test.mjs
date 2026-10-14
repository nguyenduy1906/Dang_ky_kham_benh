import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { request } from "node:http";
import { fileURLToPath } from "node:url";

test("npm's static server publishes the frontend and rejects traversal/private files", async t => {
  const server = spawn(process.execPath, [fileURLToPath(new URL("../scripts/serve.mjs", import.meta.url)), "--port", "0"]);
  t.after(() => server.kill());
  const output = await new Promise((resolve, reject) => {
    server.stdout.once("data", data => resolve(String(data)));
    server.once("error", reject);
    server.once("exit", code => reject(new Error(`Server exited: ${code}`)));
  });
  const base = new URL(output.match(/http:\/\/[^\s]+/)[0]);
  const get = (path, method = "GET") => new Promise((resolve, reject) => {
    const req = request({ hostname: base.hostname, port: base.port, path, method }, res => {
      let body = ""; res.on("data", part => body += part); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject); req.end();
  });
  assert.equal((await get("/")).headers.location, "/frontend/templates/public/home.html");
  const page = await get(base.pathname);
  assert.equal(page.status, 200); assert.match(page.body, /Trang chủ/);
  const js = await get("/frontend/static/js/pages/auth.js?v=test");
  assert.equal(js.status, 200); assert.match(js.headers["content-type"], /javascript/);
  assert.equal((await get("/frontend/static/assets/clinic/n%E1%BB%99i_khoa.jpg", "HEAD")).status, 200);
  for (const path of ["/backend/.env", "/frontend/package.json", "/frontend/static/../../backend/.env", "/frontend/static/%2e%2e/%2e%2e/backend/.env", "/frontend/static/%5c..%5cbackend%5c.env"]) {
    assert.equal((await get(path)).status, 404, path);
  }
  assert.equal((await get("/frontend/static/%XX")).status, 400);
  assert.equal((await get(base.pathname, "POST")).status, 405);
  server.kill(); await once(server, "exit");
});
