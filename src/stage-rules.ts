import type { StageId } from './stage-contract.js';

function context<const Id extends StageId, const Revision extends 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>(stageId: Id, revision: Revision): Readonly<{ stageId: Id; rulesVersion: `${Id}-${Revision}` }> {
  return Object.freeze({ stageId, rulesVersion: `${stageId}-${revision}` });
}

export const DESERT_CONTEXT = context('desert-base', 1);
export const DESERT_REPAIR_CONTEXT = context('desert-base', 3);
export const DESERT_TURRET_CONTEXT = context('desert-base', 4);
export const DESERT_FOUR_TOWERS_CONTEXT = context('desert-base', 5);
export const DESERT_ASSAULT_CONTEXT = context('desert-base', 6);
export const DESERT_RELAY_CONTEXT = context('desert-base', 7);
export const DESERT_CONTINUOUS_CONTEXT = context('desert-base', 8);
export const DESERT_ASSAULT_DURATION_TICKS = 60 * 300;
export const RAINFOREST_CONTEXT = context('rainforest', 1);
export const RAINFOREST_RELAY_CONTEXT = context('rainforest', 3);
export const ANTARCTICA_CONTEXT = context('antarctica', 1);
export const ANTARCTIC_RELAY_CONTEXT = context('antarctica', 3);
export const ANTARCTIC_FROST_CONTEXT = context('antarctica', 4);
export const SPACE_ELEVATOR_CONTEXT = context('space-elevator', 1);
export const ELEVATOR_RELAY_CONTEXT = context('space-elevator', 3);
export const WATCHTOWER_CONTEXT = context('watchtower', 1);
export const WATCHTOWER_RELAY_CONTEXT = context('watchtower', 3);
export const LUNAR_ECHOES_CONTEXT = context('lunar-echoes', 1);
export const LUNAR_RELAY_CONTEXT = context('lunar-echoes', 3);

const LEGACY_CONTEXTS = Object.freeze({
  'desert-base': DESERT_CONTEXT,
  rainforest: RAINFOREST_CONTEXT,
  antarctica: ANTARCTICA_CONTEXT,
  'space-elevator': SPACE_ELEVATOR_CONTEXT,
  watchtower: WATCHTOWER_CONTEXT,
  'lunar-echoes': LUNAR_ECHOES_CONTEXT
} satisfies { [Id in StageId]: { stageId: Id; rulesVersion: `${Id}-1` } });

const CONTEXTS = Object.freeze({
  'desert-base': context('desert-base', 2),
  rainforest: context('rainforest', 2),
  antarctica: context('antarctica', 2),
  'space-elevator': context('space-elevator', 2),
  watchtower: context('watchtower', 2),
  'lunar-echoes': context('lunar-echoes', 2)
} satisfies { [Id in StageId]: { stageId: Id; rulesVersion: `${Id}-2` } });

export type StageContext =
  | typeof CONTEXTS[StageId]
  | typeof LEGACY_CONTEXTS[StageId]
  | typeof DESERT_REPAIR_CONTEXT
  | typeof DESERT_TURRET_CONTEXT
  | typeof DESERT_FOUR_TOWERS_CONTEXT
  | typeof DESERT_ASSAULT_CONTEXT
  | typeof DESERT_RELAY_CONTEXT
  | typeof DESERT_CONTINUOUS_CONTEXT
  | typeof RAINFOREST_RELAY_CONTEXT
  | typeof ANTARCTIC_RELAY_CONTEXT
  | typeof ANTARCTIC_FROST_CONTEXT
  | typeof ELEVATOR_RELAY_CONTEXT
  | typeof WATCHTOWER_RELAY_CONTEXT
  | typeof LUNAR_RELAY_CONTEXT;

type FourDeliveries = readonly [number, number, number, number];
const ANTARCTIC_DELIVERY_TICKS = Object.freeze([1, 42 * 60, 84 * 60, 126 * 60] as const);
const CAMPAIGN_RELAY_DELIVERY_TICKS: Readonly<Partial<Record<StageContext['rulesVersion'], FourDeliveries>>> = Object.freeze({
  'rainforest-3': Object.freeze([1, 35 * 60, 70 * 60, 108 * 60] as const),
  'antarctica-3': ANTARCTIC_DELIVERY_TICKS,
  'antarctica-4': ANTARCTIC_DELIVERY_TICKS,
  'space-elevator-3': Object.freeze([1, 29 * 60, 76 * 60, 120 * 60] as const),
  'watchtower-3': Object.freeze([1, 42 * 60, 89 * 60, 118 * 60] as const),
  'lunar-echoes-3': Object.freeze([1, 44 * 60, 112 * 60, 142 * 60] as const)
});

const LATEST_CONTEXTS: Readonly<Partial<Record<StageId, StageContext>>> = Object.freeze({
  'desert-base': DESERT_CONTINUOUS_CONTEXT,
  rainforest: RAINFOREST_RELAY_CONTEXT,
  antarctica: ANTARCTIC_FROST_CONTEXT,
  'space-elevator': ELEVATOR_RELAY_CONTEXT,
  watchtower: WATCHTOWER_RELAY_CONTEXT,
  'lunar-echoes': LUNAR_RELAY_CONTEXT
});
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
  frostGuard?: Readonly<{ startTick: number; crawlerShare: number }>;
}>;

const DESERT_RULES = Object.freeze({ kind: 'desert' as const, durationTicks: 60 * 180, arenaSize: 1500, bossSpawnTick: 60 * 140 });
const DESERT_ASSAULT_RULES = Object.freeze({ ...DESERT_RULES, durationTicks: DESERT_ASSAULT_DURATION_TICKS });
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

const ANTARCTIC_FROST_RULES: CampaignRules = Object.freeze({
  ...RULES.antarctica,
  frostGuard: Object.freeze({ startTick: 82 * 60, crawlerShare: .22 })
});

function isStageId(stageId: unknown): stageId is StageId {
  return typeof stageId === 'string' && Object.hasOwn(CONTEXTS, stageId);
}

export function hasDesertRelay(context: StageContext): boolean {
  return context === DESERT_RELAY_CONTEXT || context === DESERT_CONTINUOUS_CONTEXT;
}

export function hasRelayBase(context: StageContext): boolean {
  return hasDesertRelay(context) || campaignRelayDeliveryTicks(context) !== undefined;
}

export function campaignRelayDeliveryTicks(context: StageContext): FourDeliveries | undefined {
  return CAMPAIGN_RELAY_DELIVERY_TICKS[context.rulesVersion];
}

export function hasDesertAssault(context: StageContext): boolean {
  return context === DESERT_ASSAULT_CONTEXT || hasDesertRelay(context);
}

export function stageContext(stageId: StageId): StageContext {
  return LATEST_CONTEXTS[stageId] ?? CONTEXTS[stageId];
}

export function resolveStage(stageId: unknown, rulesVersion: unknown): StageContext {
  if (!isStageId(stageId)) throw new SimulationError('unavailable-stage');
  const latest = stageContext(stageId);
  if (rulesVersion === latest.rulesVersion) return latest;
  if (stageId === 'antarctica' && rulesVersion === ANTARCTIC_RELAY_CONTEXT.rulesVersion) return ANTARCTIC_RELAY_CONTEXT;
  if (stageId === DESERT_TURRET_CONTEXT.stageId) {
    if (rulesVersion === DESERT_RELAY_CONTEXT.rulesVersion) return DESERT_RELAY_CONTEXT;
    if (rulesVersion === DESERT_ASSAULT_CONTEXT.rulesVersion) return DESERT_ASSAULT_CONTEXT;
    if (rulesVersion === DESERT_FOUR_TOWERS_CONTEXT.rulesVersion) return DESERT_FOUR_TOWERS_CONTEXT;
    if (rulesVersion === DESERT_TURRET_CONTEXT.rulesVersion) return DESERT_TURRET_CONTEXT;
    if (rulesVersion === DESERT_REPAIR_CONTEXT.rulesVersion) return DESERT_REPAIR_CONTEXT;
  }
  const legacy = LEGACY_CONTEXTS[stageId];
  if (rulesVersion === legacy.rulesVersion) return legacy;
  const stage = CONTEXTS[stageId];
  if (rulesVersion !== stage.rulesVersion) throw new SimulationError('incompatible-rules');
  return stage;
}

export function stageRules(context: StageContext) {
  const resolved = resolveStage(context.stageId, context.rulesVersion);
  if (resolved === ANTARCTIC_FROST_CONTEXT) return ANTARCTIC_FROST_RULES;
  return hasDesertAssault(resolved) ? DESERT_ASSAULT_RULES : RULES[resolved.stageId];
}
