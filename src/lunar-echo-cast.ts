import type { World } from './core.js';
import { LUNAR_ECHO_CONTEXT } from './stage-rules.js';

const SPLIT_TICK = 187 * 60;
const ECHO_FORWARD = 110;
const ECHO_OFFSETS = [-78, 78];
const ARENA_MARGIN = 36;

export const LUNAR_ECHO_CAST = Object.freeze({ warningTicks: 42, lifeTicks: 150 });
export const LUNAR_ECHO_STATS = Object.freeze({ hp: 45, radius: 24, speed: 0, xp: 0 });

type Site = Readonly<{ x: number; y: number }>;
type CastOrigin = Readonly<{ bossId: number; splitTick: number }>;
export type LunarEchoCast = CastOrigin & (
  Readonly<{ kind: 'warning'; sites: readonly Site[] }> | Readonly<{ kind: 'active'; expiresAt: number }>
);

export function stepLunarEchoCast(world: World, arenaSize: number, enemyLimit: number): void {
  if (world.context !== LUNAR_ECHO_CONTEXT) return;
  const { player, tick, lunarEchoCast: cast } = world;
  if (!cast && tick !== SPLIT_TICK - LUNAR_ECHO_CAST.warningTicks) return;
  const boss = world.enemies.find(enemy => enemy.kind === 'boss' && (!cast || cast.bossId === enemy.id));
  if (cast?.kind === 'active') {
    if (!boss || world.phase.kind === 'lost' || tick >= cast.expiresAt) {
      world.enemies = world.enemies.filter(enemy => enemy.kind !== 'boss-echo');
      delete world.lunarEchoCast;
    } else if (!world.enemies.some(enemy => enemy.kind === 'boss-echo')) {
      delete world.lunarEchoCast;
    }
    return;
  }
  if (!boss || world.phase.kind === 'lost') {
    delete world.lunarEchoCast;
    return;
  }
  if (cast?.kind === 'warning') {
    if (tick !== cast.splitTick) return;
    const { hp, radius } = LUNAR_ECHO_STATS;
    for (const { x, y } of cast.sites.slice(0, Math.max(0, enemyLimit - world.enemies.length))) {
      world.enemies.push({ id: world.nextId++, kind: 'boss-echo', x, y, hp, maxHp: hp, radius, attack: 0, flash: 0 });
    }
    world.lunarEchoCast = {
      kind: 'active', bossId: cast.bossId, splitTick: cast.splitTick, expiresAt: tick + LUNAR_ECHO_CAST.lifeTicks
    };
    return;
  }
  const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
  const inside = (coordinate: number) => Math.max(ARENA_MARGIN, Math.min(arenaSize - ARENA_MARGIN, coordinate));
  const sites = ECHO_OFFSETS.map(side => ({
    x: inside(boss.x + ECHO_FORWARD * Math.cos(angle) - side * Math.sin(angle)),
    y: inside(boss.y + ECHO_FORWARD * Math.sin(angle) + side * Math.cos(angle))
  }));
  world.lunarEchoCast = { kind: 'warning', bossId: boss.id, splitTick: SPLIT_TICK, sites };
}
