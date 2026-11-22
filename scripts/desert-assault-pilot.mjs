export function planDesertAssaultInput(world, { skipFourth = false, fourthRepairAfter = 0, stationaryFinal = false } = {}) {
  const position = world.player;
  const deliveries = (world.desertAssault ?? world.rainforestRelay).deliveries;
  const final = world.desertAssault?.final;
  const { towers, inventory, supplies } = world.desertRepair;
  const repaired = towers.filter(tower => tower.kind === 'repaired').length;
  const fourth = repaired === 3;
  const delayFourth = fourth && (skipFourth || world.tick < 60 * fourthRepairAfter);
  const permitRepair = repaired < towers.length && repaired < deliveries && !delayFourth;
  let nearest = null, nearestDistance = Infinity;
  let x = 0, y = 0;
  for (const enemy of world.enemies) {
    const distance = Math.hypot(enemy.x - position.x, enemy.y - position.y);
    if (distance < nearestDistance) { nearest = enemy; nearestDistance = distance; }
    if (distance < 95) {
      const weight = 130 / Math.max(1, distance * distance);
      x += (position.x - enemy.x) * weight;
      y += (position.y - enemy.y) * weight;
    }
  }
  for (const shot of world.shots) {
    if (!shot.hostile) continue;
    const distance = Math.hypot(shot.x - position.x, shot.y - position.y);
    if (distance >= 55) continue;
    const weight = 100 / Math.max(1, distance * distance);
    x += (position.x - shot.x) * weight;
    y += (position.y - shot.y) * weight;
  }
  if (permitRepair) {
    const material = inventory.wood < 2 ? 'wood' : inventory.iron < 1 ? 'iron' : null;
    const supply = supplies.find(entry => entry.material === material);
    const damaged = towers.find(tower => tower.kind === 'damaged');
    const { x: tx, y: ty } = supply ?? damaged;
    const delta = Math.max(1, Math.hypot(tx - position.x, ty - position.y));
    x += (tx - position.x) / delta * 4;
    y += (ty - position.y) / delta * 4;
  } else {
    const distanceFromCenter = Math.hypot(position.x - 750, position.y - 750);
    let crystal = null, crystalDistance = Infinity;
    for (const entry of world.crystals) {
      if (Math.hypot(entry.x - 750, entry.y - 750) > 270) continue;
      const distance = Math.hypot(entry.x - position.x, entry.y - position.y);
      if (distance < crystalDistance) { crystal = entry; crystalDistance = distance; }
    }
    if (crystal) {
      x += (crystal.x - position.x) / Math.max(1, crystalDistance);
      y += (crystal.y - position.y) / Math.max(1, crystalDistance);
    } else {
      x += Math.cos(world.tick / 105) * .6;
      y += Math.sin(world.tick / 105) * .6;
    }
    const tether = Math.max(0, distanceFromCenter - 125) / 90;
    x += (750 - position.x) * tether / Math.max(1, distanceFromCenter);
    y += (750 - position.y) * tether / Math.max(1, distanceFromCenter);
    if (nearest && nearestDistance < 30) {
      x = position.x - nearest.x;
      y = position.y - nearest.y;
    }
  }
  const lastTower = towers.at(-1);
  if (delayFourth && Math.hypot(position.x - lastTower.x, position.y - lastTower.y) < 105) {
    x = position.x - lastTower.x;
    y = position.y - lastTower.y;
  }
  if (stationaryFinal && final?.kind === 'active') return { x: 0, y: 0, dash: false };
  return { x, y, dash: !permitRepair && nearestDistance < 45 && world.tick % 30 === 0 };
}
