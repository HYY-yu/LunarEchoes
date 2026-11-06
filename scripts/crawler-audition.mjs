import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const routes = new Map([
  ['/', ['scripts/fixtures/crawler-audition.html', 'text/html']],
  ['/fixture.js', ['scripts/fixtures/crawler-audition.mjs', 'text/javascript']],
  ...['main', 'art', 'render', 'core', 'audio', 'i18n', 'logger'].map(name => [`/${name}.js`, [`dist/${name}.js`, 'text/javascript']]),
  ['/style.css', ['dist/style.css', 'text/css']],
  ['/game/', ['dist/index.html', 'text/html']]
]);
const server = createServer(async (request, response) => {
  if (request.url === '/favicon.ico') { response.writeHead(204); response.end(); return; }
  const route = routes.get(request.url);
  if (!route) { response.writeHead(404); response.end('Not found'); return; }
  try { const bytes = await readFile(new URL(`../${route[0]}`, import.meta.url)); response.writeHead(200, { 'Content-Type': route[1], 'Cache-Control': 'no-store' }); response.end(bytes); }
  catch (error) { console.error({ event: 'crawler_audition.read_failed', error: String(error) }); response.writeHead(500); response.end('Run npm run build first'); }
});
server.listen(4176, '127.0.0.1', () => console.info({ event: 'crawler_audition.ready', url: 'http://127.0.0.1:4176', game: 'http://127.0.0.1:4176/game/' }));
