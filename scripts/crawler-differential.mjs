import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as current from '../dist/core.js';
import { play } from './simulate.mjs';
const revision = process.argv[2];
if (!/^[0-9a-f]{40}$/i.test(revision ?? '')) throw new Error('Usage: node scripts/crawler-differential.mjs <40-hex-baseline-commit>');
const source = execFileSync('git', ['show', `${revision}:src/core.ts`], { encoding: 'utf8' });
assert.equal(await readFile('src/core.ts', 'utf8'), source, 'Crawler animation must not change simulation source');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const baseline = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
let actions = 0;
for (const seed of [208907, 42, 101]) {
  const { recording } = play(seed), before = baseline.createWorld(seed), after = current.createWorld(seed);
  for (const action of recording.actions) {
    baseline.dispatch(before, action); current.dispatch(after, action);
    assert.deepEqual(after, before, `Full World differs at seed ${seed}, action ${actions}`);
    assert.equal(current.checksum(after), baseline.checksum(before)); actions++;
  }
}
console.info({ event: 'crawler_differential.passed', revision, seeds: 3, actions, compared: 'Complete World including events and every checksum; core source identical' });
