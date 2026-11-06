import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGE_ORDER, STAGE_SAMPLES, StageContractError,
  parseStageCatalog, parseCompleteCampaign, getStage
} from '../dist/stage-contract.js';

function sample() { return structuredClone(STAGE_SAMPLES[0]); }
function rejects(input, code, path) {
  assert.throws(() => parseStageCatalog(input), error =>
    error instanceof StageContractError && error.code === code && error.path === path);
}

test('two stage samples load with distinct maps and complete bilingual story', () => {
  const catalog = parseStageCatalog(STAGE_SAMPLES);
  assert.deepEqual(catalog.map(stage => stage.id), ['desert-base', 'lunar-echoes']);
  assert.notEqual(catalog[0].mapId, catalog[1].mapId);
  assert.equal(getStage(catalog, 'desert-base').durationSeconds, 180);
  assert.equal(getStage(catalog, 'lunar-echoes').durationSeconds, 300);
  for (const stage of catalog) for (const text of Object.values(stage.story)) {
    assert(text.zh.trim()); assert(text.en.trim());
  }
});

test('complete campaigns require all six stages in their canonical order', () => {
  const complete = STAGE_ORDER.map(id => ({ ...sample(), id, mapId: id }));
  assert.deepEqual(parseCompleteCampaign(complete).map(stage => stage.id), [...STAGE_ORDER]);
  assert.throws(() => parseCompleteCampaign(STAGE_SAMPLES), error =>
    error instanceof StageContractError && error.code === 'missing_stage');
  assert.throws(() => parseCompleteCampaign([]), error =>
    error instanceof StageContractError && error.code === 'missing_stage');
  assert.deepEqual(parseStageCatalog([]), []);
});

test('unknown, duplicate, unordered and missing stage references do not fall back', () => {
  rejects([{ ...sample(), id: 'unknown' }], 'unknown_stage', '$[0].id');
  rejects([sample(), sample()], 'duplicate_stage', '$[1].id');
  rejects([...STAGE_SAMPLES].reverse(), 'stage_order', '$[1].id');
  rejects([{ ...sample(), mapId: 'unbuilt-theme' }], 'unknown_stage', '$[0].mapId');
  assert.throws(() => getStage(STAGE_SAMPLES, 'unknown'), error =>
    error instanceof StageContractError && error.code === 'unknown_stage');
  assert.throws(() => getStage(STAGE_SAMPLES, 'rainforest'), error =>
    error instanceof StageContractError && error.code === 'missing_stage');
});

test('duration rejects noninteger, nonfinite and out-of-range input', () => {
  for (const value of [179, 301, 180.5, NaN, Infinity, -Infinity, '180', null, undefined]) {
    rejects([{ ...sample(), durationSeconds: value }], 'out_of_range', '$[0].durationSeconds');
  }
});

test('wave schedule bounds and references are validated', () => {
  const wave = { atSecond: 0, enemyKind: 'crawler', count: 1 };
  for (const count of [0, 181, 1.5, Infinity, NaN, '2']) {
    rejects([{ ...sample(), waves: [{ ...wave, count }] }], 'out_of_range', '$[0].waves[0].count');
  }
  for (const atSecond of [-1, 180, 2.5, Infinity, NaN]) {
    rejects([{ ...sample(), waves: [{ ...wave, atSecond }] }], 'out_of_range', '$[0].waves[0].atSecond');
  }
  rejects([{ ...sample(), waves: [{ ...wave, enemyKind: 'alien' }] }], 'unknown_enemy', '$[0].waves[0].enemyKind');
  rejects([{ ...sample(), waves: [{ ...wave, enemyKind: 'boss' }] }], 'unknown_enemy', '$[0].waves[0].enemyKind');
  rejects([{ ...sample(), waves: [{ ...wave, atSecond: 30 }, wave] }], 'out_of_range', '$[0].waves[1].atSecond');
  const equalTimes = parseStageCatalog([{ ...sample(), waves: [wave, { ...wave, enemyKind: 'drone', count: 180 }] }]);
  assert.equal(equalTimes[0].waves.length, 2);
});

test('boss must reference the existing boss kind and appear before stage end', () => {
  rejects([{ ...sample(), boss: { enemyKind: 'new-boss', spawnSecond: 140 } }], 'unknown_enemy', '$[0].boss.enemyKind');
  for (const spawnSecond of [-1, 180, 1.5, Infinity, NaN, '140']) {
    rejects([{ ...sample(), boss: { enemyKind: 'boss', spawnSecond } }], 'out_of_range', '$[0].boss.spawnSecond');
  }
});

test('each story beat requires nonblank Chinese and English strings', () => {
  for (const beat of ['opening', 'objective', 'ending', 'nextClue']) {
    for (const language of ['zh', 'en']) {
      for (const value of ['', '  \n ', null, 42, undefined]) {
        const stage = sample(); stage.story[beat][language] = value;
        rejects([stage], 'invalid_text', `$[0].story.${beat}.${language}`);
      }
    }
  }
});

test('malformed roots, nested objects and sparse arrays are rejected', () => {
  for (const root of [null, {}, 'stages', 1]) rejects(root, 'invalid_type', '$');
  rejects([null], 'invalid_type', '$[0]');
  rejects([{ ...sample(), waves: null }], 'invalid_type', '$[0].waves');
  rejects([{ ...sample(), waves: [null] }], 'invalid_type', '$[0].waves[0]');
  rejects([{ ...sample(), boss: null }], 'invalid_type', '$[0].boss');
  rejects([{ ...sample(), story: [] }], 'invalid_type', '$[0].story');
  rejects(new Array(1), 'invalid_type', '$[0]');
  rejects([{ ...sample(), waves: new Array(1) }], 'invalid_type', '$[0].waves[0]');
});

test('parsed catalog owns deeply immutable data isolated from its input', () => {
  const input = [sample()]; const catalog = parseStageCatalog(input);
  input[0].waves[0].count = 99;
  input[0].boss.spawnSecond = 1;
  input[0].story.opening.zh = 'changed';
  input.push(sample());
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].waves[0].count, 6);
  assert.equal(catalog[0].boss.spawnSecond, 140);
  assert.equal(catalog[0].story.opening.zh, STAGE_SAMPLES[0].story.opening.zh);
  assert.throws(() => { catalog[0].waves[0].count = 99; }, TypeError);
  assert.throws(() => { catalog[0].story.opening.en = 'changed'; }, TypeError);
  assert.throws(() => { catalog[0].boss.spawnSecond = 1; }, TypeError);
  assert.throws(() => { catalog.push(sample()); }, TypeError);
  assert.throws(() => { STAGE_ORDER.reverse(); }, TypeError);
});
