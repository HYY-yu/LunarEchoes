import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import ts from 'typescript';
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
    if (hasComments) { console.error({ event: 'check.comment_forbidden', file }); failed = true; }
    if (file === 'core.ts' && /\b(document|window|Date|AudioContext)\b|Math\.random/.test(text)) { console.error({ event: 'check.core_boundary', file }); failed = true; }
  }
}
let bytes = 0;
for (const file of ['index.html', 'style.css']) {
  const text = await readFile(file, 'utf8');
  if (file.endsWith('.html') ? /<!--/.test(text) : /\/\*/.test(text)) {
    console.error({ event: 'check.comment_forbidden', file });
    failed = true;
  }
}
for (const file of await readdir('dist')) bytes += gzipSync(await readFile(`dist/${file}`)).length;
if (bytes > 150 * 1024) { console.error({ event: 'check.download_budget_exceeded', bytes, budget: 150 * 1024 }); failed = true; }
console.info({ event: 'check.complete', gzipBytes: bytes, budgetBytes: 150 * 1024, passed: !failed });
if (failed) process.exitCode = 1;
