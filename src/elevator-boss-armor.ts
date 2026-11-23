import type { Enemy } from './core.js';

export const ELEVATOR_BOSS_ARMOR = Object.freeze({ capacity: 165, durationTicks: 330, absorption: .6 });

export type ElevatorBossArmor =
  | Readonly<{ kind: 'active'; remaining: number; expiresAt: number; hitTick?: number }>
  | Readonly<{ kind: 'spent'; atTick: number; reason: 'broken' | 'expired' }>;

export function startElevatorBossArmor(tick: number): ElevatorBossArmor {
  return { kind: 'active', remaining: ELEVATOR_BOSS_ARMOR.capacity, expiresAt: tick + ELEVATOR_BOSS_ARMOR.durationTicks };
}

export function expireElevatorBossArmor(enemy: Enemy, tick: number): void {
  if (enemy.armor?.kind === 'active' && tick >= enemy.armor.expiresAt) {
    enemy.armor = { kind: 'spent', atTick: tick, reason: 'expired' };
  }
}

export function absorbElevatorBossDamage(enemy: Enemy, tick: number, damage: number): number {
  expireElevatorBossArmor(enemy, tick);
  const armor = enemy.armor;
  if (armor?.kind !== 'active') return damage;
  const absorbed = Math.min(armor.remaining, damage * ELEVATOR_BOSS_ARMOR.absorption);
  const remaining = armor.remaining - absorbed;
  enemy.armor = remaining > 0
    ? { ...armor, remaining, hitTick: tick }
    : { kind: 'spent', atTick: tick, reason: 'broken' };
  return damage - absorbed;
}
