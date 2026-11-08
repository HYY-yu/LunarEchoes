import { DESERT_CONTEXT, stageRules } from '../dist/stage-rules.js';
const DURATION = stageRules(DESERT_CONTEXT).durationTicks;
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, dispatch, checksum, replay, parseActionBuffer, VERSION, normalizeInput, ARMOR_RULES } from '../dist/core.js';
const idle = { kind: 'tick', input: { x: 0, y: 0, dash: false } };
test('same seed and inputs reproduce the complete state', () => {
  const record = { version: VERSION, stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: 42, actions: Array.from({ length: 600 }, (_, i) => ({ kind: 'tick', input: { x: Math.cos(i / 120), y: Math.sin(i / 120), dash: i % 160 === 0 } })) };
  const run = input => { const buffer = parseActionBuffer(input), world = createWorld({ stageId: buffer.stageId, rulesVersion: buffer.rulesVersion, seed: buffer.seed }); for (const action of buffer.actions) dispatch(world, action); return world; };
  assert.equal(checksum(run(record)), checksum(run(record)));
  assert.notEqual(checksum(run(record)), checksum(run({ ...record, seed: 43 })));
  assert.throws(() => replay(record), error => error.code === 'invalid-data');
});
test('pause freezes simulation and resume continues', () => {
  const world = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: 1 }); dispatch(world, { kind: 'pause' }); const before = checksum(world);
  for (let i = 0; i < 100; i++) dispatch(world, idle);
  assert.equal(checksum(world), before); dispatch(world, { kind: 'resume' }); dispatch(world, idle); assert.equal(world.tick, 1);
});
test('upgrade freezes combat and can only be selected once', () => {
  const world = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: 1 }); world.xp = world.threshold; dispatch(world, idle); assert.equal(world.phase.kind, 'upgrading');
  const before = checksum(world); dispatch(world, idle); assert.equal(checksum(world), before);
  const id = world.phase.offers[0]; const previous = world.upgrades[id]; dispatch(world, { kind: 'choose', upgrade: id }); dispatch(world, { kind: 'choose', upgrade: id });
  assert.equal(world.upgrades[id], previous + 1); assert.equal(world.phase.kind, 'running');
});
test('death is terminal and emits a single outcome', () => {
  const world = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: 1 }); world.player.hp = ARMOR_RULES.hpPerCell;
  world.enemies.push({ id: 1, kind: 'crawler', x: world.player.x, y: world.player.y, hp: 100, maxHp: 100, radius: 11, attack: 100, flash: 0 });
  dispatch(world, idle); assert.equal(world.phase.kind, 'lost'); assert.equal(world.events.filter(event => event === 'lost').length, 1);
  const tick = world.tick; dispatch(world, idle); assert.equal(world.tick, tick); assert.equal(world.events.length, 0);
});
test('fresh deployment clears all previous combat state', () => {
  const first = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: 42 }); for (let i = 0; i < 200; i++) dispatch(first, idle);
  const fresh = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: 42 }); assert.equal(fresh.tick, 0); assert.equal(fresh.enemies.length, 0); assert.equal(fresh.kills, 0); assert.equal(fresh.player.hp, 100);
});
test('input is finite, normalized and diagonal speed is limited', () => {
  const input = normalizeInput({ x: 1, y: 1, dash: false }); assert(Math.abs(Math.hypot(input.x, input.y) - 1) < .00001);
  assert.deepEqual(normalizeInput({ x: NaN, y: Infinity, dash: false }), { x: 0, y: 0, dash: false });
});
test('corner spawns cannot overlap the player', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const world = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: seed }); world.player.x = 36; world.player.y = 36; world.spawnCooldown = 1;
    dispatch(world, idle); assert(world.enemies.every(enemy => Math.hypot(enemy.x - 36, enemy.y - 36) > 200));
  }
});
test('end of mission wins only after boss defeat', () => {
  const world = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: 1 }); world.tick = DURATION - 1; world.bossSpawned = true; world.bossKilled = true; dispatch(world, idle); assert.equal(world.phase.kind, 'won');
});
test('replay rejects incompatible versions', () => assert.throws(() => replay({ version: 'old', seed: 1, actions: [] }), /version/));
test('enemy-hit is transient and emitted for bullet orbit and nova damage', () => {
  for (const weapon of ['bullet', 'orbit', 'nova']) {
    const world = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: 1 }); world.spawnCooldown = 999; world.fireCooldown = 999;
    const x = weapon === 'orbit' ? world.player.x + 58 : world.player.x + 50;
    world.enemies.push({ id: 1, kind: 'crawler', x, y: world.player.y, hp: 100, maxHp: 100, radius: 11, attack: 100, flash: 0 });
    if (weapon === 'bullet') world.shots.push({ x, y: world.player.y, vx: 0, vy: 0, life: 10, damage: 5, hostile: false });
    else world.upgrades[weapon] = 1;
    dispatch(world, idle); assert(world.events.includes('enemy-hit'), weapon); assert(world.enemies[0].hp < 100, weapon);
    const hash = checksum(world); world.events.length = 0; assert.equal(checksum(world), hash);
  }
});
