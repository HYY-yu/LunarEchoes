import assert from 'node:assert/strict';
import { loadCoreRevision } from './load-core-revision.mjs';
import { stageRules } from '../dist/stage-rules.js';
import * as head from '../dist/core.js';
const revision = process.argv[2] ?? 'bde5936d13d6890a72d24d36bb0039e48e36df44';
const { core: base } = await loadCoreRevision(revision);
let actions = 0;
function compare(a, b, action) {
  base.dispatch(a, action); head.dispatch(b, action); actions++;
  const { events: oldEvents, context: oldContext, ...oldState } = a, { events: newEvents, context, ...newState } = b;
  assert.deepEqual(newState, oldState); assert.equal(head.checksum(b), base.checksum(a));
  assert.deepEqual(base.VERSION === 'lunar-1' ? newEvents.filter(event => event !== 'enemy-hit') : newEvents, oldEvents);
}
for (const seed of [208907, 42, 101]) {
  const a = base.createWorld(base.VERSION === 'lunar-2' ? { stageId: 'desert-base', rulesVersion: 'desert-base-1', seed } : seed), b = head.createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed });
  for (let i = 0; i < stageRules(b.context).durationTicks + 100 && !['won', 'lost'].includes(a.phase.kind); i++) {
    if (a.phase.kind === 'upgrading') compare(a, b, { kind: 'choose', upgrade: a.phase.offers[0] });
    if (i % 160 === 0) { compare(a, b, { kind: 'pause' }); compare(a, b, { kind: 'resume' }); }
    compare(a, b, { kind: 'tick', input: { x: Math.cos(i / 120), y: Math.sin(i / 120), dash: i % 160 === 0 } });
  }
}
for (const weapon of ['bullet', 'orbit', 'nova']) {
  const a = base.createWorld(base.VERSION === 'lunar-2' ? { stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: 1 } : 1), b = head.createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: 1 });
  for (const world of [a, b]) {
    world.spawnCooldown = 999; world.fireCooldown = 999;
    const x = world.player.x + (weapon === 'orbit' ? 58 : 50);
    world.enemies.push({ id: 1, kind: 'crawler', x, y: world.player.y, hp: 100, maxHp: 100, radius: 11, attack: 100, flash: 0 });
    if (weapon === 'bullet') world.shots.push({ x, y: world.player.y, vx: 0, vy: 0, life: 10, damage: 5, hostile: false }); else world.upgrades[weapon] = 1;
  }
  compare(a, b, { kind: 'tick', input: { x: 0, y: 0, dash: false } }); assert(b.events.includes('enemy-hit'));
}
console.info({ event: 'audio.differential_passed', base: revision, actions, compared: 'complete battle World excluding only context and transient events, every checksum, old event order' });
