import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist/core.js';
import { DESERT_CONTEXT, RAINFOREST_BROOD_CONTEXT, RAINFOREST_CONTEXT, RAINFOREST_RELAY_CONTEXT, resolveStage } from '../dist/stage-rules.js';
import { rainforestBroodSites, rainforestBroodWarning } from '../dist/rainforest-brood.js';
import { playArmorCase } from '../scripts/armor-balance.mjs';
import { play } from '../scripts/simulation.mjs';

const seed = 42;
const request = { ...RAINFOREST_CONTEXT, seed };
const idle = { kind: 'tick', input: { x: 0, y: 0, dash: false } };

test('rainforest records a complete win and loss through the shared action and replay APIs', () => {
  for (const [strategy, outcome] of [['skilled', 'won'], ['stationary', 'lost']]) {
    const result = playArmorCase(core, seed, strategy, 'attack', RAINFOREST_CONTEXT);
    assert.equal(result.error, null);
    assert.equal(result.phase, outcome);
    assert.equal(result.timeout, false);
    assert.equal(result.recording.version, 'lunar-2');
    assert.deepEqual(Object.keys(result.recording), ['version', 'stageId', 'rulesVersion', 'seed', 'actions', 'finalChecksum']);
    assert.equal(result.recording.stageId, 'rainforest');
    assert.equal(result.recording.rulesVersion, 'rainforest-1');
    assert.equal(result.recording.seed, seed);
    const { world, recording } = core.prepareReplay(result.recording);
    const bossTicks = [];
    for (const action of recording.actions) {
      const before = world.tick;
      core.dispatch(world, action);
      if (action.kind === 'choose') assert.equal(world.tick, before);
      if (world.events.includes('boss')) bossTicks.push(world.tick);
    }
    core.verifyReplay(world, recording, recording.actions.length);
    assert.equal(core.finalChecksum(world), recording.finalChecksum);
    assert.deepEqual(core.replay(recording), world);
    assert.deepEqual(core.replay(recording), world);
    if (outcome === 'won') {
      assert.deepEqual(bossTicks, [155 * core.HZ]);
      assert.equal(world.tick, 195 * core.HZ);
      assert.equal(world.bossKilled, true);
    } else {
      assert.deepEqual(bossTicks, []);
      assert(world.tick < 195 * core.HZ);
      assert.equal(world.player.hp, 0);
    }
  }
});

test('rainforest runs its own enemy composition and pause does not advance battle time', () => {
  const world = core.createWorld(request);
  core.dispatch(world, { kind: 'pause' });
  const paused = structuredClone(world);
  core.dispatch(world, idle);
  assert.deepEqual(world, paused);
  core.dispatch(world, { kind: 'resume' });
  assert.equal(world.tick, 0);
  const enemyKinds = new Map();
  const seen = new Set();
  while (world.tick < 31 * core.HZ) {
    const action = world.phase.kind === 'upgrading' ? { kind: 'choose', upgrade: world.phase.offers[0] } : idle;
    assert(['running', 'upgrading'].includes(world.phase.kind));
    core.dispatch(world, action);
    for (const enemy of world.enemies) {
      if (seen.has(enemy.id)) continue;
      seen.add(enemy.id);
      if (!enemyKinds.has(enemy.kind)) enemyKinds.set(enemy.kind, world.tick);
    }
  }
  assert.deepEqual([...enemyKinds.keys()], ['crawler', 'sentry']);
  assert(enemyKinds.get('sentry') >= 18 * core.HZ);
  assert(enemyKinds.get('sentry') < 30 * core.HZ);
});

test('rainforest recording validation requires the exact rule pair and rejects context substitution', () => {
  const { recording } = playArmorCase(core, seed, 'stationary', 'attack', RAINFOREST_CONTEXT);
  for (const rulesVersion of ['desert-base-1', 'rainforest-6']) {
    assert.throws(() => core.createWorld({ ...request, rulesVersion }), { code: 'incompatible-rules' });
    assert.throws(() => core.prepareReplay({ ...recording, rulesVersion }), { code: 'incompatible-rules' });
  }
  assert.throws(() => core.replay({ ...recording, ...DESERT_CONTEXT }), error =>
    ['checksum-mismatch', 'nonterminal-replay'].includes(error.code));
});

test('rainforest v4 retains the four-tower route, outcome and replay', () => {
  const context = resolveStage('rainforest', 'rainforest-4');
  assert.equal(context, RAINFOREST_BROOD_CONTEXT);
  const whole = play(42, context);
  const world = core.createWorld({ ...context, seed: 42 });
  assert.equal(core.finalChecksum(core.createWorld({ ...RAINFOREST_RELAY_CONTEXT, seed: 42 })), '047840c6');
  const repair = world.desertRepair;
  assert.deepEqual(repair.towers.map(({ x, y }) => [x, y]), [[590, 590], [910, 590], [910, 910], [590, 910]]);
  const deliveries = [];
  const repairs = [];
  let bossTick;
  let towersFiredBeforeBoss;
  for (const action of whole.recording.actions) {
    const previousDelivery = world.campaignRelay.deliveries;
    const previousRepaired = repair.towers.filter(tower => tower.kind === 'repaired').length;
    const previousShots = Object.keys(world.desertTurretShots ?? {});
    const nextEnemy = world.nextId;
    core.dispatch(world, action);
    if (world.campaignRelay.deliveries > previousDelivery) deliveries.push(world.tick);
    if (repair.towers.filter(tower => tower.kind === 'repaired').length > previousRepaired) {
      repairs.push(world.tick);
      assert.deepEqual(world.enemies.filter(enemy => enemy.id >= nextEnemy).slice(0, 3).map(enemy => enemy.kind),
        ['crawler', 'crawler', 'drone']);
    }
    if (world.events.includes('boss')) {
      bossTick = world.tick;
      towersFiredBeforeBoss = previousShots;
    }
  }
  assert.deepEqual(deliveries, [1, 35 * core.HZ, 70 * core.HZ, 108 * core.HZ]);
  assert.equal(repairs.length, 4);
  assert.equal(bossTick, 155 * core.HZ);
  assert(repairs[3] < bossTick);
  assert.deepEqual(towersFiredBeforeBoss, ['north', 'east', 'south', 'west']);
  assert.equal(world.phase.kind, 'won');
  assert.equal(world.tick, 195 * core.HZ);
  assert.deepEqual(core.replay(whole.recording), world);
  const skipped = play(42, context, [], { skipFourth: true }).world;
  assert.equal(skipped.desertRepair.towers.filter(tower => tower.kind === 'repaired').length, 3);
  assert.equal(skipped.phase.kind, 'won');
});

test('a live matriarch releases at its warned sites and defeat on that step cancels the release', () => {
  const releaseTick = 158 * core.HZ;
  function aboutToRelease() {
    const world = core.createWorld({ ...RAINFOREST_BROOD_CONTEXT, seed });
    world.tick = releaseTick - 1;
    world.bossSpawned = true;
    world.spawnCooldown = 90;
    world.fireCooldown = 90;
    world.enemies.push({ id: world.nextId++, kind: 'boss', x: 850, y: 750, hp: 950, maxHp: 950,
      radius: 27, attack: 75, flash: 0 });
    return world;
  }

  const live = aboutToRelease();
  const progress = rainforestBroodWarning(live.context, live.tick);
  assert(progress > .9 && progress < 1);
  assert.equal(rainforestBroodWarning(RAINFOREST_RELAY_CONTEXT, live.tick), undefined);
  core.dispatch(live, { kind: 'pause' });
  core.dispatch(live, idle);
  assert.equal(rainforestBroodWarning(live.context, live.tick), progress);
  assert.equal(live.rainforestBrood, undefined);
  core.dispatch(live, { kind: 'resume' });
  core.dispatch(live, idle);
  const [mother, ...offspring] = live.enemies;
  const sites = rainforestBroodSites(mother.x, mother.y, 1500);
  assert.deepEqual(live.rainforestBrood, { tick: releaseTick, motherId: mother.id, sites });
  assert.deepEqual(offspring.map(({ x, y, kind }) => ({ x, y, kind })), sites.map(site => ({ ...site, kind: 'crawler' })));

  const defeated = aboutToRelease();
  defeated.shots.push({ x: 850, y: 750, vx: 0, vy: 0, life: 2, damage: 1000, hostile: false });
  core.dispatch(defeated, idle);
  assert.equal(defeated.bossKilled, true);
  assert.equal(defeated.rainforestBrood, undefined);
  assert.deepEqual(defeated.enemies, []);
});
