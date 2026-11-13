export const DESERT_CONTEXT = Object.freeze({ stageId: 'desert-base', rulesVersion: 'desert-base-1' } as const);
export const RAINFOREST_CONTEXT = Object.freeze({ stageId: 'rainforest', rulesVersion: 'rainforest-1' } as const);
export type StageContext = typeof DESERT_CONTEXT | typeof RAINFOREST_CONTEXT;
export type SimulationErrorCode = 'invalid-data' | 'incompatible-version' | 'unavailable-stage' | 'incompatible-rules' | 'nonterminal-replay' | 'checksum-mismatch' | 'incomplete-replay';
export class SimulationError extends Error {
  constructor(readonly code: SimulationErrorCode) { super(code === 'incompatible-version' ? 'Replay version mismatch' : code); this.name = 'SimulationError'; }
}
const DESERT_RULES = Object.freeze({ kind: 'desert' as const, durationTicks: 60 * 180, arenaSize: 1500, bossSpawnTick: 60 * 140 });
const RAINFOREST_RULES = Object.freeze({
  kind: 'rainforest' as const, durationTicks: 60 * 195, arenaSize: 1500, bossSpawnTick: 60 * 155,
  sentryStartTick: 60 * 18, lateWaveTick: 60 * 90, sentryChance: .24, lateSentryChance: .34, minimumSpawnInterval: 15
});
export function resolveStage(stageId: unknown, rulesVersion: unknown): StageContext {
  const context = stageId === DESERT_CONTEXT.stageId ? DESERT_CONTEXT : stageId === RAINFOREST_CONTEXT.stageId ? RAINFOREST_CONTEXT : null;
  if (context === null) throw new SimulationError('unavailable-stage');
  if (rulesVersion !== context.rulesVersion) throw new SimulationError('incompatible-rules');
  return context;
}
export function stageRules(context: StageContext) {
  return resolveStage(context.stageId, context.rulesVersion).stageId === 'rainforest' ? RAINFOREST_RULES : DESERT_RULES;
}
