import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, dispatch, HZ, parseActionBuffer, startRecording } from '../dist/core.js';
import { desertTowerCapacity, nearbySalvageTower } from '../dist/desert-repair.js';
import { STAGE_ORDER } from '../dist/stage-contract.js';
import { DESERT_ASSAULT_DURATION_TICKS, DESERT_DROP_RATE_CONTEXT, DESERT_SALVAGE_CONTEXT, DESERT_STASIS_CONTEXT, resolveStage, stageContext } from '../dist/stage-rules.js';

const idle = { kind: 'tick', input: { x: 0, y: 0, dash: false } };
const fortify = { kind: 'fortify-tower' };
const mod = { kind: 'mod-tower' };

function quietWorld(context = DESERT_DROP_RATE_CONTEXT, seed = 42) {
  return Object.assign(createWorld({ ...context, seed }), { spawnCooldown: 100000, fireCooldown: 100000, threshold: 100000 });
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

test('desert v10 keeps its legacy salvage rolls and replay actions', () => {
  assert.equal(resolveStage('desert-base', 'desert-base-9'), DESERT_STASIS_CONTEXT);
  assert.equal(resolveStage('desert-base', 'desert-base-10'), DESERT_SALVAGE_CONTEXT);
  const world = quietWorld(DESERT_SALVAGE_CONTEXT);
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

test('desert v11 rolls lower-density salvage once per real kill', () => {
  assert.equal(resolveStage('desert-base', 'desert-base-11'), DESERT_DROP_RATE_CONTEXT);
  const world = quietWorld(DESERT_DROP_RATE_CONTEXT, 152);
  const repair = world.desertRepair;
  dispatch(world, idle);
  assert.deepEqual(repair.supplies, []);
  assert.equal(world.desertAssault.deliveries, 0);
  const rng = world.rng;
  shot(world, enemy(world, 360, 500, 'boss-echo'));
  const targets = [440, 510, 580, 650, 720, 790, 860, 930].map(x => enemy(world, x, 500));
  for (const target of targets) shot(world, target);
  dispatch(world, idle);
  assert.equal(world.rng, rng);
  assert.equal(world.kills, 8);
  const [ironTarget, moduleTarget, firstWood, secondWood] = [targets[1], targets[2], targets[6], targets[7]];
  assert.deepEqual(repair.supplies, [
    { x: ironTarget.x, y: ironTarget.y, material: 'iron' },
    { x: firstWood.x, y: firstWood.y, material: 'wood' },
    { x: secondWood.x, y: secondWood.y, material: 'wood' },
  ]);
  assert.deepEqual(world.desertSalvage.modules, [{ x: moduleTarget.x, y: moduleTarget.y, module: 'electric' }]);
  assert.deepEqual(parseActionBuffer({ ...startRecording(world), actions: [fortify, mod] }).actions, [fortify, mod]);
});

test('each mission restores independently suppressed ground drops after pickup', () => {
  for (const stageId of STAGE_ORDER) {
    const world = quietWorld(stageContext(stageId));
    const repair = world.desertRepair;
    const salvage = world.desertSalvage;
    dispatch(world, idle);
    assert.equal(repair.supplies.length, stageId === 'desert-base' ? 0 : 3, stageId);
    repair.supplies = Array.from({ length: 4 }, (_, i) => ({ x: 300 + i * 40, y: 500, material: 'wood' }));
    salvage.modules = [{ x: 460, y: 500, module: 'electric' }];
    const rng = world.rng;

    function killWithRoll(state) {
      salvage.lootRng = state;
      shot(world, enemy(world, 1090, 460));
      dispatch(world, idle);
    }

    killWithRoll(2382);
    assert.equal(repair.supplies.length, 5, stageId);
    assert.equal(repair.supplies.at(-1).material, 'iron', stageId);
    killWithRoll(2101);
    assert.equal(repair.supplies.length, 5, stageId);
    const take = ({ x, y }) => {
      Object.assign(world.player, { x, y });
      dispatch(world, idle);
      Object.assign(world.player, { x: 750, y: 750 });
    };
    take(repair.supplies.at(-1));
    assert.equal(repair.inventory.iron, 1, stageId);
    assert.equal(repair.supplies.length, 4, stageId);

    killWithRoll(2101);
    assert.equal(repair.supplies.length, 5, stageId);
    assert.equal(repair.supplies.at(-1).material, 'wood', stageId);
    killWithRoll(2098);
    assert.equal(repair.supplies.length, 6, stageId);
    assert.equal(repair.supplies.at(-1).material, 'iron', stageId);

    killWithRoll(2385);
    assert.deepEqual(salvage.modules.map(drop => drop.module), ['electric', 'fire'], stageId);
    killWithRoll(2459);
    assert.equal(salvage.modules.length, 2, stageId);
    take(salvage.modules.at(-1));
    assert.equal(salvage.held, 'fire', stageId);
    assert.equal(salvage.modules.length, 1, stageId);
    killWithRoll(2462);
    assert.equal(salvage.modules.length, 1, stageId);
    killWithRoll(2459);
    assert.deepEqual(salvage.modules.map(drop => drop.module), ['electric', 'powder'], stageId);
    assert.equal(world.rng, rng, stageId);

    const tower = repairTower(world, 0);
    assert.equal(tower.kind, 'repaired', stageId);
    assert.equal(!!tower.armor, stageId === 'desert-base', stageId);
    dispatch(world, mod);
    assert.equal(salvage.held, undefined, stageId);
    assert.deepEqual(world.events, ['tower-modded'], stageId);
    enemy(world, tower.x - 100, tower.y - 100);
    dispatch(world, idle);
    const moduleShot = world.shots.find(projectile => projectile.kind === 'tower-fire');
    assert(moduleShot, stageId);
    if (stageId !== 'desert-base') assert.equal(repair.towers[0].nextTurretShotTick, world.tick + 54, stageId);
    assert.deepEqual(parseActionBuffer({ ...startRecording(world), actions: [mod] }).actions, [mod], stageId);
  }
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
