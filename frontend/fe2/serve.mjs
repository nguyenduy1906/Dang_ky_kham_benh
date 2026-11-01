// Independent, dependency-free static preview server for FE2 only.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative, isAbsolute, extname, sep } from 'node:path';

const root = await realpath(fileURLToPath(new URL('.', import.meta.url)));
const portIndex = process.argv.indexOf('--port');
const port = Number(portIndex < 0 ? 5500 : process.argv[portIndex + 1]);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Cổng không hợp lệ. Ví dụ: npm.cmd start -- --port 5501');
  process.exit(1);
}
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml' };
const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow:'GET, HEAD' }); res.end(); return;
  }
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const path = urlPath === '/' ? '/index.html' : urlPath;
    if (!(path === '/index.html' || /^\/(pages|css|js|assets)\//.test(path)) || path.includes('\\') || path.split('/').some(p => p.startsWith('.'))) {
      res.writeHead(404); res.end('Không tìm thấy trang.'); return;
    }
    const target = await realpath(resolve(root, '.' + path));
    const rel = relative(root, target);
    if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel) || !(await stat(target)).isFile() || !mime[extname(target)]) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'Content-Type':mime[extname(target)] });
    if (req.method === 'HEAD') res.end();
    else createReadStream(target).on('error', () => res.destroy()).pipe(res);
  } catch (error) {
    res.writeHead(error instanceof URIError ? 400 : 404); res.end('Không tìm thấy trang.');
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Cổng ${port} đang được dùng. Chạy: npm.cmd start -- --port ${port + 1}` : error.message);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => {
  console.log(`FE2: http://127.0.0.1:${port}/`);
  console.log('Bản xem giao diện độc lập, không cần backend. Dừng bằng Ctrl+C.');
});
