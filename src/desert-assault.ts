import type { Enemy, EnemyKind } from './core.js';
import { DESERT_ASSAULT_DURATION_TICKS } from './stage-rules.js';

const TICKS_PER_SECOND = 60;
const TOWER_COUNT = 4;
const FINAL_DELAY_TICKS = 3 * TICKS_PER_SECOND;
const FINAL_LAST_BATCH_TARGET = 280;
export const FINAL_BATCH_COUNT = 6;
export const DESERT_SUPPLY_TICKS = [105, 120, 140, 160].map(second => second * TICKS_PER_SECOND);
export const DESERT_LATE_REPAIR_TICK = 210 * TICKS_PER_SECOND;
export const DESERT_CENTER = Object.freeze({ x: 750, y: 750 });

export type DesertAssault = {
  deliveries: number;
  final: { kind: 'waiting' }
    | { kind: 'scheduled'; firstTick: number }
    | { kind: 'active'; firstEnemyId: number; batches: number; nextTick: number; intervalTicks: number };
};

type SpawnEnemy = (kind: EnemyKind, origin?: Readonly<{ x: number; y: number }>) => void;

export function stepDesertAssault(
  assault: DesertAssault, tick: number, repairedCount: number, nextEnemyId: number, spawn: SpawnEnemy
): boolean {
  if (repairedCount !== 0) {
    spawn('crawler');
    spawn('crawler');
    spawn('drone');
    if (repairedCount === TOWER_COUNT) assault.final = { kind: 'scheduled', firstTick: tick + FINAL_DELAY_TICKS };
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

export function desertAssaultOutcome(assault: DesertAssault, tick: number, enemies: readonly Enemy[]): 'won' | 'lost' | undefined {
  const final = assault.final;
  if (final.kind === 'active' && final.batches === FINAL_BATCH_COUNT && enemies.every(enemy => enemy.id < final.firstEnemyId)) return 'won';
  if (tick >= DESERT_ASSAULT_DURATION_TICKS) return 'lost';
}
