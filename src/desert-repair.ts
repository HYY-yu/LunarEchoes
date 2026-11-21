type Position = Readonly<{ x: number; y: number }>;
type Material = 'wood' | 'iron';
type Materials = Record<Material, number>;
type Supply = Position & Readonly<{ material: Material }>;
type Tower = Position & Readonly<{ kind: 'damaged' | 'repaired' }>;

export type DesertRepair = {
  inventory: Materials;
  supplies: readonly Supply[];
  tower: Tower;
};

export const REPAIR_COST: Readonly<Materials> = Object.freeze({ wood: 2, iron: 1 });
export const SUPPLY_CAPACITY = 3;
export const REPAIR_RADIUS = 28;
const PICKUP_RADIUS = 20;

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
