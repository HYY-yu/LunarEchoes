import type { World } from './core.js';
import { WATCHTOWER_STRIKE_CONTEXT } from './stage-rules.js';

const IMPACT_TICKS = [176 * 60, 180 * 60];
const MARK_OFFSETS = [-76, 0, 76];
const MARK_RADIUS = 46;
const ARENA_MARGIN = 36;

export const WATCHTOWER_STRIKE = Object.freeze({ warningTicks: 60, aftermathTicks: 24 });

type StrikeMark = Readonly<{ x: number; y: number; radius: number }>;
type StrikeTarget = Readonly<{ bossId: number; impactTick: number; marks: readonly StrikeMark[] }>;
export type WatchtowerStrike = StrikeTarget & (
  Readonly<{ kind: 'warning' }> | Readonly<{ kind: 'impact'; outcome: 'hit' | 'avoided' | 'shielded' }>
);

export function stepWatchtowerStrike(world: World, arenaSize: number, damagePlayer: (world: World) => void): void {
  if (world.context !== WATCHTOWER_STRIKE_CONTEXT) return;
  const { player, tick, watchtowerStrike: strike } = world;
  if (strike?.kind === 'warning') {
    if (world.phase.kind === 'lost' || !world.enemies.some(enemy => enemy.id === strike.bossId)) {
      delete world.watchtowerStrike;
    } else if (tick === strike.impactTick) {
      const covered = strike.marks.some(mark => Math.hypot(player.x - mark.x, player.y - mark.y) <= mark.radius);
      const previousHp = player.hp;
      if (covered) damagePlayer(world);
      world.watchtowerStrike = {
        ...strike, kind: 'impact', outcome: !covered ? 'avoided' : player.hp < previousHp ? 'hit' : 'shielded'
      };
    }
    return;
  }
  if (strike?.kind === 'impact' && tick - strike.impactTick >= WATCHTOWER_STRIKE.aftermathTicks) {
    delete world.watchtowerStrike;
  }
  const impactTick = IMPACT_TICKS.find(impact => tick === impact - WATCHTOWER_STRIKE.warningTicks);
  if (impactTick === undefined || world.phase.kind === 'lost') return;
  const boss = world.enemies.find(enemy => enemy.kind === 'boss');
  if (!boss) return;
  const across = Math.atan2(player.y - boss.y, player.x - boss.x) + Math.PI / 2;
  const inside = (coordinate: number) => Math.max(ARENA_MARGIN, Math.min(arenaSize - ARENA_MARGIN, coordinate));
  const marks = MARK_OFFSETS.map(offset => ({
    x: inside(player.x + offset * Math.cos(across)),
    y: inside(player.y + offset * Math.sin(across)),
    radius: MARK_RADIUS
  }));
  world.watchtowerStrike = { kind: 'warning', bossId: boss.id, impactTick, marks };
}
