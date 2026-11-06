import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import ts from 'typescript';
import * as head from '../dist/core.js';
const revision = process.argv[2] ?? '56c6923d381baf40750be08da00a6fa576d6723c';
const source = execFileSync('git', ['show', `${revision}:src/core.ts`], { encoding: 'utf8' });
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const base = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
let actions = 0;
function compare(a, b, action) {
  base.dispatch(a, action); head.dispatch(b, action); actions++;
  const { events: oldEvents, ...oldState } = a, { events: newEvents, ...newState } = b;
  assert.deepEqual(newState, oldState); assert.equal(head.checksum(b), base.checksum(a));
  assert.deepEqual(newEvents.filter(event => event !== 'enemy-hit'), oldEvents);
}
for (const seed of [208907, 42, 101]) {
  const a = base.createWorld(seed), b = head.createWorld(seed);
  for (let i = 0; i < head.DURATION + 100 && !['won', 'lost'].includes(a.phase.kind); i++) {
    if (a.phase.kind === 'upgrading') compare(a, b, { kind: 'choose', upgrade: a.phase.offers[0] });
    if (i % 160 === 0) { compare(a, b, { kind: 'pause' }); compare(a, b, { kind: 'resume' }); }
    compare(a, b, { kind: 'tick', input: { x: Math.cos(i / 120), y: Math.sin(i / 120), dash: i % 160 === 0 } });
  }
}
for (const weapon of ['bullet', 'orbit', 'nova']) {
  const a = base.createWorld(1), b = head.createWorld(1);
  for (const world of [a, b]) {
    world.spawnCooldown = 999; world.fireCooldown = 999;
    const x = world.player.x + (weapon === 'orbit' ? 58 : 50);
    world.enemies.push({ id: 1, kind: 'crawler', x, y: world.player.y, hp: 100, maxHp: 100, radius: 11, attack: 100, flash: 0 });
    if (weapon === 'bullet') world.shots.push({ x, y: world.player.y, vx: 0, vy: 0, life: 10, damage: 5, hostile: false }); else world.upgrades[weapon] = 1;
  }
  compare(a, b, { kind: 'tick', input: { x: 0, y: 0, dash: false } }); assert(b.events.includes('enemy-hit'));
}
console.info({ event: 'audio.differential_passed', base: revision, actions, compared: 'complete World excluding transient events, every checksum, old event order' });
