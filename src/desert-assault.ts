import type { Enemy, EnemyKind } from './core.js';
import { DESERT_ASSAULT_DURATION_TICKS } from './stage-rules.js';
import { RELAY_REPAIR_RAID } from './desert-repair.js';

const TICKS_PER_SECOND = 60;
const TOWER_COUNT = 4;
const FINAL_DELAY_TICKS = 3 * TICKS_PER_SECOND;
const FINAL_LAST_BATCH_TARGET = 280;
export const FINAL_BATCH_COUNT = 6;
export const DESERT_SUPPLY_TICKS = [105, 120, 140, 160].map(second => second * TICKS_PER_SECOND);
export const DESERT_RELAY_SUPPLY_TICKS = [1, 45 * TICKS_PER_SECOND, 100 * TICKS_PER_SECOND, 160 * TICKS_PER_SECOND];
export const DESERT_LATE_REPAIR_TICK = 210 * TICKS_PER_SECOND;
export const DESERT_CENTER = Object.freeze({ x: 750, y: 750 });

type LegacyDesertAssault = {
  deliveries: number;
  final: { kind: 'waiting' }
    | { kind: 'scheduled'; firstTick: number }
    | { kind: 'active'; firstEnemyId: number; batches: number; nextTick: number; intervalTicks: number };
};

type ContinuousDesertAssault = {
  mode: 'continuous' | 'salvage';
  deliveries: number;
  final: { kind: 'waiting' }
    | { kind: 'scheduled'; firstTick: number }
    | { kind: 'active'; firstEnemyId: number; bossTick: number; reinforcementEnd: number; pressureStart: number };
};

export type DesertAssault = LegacyDesertAssault | ContinuousDesertAssault;

const EARLIEST_BOSS_TICK = 255 * TICKS_PER_SECOND;
const BOSS_BUILDUP_TICKS = 18 * TICKS_PER_SECOND;
const REINFORCEMENT_TICKS = 9 * TICKS_PER_SECOND;
const PRESSURE_STEP_TICKS = 18 * TICKS_PER_SECOND;

type SpawnEnemy = (kind: EnemyKind, origin?: Readonly<{ x: number; y: number }>) => void;

export function stepDesertAssault(
  assault: DesertAssault, tick: number, repairedCount: number, nextEnemyId: number, spawn: SpawnEnemy
): boolean {
  if (repairedCount !== 0 && (!('mode' in assault) || assault.mode !== 'salvage' || assault.final.kind === 'waiting')) {
    for (const kind of RELAY_REPAIR_RAID) spawn(kind);
    if (repairedCount === TOWER_COUNT) assault.final = { kind: 'scheduled', firstTick: tick + FINAL_DELAY_TICKS };
  }
  if ('mode' in assault) {
    if (assault.final.kind === 'scheduled' && tick === assault.final.firstTick) {
      const bossTick = Math.max(EARLIEST_BOSS_TICK, tick + BOSS_BUILDUP_TICKS);
      assault.final = { kind: 'active', firstEnemyId: nextEnemyId, bossTick, pressureStart: tick,
        reinforcementEnd: Math.min(bossTick + REINFORCEMENT_TICKS, DESERT_ASSAULT_DURATION_TICKS) };
    }
    if (assault.final.kind !== 'active' || tick !== assault.final.bossTick) return false;
    spawn('boss', DESERT_CENTER);
    return true;
  }
  if (assault.final.kind === 'scheduled' && tick === assault.final.firstTick) {
    const spacing = Math.floor((FINAL_LAST_BATCH_TARGET - tick / TICKS_PER_SECOND) / (FINAL_BATCH_COUNT - 1));
    assault.final = { kind: 'active', firstEnemyId: nextEnemyId, batches: 0, nextTick: tick,
      intervalTicks: Math.max(12, Math.min(20, spacing)) * TICKS_PER_SECOND };
  }
  const final = assault.final;
  if (final.kind !== 'active' || final.batches === FINAL_BATCH_COUNT || tick !== final.nextTick) return false;
  const containsBoss = final.batches === FINAL_BATCH_COUNT - 1;
  if (containsBoss) spawn('boss', DESERT_CENTER);
  for (let index = 0; index < 8 + final.batches * 2; index++) {
    spawn(index % 5 === 0 ? 'sentry' : index % 3 === 0 ? 'drone' : 'crawler', DESERT_CENTER);
  }
  final.batches++;
  final.nextTick += final.intervalTicks;
  return containsBoss;
}

export function desertSpawnsReinforcements(assault: DesertAssault | undefined, tick: number): boolean {
  if (assault?.final.kind !== 'active') return true;
  return 'mode' in assault && tick < assault.final.reinforcementEnd;
}

export function desertSpawnInterval(assault: DesertAssault | undefined, tick: number): number {
  const baseline = Math.max(13, 60 - Math.floor(tick / TICKS_PER_SECOND / 3));
  if (!assault || !('mode' in assault) || assault.final.kind !== 'active') return baseline;
  return Math.max(8, baseline - Math.floor((tick - assault.final.pressureStart) / PRESSURE_STEP_TICKS));
}

export function desertAssaultOutcome(assault: DesertAssault, tick: number, enemies: readonly Enemy[], bossKilled: boolean, allTowersRepaired = false): 'won' | 'lost' | undefined {
  if ('mode' in assault) {
    const { final } = assault;
    if (final.kind === 'active' && bossKilled && tick >= final.reinforcementEnd &&
      (assault.mode !== 'salvage' || allTowersRepaired) &&
      enemies.every(enemy => enemy.id < final.firstEnemyId)) return 'won';
  } else {
    const { final } = assault;
    if (final.kind === 'active' && final.batches === FINAL_BATCH_COUNT && enemies.every(enemy => enemy.id < final.firstEnemyId)) return 'won';
  }
  if (tick >= DESERT_ASSAULT_DURATION_TICKS) return 'lost';
}
