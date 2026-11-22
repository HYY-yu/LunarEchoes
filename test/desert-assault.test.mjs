import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, dispatch, HZ } from '../dist/core.js';
import { DESERT_ASSAULT_CONTEXT, stageContext } from '../dist/stage-rules.js';
import { play } from '../scripts/simulation.mjs';

const idle = { kind: 'tick', input: { x: 0, y: 0, dash: false } };

test('current desert rules unlock four shipments and spawn exactly one short raid per repair', () => {
  assert.equal(stageContext('desert-base'), DESERT_ASSAULT_CONTEXT);
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
