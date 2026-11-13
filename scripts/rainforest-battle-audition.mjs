import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const routes = new Map([
  ['/', ['./fixtures/rainforest-battle-audition.html', 'text/html; charset=utf-8']],
  ['/rainforest-battle-preview.mjs', ['./fixtures/rainforest-battle-preview.mjs', 'text/javascript']],
  ['/rainforest-map.js', ['../dist/rainforest-map.js', 'text/javascript']],
  ['/art.js', ['../dist/art.js', 'text/javascript']]
]);
const files = new Map();
for (const [path, [file, type]] of routes) {
  try {
    files.set(path, [await readFile(new URL(file, import.meta.url)), type]);
  } catch (error) {
    console.error({ level: 'error', event: 'rainforest_battle_audition.read_failed', file, error: String(error) });
    process.exit(1);
  }
}

const server = createServer((request, response) => {
  if (request.url === '/favicon.ico') return response.writeHead(204).end();
  const file = files.get(request.url);
  if (!file) return response.writeHead(404).end('Not found');
  const [body, type] = file;
  response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body);
});
server.on('error', error => {
  console.error({ level: 'error', event: 'rainforest_battle_audition.server_failed', error: String(error) });
  process.exitCode = 1;
});
server.listen(Number(process.env.PORT ?? 4190), '127.0.0.1', () => {
  console.info({ level: 'info', event: 'rainforest_battle_audition.ready', url: `http://127.0.0.1:${server.address().port}` });
});
