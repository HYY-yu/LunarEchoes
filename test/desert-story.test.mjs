import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { validateDesertStory, DesertStoryError, DESERT_BEATS } from '../scripts/desert-story.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/desert-base.story.json', import.meta.url), 'utf8'));
function rejects(change, code) {
  const input = structuredClone(catalog);
  change(input);
  assert.throws(() => validateDesertStory(input), error => error instanceof DesertStoryError && error.code === code);
}

test('canonical desert script has eight ordered bilingual beats and victory-only rainforest handoff', () => {
  assert.equal(validateDesertStory(catalog), catalog);
  assert.deepEqual(catalog.map(entry => entry.beat), DESERT_BEATS);
  assert.deepEqual(catalog.filter(entry => entry.nextStageId).map(entry => [entry.beat, entry.outcome, entry.nextStageId]), [['next-clue', 'won', 'rainforest']]);
});

test('catalog rejects malformed roots, entries, duplicate IDs, missing beats and reordering', () => {
  for (const input of [null, {}, 42, 'story']) assert.throws(() => validateDesertStory(input), DesertStoryError);
  rejects(input => { input[0] = null; }, 'invalid_entry');
  rejects(input => { input[1] = input[0]; }, 'duplicate_id');
  rejects(input => { input.pop(); }, 'missing_beats');
  rejects(input => { [input[0], input[1]] = [input[1], input[0]]; }, 'beat_order');
  rejects(input => { input[0].beat = 'unknown'; }, 'unknown_beat');
  rejects(input => { input[0].id = 'other.opening'; }, 'invalid_id');
  rejects(input => { input[0].extra = true; }, 'unknown_field');
});

test('every beat rejects wrong stage and missing or blank locales', () => {
  for (let index = 0; index < catalog.length; index++) {
    rejects(input => { input[index].stageId = 'lunar-echoes'; }, 'invalid_stage');
    for (const locale of ['zh', 'en']) for (const value of [undefined, null, '', ' \n ', 7]) {
      rejects(input => { input[index][locale] = value; }, 'invalid_locale');
    }
  }
});

test('defeat cannot route to success and only victory can carry the planned handoff', () => {
  rejects(input => { input[6].outcome = 'won'; }, 'invalid_outcome');
  rejects(input => { input[6].nextStageId = 'rainforest'; }, 'invalid_handoff');
  rejects(input => { input[5].outcome = 'lost'; }, 'invalid_outcome');
  rejects(input => { input[7].outcome = 'any'; }, 'invalid_outcome');
  rejects(input => { input[7].nextStageId = 'lunar-echoes'; }, 'invalid_handoff');
  rejects(input => { delete input[7].nextStageId; }, 'invalid_handoff');
});

test('CLI reports structured success and file loading errors', () => {
  const success = spawnSync(process.execPath, ['scripts/desert-story.mjs'], { encoding: 'utf8' });
  assert.equal(success.status, 0);
  assert.equal(JSON.parse(success.stdout).entries, 8);
  const failure = spawnSync(process.execPath, ['scripts/desert-story.mjs', '/nonexistent/desert-story.json'], { encoding: 'utf8' });
  assert.equal(failure.status, 1);
  assert.equal(JSON.parse(failure.stderr).level, 'error');
});
