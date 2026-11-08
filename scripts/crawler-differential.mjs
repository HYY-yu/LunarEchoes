import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadCoreRevision } from './load-core-revision.mjs';
import * as current from '../dist/core.js';
import { play } from './simulate.mjs';
const revision = process.argv[2];
if (!/^[0-9a-f]{40}$/i.test(revision ?? '')) throw new Error('Usage: node scripts/crawler-differential.mjs <40-hex-baseline-commit>');
const { core: baseline, source, rulesSource } = await loadCoreRevision(revision);
assert.equal(await readFile('src/core.ts', 'utf8'), source, 'Crawler animation must not change simulation source');
assert.equal(await readFile('src/stage-rules.ts', 'utf8'), rulesSource, 'Crawler animation must not change stage rules');
let actions = 0;
for (const seed of [208907, 42, 101]) {
  const { recording } = play(seed), before = baseline.createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed }), after = current.createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed });
  for (const action of recording.actions) {
    baseline.dispatch(before, action); current.dispatch(after, action);
    assert.deepEqual(after, before, `Full World differs at seed ${seed}, action ${actions}`);
    assert.equal(current.checksum(after), baseline.checksum(before)); actions++;
  }
}
console.info({ event: 'crawler_differential.passed', revision, seeds: 3, actions, compared: 'Complete World including events and every checksum; core source identical' });
