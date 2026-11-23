import type { World } from './core.js';
import { ANTARCTIC_BARRAGE_CONTEXT } from './stage-rules.js';

const FIRST_VOLLEY_TICKS = [9870, 10110];
const LANE_STEP = .16;
const VOLLEY_YAW = [0, .08, -.08];
const SHOT_COUNT = 7;

export const ANTARCTIC_BARRAGE = Object.freeze({
  warningTicks: 54,
  volleyOffsets: Object.freeze([0, 12, 24] as const),
  spread: LANE_STEP * (SHOT_COUNT - 1) / 2 + .08,
  count: SHOT_COUNT,
  shotSpeed: 2.8,
  shotLife: 155
});

export type AntarcticBarrage = Readonly<{ bossId: number; angle: number; firstVolleyTick: number }>;

export function antarcticBarrageVolleyIndex(barrage: AntarcticBarrage, tick: number): number {
  return ANTARCTIC_BARRAGE.volleyOffsets.findIndex(offset => barrage.firstVolleyTick + offset === tick);
}

export function stepAntarcticBarrage(world: World, damage: number): void {
  if (world.context !== ANTARCTIC_BARRAGE_CONTEXT || world.phase.kind === 'lost') return;
  const { tick } = world;
  const { warningTicks, volleyOffsets, count, shotSpeed, shotLife } = ANTARCTIC_BARRAGE;
  const firstVolleyTick = FIRST_VOLLEY_TICKS.find(first => first - warningTicks === tick);
  if (firstVolleyTick === undefined && !world.antarcticBarrage) return;
  const boss = world.enemies.find(enemy => enemy.kind === 'boss');
  if (!boss) {
    delete world.antarcticBarrage;
    return;
  }
  if (firstVolleyTick !== undefined) {
    const angle = Math.atan2(world.player.y - boss.y, world.player.x - boss.x);
    world.antarcticBarrage = { bossId: boss.id, angle, firstVolleyTick };
  }
  const barrage = world.antarcticBarrage;
  if (!barrage) return;
  if (tick > barrage.firstVolleyTick + volleyOffsets[volleyOffsets.length - 1]) {
    delete world.antarcticBarrage;
    return;
  }
  const volley = antarcticBarrageVolleyIndex(barrage, tick);
  if (volley < 0) return;
  for (let lane = 0; lane < count; lane++) {
    const angle = barrage.angle + (lane - (count - 1) / 2) * LANE_STEP + VOLLEY_YAW[volley];
    world.shots.push({ x: boss.x, y: boss.y, vx: Math.cos(angle) * shotSpeed, vy: Math.sin(angle) * shotSpeed,
      life: shotLife, damage, hostile: true, kind: 'ice-shard' });
  }
}
