import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const routes = new Map([
  ['/', ['./fixtures/rainforest-audition.html', 'text/html; charset=utf-8']],
  ['/rainforest-story-art.js', ['../dist/rainforest-story-art.js', 'text/javascript']],
  ['/rainforest.story.json', ['../dist/rainforest.story.json', 'application/json; charset=utf-8']]
]);
const server = createServer(async (request, response) => {
  if (request.url === '/favicon.ico') {
    response.writeHead(204).end();
    return;
  }
  const route = routes.get(request.url);
  if (!route) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const [file, type] = route;
    const bytes = await readFile(new URL(file, import.meta.url));
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(bytes);
  } catch (error) {
    console.error({ level: 'error', event: 'rainforest_audition.read_failed', error: String(error) });
    response.writeHead(500).end('Preview could not load');
  }
});
server.on('error', error => {
  console.error({ level: 'error', event: 'rainforest_audition.server_failed', error: String(error) });
  process.exitCode = 1;
});
server.listen(4188, '127.0.0.1', () => {
  console.info({ level: 'info', event: 'rainforest_audition.ready', url: 'http://127.0.0.1:4188' });
});
