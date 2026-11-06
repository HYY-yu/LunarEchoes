import type { EnemyKind } from './core.js';

function sequence<const T extends readonly string[]>(...values: T): T {
  return values;
}

export const STAGE_ORDER = Object.freeze(sequence(
  'desert-base', 'rainforest', 'antarctica',
  'space-elevator', 'watchtower', 'lunar-echoes'
));

export type StageId = typeof STAGE_ORDER[number];
export type LocalizedText = Readonly<{ zh: string; en: string }>;
export type StageWave = Readonly<{
  atSecond: number;
  enemyKind: Exclude<EnemyKind, 'boss'>;
  count: number;
}>;
export type StageDefinition = Readonly<{
  id: StageId;
  durationSeconds: number;
  mapId: StageId;
  waves: readonly StageWave[];
  boss: Readonly<{ enemyKind: 'boss'; spawnSecond: number }>;
  story: Readonly<{
    opening: LocalizedText;
    objective: LocalizedText;
    ending: LocalizedText;
    nextClue: LocalizedText;
  }>;
}>;
export type StageContractCode = 'invalid_type' | 'invalid_text' | 'out_of_range'
  | 'unknown_stage' | 'unknown_enemy' | 'duplicate_stage' | 'stage_order' | 'missing_stage';

export class StageContractError extends Error {
  constructor(readonly code: StageContractCode, readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'StageContractError';
  }
}

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function object(input: unknown, path: string): Record<string, unknown> {
  if (!isObject(input)) {
    throw new StageContractError('invalid_type', path, 'Expected an object');
  }
  return input;
}

function list(input: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(input)) throw new StageContractError('invalid_type', path, 'Expected an array');
  return input;
}

function integer(input: unknown, min: number, max: number, path: string): number {
  if (typeof input !== 'number' || !Number.isFinite(input) || !Number.isInteger(input) || input < min || input > max) {
    throw new StageContractError('out_of_range', path, `Expected an integer from ${min} to ${max}`);
  }
  return input;
}

function localized(input: unknown, path: string): LocalizedText {
  const value = object(input, path);
  if (typeof value.zh !== 'string' || !value.zh.trim()) {
    throw new StageContractError('invalid_text', `${path}.zh`, 'Expected nonblank Chinese text');
  }
  if (typeof value.en !== 'string' || !value.en.trim()) {
    throw new StageContractError('invalid_text', `${path}.en`, 'Expected nonblank English text');
  }
  return Object.freeze({ zh: value.zh, en: value.en });
}

function stageId(input: unknown, path: string): StageId {
  for (const id of STAGE_ORDER) if (input === id) return id;
  throw new StageContractError('unknown_stage', path, 'Unknown stage or map reference');
}

function enemyKind(input: unknown, path: string): StageWave['enemyKind'] {
  if (input === 'crawler' || input === 'drone' || input === 'sentry') return input;
  throw new StageContractError('unknown_enemy', path, 'Expected crawler, drone or sentry');
}

function stage(input: unknown, path: string): StageDefinition {
  const value = object(input, path);
  const id = stageId(value.id, `${path}.id`);
  const durationSeconds = integer(value.durationSeconds, 180, 300, `${path}.durationSeconds`);
  const mapId = stageId(value.mapId, `${path}.mapId`);
  const waves: StageWave[] = [];
  let previous = -1;
  for (const [index, inputWave] of list(value.waves, `${path}.waves`).entries()) {
    const wavePath = `${path}.waves[${index}]`;
    const wave = object(inputWave, wavePath);
    const atSecond = integer(wave.atSecond, 0, durationSeconds - 1, `${wavePath}.atSecond`);
    if (atSecond < previous) throw new StageContractError('out_of_range', `${wavePath}.atSecond`, 'Wave times must be nondecreasing');
    previous = atSecond;
    waves.push(Object.freeze({
      atSecond,
      enemyKind: enemyKind(wave.enemyKind, `${wavePath}.enemyKind`),
      count: integer(wave.count, 1, 180, `${wavePath}.count`)
    }));
  }
  const boss = object(value.boss, `${path}.boss`);
  if (boss.enemyKind !== 'boss') throw new StageContractError('unknown_enemy', `${path}.boss.enemyKind`, 'Expected boss');
  const spawnSecond = integer(boss.spawnSecond, 0, durationSeconds - 1, `${path}.boss.spawnSecond`);
  const story = object(value.story, `${path}.story`);
  return Object.freeze({
    id, durationSeconds, mapId, waves: Object.freeze(waves),
    boss: Object.freeze({ enemyKind: 'boss', spawnSecond }),
    story: Object.freeze({
      opening: localized(story.opening, `${path}.story.opening`),
      objective: localized(story.objective, `${path}.story.objective`),
      ending: localized(story.ending, `${path}.story.ending`),
      nextClue: localized(story.nextClue, `${path}.story.nextClue`)
    })
  });
}

export function parseStageCatalog(input: unknown): readonly StageDefinition[] {
  const result: StageDefinition[] = [];
  const seen = new Set<StageId>();
  let previous = -1;
  for (const [index, item] of list(input, '$').entries()) {
    const definition = stage(item, `$[${index}]`);
    if (seen.has(definition.id)) throw new StageContractError('duplicate_stage', `$[${index}].id`, 'Stage is already defined');
    const order = STAGE_ORDER.indexOf(definition.id);
    if (order <= previous) throw new StageContractError('stage_order', `$[${index}].id`, 'Stages must follow campaign order');
    previous = order;
    seen.add(definition.id);
    result.push(definition);
  }
  return Object.freeze(result);
}

export function parseCompleteCampaign(input: unknown): readonly StageDefinition[] {
  const catalog = parseStageCatalog(input);
  for (const id of STAGE_ORDER) {
    if (!catalog.some(definition => definition.id === id)) {
      throw new StageContractError('missing_stage', '$', `Missing stage ${id}`);
    }
  }
  return catalog;
}

export function getStage(catalog: readonly StageDefinition[], input: unknown): StageDefinition {
  const id = stageId(input, '$lookup.id');
  const definition = catalog.find(item => item.id === id);
  if (!definition) throw new StageContractError('missing_stage', '$lookup.id', `Stage ${id} has no definition`);
  return definition;
}

export const STAGE_SAMPLES = parseStageCatalog([
  {
    id: 'desert-base', durationSeconds: 180, mapId: 'desert-base',
    waves: [{ atSecond: 0, enemyKind: 'crawler', count: 6 }, { atSecond: 60, enemyKind: 'drone', count: 8 }],
    boss: { enemyKind: 'boss', spawnSecond: 140 },
    story: {
      opening: { zh: '沙漠基地的求援信号即将中断。', en: 'The desert base is about to lose its distress signal.' },
      objective: { zh: '击退入侵，恢复通讯。', en: 'Repel the invasion and restore communications.' },
      ending: { zh: '遥测数据已恢复。', en: 'Telemetry has been recovered.' },
      nextClue: { zh: '信号指向雨林研究站。', en: 'The signal points to a rainforest research station.' }
    }
  },
  {
    id: 'lunar-echoes', durationSeconds: 300, mapId: 'lunar-echoes',
    waves: [{ atSecond: 0, enemyKind: 'sentry', count: 4 }, { atSecond: 180, enemyKind: 'drone', count: 16 }],
    boss: { enemyKind: 'boss', spawnSecond: 240 },
    story: {
      opening: { zh: '轨道哨塔打通了月球航线。', en: 'The orbital watchtower has cleared the route to the Moon.' },
      objective: { zh: '清除月球基地，关闭入侵网络。', en: 'Clear the lunar base and shut down the invasion network.' },
      ending: { zh: '地球重新接通信号。', en: 'Earth is receiving our signal again.' },
      nextClue: { zh: '中继任务完成。', en: 'Relay mission complete.' }
    }
  }
]);
