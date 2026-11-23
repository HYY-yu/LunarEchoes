import { RAINFOREST_BROOD_CONTEXT, type StageContext } from './stage-rules.js';

const RELEASE_TICKS = [158 * 60, 163 * 60];
const WARNING_TICKS = 54;
const SITES = [{ x: -70, y: -30 }, { x: 70, y: -30 }, { x: 0, y: 76 }];

type Site = Readonly<{ x: number; y: number }>;
export type RainforestBrood = Readonly<{ tick: number; motherId: number; sites: readonly Site[] }>;

export function rainforestBroodReleases(context: StageContext, tick: number): boolean {
  return context === RAINFOREST_BROOD_CONTEXT && RELEASE_TICKS.includes(tick);
}

export function rainforestBroodWarning(context: StageContext, tick: number): number | undefined {
  if (context !== RAINFOREST_BROOD_CONTEXT) return undefined;
  const release = RELEASE_TICKS.find(end => tick >= end - WARNING_TICKS && tick < end);
  return release === undefined ? undefined : (tick - release + WARNING_TICKS) / WARNING_TICKS;
}

export function rainforestBroodSites(x: number, y: number, arenaSize: number): readonly Site[] {
  const inside = (value: number) => Math.max(36, Math.min(arenaSize - 36, value));
  return SITES.map(offset => ({ x: inside(x + offset.x), y: inside(y + offset.y) }));
}
