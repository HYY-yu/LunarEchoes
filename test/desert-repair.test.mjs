import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checksum, createWorld, dispatch, finishRecording, replay } from '../dist/core.js';
import { selectTurretTarget, stepDesertTurret } from '../dist/desert-repair.js';
import { advanceTowerTurn } from '../dist/tower-turn-motion.js';
import { DESERT_CONTINUOUS_CONTEXT, DESERT_REPAIR_CONTEXT, DESERT_TURRET_CONTEXT, DESERT_FOUR_TOWERS_CONTEXT } from '../dist/stage-rules.js';
import { play } from '../scripts/simulation.mjs';

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
  assert.equal(world.desertTurretShots, undefined);
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
  assert.equal(world.desertTurretShots?.north?.tick, undefined);
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
    assert.equal(Boolean(selectTurretTarget(world, world.desertRepair.tower, 'north')), fires);
    dispatch(world, idle);
    assert.equal(world.events.includes('shot'), fires, `target offset (${dx}, ${dy})`);
  }
});

test('turret picks the nearest living enemy and breaks distance ties by lower id', () => {
  const world = quietTurretWorld();
  supplyRepair(world);
  world.enemies.push(sentry(world, 1, 0, -140), sentry(world, 9, 60, -80),
    sentry(world, 4, -60, -80), sentry(world, 7, 0, -100), sentry(world, 2, 0, -60, 0));

  const beforeQuery = structuredClone(world);
  const aim = selectTurretTarget(world, world.desertRepair.tower, 'north');
  assert.equal(aim.target.id, 4);
  assert.equal(aim.distanceSquared, 10000);
  assert.deepEqual(world, beforeQuery);
  dispatch(world, idle);
  assert.equal(world.shots.length, 1);
  const shot = world.shots[0];
  assert.deepEqual([shot.vx, shot.vy], [-4.8, -6.4]);
  assert.deepEqual(world.desertTurretShots.north, { tick: world.tick, vx: shot.vx, vy: shot.vy });
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
  assert.equal(world.desertTurretShots?.north?.tick, firstShotTick);
  for (let tick = 0; tick < 53; tick++) {
    dispatch(world, idle);
    assert.equal(world.events.includes('shot'), false);
  }
  assert.equal(target.hp, 18);
  assert.equal(world.desertTurretShots?.north?.tick, firstShotTick);
  dispatch(world, idle);
  assert.deepEqual(world.events, ['shot']);
  assert.equal(world.desertTurretShots?.north?.tick, world.tick);
  for (let tick = 0; tick < 30 && !world.kills; tick++) dispatch(world, idle);
  assert.deepEqual(world.events, ['enemy-hit', 'kill']);
  assert.equal(world.kills, 1);
  assert.equal(world.enemies.length, 0);
  assert.deepEqual(world.crystals.map(crystal => crystal.value), [1]);

  const fresh = turretWorld();
  assert.equal(fresh.desertRepair.tower.kind, 'damaged');
  assert.equal(fresh.desertRepair.nextTurretShotTick, 0);
  assert.deepEqual(fresh.shots, []);
  assert.equal(fresh.desertTurretShots, undefined);
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

test('v5 shares a limited supply pool and charges exactly once per repaired tower', () => {
  const world = createWorld({ ...DESERT_FOUR_TOWERS_CONTEXT, seed: 42 });
  const repair = world.desertRepair;
  const [north, east, south] = repair.towers;
  function visit(point) {
    Object.assign(world.player, { x: point.x, y: point.y });
    dispatch(world, idle);
  }

  visit(north);
  assert.equal(repair.towers[0].kind, 'damaged');
  for (const supply of repair.supplies.filter(supply => supply.material === 'wood')) visit(supply);
  assert.deepEqual(repair.inventory, { wood: 3, iron: 0 });
  assert.equal(repair.supplies.filter(supply => supply.material === 'wood').length, 5);
  visit(east);
  assert.deepEqual(repair.inventory, { wood: 3, iron: 0 });
  assert.equal(repair.towers[1].kind, 'damaged');

  for (const supply of repair.supplies.filter(supply => supply.material === 'iron')) visit(supply);
  assert.deepEqual(repair.inventory, { wood: 3, iron: 3 });
  assert.equal(repair.supplies.filter(supply => supply.material === 'iron').length, 1);
  visit(south);
  assert.deepEqual(repair.towers.map(tower => tower.kind), ['damaged', 'damaged', 'repaired', 'damaged']);
  assert.deepEqual(repair.inventory, { wood: 1, iron: 2 });
  for (const supply of repair.supplies) visit(supply);
  assert.deepEqual(repair.inventory, { wood: 3, iron: 3 });
  visit(south);
  assert.deepEqual(repair.inventory, { wood: 3, iron: 3 });
});

test('v5 towers fire on repair in their own sectors and keep independent cooldowns', () => {
  const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const enemy = (id, x, y) => ({ id, kind: 'sentry', x, y, hp: 50, maxHp: 50, radius: 15, attack: 1000, flash: 0 });
  for (const [index, [x, y]] of directions.entries()) {
    const world = createWorld({ ...DESERT_FOUR_TOWERS_CONTEXT, seed: 42 });
    const repair = world.desertRepair;
    const tower = repair.towers[index];
    world.fireCooldown = 1000;
    supplyRepair(world);
    Object.assign(world.player, { x: tower.x, y: tower.y });
    world.enemies.push(enemy(1, tower.x + x * 100, tower.y + y * 100), enemy(2, tower.x - x * 40, tower.y - y * 40));
    dispatch(world, idle);
    assert.equal(world.desertTurretShots[tower.direction].tick, world.tick);
    assert.equal(world.shots.length, 1);
    assert.deepEqual([world.shots[0].x, world.shots[0].y], [tower.x + x * 8, tower.y + y * 8]);

    for (const [forward, sideways, fires] of [
      [240, 0, true], [240.00000001, 0, false], [120, 120 * Math.sqrt(3), true],
      [120, -120 * Math.sqrt(3), true], [60, 60 * Math.sqrt(3) + 1e-8, false], [0, 0, false]
    ]) {
      world.tick += 54;
      world.shots.length = 0;
      world.enemies = [enemy(1, tower.x + x * forward - y * sideways, tower.y + y * forward + x * sideways)];
      assert.equal(Boolean(selectTurretTarget(world, tower, tower.direction)), fires);
      stepDesertTurret(world);
      assert.equal(world.shots.length, Number(fires), `${tower.direction}: ${forward}, ${sideways}`);
      const [shot] = world.shots;
      if (fires) assert.deepEqual(world.desertTurretShots[tower.direction], { tick: world.tick, vx: shot.vx, vy: shot.vy });
      else assert(world.desertTurretShots[tower.direction].tick < world.tick);
    }
  }

  const world = createWorld({ ...DESERT_FOUR_TOWERS_CONTEXT, seed: 42 });
  world.desertRepair.towers = world.desertRepair.towers.map(tower => ({ ...tower, kind: 'repaired', nextTurretShotTick: 0 }));
  world.enemies = directions.map(([x, y], index) => enemy(index + 1, 750 + x * 200, 750 + y * 200));
  stepDesertTurret(world);
  assert.deepEqual(world.shots.map(({ x, y }) => [x, y]), [[750, 670], [830, 750], [750, 830], [670, 750]]);
  const [north] = world.desertRepair.towers;
  north.nextTurretShotTick = 1;
  world.tick = 1;
  stepDesertTurret(world);
  assert.deepEqual(world.desertRepair.towers.map(tower => tower.nextTurretShotTick), [55, 54, 54, 54]);
});

test('two fixed-seed v5 routes repair all four towers and replay a full win', () => {
  const routes = [
    [[0, -1, 86], [0, 1, 86]],
    [[1, 0, 86], [-1, 0, 86]],
    [[0, 1, 86], [0, -1, 86]],
    [[0, 1, 10], [-1, 0, 86], [1, 0, 86], [0, -1, 10]]
  ];
  for (const [seed, order] of [[42, [0, 1, 2, 3]], [101, [3, 2, 1, 0]]]) {
    const opening = order.flatMap(index => routes[index].flatMap(([x, y, ticks]) =>
      Array.from({ length: ticks }, () => ({ kind: 'tick', input: { x, y, dash: false } }))));
    const { world, recording } = play(seed, DESERT_FOUR_TOWERS_CONTEXT, opening);
    assert.equal(world.phase.kind, 'won');
    assert.equal(world.tick, 10800);
    assert.deepEqual(world.desertRepair.supplies, []);
    assert.deepEqual(world.desertRepair.inventory, { wood: 0, iron: 0 });
    assert(world.desertRepair.towers.every(tower => tower.kind === 'repaired' && world.desertTurretShots?.[tower.direction] !== undefined));
    assert.deepEqual(replay(JSON.parse(JSON.stringify(recording))), world);

    const fresh = createWorld({ ...DESERT_FOUR_TOWERS_CONTEXT, seed });
    assert(fresh.desertRepair.towers.every(tower => tower.kind === 'damaged' && !Object.hasOwn(tower, 'nextTurretShotTick')));
    assert.equal(fresh.desertRepair.supplies.length, 12);
  }
});

test('material motion records each successful pickup and a same-tick deposit without changing battle checksum', () => {
  const world = createWorld({ ...DESERT_CONTINUOUS_CONTEXT, seed: 42 });
  const repair = world.desertRepair;
  const tower = repair.towers[0];
  world.tick = 500;
  world.spawnCooldown = 1000;
  Object.assign(world.player, { x: tower.x + 10, y: tower.y });
  const firstWood = { material: 'wood', x: tower.x + 14, y: tower.y };
  repair.supplies = [firstWood];
  repair.inventory.wood = 3;
  dispatch(world, idle);
  assert.deepEqual(repair.supplies, [firstWood]);
  assert.equal(repair.towers[0].kind, 'damaged');
  assert.equal(world.materialMotions, undefined);

  repair.inventory.wood = 0;
  const secondWood = { material: 'wood', x: tower.x + 17, y: tower.y + 2 };
  const iron = { material: 'iron', x: tower.x + 20, y: tower.y - 2 };
  repair.supplies = [firstWood, secondWood, iron];
  dispatch(world, idle);
  const tick = world.tick;
  const motions = [
    { kind: 'pickup', tick, material: 'wood', source: { x: firstWood.x, y: firstWood.y } },
    { kind: 'pickup', tick, material: 'wood', source: { x: secondWood.x, y: secondWood.y } },
    { kind: 'pickup', tick, material: 'iron', source: { x: iron.x, y: iron.y } },
    { kind: 'deposit', tick, source: { x: tower.x + 10, y: tower.y }, tower: { x: tower.x, y: tower.y } }
  ];
  assert.deepEqual(world.materialMotions, motions);
  assert.equal(repair.towers[0].kind, 'repaired');
  assert.deepEqual(repair.inventory, { wood: 0, iron: 0 });
  const { materialMotions, ...withoutVisuals } = world;
  assert.equal(checksum(world), checksum(withoutVisuals));

  dispatch(world, { kind: 'pause' });
  dispatch(world, idle);
  assert.equal(world.tick, tick);
  assert.deepEqual(world.materialMotions, motions);
  dispatch(world, { kind: 'resume' });
  for (let age = 1; age <= 30; age++) {
    dispatch(world, idle);
    assert.deepEqual(world.materialMotions, age < 18 ? motions : age < 30 ? motions.slice(3) : undefined);
  }
  assert.equal(createWorld({ ...DESERT_CONTINUOUS_CONTEXT, seed: 43 }).materialMotions, undefined);
});

test('a skipped rendering frame accounts for the shot flash before turning again', () => {
  const shot = { tick: 13, vx: 0, vy: 8 };
  const previous = { tick: 12, angle: 0, flash: false };
  const target = () => Math.PI;
  assert.deepEqual(advanceTowerTurn(previous, 20, 0, shot, target), { tick: 20, angle: Math.PI / 2, flash: true });
  const resumed = advanceTowerTurn(previous, 22, 0, shot, target);
  assert.equal(resumed.flash, false);
  assert.equal(resumed.angle, Math.PI / 2 + 2 * Math.PI / 45);
  assert.deepEqual(advanceTowerTurn(resumed, 22, 0, shot, target), resumed);
});
