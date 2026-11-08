import test from 'node:test';
import assert from 'node:assert/strict';
import { ARMOR_RULES, createWorld, dispatch, replay, checksum, VERSION, HZ } from '../dist/core.js';
const idle = { kind: 'tick', input: { x: 0, y: 0, dash: false } };
function quiet() { const world = createWorld(42); world.spawnCooldown = 99999; world.fireCooldown = 99999; return world; }
function enemy(world, kind = 'crawler') { return { id: world.nextId++, kind, x: world.player.x, y: world.player.y, hp: 1000, maxHp: 1000, radius: 27, attack: 999, flash: 0 }; }
function shot(world) { return { x: world.player.x, y: world.player.y, vx: 0, vy: 0, life: 10, damage: ARMOR_RULES.hpPerCell, hostile: true }; }
test('all accepted contact and projectile damage consumes exactly one armor cell', () => {
  for (const source of ['crawler', 'boss', 'shot']) {
    const world = quiet();
    if (source === 'shot') world.shots.push(shot(world)); else world.enemies.push(enemy(world, source));
    dispatch(world, idle);
    assert.equal(world.player.hp, 100 - ARMOR_RULES.hpPerCell, source);
    assert.equal(world.player.invincible, HZ);
    assert.equal(world.events.filter(event => event === 'hit').length, 1);
  }
  const world = quiet(); world.enemies.push(enemy(world), enemy(world, 'boss')); world.shots.push(shot(world)); dispatch(world, idle);
  assert.equal(world.player.hp, 90); assert.equal(world.events.filter(event => event === 'hit').length, 1);
});
test('invincibility and dash keep their existing decrement-before-contact boundaries', () => {
  for (const field of ['invincible', 'dashTicks']) for (const remaining of [2, 1, 0]) {
    const world = quiet(); world.player[field] = remaining; world.enemies.push(enemy(world)); dispatch(world, idle);
    assert.equal(world.player.hp, remaining === 2 ? 100 : 90, `${field}/${remaining}`);
  }
  const world = quiet(); world.enemies.push(enemy(world)); dispatch(world, { kind: 'tick', input: { x: 1, y: 0, dash: true } });
  assert.equal(world.player.hp, 100); assert(world.events.includes('dash'));
});
test('the final cell produces one terminal loss and no further simulation', () => {
  const world = quiet(); world.player.hp = ARMOR_RULES.hpPerCell; world.enemies.push(enemy(world), enemy(world, 'boss')); world.shots.push(shot(world)); dispatch(world, idle);
  assert.equal(world.player.hp, 0); assert.equal(world.phase.kind, 'lost'); assert.equal(world.events.filter(event => event === 'lost').length, 1);
  const tick = world.tick; dispatch(world, idle); assert.equal(world.tick, tick); assert.equal(world.events.length, 0);
});
test('passive repair is one capped whole cell at the global thirty-second boundary', () => {
  const world = quiet(); world.player.hp = 80; world.tick = ARMOR_RULES.repairEveryTicks - 2;
  dispatch(world, idle); assert.equal(world.player.hp, 80);
  dispatch(world, idle); assert.equal(world.player.hp, 90);
  dispatch(world, idle); assert.equal(world.player.hp, 90);
  world.tick = ARMOR_RULES.repairEveryTicks * 2 - 1; world.player.hp = 100; dispatch(world, idle); assert.equal(world.player.hp, 100);
  world.player.hp = 90; world.tick = ARMOR_RULES.repairEveryTicks - 1; dispatch(world, { kind: 'pause' }); dispatch(world, idle); assert.equal(world.player.hp, 90); assert.equal(world.tick, ARMOR_RULES.repairEveryTicks - 1);
  world.phase = { kind: 'upgrading', offers: ['hull'] }; dispatch(world, idle); assert.equal(world.player.hp, 90); assert.equal(world.tick, ARMOR_RULES.repairEveryTicks - 1);
});
test('repair still precedes accepted damage and can cancel its net tick change', () => {
  const world = quiet(); world.tick = ARMOR_RULES.repairEveryTicks - 1; world.player.hp = 80; world.enemies.push(enemy(world)); dispatch(world, idle);
  assert.equal(world.player.hp, 80); assert.equal(world.events.filter(event => event === 'hit').length, 1); assert.equal(world.player.invincible, HZ);
});
test('hull adds two cells and repairs at most four without duplicate or invalid selection', () => {
  for (const hp of [100, 60, 10]) {
    const world = quiet(); world.player.hp = hp; world.phase = { kind: 'upgrading', offers: ['hull'] };
    dispatch(world, { kind: 'choose', upgrade: 'hull' }); assert.equal(world.player.maxHp, 120); assert.equal(world.player.hp, Math.min(120, hp + 40));
    dispatch(world, { kind: 'choose', upgrade: 'hull' }); assert.equal(world.player.maxHp, 120); assert.equal(world.upgrades.hull, 1);
    world.phase = { kind: 'upgrading', offers: ['pulse'] }; dispatch(world, { kind: 'choose', upgrade: 'hull' }); assert.equal(world.player.maxHp, 120);
  }
});
test('normal actions keep both armor values in whole cells and candidate replays reject old rules', () => {
  const world = createWorld(42), recording = { version: VERSION, seed: 42, actions: [] };
  for (let i = 0; i < HZ * 40 && !['lost', 'won'].includes(world.phase.kind); i++) {
    const action = world.phase.kind === 'upgrading' ? { kind: 'choose', upgrade: world.phase.offers.includes('hull') ? 'hull' : world.phase.offers[0] } : { kind: 'tick', input: { x: Math.cos(world.tick / 90), y: Math.sin(world.tick / 90), dash: world.tick % 150 === 0 } };
    recording.actions.push(action); dispatch(world, action);
    assert.equal(world.player.hp % ARMOR_RULES.hpPerCell, 0); assert.equal(world.player.maxHp % ARMOR_RULES.hpPerCell, 0); assert(world.player.hp >= 0 && world.player.hp <= world.player.maxHp);
  }
  assert.equal(checksum(replay(recording)), checksum(world));
  for (const version of ['lunar-1', 'lunar-2', 'unknown']) assert.throws(() => replay({ ...recording, version }), /version mismatch/);
  assert.equal(VERSION, 'lunar-armor-1'); assert.equal(Object.isFrozen(ARMOR_RULES), true);
});
