export const DESERT_CONTEXT = Object.freeze({ stageId: 'desert-base', rulesVersion: 'desert-base-1' } as const);
export type StageContext = typeof DESERT_CONTEXT;
export type SimulationErrorCode = 'invalid-data' | 'incompatible-version' | 'unavailable-stage' | 'incompatible-rules' | 'nonterminal-replay' | 'checksum-mismatch' | 'incomplete-replay';
export class SimulationError extends Error {
  constructor(readonly code: SimulationErrorCode) { super(code === 'incompatible-version' ? 'Replay version mismatch' : code); this.name = 'SimulationError'; }
}
const DESERT_RULES = Object.freeze({ durationTicks: 60 * 180, arenaSize: 1500, bossSpawnTick: 60 * 140 });
export function resolveStage(stageId: unknown, rulesVersion: unknown): StageContext {
  if (stageId !== DESERT_CONTEXT.stageId) throw new SimulationError('unavailable-stage');
  if (rulesVersion !== DESERT_CONTEXT.rulesVersion) throw new SimulationError('incompatible-rules');
  return DESERT_CONTEXT;
}
export function stageRules(context: StageContext) {
  resolveStage(context.stageId, context.rulesVersion);
  return DESERT_RULES;
}
