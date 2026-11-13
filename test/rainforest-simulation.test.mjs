import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist/core.js';
import { DESERT_CONTEXT, RAINFOREST_CONTEXT } from '../dist/stage-rules.js';
import { playArmorCase } from '../scripts/armor-balance.mjs';

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
  for (const rulesVersion of ['desert-base-1', 'rainforest-2']) {
    assert.throws(() => core.createWorld({ ...request, rulesVersion }), { code: 'incompatible-rules' });
    assert.throws(() => core.prepareReplay({ ...recording, rulesVersion }), { code: 'incompatible-rules' });
  }
  assert.throws(() => core.replay({ ...recording, ...DESERT_CONTEXT }), error =>
    ['checksum-mismatch', 'nonterminal-replay'].includes(error.code));
});
