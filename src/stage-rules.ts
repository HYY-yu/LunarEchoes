import type { StageId } from './stage-contract.js';

function context<const Id extends StageId>(stageId: Id): Readonly<{ stageId: Id; rulesVersion: `${Id}-1` }> {
  return Object.freeze({ stageId, rulesVersion: `${stageId}-1` });
}

export const DESERT_CONTEXT = context('desert-base');
export const RAINFOREST_CONTEXT = context('rainforest');
export const ANTARCTICA_CONTEXT = context('antarctica');
export const SPACE_ELEVATOR_CONTEXT = context('space-elevator');
export const WATCHTOWER_CONTEXT = context('watchtower');
export const LUNAR_ECHOES_CONTEXT = context('lunar-echoes');

const CONTEXTS = Object.freeze({
  'desert-base': DESERT_CONTEXT,
  rainforest: RAINFOREST_CONTEXT,
  antarctica: ANTARCTICA_CONTEXT,
  'space-elevator': SPACE_ELEVATOR_CONTEXT,
  watchtower: WATCHTOWER_CONTEXT,
  'lunar-echoes': LUNAR_ECHOES_CONTEXT
} satisfies { [Id in StageId]: { stageId: Id; rulesVersion: `${Id}-1` } });

export type StageContext = typeof CONTEXTS[StageId];
export type SimulationErrorCode = 'invalid-data' | 'incompatible-version' | 'unavailable-stage' | 'incompatible-rules' | 'nonterminal-replay' | 'checksum-mismatch' | 'incomplete-replay';
export class SimulationError extends Error {
  constructor(readonly code: SimulationErrorCode) { super(code === 'incompatible-version' ? 'Replay version mismatch' : code); this.name = 'SimulationError'; }
}

type CampaignWave = Readonly<{
  startTick: number;
  intervalTicks: number;
  sentryChance: number;
  droneChance: number;
}>;

type CampaignBoss = Readonly<{
  hp: number;
  speed: number;
  shotCount: number;
  shotSpeed: number;
  cooldownTicks: number;
}> & (Readonly<{ aim: 'fan'; fanStep: number }> | Readonly<{ aim: 'ring' }>);

type CampaignRules = Readonly<{
  kind: 'campaign';
  durationTicks: number;
  arenaSize: number;
  bossSpawnTick: number;
  crawlerHp: number;
  waves: readonly [CampaignWave, ...CampaignWave[]];
  boss: CampaignBoss;
}>;

const DESERT_RULES = Object.freeze({ kind: 'desert' as const, durationTicks: 60 * 180, arenaSize: 1500, bossSpawnTick: 60 * 140 });
const RAINFOREST_RULES = Object.freeze({
  kind: 'rainforest' as const, durationTicks: 60 * 195, arenaSize: 1500, bossSpawnTick: 60 * 155,
  sentryStartTick: 60 * 18, lateWaveTick: 60 * 90, sentryChance: .24, lateSentryChance: .34, minimumSpawnInterval: 15
});

function wave(startSecond: number, intervalTicks: number, sentryChance: number, droneChance: number): CampaignWave {
  return Object.freeze({ startTick: 60 * startSecond, intervalTicks, sentryChance, droneChance });
}

function campaign(durationSeconds: number, bossSecond: number, crawlerHp: number, waves: CampaignRules['waves'], boss: CampaignBoss): CampaignRules {
  return Object.freeze({
    kind: 'campaign', durationTicks: 60 * durationSeconds, arenaSize: 1500, bossSpawnTick: 60 * bossSecond,
    crawlerHp, waves: Object.freeze(waves), boss: Object.freeze(boss)
  });
}

const RULES = Object.freeze({
  'desert-base': DESERT_RULES,
  rainforest: RAINFOREST_RULES,
  antarctica: campaign(210, 162, 43, [
    wave(0, 61, 0, 0),
    wave(36, 52, .24, .08),
    wave(82, 38, .30, .10),
    wave(126, 26, .32, .12),
    wave(173, 16, .27, .12)
  ], { hp: 1050, speed: .57, shotCount: 7, aim: 'fan', fanStep: .17, shotSpeed: 2.3, cooldownTicks: 142 }),
  'space-elevator': campaign(205, 158, 30, [
    wave(0, 61, 0, .32),
    wave(29, 50, .10, .42),
    wave(76, 35, .14, .49),
    wave(120, 24, .18, .50),
    wave(167, 16, .16, .56)
  ], { hp: 925, speed: 1.05, shotCount: 3, aim: 'fan', fanStep: .14, shotSpeed: 2.8, cooldownTicks: 103 }),
  watchtower: campaign(225, 173, 32, [
    wave(0, 63, 0, .08),
    wave(25, 48, .17, .22),
    wave(62, 30, .23, .27),
    wave(89, 53, .09, .21),
    wave(105, 25, .28, .24),
    wave(144, 40, .17, .29),
    wave(164, 15, .28, .34)
  ], { hp: 1100, speed: .72, shotCount: 10, aim: 'ring', shotSpeed: 2.4, cooldownTicks: 113 }),
  'lunar-echoes': campaign(240, 185, 35, [
    wave(0, 59, 0, .14),
    wave(22, 45, .16, .26),
    wave(66, 36, .24, .34),
    wave(112, 25, .30, .36),
    wave(155, 17, .32, .32),
    wave(201, 13, .34, .34)
  ], { hp: 1250, speed: .79, shotCount: 15, aim: 'ring', shotSpeed: 2.5, cooldownTicks: 120 })
} satisfies Record<StageId, typeof DESERT_RULES | typeof RAINFOREST_RULES | CampaignRules>);

function isStageId(stageId: unknown): stageId is StageId {
  return typeof stageId === 'string' && Object.hasOwn(CONTEXTS, stageId);
}

export function stageContext(stageId: StageId): StageContext {
  return CONTEXTS[stageId];
}

export function resolveStage(stageId: unknown, rulesVersion: unknown): StageContext {
  if (!isStageId(stageId)) throw new SimulationError('unavailable-stage');
  const stage = stageContext(stageId);
  if (rulesVersion !== stage.rulesVersion) throw new SimulationError('incompatible-rules');
  return stage;
}

export function stageRules(context: StageContext) {
  return RULES[resolveStage(context.stageId, context.rulesVersion).stageId];
}
