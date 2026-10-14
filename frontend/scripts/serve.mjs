// Serve the HTML/CSS/JS frontend independently of VS Code, using Node built-ins.
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat, realpath } from "node:fs/promises";
import { resolve, relative, isAbsolute, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = await realpath(fileURLToPath(new URL("../", import.meta.url)));
const portArg = process.argv.indexOf("--port");
const port = Number(portArg >= 0 ? process.argv[portArg + 1] : process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error("Cổng phải là số từ 0 đến 65535."); process.exit(1);
}
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
  ".webp": "image/webp", ".gif": "image/gif", ".woff": "font/woff", ".woff2": "font/woff2" };
function inside(path) {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-cache");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }); response.end(); return;
  }
  try {
    const rawPath = (request.url || "/").split("?")[0];
    const pathname = decodeURIComponent(rawPath);
    if (pathname === "/" || pathname === "/frontend" || pathname === "/frontend/") {
      response.writeHead(302, { Location: "/frontend/templates/public/home.html" }); response.end(); return;
    }
    const asset = pathname.replace(/^\/frontend\//, "/");
    // Only publish site assets and templates, never scripts, tests or hidden files.
    if (!/^\/(static|templates)\//.test(asset) || asset.includes("\\") ||
        asset.split("/").some(segment => segment.startsWith("."))) {
      response.writeHead(404); response.end("Không tìm thấy trang."); return;
    }
    const target = await realpath(resolve(root, `.${asset}`));
    if (!inside(target) || !(await stat(target)).isFile()) {
      response.writeHead(404); response.end(); return;
    }
    response.setHeader("Content-Type", types[extname(target).toLowerCase()] || "application/octet-stream");
    response.writeHead(200);
    if (request.method === "HEAD") response.end();
    else createReadStream(target).on("error", () => response.destroy()).pipe(response);
  } catch (error) {
    response.writeHead(error instanceof URIError ? 400 : 404); response.end("Không tìm thấy trang.");
  }
});
server.on("error", error => {
  console.error(error.code === "EADDRINUSE"
    ? `Cổng ${port} đang được dùng. Tắt Live Preview hoặc chạy: npm start -- --port 5500`
    : error.message);
  process.exit(1);
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Frontend: http://127.0.0.1:${server.address().port}/frontend/templates/public/home.html`);
  console.log("Dừng server: Ctrl+C. Backend API: http://127.0.0.1:5000");
});
