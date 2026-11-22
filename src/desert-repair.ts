import type { Enemy, Shot, World } from './core.js';

type Position = Readonly<{ x: number; y: number }>;
type Material = 'wood' | 'iron';
type Materials = Record<Material, number>;
type Supply = Position & Readonly<{ material: Material }>;
type Tower = Position & Readonly<{ kind: 'damaged' | 'repaired' }>;

type InventoryState = {
  inventory: Materials;
  supplies: readonly Supply[];
};
type SingleTowerRepair = InventoryState & {
  tower: Tower;
  nextTurretShotTick?: number;
};
export type TowerDirection = 'north' | 'east' | 'south' | 'west';
export type DesertTurretShot = Readonly<Pick<Shot, 'vx' | 'vy'> & { tick: number }>;
export type DesertTurretShots = Partial<Record<TowerDirection, DesertTurretShot>>;
type TurretWorld = Pick<World, 'desertRepair' | 'desertTurretShots' | 'enemies' | 'shots' | 'events' | 'tick'>;
type DirectionalTower = Position & Readonly<{ direction: TowerDirection }> & (
  Readonly<{ kind: 'damaged' }> | { readonly kind: 'repaired'; nextTurretShotTick: number }
);
type FourTowerRepair = InventoryState & { towers: readonly DirectionalTower[] };
export type DesertRepair = SingleTowerRepair | FourTowerRepair;

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

const FOUR_TOWER_LAYOUT = [
  { direction: 'north', x: 750, y: 670, wood: [{ x: 750, y: 620 }, { x: 750, y: 578 }], iron: { x: 750, y: 536 } },
  { direction: 'east', x: 830, y: 750, wood: [{ x: 880, y: 750 }, { x: 922, y: 750 }], iron: { x: 964, y: 750 } },
  { direction: 'south', x: 750, y: 830, wood: [{ x: 750, y: 880 }, { x: 750, y: 922 }], iron: { x: 750, y: 964 } },
  { direction: 'west', x: 670, y: 750, wood: [{ x: 620, y: 775 }, { x: 578, y: 775 }], iron: { x: 536, y: 775 } }
] satisfies readonly (Position & { direction: TowerDirection; wood: readonly [Position, Position]; iron: Position })[];

export function createDesertRepair(): SingleTowerRepair {
  return {
    inventory: { wood: 0, iron: 0 },
    supplies: SUPPLIES.map(supply => ({ ...supply })),
    tower: { kind: 'damaged', x: 750, y: 670 }
  };
}

export const DESERT_SUPPLY_DIRECTIONS = FOUR_TOWER_LAYOUT.map(tower => tower.direction);

export function desertShipment(index: number): Supply[] {
  const { wood, iron } = FOUR_TOWER_LAYOUT[index];
  return [...wood.map<Supply>(point => ({ ...point, material: 'wood' })), { ...iron, material: 'iron' }];
}

export function createDesertFourTowers(supplies = FOUR_TOWER_LAYOUT.flatMap((_, index) => desertShipment(index))): FourTowerRepair {
  return {
    inventory: { wood: 0, iron: 0 },
    supplies,
    towers: FOUR_TOWER_LAYOUT.map(({ direction, x, y }) => ({ direction, x, y, kind: 'damaged' }))
  };
}

export function stepDesertRepair(repair: DesertRepair, player: Position): boolean {
  const { inventory, supplies } = repair;
  repair.supplies = supplies.filter(supply => {
    if (inventory[supply.material] >= SUPPLY_CAPACITY || distance(player, supply) > PICKUP_RADIUS) return true;
    inventory[supply.material]++;
    return false;
  });
  if (inventory.wood < REPAIR_COST.wood || inventory.iron < REPAIR_COST.iron) return false;

  if ('towers' in repair) {
    const target = repair.towers.find(tower => tower.kind === 'damaged' && distance(player, tower) <= REPAIR_RADIUS);
    if (!target) return false;
    repair.towers = repair.towers.map(tower => tower === target
      ? { ...tower, kind: 'repaired', nextTurretShotTick: 0 }
      : tower);
  } else {
    const { tower } = repair;
    if (tower.kind !== 'damaged' || distance(player, tower) > REPAIR_RADIUS) return false;
    repair.tower = { ...tower, kind: 'repaired' };
  }
  inventory.wood -= REPAIR_COST.wood;
  inventory.iron -= REPAIR_COST.iron;
  return true;
}

function distance(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function stepDesertTurret(world: TurretWorld): void {
  const repair = world.desertRepair;
  if (!repair) return;
  if ('towers' in repair) {
    for (const tower of repair.towers) {
      if (tower.kind === 'repaired' && world.tick >= tower.nextTurretShotTick && fireTurret(world, tower, tower.direction)) {
        tower.nextTurretShotTick = world.tick + TURRET_CADENCE;
      }
    }
    return;
  }
  if (repair.tower.kind === 'repaired' && repair.nextTurretShotTick !== undefined &&
      world.tick >= repair.nextTurretShotTick && fireTurret(world, repair.tower, 'north')) {
    repair.nextTurretShotTick = world.tick + TURRET_CADENCE;
  }
}

function fireTurret(world: TurretWorld, tower: Position, direction: TowerDirection): boolean {
  const boundaryRoundoff = 2 * Number.EPSILON * Math.max(tower.x, tower.y);
  let nearestDistanceSquared = (TURRET_RANGE + boundaryRoundoff) ** 2;
  let target: Enemy | undefined;
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - tower.x;
    const dy = enemy.y - tower.y;
    const forward = direction === 'north' ? -dy : direction === 'east' ? dx : direction === 'south' ? dy : -dx;
    const sideways = direction === 'north' || direction === 'south' ? dx : dy;
    if (forward <= 0 || Math.abs(sideways) > forward * TURRET_SECTOR_SLOPE + boundaryRoundoff) continue;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared > nearestDistanceSquared ||
        (distanceSquared === nearestDistanceSquared && target && enemy.id >= target.id)) continue;
    target = enemy;
    nearestDistanceSquared = distanceSquared;
  }
  if (!target) return false;

  const velocityScale = TURRET_SHOT_SPEED / Math.sqrt(nearestDistanceSquared);
  const vx = (target.x - tower.x) * velocityScale;
  const vy = (target.y - tower.y) * velocityScale;
  world.shots.push({
    x: tower.x, y: tower.y, vx, vy,
    life: TURRET_SHOT_LIFE, damage: TURRET_SHOT_DAMAGE, hostile: false
  });
  (world.desertTurretShots ??= {})[direction] = { tick: world.tick, vx, vy };
  world.events.push('shot');
  return true;
}
