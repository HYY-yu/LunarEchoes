import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const routes = new Map([
  ['/', ['scripts/fixtures/desert-audition.html', 'text/html; charset=utf-8']],
  ['/fixture.js', ['scripts/fixtures/desert-audition.mjs', 'text/javascript']],
  ['/desert-scene.js', ['dist/desert-scene.js', 'text/javascript']],
  ['/story.json', ['content/desert-base.story.json', 'application/json']]
]);
const server = createServer(async (request, response) => {
  if (request.url === '/favicon.ico') { response.writeHead(204); response.end(); return; }
  const route = routes.get(request.url);
  if (!route) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const bytes = await readFile(new URL(`../${route[0]}`, import.meta.url));
    response.writeHead(200, { 'Content-Type': route[1], 'Cache-Control': 'no-store' }); response.end(bytes);
  } catch (error) {
    console.error({ level: 'error', event: 'desert_audition.read_failed', error: String(error) });
    response.writeHead(500); response.end('Run npm run build first');
  }
});
server.on('error', error => { console.error({ level: 'error', event: 'desert_audition.server_failed', error: String(error) }); process.exitCode = 1; });
server.listen(4187, '127.0.0.1', () => console.info({ level: 'info', event: 'desert_audition.ready', url: 'http://127.0.0.1:4187' }));
