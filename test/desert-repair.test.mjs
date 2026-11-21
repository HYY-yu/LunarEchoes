import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorld, dispatch, finishRecording, replay } from '../dist/core.js';
import { lastDesertTurretShotTick } from '../dist/desert-repair.js';
import { DESERT_REPAIR_CONTEXT, DESERT_TURRET_CONTEXT } from '../dist/stage-rules.js';

const idle = { kind: 'tick', input: { x: 0, y: 0, dash: false } };
const turretWorld = () => createWorld({ ...DESERT_TURRET_CONTEXT, seed: 42 });

function quietTurretWorld() {
  const world = turretWorld();
  world.fireCooldown = 1000;
  world.spawnCooldown = 1000;
  const { x, y } = world.desertRepair.tower;
  Object.assign(world.player, { x, y });
  return world;
}

function sentry(world, id, dx, dy, hp = 50) {
  const { x, y } = world.desertRepair.tower;
  return { id, kind: 'sentry', x: x + dx, y: y + dy, hp, maxHp: 50, radius: 15, attack: 1000, flash: 0 };
}

function supplyRepair(world) {
  world.desertRepair.inventory = { wood: 2, iron: 1 };
}

test('Desert repair records limited pickups and charges only for the first repair', () => {
  const world = createWorld({ ...DESERT_REPAIR_CONTEXT, seed: 42 });
  const actions = [];
  function act(action) {
    actions.push(action);
    dispatch(world, action);
  }
  function tick(x, y) {
    if (world.phase.kind === 'upgrading') {
      act({ kind: 'choose', upgrade: world.phase.offers.find(upgrade => upgrade !== 'boots') });
    }
    act({ kind: 'tick', input: { x, y, dash: false } });
  }
  function moveTo(x, y) {
    for (let i = 0; i < 200 && (world.player.x !== x || world.player.y !== y); i++) {
      tick(Math.sign(x - world.player.x) * Math.min(1, Math.abs(x - world.player.x) / 2.5),
        Math.sign(y - world.player.y) * Math.min(1, Math.abs(y - world.player.y) / 2.5));
    }
    assert.deepEqual([world.player.x, world.player.y], [x, y]);
  }

  const repair = world.desertRepair;
  moveTo(750, 670);
  assert.equal(repair.tower.kind, 'damaged');
  moveTo(750, 750);
  moveTo(550, 750);
  assert.deepEqual(repair.inventory, { wood: 3, iron: 0 });
  assert(repair.supplies.some(supply => supply.material === 'wood' && supply.x === 550));
  moveTo(750, 750);
  moveTo(750, 670);
  assert.deepEqual(repair.inventory, { wood: 3, iron: 0 });
  assert.equal(repair.tower.kind, 'damaged');

  moveTo(750, 750);
  moveTo(950, 750);
  assert.deepEqual(repair.inventory, { wood: 3, iron: 3 });
  assert(repair.supplies.some(supply => supply.material === 'iron' && supply.x === 950));
  moveTo(750, 750);
  moveTo(750, 670);
  assert.equal(repair.tower.kind, 'repaired');
  assert.deepEqual(repair.inventory, { wood: 1, iron: 2 });
  moveTo(750, 750);
  moveTo(550, 750);
  moveTo(750, 750);
  moveTo(750, 670);
  assert.deepEqual(repair.inventory, { wood: 2, iron: 2 });

  while (world.phase.kind === 'running' || world.phase.kind === 'upgrading') tick(0, 0);
  const recording = finishRecording(world, actions);
  assert.deepEqual(replay(recording), world);
  assert.equal(Object.hasOwn(repair, 'nextTurretShotTick'), false);
  assert.equal(lastDesertTurretShotTick(repair), undefined);
  assert.equal(createWorld({ ...DESERT_REPAIR_CONTEXT, seed: 42 }).desertRepair.tower.kind, 'damaged');
});

test('a damaged or repaired but idle turret leaves the first shot ready', () => {
  const world = quietTurretWorld();
  const target = sentry(world, 1, 0, -80);
  world.enemies.push(target);
  dispatch(world, idle);
  assert.equal(world.desertRepair.tower.kind, 'damaged');
  assert.deepEqual(world.shots, []);
  assert.deepEqual(world.events, []);

  world.enemies = [];
  supplyRepair(world);
  dispatch(world, idle);
  assert.equal(world.desertRepair.tower.kind, 'repaired');
  assert.equal(world.desertRepair.nextTurretShotTick, 0);
  assert.equal(lastDesertTurretShotTick(world.desertRepair), undefined);
  assert.deepEqual(world.shots, []);
  assert.deepEqual(world.events, []);

  world.enemies.push(target);
  dispatch(world, idle);
  assert.deepEqual(world.events, ['shot']);
});

test('turret range and north-facing sector include both edges', () => {
  const eastEdge = 120 * Math.sqrt(3);
  for (const [dx, dy, fires] of [
    [0, -240, true], [eastEdge, -120, true], [-eastEdge, -120, true],
    [0, -240.00000001, false], [eastEdge / 2 + 1e-8, -60, false], [-eastEdge / 2 - 1e-8, -60, false],
    [0, 40, false], [0, 0, false]
  ]) {
    const world = quietTurretWorld();
    supplyRepair(world);
    dispatch(world, idle);
    world.player.y -= 120;
    world.enemies.push(sentry(world, 1, dx, dy));
    dispatch(world, idle);
    assert.equal(world.events.includes('shot'), fires, `target offset (${dx}, ${dy})`);
  }
});

test('turret picks the nearest living enemy and breaks distance ties by lower id', () => {
  const world = quietTurretWorld();
  supplyRepair(world);
  world.enemies.push(sentry(world, 1, 0, -140), sentry(world, 9, 60, -80),
    sentry(world, 4, -60, -80), sentry(world, 7, 0, -100), sentry(world, 2, 0, -60, 0));

  dispatch(world, idle);
  assert.equal(world.shots.length, 1);
  const shot = world.shots[0];
  assert.deepEqual([shot.vx, shot.vy], [-4.8, -6.4]);
});

test('same-tick repair fires after enemy movement and reuses damage and loot at the fixed cadence', () => {
  const world = quietTurretWorld();
  const { x, y } = world.desertRepair.tower;
  const target = { ...sentry(world, 1, 0, -240.5, 36), kind: 'crawler', radius: 11 };
  world.enemies.push(target);
  supplyRepair(world);

  dispatch(world, idle);
  assert.equal(world.desertRepair.tower.kind, 'repaired');
  assert.deepEqual(world.events, ['shot']);
  assert.deepEqual(world.shots, [{ x, y: y - 8, vx: 0, vy: -8, life: 29, damage: 18, hostile: false }]);
  const firstShotTick = world.tick;
  assert.equal(lastDesertTurretShotTick(world.desertRepair), firstShotTick);
  for (let tick = 0; tick < 53; tick++) {
    dispatch(world, idle);
    assert.equal(world.events.includes('shot'), false);
  }
  assert.equal(target.hp, 18);
  assert.equal(lastDesertTurretShotTick(world.desertRepair), firstShotTick);
  dispatch(world, idle);
  assert.deepEqual(world.events, ['shot']);
  assert.equal(lastDesertTurretShotTick(world.desertRepair), world.tick);
  for (let tick = 0; tick < 30 && !world.kills; tick++) dispatch(world, idle);
  assert.deepEqual(world.events, ['enemy-hit', 'kill']);
  assert.equal(world.kills, 1);
  assert.equal(world.enemies.length, 0);
  assert.deepEqual(world.crystals.map(crystal => crystal.value), [1]);

  const fresh = turretWorld();
  assert.equal(fresh.desertRepair.tower.kind, 'damaged');
  assert.equal(fresh.desertRepair.nextTurretShotTick, 0);
  assert.deepEqual(fresh.shots, []);
});

test('a fixed-seed v4 recording repairs and fires, then verifies to the same terminal world', () => {
  const world = turretWorld();
  const actions = [];
  let turretFired = false;
  function record(action) {
    actions.push(action);
    dispatch(world, action);
    turretFired ||= world.shots.some(shot => !shot.hostile && shot.damage === 18);
  }
  for (const [x, y, ticks] of [[-1, 0, 40], [1, 0, 60], [-1, 0, 20], [0, -1, 32]]) {
    for (let tick = 0; tick < ticks; tick++) record({ kind: 'tick', input: { x, y, dash: false } });
  }
  assert.equal(world.desertRepair.tower.kind, 'repaired');
  while (world.phase.kind === 'running' || world.phase.kind === 'upgrading') {
    record(world.phase.kind === 'upgrading' ? { kind: 'choose', upgrade: world.phase.offers[0] } : idle);
  }
  assert.equal(turretFired, true);
  const recording = finishRecording(world, actions);
  assert.equal(recording.rulesVersion, 'desert-base-4');
  assert.deepEqual(replay(JSON.parse(JSON.stringify(recording))), world);
});
