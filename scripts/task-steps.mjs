import { copyFile, mkdir, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createServer } from 'node:http';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { embedDesertContent } from './desert-content.mjs';

export async function build(context) {
  await rm('dist', { recursive: true, force: true });
  await context.execute('typescript', ['node_modules/typescript/bin/tsc']);
  await mkdir('dist', { recursive: true });
  const html = embedDesertContent(await readFile('index.html', 'utf8'), JSON.parse(await readFile('content/desert-base.story.json', 'utf8')));
  await Promise.all([writeFile('dist/index.html', html), copyFile('style.css', 'dist/style.css')]);
}

export async function check(context) {
  let failed = false;
  for (const directory of ['src', 'scripts', 'test']) {
    for (const file of await readdir(directory)) {
      if (!/\.(ts|mjs)$/.test(file)) continue;
      const text = await readFile(`${directory}/${file}`, 'utf8');
      const parsed = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      let hasComments = false;
      function inspect(node) {
        if (ts.getLeadingCommentRanges(text, node.pos)?.length || ts.getTrailingCommentRanges(text, node.end)?.length) hasComments = true;
        ts.forEachChild(node, inspect);
      }
      inspect(parsed);
      if (hasComments) { context.error({ event: 'check.comment_forbidden', file }); failed = true; }
      if (file === 'core.ts' && /\b(document|window|Date|AudioContext)\b|Math\.random/.test(text)) { context.error({ event: 'check.core_boundary', file }); failed = true; }
    }
  }
  let bytes = 0;
  for (const file of ['index.html', 'style.css']) {
    const text = await readFile(file, 'utf8');
    if (file.endsWith('.html') ? /<!--/.test(text) : /\/\*/.test(text)) {
      context.error({ event: 'check.comment_forbidden', file });
      failed = true;
    }
  }
  for (const file of await readdir('dist')) bytes += gzipSync(await readFile(`dist/${file}`)).length;
  if (bytes > 150 * 1024) { context.error({ event: 'check.download_budget_exceeded', bytes, budget: 150 * 1024 }); failed = true; }
  context.info({ event: 'check.complete', gzipBytes: bytes, budgetBytes: 150 * 1024, passed: !failed });
  if (failed) context.fail(1);
}

export async function simulate(context) {
  const { play } = await import('./simulation.mjs');
  const { checksum } = await import('../dist/core.js');
  let wins = 0;
  for (const seed of [208907, 42, 101]) {
    const { world } = play(seed);
    if (world.phase.kind === 'won') wins++;
    context.info({ event: 'simulation.finished', seed, phase: world.phase.kind, seconds: world.tick / 60, kills: world.kills, level: world.level, hp: world.player.hp, bossKilled: world.bossKilled, checksum: checksum(world) });
  }
  assert(wins > 0, 'A real input-only bot must win at least one full run');
}

export async function serve(root, context) {
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
      else { context.error({ level: 'error', event: 'server.request_failed', error: String(error) }); res.writeHead(500); res.end('Server error'); }
    }
  });
  const closed = new Promise((resolve, reject) => {
    server.once('error', error => { context.error({ level: 'error', event: 'server.start_failed', port, error: String(error) }); reject(error); });
    server.once('close', resolve);
  });
  context.setServer(server);
  server.listen(port, '127.0.0.1', () => context.info({ event: 'server.started', url: `http://127.0.0.1:${server.address().port}` }));
  await closed;
}
