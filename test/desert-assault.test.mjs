import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, dispatch, HZ } from '../dist/core.js';
import { relayObjective } from '../dist/desert-repair.js';
import { DESERT_ASSAULT_CONTEXT, DESERT_CONTINUOUS_CONTEXT, DESERT_RELAY_CONTEXT, stageContext } from '../dist/stage-rules.js';
import { play } from '../scripts/simulation.mjs';

const idle = { kind: 'tick', input: { x: 0, y: 0, dash: false } };

test('v6 desert rules unlock four shipments and spawn exactly one short raid per repair', () => {
  assert.equal(stageContext('desert-base'), DESERT_CONTINUOUS_CONTEXT);
  const world = createWorld({ ...DESERT_ASSAULT_CONTEXT, seed: 42 });
  const repair = world.desertRepair;
  assert.equal(repair.supplies.length, 0);
  const deliverySeconds = [105, 120, 140, 160];
  for (const [index, second] of deliverySeconds.entries()) {
    world.tick = second * HZ - 2;
    world.spawnCooldown = 60;
    dispatch(world, idle);
    assert.equal(repair.supplies.length, 3 * index);
    dispatch(world, idle);
    assert.equal(repair.supplies.length, 3 * (index + 1));
    assert.equal(world.bossSpawned, false);
    const tower = repair.towers[index];
    Object.assign(world.player, { x: tower.x, y: tower.y });
    Object.assign(repair.inventory, { wood: 2, iron: 1 });
    const firstEnemyId = world.nextId;
    dispatch(world, idle);
    assert.equal(repair.towers[index].kind, 'repaired');
    assert.deepEqual(world.enemies.filter(enemy => enemy.id >= firstEnemyId).map(enemy => enemy.kind), ['crawler', 'crawler', 'drone']);
    assert.deepEqual(repair.inventory, { wood: 0, iron: 0 });
    dispatch(world, idle);
    assert.equal(world.nextId, firstEnemyId + 3);
    assert.equal(world.desertAssault.final.kind, index === 3 ? 'scheduled' : 'waiting');
  }
  const { firstTick } = world.desertAssault.final;
  world.tick = firstTick - 2;
  world.spawnCooldown = 60;
  dispatch(world, idle);
  assert.equal(world.desertAssault.final.kind, 'scheduled');
  world.spawnCooldown = 1;
  dispatch(world, idle);
  assert.equal(world.desertAssault.final.batches, 1);
  assert.equal(world.enemies.filter(enemy => enemy.id >= world.desertAssault.final.firstEnemyId).length, 8);
  assert.equal(world.spawnCooldown, 0);
});

test('full desert runs resolve the final assault, running out of time and armor depletion through recorded inputs', () => {
  const scenarios = [
    { options: {}, outcome: 'won', batches: 6, alive: true },
    { options: { fourthRepairAfter: 220 }, outcome: 'won', batches: 6, alive: true },
    { options: { fourthRepairAfter: 230 }, outcome: 'lost', batches: 6, alive: true },
    { options: { skipFourth: true }, outcome: 'lost', batches: 0, alive: true },
    { options: { stationaryFinal: true }, outcome: 'lost', batches: 5, alive: false }
  ];
  for (const { options, outcome, batches, alive } of scenarios) {
    const { world } = play(42, DESERT_ASSAULT_CONTEXT, [], options);
    const { final } = world.desertAssault;
    assert.equal(world.phase.kind, outcome);
    assert.equal(world.player.hp > 0, alive);
    assert.equal(final.kind === 'active' ? final.batches : 0, batches);
    if (outcome === 'won') {
      assert.ok(world.tick >= 180 * HZ && world.tick <= 300 * HZ);
      assert.equal(world.bossKilled, true);
      assert.ok(world.enemies.every(enemy => enemy.id < final.firstEnemyId));
    } else if (alive) assert.equal(world.tick, 300 * HZ);
  }
});

test('v7 starts with reachable supplies and uses the relay corners for repairs and outward fire', () => {
  const world = createWorld({ ...DESERT_RELAY_CONTEXT, seed: 42 });
  const { desertRepair: repair, player } = world;
  const corners = [[590, 590], [910, 590], [910, 910], [590, 910]];
  assert.deepEqual(repair.towers.map(({ x, y }) => [x, y]), corners);
  assert.equal(relayObjective(repair, player), undefined);

  for (const [index, deliveryTick] of [1, 45 * HZ, 100 * HZ, 160 * HZ].entries()) {
    world.tick = deliveryTick - 1;
    world.spawnCooldown = 1000;
    world.enemies = [];
    world.shots = [];
    Object.assign(player, { x: 750, y: 750 });
    dispatch(world, idle);
    assert.equal(world.desertAssault.deliveries, index + 1);
    assert.deepEqual(repair.supplies.map(supply => supply.material), ['wood', 'wood', 'iron']);
    for (const [halfWidth, halfHeight] of [[300, 188], [122, 217]]) {
      assert(repair.supplies.every(supply => Math.abs(supply.x - player.x) > halfWidth || Math.abs(supply.y - player.y) > halfHeight));
    }
    assert.equal(relayObjective(repair, player).kind, 'supply');
    const [x, y] = corners[index];
    Object.assign(player, { x, y });
    dispatch(world, idle);
    assert.equal(repair.towers[index].kind, 'damaged');

    for (const point of repair.supplies) {
      Object.assign(player, { x: point.x, y: point.y });
      dispatch(world, idle);
    }
    assert.deepEqual(repair.inventory, { wood: 2, iron: 1 });
    assert.equal(relayObjective(repair, { x, y }).target, repair.towers[index]);
    Object.assign(player, { x, y });
    const sx = Math.sign(x - 750), sy = Math.sign(y - 750);
    const enemy = (id, x, y) => ({ id, kind: 'sentry', x, y, hp: 50, maxHp: 50, radius: 15, attack: 1000, flash: 0 });
    world.enemies = [enemy(1000, x - sx * 25, y - sy * 25), enemy(1001, x + sx * 85, y + sy * 85)];
    dispatch(world, idle);
    assert.equal(repair.towers[index].kind, 'repaired');
    assert.deepEqual(repair.inventory, { wood: 0, iron: 0 });
    const shot = world.desertTurretShots[repair.towers[index].direction];
    assert.equal(Math.sign(shot.vx), sx);
    assert.equal(Math.sign(shot.vy), sy);
  }
  assert.equal(relayObjective(repair, player), undefined);
  assert.equal(world.desertAssault.final.kind, 'scheduled');
});

test('v8 keeps the existing spawn clock and enemies when pressure rises, then clears the assault', () => {
  const world = createWorld({ ...DESERT_CONTINUOUS_CONTEXT, seed: 42 });
  const assault = world.desertAssault;
  const repair = world.desertRepair;
  repair.towers = repair.towers.map((tower, index) => index === 3 ? tower : { ...tower, kind: 'repaired', nextTurretShotTick: 0 });
  const lastTower = repair.towers[3];
  Object.assign(world.player, { x: lastTower.x, y: lastTower.y });
  Object.assign(repair.inventory, { wood: 2, iron: 1 });
  world.tick = 165 * HZ;
  world.spawnCooldown = 20;
  world.fireCooldown = 9999;
  assault.deliveries = 4;
  const before = { id: 1, kind: 'sentry', x: 1100, y: 680, hp: 50, maxHp: 50, radius: 15, attack: 1000, flash: 0 };
  world.enemies = [before];
  world.nextId = 2;
  dispatch(world, idle);
  assert.equal(assault.final.kind, 'scheduled');
  assert.equal(world.enemies.length, 4);

  world.tick = assault.final.firstTick - 1;
  world.spawnCooldown = 2;
  dispatch(world, idle);
  assert.equal(assault.final.kind, 'active');
  assert.equal(world.spawnCooldown, 1);
  assert(world.enemies.includes(before));
  assert.equal(world.enemies.length, 4);
  dispatch(world, idle);
  assert.equal(world.spawnCooldown, 13);
  assert.equal(world.enemies.length, 5);

  const { bossTick, reinforcementEnd, firstEnemyId } = assault.final;
  world.tick = bossTick - 1;
  world.spawnCooldown = 1;
  dispatch(world, idle);
  assert(world.events.includes('boss'));
  assert.equal(world.enemies.filter(enemy => enemy.kind === 'boss').length, 1);
  assert.equal(world.spawnCooldown, 9);
  dispatch(world, idle);
  assert(!world.events.includes('boss'));

  const boss = world.enemies.find(enemy => enemy.kind === 'boss');
  boss.hp = 0;
  world.tick = reinforcementEnd - 1;
  world.spawnCooldown = 1;
  const lastEnemyId = world.nextId;
  dispatch(world, idle);
  assert.equal(world.bossKilled, true);
  assert.equal(world.nextId, lastEnemyId);
  assert.equal(world.phase.kind, 'running');
  assert(world.enemies.some(enemy => enemy.id >= firstEnemyId));
  world.enemies = world.enemies.filter(enemy => enemy.id < firstEnemyId);
  dispatch(world, idle);
  assert.equal(world.phase.kind, 'won');
  assert(world.enemies.includes(before));
});
