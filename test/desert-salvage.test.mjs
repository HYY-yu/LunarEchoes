import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, dispatch, HZ, parseActionBuffer, startRecording } from '../dist/core.js';
import { desertTowerCapacity, nearbySalvageTower } from '../dist/desert-repair.js';
import { DESERT_ASSAULT_DURATION_TICKS, DESERT_SALVAGE_CONTEXT, DESERT_STASIS_CONTEXT, resolveStage, stageContext } from '../dist/stage-rules.js';

const idle = { kind: 'tick', input: { x: 0, y: 0, dash: false } };
const fortify = { kind: 'fortify-tower' };
const mod = { kind: 'mod-tower' };

function quietWorld(context = DESERT_SALVAGE_CONTEXT) {
  return Object.assign(createWorld({ ...context, seed: 42 }), { spawnCooldown: 100000, fireCooldown: 100000, threshold: 100000 });
}

function enemy(world, x, y, kind = 'sentry', hp = 100) {
  const target = { id: world.nextId++, kind, x, y, hp, maxHp: hp, radius: 15, attack: 100000, flash: 0 };
  world.enemies.push(target);
  return target;
}

function shot(world, { x, y }, options) {
  world.shots.push({ x, y, vx: 0, vy: 0, life: 3, hostile: false, damage: 100, ...options });
  return world.shots.at(-1);
}

function repairTower(world, index) {
  const repair = world.desertRepair;
  Object.assign(world.player, { x: repair.towers[index].x, y: repair.towers[index].y });
  Object.assign(repair.inventory, { wood: 2, iron: 1 });
  dispatch(world, idle);
  return repair.towers[index];
}

test('desert salvage is opt-in and rolls once per real kill using an independent seed', () => {
  assert.equal(stageContext('desert-base'), DESERT_STASIS_CONTEXT);
  assert.equal(resolveStage('desert-base', 'desert-base-10'), DESERT_SALVAGE_CONTEXT);
  const world = quietWorld();
  const repair = world.desertRepair;
  dispatch(world, idle);
  assert.deepEqual(repair.supplies, []);
  assert.equal(world.desertAssault.deliveries, 0);
  const rng = world.rng;
  for (const [index, x] of [650, 700, 800, 850].entries()) {
    shot(world, enemy(world, x, 665, index === 0 ? 'boss-echo' : 'sentry'));
  }
  dispatch(world, idle);
  assert.equal(world.rng, rng);
  assert.equal(world.kills, 3);
  assert.deepEqual(repair.supplies, [{ x: 700, y: 665, material: 'wood' }, { x: 850, y: 665, material: 'wood' }]);
  assert.deepEqual(world.desertSalvage.modules, [{ x: 800, y: 665, module: 'electric' }]);
  Object.assign(world.player, { x: 800, y: 665 });
  dispatch(world, idle);
  assert.equal(world.desertSalvage.held, 'electric');
  assert.deepEqual(world.desertSalvage.modules, []);
  assert.deepEqual(parseActionBuffer({ ...startRecording(world), actions: [fortify, mod] }).actions, [fortify, mod]);
  assert.throws(() => parseActionBuffer({ ...startRecording(quietWorld(DESERT_STASIS_CONTEXT)), actions: [mod] }), { code: 'invalid-data' });
});

test('desert salvage shares pulse cadence, limits contact, and preserves both upgrades on repair', () => {
  const world = quietWorld();
  const repair = world.desertRepair;
  const tower = repairTower(world, 0);
  assert.equal(tower.armor.hits, 15);
  assert.equal(nearbySalvageTower(repair, world.player), tower);
  world.enemies.length = 0;
  Object.assign(world.player, { x: 750, y: 750 });
  const target = enemy(world, tower.x + (tower.x - 750), tower.y + (tower.y - 750), 'sentry', 1000);
  dispatch(world, idle);
  assert.equal(world.shots.at(-1).damage, 18);
  const firstShot = world.desertTurretShots[tower.direction].tick;
  world.upgrades.pulse = 7;
  while (world.tick < firstShot + 9) dispatch(world, idle);
  assert.equal(world.desertTurretShots[tower.direction].tick, firstShot);
  dispatch(world, idle);
  assert.equal(world.desertTurretShots[tower.direction].tick, firstShot + 10);

  Object.assign(repair.inventory, { wood: 2, iron: 1 });
  world.desertSalvage.held = 'fire';
  const actionTick = world.tick;
  dispatch(world, fortify);
  assert.deepEqual(world.events, []);
  Object.assign(world.player, { x: tower.x, y: tower.y });
  dispatch(world, fortify);
  assert.deepEqual(world.events, ['tower-fortified']);
  while (world.tick < actionTick + 10) dispatch(world, idle);
  assert.equal(world.shots.at(-1).damage, 26);
  const modTick = world.tick;
  dispatch(world, mod);
  assert.deepEqual(world.events, ['tower-modded']);
  assert.equal(world.tick, modTick);
  assert.deepEqual(repair.inventory, { wood: 0, iron: 0 });
  assert.equal(world.desertSalvage.held, undefined);
  assert.equal(repair.towers[0].armor.hits, 19);
  assert.equal(desertTowerCapacity(repair.towers[0]), 19);
  assert.deepEqual(repair.towers[0].loadout, { reinforced: true, module: 'fire' });

  enemy(world, tower.x, tower.y);
  enemy(world, tower.x, tower.y);
  shot(world, tower, { hostile: true });
  dispatch(world, idle);
  assert.equal(repair.towers[0].armor.hits, 17);
  dispatch(world, idle);
  assert.equal(repair.towers[0].armor.hits, 17);
  assert(world.enemies.includes(target));
  for (let index = 0; index < 17; index++) shot(world, tower, { hostile: true });
  dispatch(world, idle);
  assert.equal(repair.towers[0].kind, 'damaged');
  assert.equal(nearbySalvageTower(repair, world.player), undefined);
  assert.equal(world.events.filter(event => event === 'tower-damaged').length, 17);
  assert.equal(world.events.filter(event => event === 'tower-destroyed').length, 1);
  assert.equal(repairTower(world, 0).armor.hits, 19);
  assert.deepEqual(repair.towers[0].loadout, { reinforced: true, module: 'fire' });
});

test('desert salvage keeps the final clock, boss stasis and cap through tower rebuilds', () => {
  const world = quietWorld();
  const repair = world.desertRepair;
  for (let index = 0; index < 4; index++) repairTower(world, index);
  const scheduled = world.desertAssault.final;
  const tower = repair.towers[0];
  world.enemies.length = 0;
  for (let index = 0; index < 15; index++) shot(world, tower, { hostile: true });
  dispatch(world, idle);
  assert.equal(repair.towers[0].kind, 'damaged');
  repairTower(world, 0);
  assert.equal(world.desertAssault.final, scheduled);

  world.tick = scheduled.firstTick - 1;
  dispatch(world, idle);
  const final = world.desertAssault.final;
  world.tick = final.bossTick - 1;
  dispatch(world, idle);
  const boss = world.enemies.find(target => target.kind === 'boss');
  assert.equal(boss.maxHp, 2850);
  assert.equal(world.desertStasis.bossId, boss.id);
  world.tick = world.desertStasis.beginsAt - 1;
  const hostile = shot(world, tower, { hostile: true });
  dispatch(world, idle);
  assert.equal(hostile.life, 3);
  world.tick = final.reinforcementEnd - 1;
  for (let index = 0; index < 14; index++) shot(world, tower, { hostile: true });
  shot(world, boss, { damage: 2850 });
  dispatch(world, idle);
  assert.equal(world.bossKilled, true);
  assert.equal(repair.towers[0].kind, 'damaged');
  assert.equal(world.phase.kind, 'running');
  repairTower(world, 0);
  assert.equal(world.desertAssault.final, final);
  assert.equal(world.phase.kind, 'won');

  const timeout = quietWorld();
  timeout.tick = DESERT_ASSAULT_DURATION_TICKS - 1;
  dispatch(timeout, idle);
  assert.equal(timeout.phase.kind, 'lost');
  assert.equal(timeout.tick, 300 * HZ);
});
