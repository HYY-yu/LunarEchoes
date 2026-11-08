import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGE_ORDER } from '../dist/stage-contract.js';
import {
  createInitialProgress, isStageUnlocked, applyStageResult,
  decodeProgress, encodeProgress
} from '../dist/progress.js';

test('new progress is a frozen first-stage snapshot without a persisted write', () => {
  const progress = createInitialProgress();
  assert.deepEqual(progress, { version: 1, highestUnlockedStageId: 'desert-base' });
  assert.equal(Object.isFrozen(progress), true);
  assert.deepEqual(Object.keys(progress), ['version', 'highestUnlockedStageId']);
  assert.deepEqual(STAGE_ORDER.filter(stageId => isStageUnlocked({ progress, stageId })), [STAGE_ORDER[0]]);
  assert.throws(() => { progress.highestUnlockedStageId = STAGE_ORDER[1]; }, TypeError);
});

test('each known progress boundary unlocks exactly its ordered prefix', () => {
  for (const [highest, highestUnlockedStageId] of STAGE_ORDER.entries()) {
    const progress = Object.freeze({ version: 1, highestUnlockedStageId });
    const actual = STAGE_ORDER.filter(stageId => isStageUnlocked({ progress, stageId }));
    assert.deepEqual(actual, STAGE_ORDER.slice(0, highest + 1));
  }
});

test('all progress, stage, source and outcome combinations enforce one adjacent grant', () => {
  const order = [...STAGE_ORDER];
  let checked = 0;
  for (const [highest, highestUnlockedStageId] of STAGE_ORDER.entries()) {
    const progress = { version: 1, highestUnlockedStageId };
    for (const [requested, stageId] of STAGE_ORDER.entries()) {
      for (const source of ['live', 'replay']) {
        for (const outcome of ['won', 'lost']) {
          const input = { progress, stageId, source, outcome };
          const transition = applyStageResult(input);
          if (requested > highest) assert.deepEqual(transition, { kind: 'locked' });
          else if (source === 'live' && outcome === 'won' && requested === highest && highest < STAGE_ORDER.length - 1) {
            assert.equal(transition.kind, 'advanced');
            assert.deepEqual(transition.progress, { version: 1, highestUnlockedStageId: STAGE_ORDER[highest + 1] });
            assert.equal(Object.isFrozen(transition.progress), true);
            assert.notEqual(transition.progress, progress);
            assert.deepEqual(Object.keys(transition), ['kind', 'progress']);
          } else assert.deepEqual(transition, { kind: 'unchanged' });
          assert.deepEqual(progress, { version: 1, highestUnlockedStageId });
          assert.equal(Object.isFrozen(progress), false);
          assert.equal(Object.isFrozen(input), false);
          checked++;
        }
      }
    }
  }
  assert.equal(checked, 144);
  assert.deepEqual(STAGE_ORDER, order);
});

test('a full campaign advances in order and duplicate or old wins cannot chain grants', () => {
  let progress = createInitialProgress();
  const visited = [progress.highestUnlockedStageId];
  for (const stageId of STAGE_ORDER) {
    const before = progress;
    assert.deepEqual(applyStageResult({ progress, stageId, source: 'live', outcome: 'lost' }), { kind: 'unchanged' });
    assert.deepEqual(applyStageResult({ progress, stageId, source: 'replay', outcome: 'won' }), { kind: 'unchanged' });
    const result = applyStageResult({ progress, stageId, source: 'live', outcome: 'won' });
    if (stageId === STAGE_ORDER.at(-1)) {
      assert.deepEqual(result, { kind: 'unchanged' });
      assert.equal(progress, before);
    } else {
      assert.equal(result.kind, 'advanced');
      progress = result.progress;
      visited.push(progress.highestUnlockedStageId);
    }
    for (const oldStageId of STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(stageId) + 1)) {
      assert.deepEqual(applyStageResult({ progress, stageId: oldStageId, source: 'live', outcome: 'won' }), { kind: 'unchanged' });
    }
  }
  assert.deepEqual(visited, STAGE_ORDER);
  assert.equal(progress.highestUnlockedStageId, STAGE_ORDER.at(-1));
});

test('unknown or missing source and outcome are rejected rather than treated as victory', () => {
  const progress = createInitialProgress();
  for (const source of [undefined, null, '', 'LIVE', 'replay ', 'unknown', true, 0, {}, []]) {
    assert.throws(() => applyStageResult({ progress, stageId: STAGE_ORDER[0], source, outcome: 'won' }), TypeError);
  }
  for (const outcome of [undefined, null, '', 'running', 'paused', 'WON', true, 0, {}, []]) {
    assert.throws(() => applyStageResult({ progress, stageId: STAGE_ORDER[0], source: 'live', outcome }), TypeError);
  }
  assert.deepEqual(progress, { version: 1, highestUnlockedStageId: STAGE_ORDER[0] });
});

test('new snapshots preserve the two-field codec and rejected raw input remains rejected', () => {
  const raw = ' {"version":2,"highestUnlockedStageId":"lunar-echoes"}\n';
  assert.deepEqual(decodeProgress(raw), { kind: 'rejected', reason: 'unknown_version', raw });
  const initial = createInitialProgress();
  const result = applyStageResult({ progress: initial, stageId: STAGE_ORDER[0], source: 'live', outcome: 'won' });
  assert.equal(result.kind, 'advanced');
  for (const progress of [initial, result.progress]) {
    const encoded = encodeProgress(progress);
    assert.equal(encoded, `{"version":1,"highestUnlockedStageId":"${progress.highestUnlockedStageId}"}`);
    assert.deepEqual(decodeProgress(encoded), { kind: 'valid', progress });
  }
  assert.deepEqual(decodeProgress(raw), { kind: 'rejected', reason: 'unknown_version', raw });
});
