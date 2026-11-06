import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const routes = new Map([
  ['/', ['scripts/fixtures/audio-audition.html', 'text/html']],
  ['/audition.js', ['scripts/fixtures/audio-audition.mjs', 'text/javascript']],
  ['/audio.js', ['dist/audio.js', 'text/javascript']]
]);
const server = createServer(async (request, response) => {
  const route = routes.get(request.url);
  if (!route) { response.writeHead(404); response.end('Not found'); return; }
  try { const data = await readFile(new URL(`../${route[0]}`, import.meta.url)); response.writeHead(200, { 'Content-Type': route[1], 'Cache-Control': 'no-store' }); response.end(data); }
  catch (error) { console.error({ event: 'audition.read_failed', error: String(error) }); response.writeHead(500); response.end('Build first'); }
});
server.listen(4175, '127.0.0.1', () => console.info({ event: 'audition.ready', url: 'http://127.0.0.1:4175' }));
