import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const file = resolve(root, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
    if (!file.startsWith(root + sep)) { res.writeHead(403); res.end('Forbidden'); return; }
    const data = await readFile(file); res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') { res.writeHead(404); res.end('Not found'); }
    else { console.error({ level: 'error', event: 'server.request_failed', error: String(error) }); res.writeHead(500); res.end('Server error'); }
  }
});
server.on('error', error => {
  console.error({ level: 'error', event: 'server.start_failed', port, error: String(error) });
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.info({ event: 'server.started', url: `http://127.0.0.1:${port}` }));
