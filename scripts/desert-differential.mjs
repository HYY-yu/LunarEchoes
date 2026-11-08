import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { loadCoreRevision } from './load-core-revision.mjs';
import * as head from '../dist/core.js';
const baselinePath = new URL('../docs/evidence/desert34/baseline-actions.json.gz', import.meta.url);
const captured = JSON.parse(gunzipSync(await readFile(baselinePath)));
assert.equal(captured.baseline, 'bde5936d13d6890a72d24d36bb0039e48e36df44');
const { core: base } = await loadCoreRevision(captured.baseline);
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
  assert.equal(head.checksum(after), base.checksum(before));
  assert.equal(after.phase.kind, before.phase.kind);
  assert.equal(after.tick, before.tick);
  assert(bossEvents <= 1);
  const recording = head.finishRecording(after, actions);
  const first = head.replay(recording), second = head.replay(recording);
  assert.deepEqual(first, after); assert.deepEqual(second, after);
  assert.equal(head.finalChecksum(first), recording.finalChecksum);
  if (after.phase.kind === 'won') assert.equal(after.tick, 10800);
  const { recording: oldRecording, ...metrics } = sample;
  const actualBaseline = { phase: before.phase.kind, ticks: before.tick, combatSeconds: before.tick / base.HZ, hp: before.player.hp, maxHp: before.player.maxHp, level: before.level, kills: before.kills, bossSpawned: before.bossSpawned, bossKilled: before.bossKilled, upgrades: { ...before.upgrades }, checksum: base.checksum(before) };
  rows.push({ seed: sample.seed, strategy: sample.strategy, preference: sample.preference, capturedObservation: metrics, actualBaseline, phase: after.phase.kind, ticks: after.tick, stageId: recording.stageId, rulesVersion: recording.rulesVersion, finalChecksum: recording.finalChecksum, battleChecksum: head.checksum(after), sameActionMatch: true, terminalReplays: 2, bossEvents });
}
const result = { baseline: captured.baseline, head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sourceDirty: execFileSync('git', ['status', '--porcelain', '--', 'src'], { encoding: 'utf8' }).trim() !== '', node: process.versions.node, platform: process.platform, arch: process.arch, capturedNode: captured.node, historicalObservation: 'Original macOS capture retained, not a cross-platform oracle', baselineActionsSha256: digest(await readFile(baselinePath)), comparedActions, excludedFields: ['context'], compared: 'Every remaining World field including events after every exact captured action', summary: { cases: rows.length, won: rows.filter(row => row.phase === 'won').length, lost: rows.filter(row => row.phase === 'lost').length, mismatches: 0, terminalReplays: rows.length * 2 }, rows };
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(result, null, 2) + '\n');
console.info({ event: 'desert.differential.passed', ...result.summary, comparedActions, excludedFields: result.excludedFields });
