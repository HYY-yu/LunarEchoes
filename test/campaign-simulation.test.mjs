import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist/core.js';
import { ANTARCTIC_BARRAGE_CONTEXT, ANTARCTIC_FROST_CONTEXT, ELEVATOR_ARMOR_CONTEXT, ELEVATOR_SUIT_CONTEXT, LUNAR_ECHO_CONTEXT, LUNAR_RELAY_CONTEXT, WATCHTOWER_ROCKET_CONTEXT, WATCHTOWER_STRIKE_CONTEXT, stageContext } from '../dist/stage-rules.js';
import { playArmorCase } from '../scripts/armor-balance.mjs';
import { play } from '../scripts/simulation.mjs';

const scenarios = [
  { stageId: 'antarctica', rulesVersion: 'antarctica-5', seed: 101, duration: 210, bossSecond: 162, health: 1050, shots: 7, fan: true },
  { stageId: 'space-elevator', rulesVersion: 'space-elevator-5', seed: 42, duration: 205, bossSecond: 158, health: 925, shots: 3, fan: true },
  { stageId: 'watchtower', rulesVersion: 'watchtower-5', seed: 42, duration: 225, bossSecond: 173, health: 1100, shots: 10, fan: false },
  { stageId: 'lunar-echoes', rulesVersion: 'lunar-echoes-4', seed: 42, duration: 240, bossSecond: 185, health: 1250, shots: 15, fan: false }
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
  { context: ANTARCTIC_BARRAGE_CONTEXT, seed: 101, duration: 210, bossSecond: 162, shipments: [1, 42 * core.HZ, 84 * core.HZ, 126 * core.HZ] },
  { context: ELEVATOR_ARMOR_CONTEXT, seed: 42, duration: 205, bossSecond: 158, shipments: [1, 29 * core.HZ, 76 * core.HZ, 120 * core.HZ] },
  { context: WATCHTOWER_STRIKE_CONTEXT, seed: 42, duration: 225, bossSecond: 173, shipments: [1, 42 * core.HZ, 89 * core.HZ, 118 * core.HZ] },
  { context: LUNAR_ECHO_CONTEXT, seed: 42, duration: 240, bossSecond: 185, shipments: [1, 44 * core.HZ, 112 * core.HZ, 142 * core.HZ] }
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

const reinforcementScenarios = [
  { context: ANTARCTIC_BARRAGE_CONTEXT, enemyKind: 'frost-guard', hp: 78, radius: 13, startSecond: 82, bossSecond: 162 },
  { context: ELEVATOR_ARMOR_CONTEXT, enemyKind: 'insulated-suit', hp: 46, radius: 12, startSecond: 76, bossSecond: 158 },
  { context: WATCHTOWER_STRIKE_CONTEXT, enemyKind: 'rocket-bot', hp: 72, radius: 16, startSecond: 105, bossSecond: 173 }
];

for (const { context, enemyKind, hp, radius, startSecond, bossSecond } of reinforcementScenarios) {
  test(`${context.rulesVersion} mixes ${enemyKind} into the existing campaign waves`, () => {
    const seed = 42;
    const { recording } = play(seed, context);
    const world = core.createWorld({ ...context, seed });
    const seen = new Set();
    let firstSpawn;
    let sawHit = false;
    for (const action of recording.actions) {
      core.dispatch(world, action);
      for (const enemy of world.enemies) {
        seen.add(enemy.kind);
        if (enemy.kind !== enemyKind) continue;
        firstSpawn ??= world.tick;
        assert.equal(enemy.maxHp, hp);
        assert.equal(enemy.radius, radius);
        if (enemy.flash > 0) sawHit = true;
      }
    }
    assert(firstSpawn >= startSecond * core.HZ && firstSpawn < bossSecond * core.HZ);
    assert(sawHit);
    assert.deepEqual([...seen].sort(), ['boss', 'crawler', 'drone', enemyKind, 'sentry'].sort());
  });
}

test('a rocket bot fires after its warning delay and the projectile can be dodged', () => {
  const idle = { kind: 'tick', input: { x: 0, y: 0, dash: false } };
  function readyToFire() {
    const world = core.createWorld({ ...WATCHTOWER_ROCKET_CONTEXT, seed: 42 });
    world.spawnCooldown = 600;
    world.fireCooldown = 600;
    world.enemies.push({ id: world.nextId++, kind: 'rocket-bot', x: 870, y: 750, hp: 72, maxHp: 72,
      radius: 16, attack: core.ROCKET_WARNING_TICKS, flash: 0 });
    for (let tick = 1; tick < core.ROCKET_WARNING_TICKS; tick++) core.dispatch(world, idle);
    assert.equal(world.shots.length, 0);
    assert.equal(world.enemies[0].attack, 1);
    core.dispatch(world, { kind: 'pause' });
    core.dispatch(world, idle);
    assert.equal(world.enemies[0].attack, 1);
    core.dispatch(world, { kind: 'resume' });
    core.dispatch(world, idle);
    const [rocket] = world.shots;
    assert.equal(rocket.kind, 'rocket');
    assert.equal(rocket.hostile, true);
    assert.equal(rocket.damage, core.ARMOR_RULES.hpPerCell);
    assert(Math.abs(Math.hypot(rocket.vx, rocket.vy) - 1.85) < 1e-12);
    return world;
  }
  const exposed = readyToFire();
  const dodged = readyToFire();
  const initialHp = exposed.player.hp;
  for (let tick = 0; tick < 75; tick++) {
    core.dispatch(exposed, idle);
    core.dispatch(dodged, { kind: 'tick', input: { x: 0, y: 1, dash: tick === 0 } });
  }
  assert.equal(exposed.player.hp, initialHp - core.ARMOR_RULES.hpPerCell);
  assert.equal(dodged.player.hp, initialHp);
});

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
    assert.equal(world.shots.filter(shot => shot.kind !== 'ice-shard').length, 0);
    core.dispatch(world, idle);
    const regular = world.shots.filter(shot => shot.kind !== 'ice-shard');
    assert.equal(regular.length, shots);
    assert(regular.every(shot => shot.hostile && shot.damage === core.ARMOR_RULES.hpPerCell));
    const forward = regular.filter(shot =>
      shot.vx * (world.player.x - boss.x) + shot.vy * (world.player.y - boss.y) > 0
    );
    if (fan) assert.equal(forward.length, shots);
    else assert(forward.length > 0 && forward.length < shots);
  }
});

test('Antarctic ice lanes lock during warning, deal one cell on impact and can be dodged', () => {
  const first = 9870;
  const idle = { kind: 'tick', input: { x: 0, y: 0, dash: false } };
  const shards = world => world.shots.filter(shot => shot.kind === 'ice-shard');
  function warned(context = ANTARCTIC_BARRAGE_CONTEXT) {
    const world = core.createWorld({ ...context, seed: 42 });
    world.tick = first - 55;
    world.bossSpawned = true;
    world.spawnCooldown = 1000;
    world.fireCooldown = 1000;
    world.enemies.push({ id: world.nextId++, kind: 'boss', x: 550, y: 750, hp: 1050, maxHp: 1050,
      radius: 27, attack: 1000, flash: 0 });
    core.dispatch(world, idle);
    return world;
  }

  const standing = warned(), dodging = warned(), defeated = warned(), legacy = warned(ANTARCTIC_FROST_CONTEXT);
  assert.equal(standing.antarcticBarrage.firstVolleyTick, first);
  assert.equal(standing.antarcticBarrage.angle, 0);
  const warning = structuredClone(dodging);
  core.dispatch(dodging, { kind: 'pause' });
  core.dispatch(dodging, idle);
  assert.equal(dodging.tick, warning.tick);
  assert.deepEqual(dodging.antarcticBarrage, warning.antarcticBarrage);
  core.dispatch(dodging, { kind: 'resume' });
  for (let i = 0; i < 53; i++) {
    core.dispatch(standing, idle);
    core.dispatch(dodging, { kind: 'tick', input: { x: 0, y: 1, dash: i === 0 } });
    core.dispatch(defeated, idle);
    core.dispatch(legacy, idle);
  }
  assert.equal(shards(standing).length, 0);
  assert.deepEqual(dodging.antarcticBarrage, warning.antarcticBarrage);
  const boss = defeated.enemies[0];
  defeated.shots.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, life: 2, damage: 2000, hostile: false });
  for (const world of [standing, dodging, defeated, legacy]) core.dispatch(world, idle);
  assert.equal(defeated.bossKilled, true);
  assert.equal(defeated.antarcticBarrage, undefined);
  assert.equal(shards(defeated).length, 0);
  assert.equal(legacy.antarcticBarrage, undefined);
  assert.equal(shards(legacy).length, 0);
  const lanes = world => shards(world).map(shot => [shot.vx, shot.vy]);
  assert.equal(lanes(standing).length, 7);
  assert.deepEqual(lanes(standing), lanes(dodging));
  assert(shards(standing).every(shot => shot.hostile && shot.damage === core.ARMOR_RULES.hpPerCell));
  const initial = standing.player.hp;
  for (let i = 0; i < 85; i++) {
    core.dispatch(standing, idle);
    core.dispatch(dodging, idle);
    if (i === 11) assert.equal(shards(standing).length, 14);
    if (i === 23) assert.equal(shards(standing).length, 21);
  }
  assert.equal(standing.player.hp, initial - core.ARMOR_RULES.hpPerCell);
  assert.equal(dodging.player.hp, initial);
});

const idle = { kind: 'tick', input: { x: 0, y: 0, dash: false } };
function elevatorBoss(context = ELEVATOR_ARMOR_CONTEXT) {
  const world = core.createWorld({ ...context, seed: 42 });
  world.tick = 158 * core.HZ - 1;
  world.spawnCooldown = 1000;
  world.fireCooldown = 1000;
  core.dispatch(world, idle);
  const boss = world.enemies[0];
  assert.equal(boss.kind, 'boss');
  return { world, boss };
}

test('the elevator boss armor absorbs hits until broken or expired', () => {
  function fire(world, boss, damage) {
    world.shots.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, life: 2, damage, hostile: false });
    core.dispatch(world, idle);
  }
  const { world, boss } = elevatorBoss();
  const first = world.tick;
  assert.deepEqual(boss.armor, { kind: 'active', remaining: 165, expiresAt: first + 330 });
  fire(world, boss, 100);
  assert.equal(boss.hp, 885);
  assert.deepEqual(boss.armor, { kind: 'active', remaining: 105, expiresAt: first + 330, hitTick: first + 1 });
  core.dispatch(world, { kind: 'pause' });
  core.dispatch(world, idle);
  assert.equal(world.tick, first + 1);
  assert.equal(boss.armor.remaining, 105);
  core.dispatch(world, { kind: 'resume' });
  fire(world, boss, 300);
  assert.equal(boss.hp, 690);
  assert.deepEqual(boss.armor, { kind: 'spent', atTick: first + 2, reason: 'broken' });
  fire(world, boss, 50);
  assert.equal(boss.hp, 640);

  const expiry = elevatorBoss();
  expiry.world.tick = expiry.boss.armor.expiresAt - 1;
  fire(expiry.world, expiry.boss, 100);
  assert.equal(expiry.boss.hp, 825);
  assert.deepEqual(expiry.boss.armor, { kind: 'spent', atTick: first + 330, reason: 'expired' });

  const legacy = elevatorBoss(ELEVATOR_SUIT_CONTEXT);
  fire(legacy.world, legacy.boss, 100);
  assert.equal(legacy.boss.armor, undefined);
  assert.equal(legacy.boss.hp, 825);
});

test('tower, nova and orbit damage also consume the elevator boss armor', () => {
  const nova = elevatorBoss();
  const orbit = elevatorBoss();
  const tower = elevatorBoss();

  nova.boss.x = nova.world.player.x + 90;
  nova.boss.y = nova.world.player.y;
  nova.world.upgrades.nova = 1;

  const nextAngle = (orbit.world.tick + 1) * .055;
  orbit.boss.x = orbit.world.player.x + Math.cos(nextAngle) * 58;
  orbit.boss.y = orbit.world.player.y + Math.sin(nextAngle) * 58;
  orbit.world.upgrades.orbit = 1;

  const [north] = tower.world.desertRepair.towers;
  tower.world.desertRepair.towers[0] = { ...north, kind: 'repaired', nextTurretShotTick: 0 };
  tower.boss.x = north.x - 22;
  tower.boss.y = north.y - 22;

  for (const [{ world, boss }, rawDamage] of [[nova, 51], [orbit, 1.6], [tower, 18]]) {
    core.dispatch(world, idle);
    assert(Math.abs(boss.hp - (925 - rawDamage * .4)) < 1e-9);
    assert(Math.abs(boss.armor.remaining - (165 - rawDamage * .6)) < 1e-9);
    assert.equal(boss.armor.hitTick, world.tick);
  }
  assert.equal(tower.world.desertTurretShots.north.tick, tower.world.tick);
});

test('watchtower strike uses fixed marks, can be avoided and stops if the caller falls', () => {
  const firstImpact = 176 * core.HZ;
  function warned(context = WATCHTOWER_STRIKE_CONTEXT) {
    const world = core.createWorld({ ...context, seed: 42 });
    world.tick = firstImpact - core.HZ - 1;
    world.bossSpawned = true;
    world.spawnCooldown = 1000;
    world.fireCooldown = 1000;
    world.enemies.push({ id: world.nextId++, kind: 'boss', x: 470, y: 750, hp: 1100, maxHp: 1100,
      radius: 27, attack: 1000, flash: 0 });
    core.dispatch(world, idle);
    return world;
  }
  const standing = warned(), leaving = warned(), defeated = warned(), dashing = warned();
  const warning = structuredClone(standing.watchtowerStrike);
  assert.equal(warning.kind, 'warning');
  assert.equal(warning.impactTick, firstImpact);
  assert.deepEqual(warning.marks.map(({ y, radius }) => [y, radius]), [[674, 46], [750, 46], [826, 46]]);
  core.dispatch(standing, { kind: 'pause' });
  core.dispatch(standing, idle);
  assert.equal(standing.tick, firstImpact - core.HZ);
  assert.deepEqual(standing.watchtowerStrike, warning);
  core.dispatch(standing, { kind: 'resume' });
  for (let i = 0; i < core.HZ - 1; i++) {
    for (const world of [standing, defeated, dashing]) core.dispatch(world, idle);
    core.dispatch(leaving, { kind: 'tick', input: { x: 1, y: 0, dash: false } });
  }
  assert.deepEqual(leaving.watchtowerStrike, warning);
  standing.player.y += 38;
  const boss = defeated.enemies[0];
  defeated.shots.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, life: 2, damage: 2000, hostile: false });
  for (const world of [standing, leaving, defeated]) core.dispatch(world, idle);
  core.dispatch(dashing, { kind: 'tick', input: { x: 1, y: 0, dash: true } });
  assert.equal(standing.player.hp, 40);
  assert.equal(standing.events.filter(event => event === 'hit').length, 1);
  assert.deepEqual(standing.watchtowerStrike, { ...warning, kind: 'impact', outcome: 'hit' });
  assert.equal(leaving.player.hp, 50);
  assert.equal(leaving.watchtowerStrike.outcome, 'avoided');
  assert.equal(dashing.player.hp, 50);
  assert.equal(dashing.watchtowerStrike.outcome, 'shielded');
  assert.equal(defeated.bossKilled, true);
  assert.equal(defeated.player.hp, 50);
  assert.equal(defeated.watchtowerStrike, undefined);
  for (let i = 0; i < 24; i++) core.dispatch(standing, idle);
  assert.equal(standing.watchtowerStrike, undefined);
  assert.equal(standing.player.hp, 40);
  assert.equal(warned(WATCHTOWER_ROCKET_CONTEXT).watchtowerStrike, undefined);
});


test('lunar projections draw auto fire without contact damage, rewards or lingering after the boss', () => {
  const split = 187 * core.HZ;
  function warned(context = LUNAR_ECHO_CONTEXT) {
    const world = core.createWorld({ ...context, seed: 42 });
    world.tick = split - 43;
    world.bossSpawned = true;
    world.spawnCooldown = 1000;
    world.fireCooldown = 1000;
    world.enemies.push({ id: world.nextId++, kind: 'boss', x: 900, y: 750, hp: 1250, maxHp: 1250,
      radius: 27, attack: 1000, flash: 0 });
    core.dispatch(world, idle);
    return world;
  }
  const live = warned(), defeated = warned(), expiry = warned();
  const warning = structuredClone(live.lunarEchoCast);
  assert.equal(warning.kind, 'warning');
  assert.equal(warning.splitTick, split);
  core.dispatch(live, { kind: 'pause' });
  core.dispatch(live, idle);
  assert.equal(live.tick, split - 42);
  assert.deepEqual(live.lunarEchoCast, warning);
  core.dispatch(live, { kind: 'resume' });
  for (let i = 0; i < 41; i++) for (const world of [live, defeated, expiry]) core.dispatch(world, idle);
  const trueBoss = defeated.enemies[0];
  defeated.shots.push({ x: trueBoss.x, y: trueBoss.y, vx: 0, vy: 0, life: 2, damage: 2000, hostile: false });
  for (const world of [live, defeated, expiry]) core.dispatch(world, idle);
  assert.equal(defeated.bossKilled, true);
  assert.equal(defeated.lunarEchoCast, undefined);
  assert(!defeated.enemies.some(enemy => enemy.kind === 'boss-echo'));

  const [boss, target, other] = live.enemies;
  assert.deepEqual([target,other].map(({x,y})=>({x,y})), warning.sites);
  assert.equal(target.maxHp, 45);
  assert.equal(target.kind, 'boss-echo');
  live.player.x = target.x - 68;
  live.player.y = target.y;
  live.fireCooldown = 1;
  core.dispatch(live, idle);
  const shot = live.shots.find(shot => !shot.hostile);
  assert.deepEqual([shot.vx,shot.vy], [8,0]);
  const progress = [live.kills, live.xp, live.crystals.length];
  live.shots.push({ ...shot, x: target.x, y: target.y, vx: 0, vy: 0, life: 2, damage: 45 });
  core.dispatch(live, idle);
  assert(!live.enemies.includes(target));
  assert(live.effects.some(effect => effect.kind === 'echo-dispersal'));
  assert.deepEqual([live.kills, live.xp, live.crystals.length], progress);
  live.player.x = other.x;
  live.player.y = other.y;
  core.dispatch(live, idle);
  assert.equal(live.player.hp, 50);
  live.shots.push({ ...shot, x: boss.x, y: boss.y, vx: 0, vy: 0, life: 2, damage: 2000 });
  core.dispatch(live, idle);
  assert.equal(live.bossKilled, true);
  assert.equal(live.lunarEchoCast, undefined);
  assert(!live.enemies.includes(other));
  assert.equal(live.kills, progress[0] + 1);

  while (expiry.tick < split + 150) core.dispatch(expiry, idle);
  assert.equal(expiry.lunarEchoCast, undefined);
  assert(expiry.enemies.every(enemy => enemy.kind === 'boss'));
  assert.equal(expiry.kills, 0);
  assert.equal(warned(LUNAR_RELAY_CONTEXT).lunarEchoCast, undefined);
});
