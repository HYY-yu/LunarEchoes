import type { Enemy, Shot, World } from './core.js';
import type { DesertRepair, TowerModule } from './desert-repair.js';
import { DESERT_DROP_RATE_CONTEXT, type StageContext } from './stage-rules.js';

type Position = Readonly<{ x: number; y: number }>;
type ModuleDrop = Position & Readonly<{ module: TowerModule }>;
export type DesertSalvage = {
  lootRng: number;
  held?: TowerModule;
  modules: readonly ModuleDrop[];
};
export type TowerAction = 'fortify-tower' | 'mod-tower';
export type TowerAmmo = `tower-${TowerModule}`;
export type TowerBurn = { nextTick: number; remaining: number };
type Damage = (enemy: Enemy, damage: number, flash: number) => void;

const MODULES: readonly [TowerModule, TowerModule, TowerModule] = ['fire', 'electric', 'powder'];
const LEGACY_DROP_RATES = Object.freeze({ material: .4, module: .1 });
const DESERT_DROP_RATES = Object.freeze({ material: .16, module: .03 });
const MODULE_PICKUP_RADIUS = 20;
const BURN_INTERVAL = 20;
const BURN_PULSES = 3;
const BURN_DAMAGE = 4;
const POWDER_RADIUS = 42;
const POWDER_SPLASH = 12;

export const TOWER_MODULE_AMMO = {
  fire: { kind: 'tower-fire', damageDelta: -6 },
  electric: { kind: 'tower-electric', damageDelta: -10 },
  powder: { kind: 'tower-powder', damageDelta: 0 }
} satisfies { [Module in TowerModule]: { kind: `tower-${Module}`; damageDelta: number } };

export function createDesertSalvage(seed: number): DesertSalvage {
  return { lootRng: (seed ^ 0x9e3779b9) >>> 0, modules: [] };
}

export function dropDesertSalvage(salvage: DesertSalvage, repair: DesertRepair, { x, y }: Position, context: StageContext): void {
  const rates = context === DESERT_DROP_RATE_CONTEXT ? DESERT_DROP_RATES : LEGACY_DROP_RATES;
  salvage.lootRng = (Math.imul(salvage.lootRng, 1664525) + 1013904223) >>> 0;
  const roll = salvage.lootRng / 4294967296;
  if (roll < rates.material) {
    const material = roll < rates.material * 2 / 3 ? 'wood' : 'iron';
    repair.supplies = [...repair.supplies, { x, y, material }];
  } else if (roll < rates.material + rates.module) {
    const module = MODULES[Math.floor((roll - rates.material) * (MODULES.length / rates.module))];
    salvage.modules = [...salvage.modules, { x, y, module }];
  }
}

export function stepModulePickup(world: Pick<World, 'player' | 'events'>, salvage: DesertSalvage): void {
  if (salvage.held) return;
  const { player } = world;
  const target = salvage.modules.find(drop => Math.hypot(drop.x - player.x, drop.y - player.y) <= MODULE_PICKUP_RADIUS);
  if (!target) return;
  salvage.held = target.module;
  salvage.modules = salvage.modules.filter(drop => drop !== target);
  world.events.push('pickup');
}

export function pulseFireInterval(pulse: number): number {
  return Math.max(8, 31 - pulse * 3);
}

export function stepTowerBurn(enemy: Enemy, tick: number, damage: Damage): void {
  const burn = enemy.towerBurn;
  if (!burn || tick < burn.nextTick || enemy.hp <= 0) return;
  damage(enemy, BURN_DAMAGE, 6);
  if (--burn.remaining === 0) delete enemy.towerBurn;
  else burn.nextTick += BURN_INTERVAL;
}

export function hitWithPlayerSideShot(shot: Shot, enemy: Enemy, world: Pick<World, 'tick' | 'enemies'>, damage: Damage): void {
  damage(enemy, shot.damage, 6);
  if (shot.kind === 'tower-electric' && shot.piercedEnemyId === undefined) {
    shot.piercedEnemyId = enemy.id;
    return;
  }
  shot.life = 0;
  if (shot.kind === 'tower-fire' && enemy.hp > 0) {
    enemy.towerBurn = { nextTick: enemy.towerBurn?.nextTick ?? world.tick + BURN_INTERVAL, remaining: BURN_PULSES };
  } else if (shot.kind === 'tower-powder') {
    for (const other of world.enemies) {
      if (other !== enemy && other.hp > 0 && Math.hypot(other.x - shot.x, other.y - shot.y) <= POWDER_RADIUS) damage(other, POWDER_SPLASH, 6);
    }
  }
}
