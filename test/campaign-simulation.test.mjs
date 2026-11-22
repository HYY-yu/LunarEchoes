import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist/core.js';
import { ANTARCTIC_RELAY_CONTEXT, ELEVATOR_RELAY_CONTEXT, stageContext } from '../dist/stage-rules.js';
import { playArmorCase } from '../scripts/armor-balance.mjs';
import { play } from '../scripts/simulation.mjs';

const scenarios = [
  { stageId: 'antarctica', rulesVersion: 'antarctica-3', seed: 101, duration: 210, bossSecond: 162, health: 1050, shots: 7, fan: true },
  { stageId: 'space-elevator', rulesVersion: 'space-elevator-3', seed: 42, duration: 205, bossSecond: 158, health: 925, shots: 3, fan: true },
  { stageId: 'watchtower', seed: 42, duration: 225, bossSecond: 173, health: 1100, shots: 10, fan: false },
  { stageId: 'lunar-echoes', seed: 42, duration: 240, bossSecond: 185, health: 1250, shots: 15, fan: false }
];

for (const { stageId, rulesVersion = `${stageId}-2`, seed, duration, bossSecond } of scenarios) {
  test(`${stageId} can be won, lost and replayed through the campaign action API`, () => {
    const context = stageContext(stageId);
    const win = playArmorCase(core, seed, 'skilled', 'attack', context);
    const loss = playArmorCase(core, seed, 'stationary', 'attack', context);
    assert.equal(win.phase, 'won');
    assert.equal(win.bossKilled, true);
    assert.equal(win.ticks, duration * core.HZ);
    assert.equal(loss.phase, 'lost');
    assert.equal(loss.hp, 0);

    for (const result of [win, loss]) {
      assert.equal(result.error, null);
      assert.equal(result.replayMatch, true);
      const { world, recording } = core.prepareReplay(result.recording);
      assert.equal(recording.version, 'lunar-2');
      assert.equal(recording.stageId, stageId);
      assert.equal(recording.rulesVersion, rulesVersion);

      const bossTicks = [];
      core.dispatch(world, { kind: 'pause' });
      const paused = structuredClone(world);
      core.dispatch(world, { kind: 'tick', input: { x: 1, y: 0, dash: true } });
      assert.deepEqual(world, paused);
      core.dispatch(world, { kind: 'resume' });
      for (const action of recording.actions) {
        core.dispatch(world, action);
        if (world.events.includes('boss')) bossTicks.push(world.tick);
      }
      core.verifyReplay(world, recording, recording.actions.length);
      assert.deepEqual(bossTicks, result.bossSpawned ? [bossSecond * core.HZ] : []);
    }
  });
}

const relayScenarios = [
  { context: ANTARCTIC_RELAY_CONTEXT, seed: 101, duration: 210, bossSecond: 162, shipments: [1, 42 * core.HZ, 84 * core.HZ, 126 * core.HZ] },
  { context: ELEVATOR_RELAY_CONTEXT, seed: 42, duration: 205, bossSecond: 158, shipments: [1, 29 * core.HZ, 76 * core.HZ, 120 * core.HZ] }
];

for (const { context, seed, duration, bossSecond, shipments } of relayScenarios) {
  const { stageId, rulesVersion } = context;
  test(`${rulesVersion} fields four corner towers before the existing boss and victory`, () => {
    assert.equal(stageContext(stageId), context);
    const { recording, world: terminal } = play(seed, context);
    const world = core.createWorld({ ...context, seed });
    assert.deepEqual(world.desertRepair.towers.map(({ x, y }) => [x, y]), [[590, 590], [910, 590], [910, 910], [590, 910]]);
    const delivered = [];
    let bossTick;
    for (const action of recording.actions) {
      const deliveries = world.campaignRelay.deliveries;
      const previousShots = Object.keys(world.desertTurretShots ?? {});
      core.dispatch(world, action);
      if (world.campaignRelay.deliveries > deliveries) delivered.push(world.tick);
      if (world.events.includes('boss')) {
        bossTick = world.tick;
        assert.equal(previousShots.length, 4);
        assert(world.desertRepair.towers.every(tower => tower.kind === 'repaired'));
      }
    }
    assert.deepEqual(delivered, shipments);
    assert.equal(bossTick, bossSecond * core.HZ);
    assert.equal(world.phase.kind, 'won');
    assert.equal(world.tick, duration * core.HZ);
    assert.deepEqual(core.replay(recording), terminal);
    for (const revision of [1, 2]) {
      assert.equal(core.createWorld({ stageId, rulesVersion: `${stageId}-${revision}`, seed }).desertRepair, undefined);
    }
  });
}

test('the outer four Bosses fire distinct volleys with their existing attack warning timer', () => {
  for (const { stageId, seed, bossSecond, health, shots, fan } of scenarios) {
    const world = core.createWorld({ ...stageContext(stageId), seed });
    world.tick = bossSecond * core.HZ - 1;
    world.fireCooldown = core.HZ * 5;
    world.spawnCooldown = core.HZ * 5;
    const idle = { kind: 'tick', input: { x: 0, y: 0, dash: false } };
    core.dispatch(world, idle);
    const boss = world.enemies.find(enemy => enemy.kind === 'boss');
    assert.equal(boss.maxHp, health);
    while (boss.attack > 1) core.dispatch(world, idle);
    assert.equal(world.shots.length, 0);
    core.dispatch(world, idle);
    assert.equal(world.shots.length, shots);
    assert(world.shots.every(shot => shot.hostile && shot.damage === core.ARMOR_RULES.hpPerCell));
    const forward = world.shots.filter(shot =>
      shot.vx * (world.player.x - boss.x) + shot.vy * (world.player.y - boss.y) > 0
    );
    if (fan) assert.equal(forward.length, shots);
    else assert(forward.length > 0 && forward.length < shots);
  }
});
