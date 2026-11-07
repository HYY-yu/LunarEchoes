import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGE_ORDER } from '../dist/stage-contract.js';
import { decodeProgress, encodeProgress } from '../dist/progress.js';

function rejects(raw, reason) {
  assert.deepEqual(decodeProgress(raw), { kind: 'rejected', reason, raw });
}

test('all six known stage boundaries round trip without implying playable content', () => {
  assert.equal(STAGE_ORDER.length, 6);
  for (const id of STAGE_ORDER) {
    const progress = { version: 1, highestUnlockedStageId: id };
    const raw = `{"version":1,"highestUnlockedStageId":"${id}"}`;
    assert.equal(encodeProgress(progress), raw);
    assert.deepEqual(decodeProgress(raw), { kind: 'valid', progress });
  }
});

test('encoding emits only the canonical two fields and does not mutate its input', () => {
  const progress = Object.freeze({ highestUnlockedStageId: 'rainforest', version: 1, equipment: ['laser'] });
  assert.equal(encodeProgress(progress), '{"version":1,"highestUnlockedStageId":"rainforest"}');
  assert.deepEqual(progress.equipment, ['laser']);
  const decoded = decodeProgress(' { "highestUnlockedStageId" : "rainforest", "version": 1 }\n');
  assert.deepEqual(decoded, { kind: 'valid', progress: { version: 1, highestUnlockedStageId: 'rainforest' } });
  assert.throws(() => { decoded.progress.highestUnlockedStageId = 'lunar-echoes'; }, TypeError);
});

test('only raw null is missing; empty strings and malformed JSON are rejected verbatim', () => {
  assert.deepEqual(decodeProgress(null), { kind: 'missing' });
  for (const raw of ['', ' \n\t', '{', '{"version":1,}', '\ufeff{"version":1}', 'bad JSON 原文\n']) {
    rejects(raw, 'invalid_json');
  }
});

test('JSON root types cannot become valid or missing progress', () => {
  for (const raw of ['null', '[]', '[{"version":1}]', 'true', 'false', '1', '1.5', '"desert-base"', '""']) {
    rejects(raw, 'invalid_type');
  }
});

test('missing or incorrectly typed versions are distinct from unsupported integer versions', () => {
  for (const version of [null, true, false, '1', 1.5, [], {}]) {
    rejects(JSON.stringify({ version, highestUnlockedStageId: 'desert-base' }), 'invalid_version');
  }
  rejects('{}', 'invalid_version');
  rejects('{"highestUnlockedStageId":"desert-base"}', 'invalid_version');
  for (const version of [0, -1, 2, 9007199254740991]) {
    rejects(JSON.stringify({ version, highestUnlockedStageId: 'desert-base' }), 'unknown_version');
  }
  rejects('{"version":1e400,"highestUnlockedStageId":"desert-base"}', 'invalid_version');
});

test('v1 requires exactly its two fields', () => {
  for (const raw of [
    '{"version":1}',
    '{"version":1,"highestUnlockedStageId":"desert-base","extra":null}',
    '{"version":1,"highestUnlockedStageId":"desert-base","__proto__":{}}',
    '{"version":1,"stage":"desert-base"}'
  ]) rejects(raw, 'invalid_fields');
});

test('stage IDs require exact known strings without coercion or fallback', () => {
  for (const highestUnlockedStageId of [null, false, 1, [], {}]) {
    rejects(JSON.stringify({ version: 1, highestUnlockedStageId }), 'invalid_type');
  }
  for (const highestUnlockedStageId of ['', ' desert-base', 'desert-base ', 'DESERT-BASE', 'unknown', '沙漠基地']) {
    rejects(JSON.stringify({ version: 1, highestUnlockedStageId }), 'unknown_stage');
  }
});

test('mixed errors obey documented priority and preserve every raw character', () => {
  for (const [raw, reason] of [
    [' { "version": "2", "extra": true }\n', 'invalid_version'],
    [' { "version": 2 }\n', 'unknown_version'],
    ['{"version":2,"highestUnlockedStageId":null,"extra":true}', 'unknown_version'],
    ['{"version":1,"highestUnlockedStageId":null,"extra":true}', 'invalid_fields'],
    ['{"version":1,"highestUnlockedStageId":"未知 ID","extra":true}', 'invalid_fields'],
    [' \n{"version":1,"highestUnlockedStageId":"未知 ID"}\t', 'unknown_stage']
  ]) rejects(raw, reason);
});
