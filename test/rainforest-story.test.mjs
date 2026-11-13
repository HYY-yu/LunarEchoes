import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validateRainforestStory } from '../scripts/rainforest-story.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const story = JSON.parse(await read('../content/rainforest.story.json'));

test('built rainforest catalog preserves the five bilingual story beats', async () => {
  const built = JSON.parse(await read('../dist/rainforest.story.json'));
  const draft = await read('../docs/rainforest-story-draft.md');
  const labels = new Map([
    ['开场', 'opening'], ['目标', 'objective'], ['胜利', 'victory'],
    ['失败', 'defeat'], ['南极交接', 'next-clue']
  ]);
  const publishedCopy = draft.split('\n').flatMap(line => {
    const [, label, zh, en] = line.split('|').map(cell => cell.trim());
    return labels.has(label) ? [{ beat: labels.get(label), zh, en }] : [];
  });
  assert.deepEqual(built, story);
  assert.deepEqual(built.map(({ beat, zh, en }) => ({ beat, zh, en })), publishedCopy);
  assert.deepEqual(built.map(entry => entry.outcome), ['any', 'any', 'won', 'lost', 'won']);
  assert.deepEqual(built.filter(entry => entry.nextStageId).map(entry => entry.nextStageId), ['antarctica']);
});

test('rainforest catalog rejects missing beats, misrouted outcomes and incomplete translations', () => {
  assert.throws(() => validateRainforestStory(story.slice(0, -1)), /at \$/);
  for (const [index, changes, field] of [
    [0, { id: 'rainforest.objective' }, 'id'],
    [0, { stageId: 'desert-base' }, 'stageId'],
    [0, { beat: 'objective' }, 'beat'],
    [2, { outcome: 'any' }, 'outcome'],
    [3, { en: ' ' }, 'en'],
    [3, { zh: undefined }, 'zh'],
    [3, { nextStageId: 'antarctica' }, 'nextStageId'],
    [4, { nextStageId: 'watchtower' }, 'nextStageId'],
    [4, { unexpected: true }, null]
  ]) {
    const invalid = story.map((entry, i) => i === index ? { ...entry, ...changes } : entry);
    assert.throws(() => validateRainforestStory(invalid), {
      message: `Invalid rainforest story at $[${index}]${field ? `.${field}` : ''}`
    });
  }
});
