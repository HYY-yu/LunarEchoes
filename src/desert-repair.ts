import type { Enemy, Shot, World } from './core.js';
import { hasDesertSalvage, hasRelayBase } from './stage-rules.js';
import { RELAY_CENTER, RELAY_CORNERS } from './relay-layout.js';
import { pulseFireInterval, TOWER_MODULE_AMMO, type TowerAction } from './desert-salvage.js';

import { materialMotionDuration, type Material } from './material-motion.js';

type Position = Readonly<{ x: number; y: number }>;
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
export type TowerModule = 'fire' | 'electric' | 'powder';
export type DesertTurretShot = Readonly<Pick<Shot, 'vx' | 'vy'> & { tick: number }>;
export type DesertTurretShots = Partial<Record<TowerDirection, DesertTurretShot>>;
type TurretWorld = Pick<World, 'context' | 'desertRepair' | 'desertTurretShots' | 'enemies' | 'shots' | 'events' | 'tick' | 'upgrades'>;
type TurretTargetWorld = Readonly<Pick<TurretWorld, 'context'>> & { readonly enemies: readonly Readonly<Enemy>[] };
type TowerArmor = { hits: number; lastShotTick?: number };
type RepairedTower = { readonly kind: 'repaired'; nextTurretShotTick: number; armor?: TowerArmor };
export type DirectionalTower = Position & Readonly<{ direction: TowerDirection; nextContactHitTick?: number; loadout?: { reinforced: boolean; module?: TowerModule } }>
  & (Readonly<{ kind: 'damaged' }> | RepairedTower);
type ArmoredTower = DirectionalTower & RepairedTower & { armor: TowerArmor };
type FourTowerRepair = InventoryState & { towers: readonly DirectionalTower[] };
export type DesertRepair = SingleTowerRepair | FourTowerRepair;
type TowerDamageWorld = Pick<World, 'tick' | 'events' | 'desertTurretShots'>;

export const REPAIR_COST: Readonly<Materials> = Object.freeze({ wood: 2, iron: 1 });
export const SUPPLY_CAPACITY = 3;
export const REPAIR_RADIUS = 28;
export const RELAY_REPAIR_RAID = ['crawler', 'crawler', 'drone'] as const;
const PICKUP_RADIUS = 20;
const TURRET_RANGE = 240;
const TURRET_SECTOR_SLOPE = Math.sqrt(3);
const TURRET_SHOT_SPEED = 8;
const TURRET_SHOT_LIFE = 30;
const TURRET_SHOT_DAMAGE = 18;
const TURRET_CADENCE = 54;
const REINFORCED_TURRET_DAMAGE = 26;
const TOWER_BASE_HITS = 15;
const TOWER_UPGRADE_HITS = 2;
const TOWER_HIT_RADIUS = 12;
const CONTACT_COOLDOWN = 60;

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

type TowerSite = Position & { direction: TowerDirection; wood: readonly [Position, Position]; iron: Position };

const FOUR_TOWER_LAYOUT = [
  { direction: 'north', x: 750, y: 670, wood: [{ x: 750, y: 620 }, { x: 750, y: 578 }], iron: { x: 750, y: 536 } },
  { direction: 'east', x: 830, y: 750, wood: [{ x: 880, y: 750 }, { x: 922, y: 750 }], iron: { x: 964, y: 750 } },
  { direction: 'south', x: 750, y: 830, wood: [{ x: 750, y: 880 }, { x: 750, y: 922 }], iron: { x: 750, y: 964 } },
  { direction: 'west', x: 670, y: 750, wood: [{ x: 620, y: 775 }, { x: 578, y: 775 }], iron: { x: 536, y: 775 } }
] satisfies readonly TowerSite[];

const RELAY_TOWER_LAYOUT = RELAY_CORNERS.map<TowerSite>((corner, index) => {
  const x = RELAY_CENTER.x + corner.x;
  const y = RELAY_CENTER.y + corner.y;
  const legacy = FOUR_TOWER_LAYOUT[index];
  const shift = (point: Position) => ({ x: point.x + x - legacy.x, y: point.y + y - legacy.y });
  return { direction: corner.direction, x, y, wood: [shift(legacy.wood[0]), shift(legacy.wood[1])], iron: shift(legacy.iron) };
});

export function createDesertRepair(): SingleTowerRepair {
  return {
    inventory: { wood: 0, iron: 0 },
    supplies: SUPPLIES.map(supply => ({ ...supply })),
    tower: { kind: 'damaged', x: 750, y: 670 }
  };
}

export const DESERT_SUPPLY_DIRECTIONS = FOUR_TOWER_LAYOUT.map(tower => tower.direction);

const DESERT_WIDE_DROP_VIEW = { halfWidth: 310, halfHeight: 195 };
const DESERT_TALL_DROP_VIEW = { halfWidth: 130, halfHeight: 225 };
const DESERT_DROP_VIEWS = [DESERT_WIDE_DROP_VIEW, DESERT_TALL_DROP_VIEW];
const DESERT_DROP_CLEARANCE = 12;

export function desertShipment(index: number, relayPlayer?: Position): Supply[] {
  const { wood, iron, direction } = (relayPlayer ? RELAY_TOWER_LAYOUT : FOUR_TOWER_LAYOUT)[index];
  const supplies: Supply[] = [...wood.map<Supply>(point => ({ ...point, material: 'wood' })), { ...iron, material: 'iron' }];
  if (!relayPlayer || supplies.every(supply => DESERT_DROP_VIEWS.every(({ halfWidth, halfHeight }) =>
    Math.abs(supply.x - relayPlayer.x) > halfWidth || Math.abs(supply.y - relayPlayer.y) > halfHeight))) return supplies;

  if (direction === 'north' || direction === 'south') {
    const sign = relayPlayer.x < RELAY_CENTER.x ? 1 : -1;
    const x = Math.round(relayPlayer.x + sign * (DESERT_WIDE_DROP_VIEW.halfWidth + DESERT_DROP_CLEARANCE));
    return supplies.map(supply => ({ ...supply, x }));
  }
  const sign = relayPlayer.y < RELAY_CENTER.y ? 1 : -1;
  const y = Math.round(relayPlayer.y + sign * (DESERT_TALL_DROP_VIEW.halfHeight + DESERT_DROP_CLEARANCE));
  return supplies.map(supply => ({ ...supply, y }));
}

export function createDesertFourTowers(supplies = FOUR_TOWER_LAYOUT.flatMap((_, index) => desertShipment(index)), relay = false): FourTowerRepair {
  return {
    inventory: { wood: 0, iron: 0 },
    supplies,
    towers: (relay ? RELAY_TOWER_LAYOUT : FOUR_TOWER_LAYOUT).map(({ direction, x, y }) => ({ direction, x, y, kind: 'damaged' }))
  };
}

export type RelayObjective = { kind: 'supply'; target: Supply } | { kind: 'repair'; target: Position };

export function relayObjective(repair: FourTowerRepair, player: Position): RelayObjective | undefined {
  const { inventory, supplies, towers } = repair;
  if (inventory.wood >= REPAIR_COST.wood && inventory.iron >= REPAIR_COST.iron) {
    const target = nearest(player, towers.filter(tower => tower.kind === 'damaged'));
    return target && { kind: 'repair', target };
  }
  const target = nearest(player, supplies.filter(supply => inventory[supply.material] < REPAIR_COST[supply.material]));
  return target && { kind: 'supply', target };
}

function nearest<T extends Position>(player: Position, targets: readonly T[]): T | undefined {
  let closest: T | undefined;
  let bestDistance = Infinity;
  for (const target of targets) {
    const candidate = (player.x - target.x) ** 2 + (player.y - target.y) ** 2;
    if (candidate >= bestDistance) continue;
    closest = target;
    bestDistance = candidate;
  }
  return closest;
}

export function stepDesertRepair(repair: DesertRepair, world: Pick<World, 'context' | 'player' | 'tick' | 'materialMotions'>): boolean {
  const { player, tick } = world;
  if (world.materialMotions) {
    const recent = world.materialMotions.filter(motion => tick - motion.tick < materialMotionDuration(motion.kind));
    if (recent.length) world.materialMotions = recent;
    else delete world.materialMotions;
  }

  const { inventory, supplies } = repair;
  repair.supplies = supplies.filter(supply => {
    if (inventory[supply.material] >= SUPPLY_CAPACITY || distance(player, supply) > PICKUP_RADIUS) return true;
    inventory[supply.material]++;
    (world.materialMotions ??= []).push({ kind: 'pickup', tick, material: supply.material, source: { x: supply.x, y: supply.y } });
    return false;
  });
  if (inventory.wood < REPAIR_COST.wood || inventory.iron < REPAIR_COST.iron) return false;

  const target = 'towers' in repair
    ? repair.towers.find(tower => tower.kind === 'damaged' && distance(player, tower) <= REPAIR_RADIUS)
    : repair.tower.kind === 'damaged' && distance(player, repair.tower) <= REPAIR_RADIUS ? repair.tower : undefined;
  if (!target) return false;

  if ('towers' in repair) {
    repair.towers = repair.towers.map(tower => tower === target
      ? { ...tower, kind: 'repaired', nextTurretShotTick: 0,
        ...(hasDesertSalvage(world.context) && { armor: { hits: desertTowerCapacity(tower) } }) }
      : tower);
  } else {
    repair.tower = { ...target, kind: 'repaired' };
  }
  inventory.wood -= REPAIR_COST.wood;
  inventory.iron -= REPAIR_COST.iron;
  (world.materialMotions ??= []).push({
    kind: 'deposit', tick, source: { x: player.x, y: player.y }, tower: { x: target.x, y: target.y }
  });
  return true;
}

function distance(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function desertTowerCapacity(tower: DirectionalTower): number {
  return TOWER_BASE_HITS + (tower.loadout?.reinforced ? TOWER_UPGRADE_HITS : 0)
    + (tower.loadout?.module ? TOWER_UPGRADE_HITS : 0);
}

function isArmoredTower(tower: DirectionalTower): tower is ArmoredTower {
  return tower.kind === 'repaired' && tower.armor !== undefined;
}

export function nearbySalvageTower(repair: DesertRepair | undefined, player: Position): ArmoredTower | undefined {
  if (!repair || !('towers' in repair)) return;
  return repair.towers.find((tower): tower is ArmoredTower => isArmoredTower(tower) && distance(player, tower) <= REPAIR_RADIUS);
}

export function applyTowerAction(world: Pick<World, 'desertRepair' | 'desertSalvage' | 'player' | 'events'>, action: TowerAction): void {
  const { desertRepair: repair, desertSalvage: salvage } = world;
  if (!repair || !('towers' in repair) || !salvage) return;
  const tower = nearbySalvageTower(repair, world.player);
  if (!tower) return;
  const loadout = { reinforced: false, ...tower.loadout };
  const { inventory } = repair;
  if (action === 'fortify-tower') {
    if (loadout.reinforced || inventory.wood < REPAIR_COST.wood || inventory.iron < REPAIR_COST.iron) return;
    inventory.wood -= REPAIR_COST.wood;
    inventory.iron -= REPAIR_COST.iron;
    loadout.reinforced = true;
    world.events.push('tower-fortified');
  } else {
    if (loadout.module || !salvage.held) return;
    loadout.module = salvage.held;
    delete salvage.held;
    world.events.push('tower-modded');
  }
  replaceTower(repair, tower, { ...tower, loadout, armor: { ...tower.armor, hits: tower.armor.hits + TOWER_UPGRADE_HITS } });
}

function replaceTower(repair: FourTowerRepair, previous: DirectionalTower, replacement: DirectionalTower): void {
  repair.towers = repair.towers.map(tower => tower === previous ? replacement : tower);
}

function damageTower(world: TowerDamageWorld, repair: FourTowerRepair, tower: ArmoredTower, source: 'shot' | 'contact'): void {
  const hits = tower.armor.hits - 1;
  const nextContactHitTick = source === 'contact' ? world.tick + CONTACT_COOLDOWN : tower.nextContactHitTick;
  world.events.push('tower-damaged');
  if (hits > 0) {
    replaceTower(repair, tower, { ...tower, nextContactHitTick, armor: { ...tower.armor, hits } });
    return;
  }
  const { x, y, direction, loadout } = tower;
  replaceTower(repair, tower, { x, y, direction, loadout, nextContactHitTick, kind: 'damaged' });
  if (world.desertTurretShots) delete world.desertTurretShots[direction];
  world.events.push('tower-destroyed');
}

export function hitTowerWithShot(world: TowerDamageWorld, repair: DesertRepair | undefined, shot: Shot): boolean {
  if (!repair || !('towers' in repair)) return false;
  const tower = repair.towers.find((tower): tower is ArmoredTower => isArmoredTower(tower) && distance(shot, tower) < TOWER_HIT_RADIUS);
  if (!tower) return false;
  damageTower(world, repair, tower, 'shot');
  return true;
}

export function stepTowerContact(world: TowerDamageWorld & Pick<World, 'enemies'>, repair: DesertRepair | undefined): void {
  if (!repair || !('towers' in repair)) return;
  for (const tower of repair.towers) {
    if (!isArmoredTower(tower) || world.tick < (tower.nextContactHitTick ?? 0)) continue;
    if (world.enemies.some(enemy => enemy.hp > 0 && enemy.kind !== 'boss-echo' && distance(enemy, tower) < enemy.radius + TOWER_HIT_RADIUS)) {
      damageTower(world, repair, tower, 'contact');
    }
  }
}

export function stepDesertTurret(world: TurretWorld): void {
  const repair = world.desertRepair;
  if (!repair) return;
  if ('towers' in repair) {
    for (const tower of repair.towers) {
      if (tower.kind !== 'repaired') continue;
      if (tower.armor) {
        const interval = pulseFireInterval(world.upgrades.pulse);
        if (world.tick - (tower.armor.lastShotTick ?? -Infinity) >= interval && fireTurret(world, tower, tower.direction, tower.loadout)) {
          tower.armor.lastShotTick = world.tick;
          tower.nextTurretShotTick = world.tick + interval;
        }
      } else if (world.tick >= tower.nextTurretShotTick && fireTurret(world, tower, tower.direction)) {
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

export function selectTurretTarget(world: TurretTargetWorld, tower: Position, direction: TowerDirection): Readonly<{ target: Readonly<Enemy>; distanceSquared: number }> | undefined {
  const boundaryRoundoff = 2 * Number.EPSILON * Math.max(tower.x, tower.y);
  let nearestDistanceSquared = (TURRET_RANGE + boundaryRoundoff) ** 2;
  let target: Readonly<Enemy> | undefined;
  const relay = hasRelayBase(world.context);
  const outwardX = Math.sign(tower.x - RELAY_CENTER.x);
  const outwardY = Math.sign(tower.y - RELAY_CENTER.y);
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - tower.x;
    const dy = enemy.y - tower.y;
    const forward = relay ? (dx * outwardX + dy * outwardY) * Math.SQRT1_2
      : direction === 'north' ? -dy : direction === 'east' ? dx : direction === 'south' ? dy : -dx;
    const sideways = relay ? (dy * outwardX - dx * outwardY) * Math.SQRT1_2
      : direction === 'north' || direction === 'south' ? dx : dy;
    if (forward <= 0 || Math.abs(sideways) > forward * TURRET_SECTOR_SLOPE + boundaryRoundoff) continue;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared > nearestDistanceSquared ||
        (distanceSquared === nearestDistanceSquared && target && enemy.id >= target.id)) continue;
    target = enemy;
    nearestDistanceSquared = distanceSquared;
  }
  return target ? { target, distanceSquared: nearestDistanceSquared } : undefined;
}

function fireTurret(world: TurretWorld, tower: Position, direction: TowerDirection, loadout?: DirectionalTower['loadout']): boolean {
  const aim = selectTurretTarget(world, tower, direction);
  if (!aim) return false;
  const { target, distanceSquared } = aim;
  const velocityScale = TURRET_SHOT_SPEED / Math.sqrt(distanceSquared);
  const vx = (target.x - tower.x) * velocityScale;
  const vy = (target.y - tower.y) * velocityScale;
  const ammo = loadout?.module ? TOWER_MODULE_AMMO[loadout.module] : undefined;
  const damage = (loadout?.reinforced ? REINFORCED_TURRET_DAMAGE : TURRET_SHOT_DAMAGE) + (ammo?.damageDelta ?? 0);
  world.shots.push({
    x: tower.x, y: tower.y, vx, vy,
    life: TURRET_SHOT_LIFE, damage, hostile: false,
    ...(ammo && { kind: ammo.kind })
  });
  (world.desertTurretShots ??= {})[direction] = { tick: world.tick, vx, vy };
  world.events.push('shot');
  return true;
}
