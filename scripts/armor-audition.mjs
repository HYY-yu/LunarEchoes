import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const routes = new Map([['/', ['scripts/fixtures/armor-audition.html', 'text/html; charset=utf-8']], ['/fixture.js', ['scripts/fixtures/armor-audition.mjs', 'text/javascript']], ['/style.css', ['dist/style.css', 'text/css']], ['/core.js', ['dist/core.js', 'text/javascript']], ['/stage-rules.js', ['dist/stage-rules.js', 'text/javascript']], ['/i18n.js', ['dist/i18n.js', 'text/javascript']]]);
const server = createServer(async (request, response) => {
  const route = routes.get(request.url);
  if (!route) { response.writeHead(404); response.end('Not found'); return; }
  try { const body = await readFile(new URL(`../${route[0]}`, import.meta.url)); response.writeHead(200, { 'Content-Type': route[1], 'Cache-Control': 'no-store' }); response.end(body); }
  catch (error) { console.error({ event: 'armor.audition.failed', error: String(error) }); response.writeHead(500); response.end('Build required'); }
});
server.on('error', error => { console.error({ event: 'armor.audition.server_failed', error: String(error) }); process.exitCode = 1; });
server.listen(4189, '127.0.0.1', () => console.info({ event: 'armor.audition.ready', url: 'http://127.0.0.1:4189' }));
