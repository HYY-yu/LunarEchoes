import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import * as head from '../dist/core.js';
const baselinePath = new URL('../docs/evidence/desert34/baseline-actions.json.gz', import.meta.url);
const captured = JSON.parse(gunzipSync(await readFile(baselinePath)));
const source = execFileSync('git', ['show', `${captured.baseline}:src/core.ts`], { encoding: 'utf8' });
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const base = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const digest = value => createHash('sha256').update(value).digest('hex');
const rows = [];
let comparedActions = 0;
for (const sample of captured.cases) {
  const before = base.createWorld(sample.seed);
  const after = head.createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: sample.seed });
  const actions = sample.recording.actions;
  assert.equal(digest(JSON.stringify(actions)), sample.actionsSha256);
  let bossEvents = 0;
  for (const [index, action] of actions.entries()) {
    base.dispatch(before, action); head.dispatch(after, action);
    const { context, ...battle } = after;
    assert.equal(JSON.stringify(battle), JSON.stringify(before));
    assert.equal(JSON.stringify({ ...battle, events: [] }), JSON.stringify({ ...before, events: [] }));
    assert.equal(head.checksum(after), base.checksum(before));
    assert.deepEqual(battle, before, `${sample.seed}/${sample.strategy}/${sample.preference}/action ${index}`);
    bossEvents += after.events.filter(event => event === 'boss').length;
    comparedActions++;
  }
  assert.equal(base.checksum(before), sample.checksum);
  assert.equal(before.phase.kind, sample.phase);
  assert.equal(before.tick, sample.ticks);
  assert(bossEvents <= 1);
  const recording = head.finishRecording(after, actions);
  const first = head.replay(recording), second = head.replay(recording);
  assert.deepEqual(first, after); assert.deepEqual(second, after);
  assert.equal(head.finalChecksum(first), recording.finalChecksum);
  if (after.phase.kind === 'won') assert.equal(after.tick, 10800);
  const { recording: oldRecording, ...metrics } = sample;
  rows.push({ ...metrics, stageId: recording.stageId, rulesVersion: recording.rulesVersion, finalChecksum: recording.finalChecksum, battleChecksum: head.checksum(after), sameActionMatch: true, terminalReplays: 2, bossEvents });
}
const result = { baseline: captured.baseline, head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sourceDirty: execFileSync('git', ['status', '--porcelain', '--', 'src'], { encoding: 'utf8' }).trim() !== '', node: process.versions.node, baselineActionsSha256: digest(await readFile(baselinePath)), comparedActions, excludedFields: ['context'], compared: 'Every remaining World field including events after every exact captured action', summary: { cases: rows.length, won: rows.filter(row => row.phase === 'won').length, lost: rows.filter(row => row.phase === 'lost').length, mismatches: 0, terminalReplays: rows.length * 2 }, rows };
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(result, null, 2) + '\n');
console.info({ event: 'desert.differential.passed', ...result.summary, comparedActions, excludedFields: result.excludedFields });
