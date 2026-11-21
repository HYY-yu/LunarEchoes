import type { Enemy, World } from './core.js';

type Position = Readonly<{ x: number; y: number }>;
type Material = 'wood' | 'iron';
type Materials = Record<Material, number>;
type Supply = Position & Readonly<{ material: Material }>;
type Tower = Position & Readonly<{ kind: 'damaged' | 'repaired' }>;

export type DesertRepair = {
  inventory: Materials;
  supplies: readonly Supply[];
  tower: Tower;
  nextTurretShotTick?: number;
};

export const REPAIR_COST: Readonly<Materials> = Object.freeze({ wood: 2, iron: 1 });
export const SUPPLY_CAPACITY = 3;
export const REPAIR_RADIUS = 28;
const PICKUP_RADIUS = 20;
const TURRET_RANGE = 240;
const TURRET_SECTOR_SLOPE = Math.sqrt(3);
const TURRET_SHOT_SPEED = 8;
const TURRET_SHOT_LIFE = 30;
const TURRET_SHOT_DAMAGE = 18;
const TURRET_CADENCE = 54;

const SUPPLIES = [
  { material: 'wood', x: 688, y: 750 },
  { material: 'wood', x: 642, y: 750 },
  { material: 'wood', x: 596, y: 750 },
  { material: 'wood', x: 550, y: 750 },
  { material: 'iron', x: 812, y: 750 },
  { material: 'iron', x: 858, y: 750 },
  { material: 'iron', x: 904, y: 750 },
  { material: 'iron', x: 950, y: 750 }
] satisfies Supply[];

export function createDesertRepair(): DesertRepair {
  return {
    inventory: { wood: 0, iron: 0 },
    supplies: SUPPLIES.map(supply => ({ ...supply })),
    tower: { kind: 'damaged', x: 750, y: 670 }
  };
}

export function stepDesertRepair(repair: DesertRepair, player: Position): void {
  const { inventory, supplies, tower } = repair;
  repair.supplies = supplies.filter(supply => {
    if (inventory[supply.material] >= SUPPLY_CAPACITY || distance(player, supply) > PICKUP_RADIUS) return true;
    inventory[supply.material]++;
    return false;
  });
  if (tower.kind === 'damaged' && distance(player, tower) <= REPAIR_RADIUS &&
      inventory.wood >= REPAIR_COST.wood && inventory.iron >= REPAIR_COST.iron) {
    inventory.wood -= REPAIR_COST.wood;
    inventory.iron -= REPAIR_COST.iron;
    repair.tower = { ...tower, kind: 'repaired' };
  }
}

function distance(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function stepDesertTurret(world: Pick<World, 'desertRepair' | 'enemies' | 'shots' | 'events' | 'tick'>): void {
  const repair = world.desertRepair;
  if (!repair || repair.tower.kind !== 'repaired' || repair.nextTurretShotTick === undefined || world.tick < repair.nextTurretShotTick) return;

  const { tower } = repair;
  const boundaryRoundoff = 2 * Number.EPSILON * Math.max(tower.x, tower.y);
  let nearestDistanceSquared = (TURRET_RANGE + boundaryRoundoff) ** 2;
  let target: Enemy | undefined;
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - tower.x;
    const north = tower.y - enemy.y;
    if (north <= 0 || Math.abs(dx) > north * TURRET_SECTOR_SLOPE + boundaryRoundoff) continue;
    const distanceSquared = dx * dx + north * north;
    if (distanceSquared > nearestDistanceSquared ||
        (distanceSquared === nearestDistanceSquared && target && enemy.id >= target.id)) continue;
    target = enemy;
    nearestDistanceSquared = distanceSquared;
  }
  if (!target) return;

  const velocityScale = TURRET_SHOT_SPEED / Math.sqrt(nearestDistanceSquared);
  world.shots.push({
    x: tower.x, y: tower.y,
    vx: (target.x - tower.x) * velocityScale, vy: (target.y - tower.y) * velocityScale,
    life: TURRET_SHOT_LIFE, damage: TURRET_SHOT_DAMAGE, hostile: false
  });
  repair.nextTurretShotTick = world.tick + TURRET_CADENCE;
  world.events.push('shot');
}
