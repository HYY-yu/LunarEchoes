import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const DESERT_BEATS = Object.freeze(['opening', 'objective', 'radio.first-contact', 'radio.telemetry', 'boss', 'victory', 'defeat', 'next-clue']);

export class DesertStoryError extends Error {
  constructor(code, path) {
    super(`${code}: ${path}`);
    this.name = 'DesertStoryError';
    this.code = code;
    this.path = path;
  }
}

function requireValue(condition, code, path) {
  if (!condition) throw new DesertStoryError(code, path);
}

export function validateDesertStory(input) {
  requireValue(Array.isArray(input), 'invalid_catalog', '$');
  const seen = new Set();
  for (let index = 0; index < input.length; index++) {
    const entry = input[index];
    const path = `$[${index}]`;
    requireValue(entry !== null && typeof entry === 'object' && !Array.isArray(entry), 'invalid_entry', path);
    requireValue(!seen.has(entry.id), 'duplicate_id', `${path}.id`);
    seen.add(entry.id);
    requireValue(DESERT_BEATS.includes(entry.beat), 'unknown_beat', `${path}.beat`);
    requireValue(entry.id === `desert-base.${entry.beat}`, 'invalid_id', `${path}.id`);
    requireValue(entry.beat === DESERT_BEATS[index], 'beat_order', `${path}.beat`);
    requireValue(entry.stageId === 'desert-base', 'invalid_stage', `${path}.stageId`);
    for (const locale of ['zh', 'en']) {
      requireValue(typeof entry[locale] === 'string' && entry[locale].trim().length > 0, 'invalid_locale', `${path}.${locale}`);
    }
    const outcome = entry.beat === 'defeat' ? 'lost' : ['victory', 'next-clue'].includes(entry.beat) ? 'won' : 'any';
    requireValue(entry.outcome === outcome, 'invalid_outcome', `${path}.outcome`);
    if (entry.beat === 'next-clue') requireValue(entry.nextStageId === 'rainforest', 'invalid_handoff', `${path}.nextStageId`);
    else requireValue(!Object.hasOwn(entry, 'nextStageId'), 'invalid_handoff', `${path}.nextStageId`);
    const keys = ['id', 'stageId', 'beat', 'outcome', 'zh', 'en', ...(entry.beat === 'next-clue' ? ['nextStageId'] : [])];
    requireValue(Object.keys(entry).every(key => keys.includes(key)), 'unknown_field', path);
  }
  requireValue(input.length === DESERT_BEATS.length, 'missing_beats', '$');
  return input;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const path = process.argv[2] ?? new URL('../content/desert-base.story.json', import.meta.url);
    const catalog = validateDesertStory(JSON.parse(await readFile(path, 'utf8')));
    console.info(JSON.stringify({ event: 'desert_story.validated', level: 'info', entries: catalog.length }));
  } catch (error) {
    console.error(JSON.stringify({ event: 'desert_story.failed', level: 'error', code: error.code ?? 'load_failed', path: error.path ?? '$', message: error.message }));
    process.exitCode = 1;
  }
}
