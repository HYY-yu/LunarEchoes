import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createWorld, dispatch, checksum, finalChecksum, finishRecording, startRecording, prepareReplay, verifyReplay, replay, parseActionBuffer, HZ } from '../dist/core.js';
import { DESERT_CONTEXT, stageRules } from '../dist/stage-rules.js';
import { STAGE_ORDER } from '../dist/stage-contract.js';
import { dictionary } from '../dist/i18n.js';
import { loadCoreRevision } from '../scripts/load-core-revision.mjs';
const idle = { kind: 'tick', input: { x: 0, y: 0, dash: false } };
const request = seed => ({ ...DESERT_CONTEXT, seed });
const captured = JSON.parse(gunzipSync(readFileSync(new URL('../docs/evidence/desert34/baseline-actions.json.gz', import.meta.url))));
assert.equal(captured.baseline, 'bde5936d13d6890a72d24d36bb0039e48e36df44');
const { core: baseline } = await loadCoreRevision(captured.baseline);
function assertSameBattle(before, after, label) {
  const { context, ...battle } = after;
  assert.deepEqual(battle, before, label);
  assert.equal(JSON.stringify(battle), JSON.stringify(before), label);
  assert.equal(JSON.stringify({ ...battle, events: [] }), JSON.stringify({ ...before, events: [] }), label);
  assert.equal(checksum(after), baseline.checksum(before), label);
}
const sample = captured.cases.find(row => row.seed === 42 && row.strategy === 'skilled' && row.preference === 'attack');
const terminal = createWorld(request(sample.seed));
for (const action of sample.recording.actions) dispatch(terminal, action);
const recording = finishRecording(terminal, sample.recording.actions);
const rejects = (fn, code) => assert.throws(fn, error => error.code === code);
test('only the implemented desert context builds a world and its identity cannot drift', () => {
  const world = createWorld(request(0));
  assert.equal(world.seed, 0); assert.equal(world.rng, 1);
  assert.deepEqual(world.context, DESERT_CONTEXT); assert(Object.isFrozen(world.context));
  assert.throws(() => { world.context.stageId = 'rainforest'; }, TypeError);
  assert.throws(() => { world.context = { ...DESERT_CONTEXT }; }, TypeError);
  assert.throws(() => { world.seed = 42; }, TypeError);
  for (const stageId of [...STAGE_ORDER.slice(1), 'unknown', null]) rejects(() => createWorld({ ...request(42), stageId }), 'unavailable-stage');
  rejects(() => createWorld({ ...request(42), rulesVersion: 'desert-base-2' }), 'incompatible-rules');
  for (const seed of [-1, 4294967296, .5, NaN, Infinity, '42', null]) rejects(() => createWorld(request(seed)), 'invalid-data');
  for (const input of [null, 42, {}, { ...request(42), rules: { durationTicks: 1 } }]) rejects(() => createWorld(input), 'invalid-data');
});
test('the real desert run matches the frozen engine on this platform at every captured action', () => {
  assert.equal(terminal.phase.kind, 'won'); assert.equal(terminal.tick, 180 * HZ);
  const before = baseline.createWorld(sample.seed), world = createWorld(request(sample.seed)), bossTicks = [];
  assertSameBattle(before, world, 'initial state');
  for (const [index, action] of sample.recording.actions.entries()) {
    baseline.dispatch(before, action); dispatch(world, action);
    assertSameBattle(before, world, `captured action ${index}`);
    if (world.events.includes('boss')) bossTicks.push(world.tick);
  }
  assert.deepEqual(world, terminal);
  assert.equal(world.phase.kind, before.phase.kind); assert.equal(world.tick, before.tick);
  assert.deepEqual(bossTicks, [140 * HZ]);
  assert.equal(stageRules(world.context).durationTicks, world.tick);
});
test('the same-platform regression oracle rejects battle mutations and serialization drift', () => {
  const before = baseline.createWorld(42), after = createWorld(request(42));
  baseline.dispatch(before, idle); dispatch(after, idle);
  assertSameBattle(before, after, 'unchanged engine');
  for (const mutate of [
    world => { world.player.x += .125; },
    world => { world.player.hp -= 10; },
    world => { world.rng ^= 1; },
    world => { world.events.push('hit'); },
    world => { world.tick++; },
    world => { const seed = world.seed; delete world.seed; world.seed = seed; }
  ]) {
    const changed = structuredClone(after); mutate(changed);
    assert.throws(() => assertSameBattle(before, changed, 'mutated engine'), assert.AssertionError);
  }
});
test('actual movement and spawning consume the controlled arena and Boss may exceed the ordinary enemy cap', () => {
  const world = createWorld(request(1)), arena = stageRules(world.context).arenaSize;
  assert.equal(world.player.x, arena / 2);
  world.player.x = arena - 36; dispatch(world, { kind: 'tick', input: { x: 9, y: 0, dash: true } });
  assert.equal(world.player.x, arena - 36);
  world.tick = stageRules(world.context).bossSpawnTick - 1; world.spawnCooldown = 0; world.fireCooldown = 1000;
  world.enemies = Array.from({ length: 180 }, (_, id) => ({ id, kind: 'crawler', x: 50, y: 50, hp: 1000, maxHp: 1000, radius: 11, attack: 999, flash: 0 }));
  dispatch(world, idle);
  assert.equal(world.enemies.length, 181); assert.equal(world.enemies.filter(enemy => enemy.kind === 'boss').length, 1);
  dispatch(world, idle); assert.equal(world.enemies.filter(enemy => enemy.kind === 'boss').length, 1);
  assert(world.enemies.every(enemy => enemy.x >= 36 && enemy.x <= arena - 36 && enemy.y >= 36 && enemy.y <= arena - 36));
});
test('full recordings have six fields and replay twice through the shared validated factory', () => {
  assert.deepEqual(Object.keys(recording), ['version', 'stageId', 'rulesVersion', 'seed', 'actions', 'finalChecksum']);
  assert.equal(recording.version, 'lunar-2'); assert.equal(recording.actions.length, sample.actionCount);
  for (let repeat = 0; repeat < 2; repeat++) assert.deepEqual(replay(recording), terminal);
  const browser = prepareReplay(recording);
  assert.equal(browser.world.tick, 0);
  for (const action of browser.recording.actions) dispatch(browser.world, action);
  verifyReplay(browser.world, browser.recording, browser.recording.actions.length);
  assert.deepEqual(browser.world, terminal);
  rejects(() => verifyReplay(browser.world, browser.recording, 0), 'incomplete-replay');
});
test('context final hash uses the approved fixed array and original event-free battle state', () => {
  const hash = value => { let n = 2166136261; for (const c of JSON.stringify(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0).toString(16).padStart(8, '0'); };
  assert.equal(recording.finalChecksum, hash(['lunar-2', 'desert-base', 'desert-base-1', 42, checksum(terminal)]));
  const withoutEvents = { ...terminal, events: [] };
  assert.equal(finalChecksum(withoutEvents), recording.finalChecksum);
  assert.notEqual(hash(['lunar-2', 'rainforest', 'desert-base-1', 42, checksum(terminal)]), recording.finalChecksum);
  assert.notEqual(hash(['lunar-2', 'desert-base', 'wrong', 42, checksum(terminal)]), recording.finalChecksum);
});
test('pending buffers cannot become terminal recordings and copies isolate action mutation', () => {
  const world = createWorld(request(42)), buffer = startRecording(world);
  buffer.actions.push({ kind: 'tick', input: { x: 9, y: -2, dash: false } });
  rejects(() => finishRecording(world, buffer.actions), 'nonterminal-replay');
  rejects(() => prepareReplay(buffer), 'invalid-data');
  const parsed = parseActionBuffer(buffer); buffer.actions[0].input.x = 0;
  assert.equal(parsed.actions[0].input.x, 9);
  const original = structuredClone(recording), prepared = prepareReplay(original);
  original.actions[0].input.x = 999; original.actions.length = 0;
  assert.equal(prepared.recording.actions.length, sample.actionCount);
  assert(Object.isFrozen(prepared.recording.actions[0].input));
});
test('all structure and compatibility errors reject before the current world is replaced', () => {
  const previous = createWorld(request(101)); let current = previous;
  const attempt = input => { const next = prepareReplay(input); current = next.world; };
  const invalid = [
    [null, 'invalid-data'], [{ ...recording, extra: true }, 'invalid-data'],
    ...['lunar-1', 'lunar-armor-1', 'unknown'].map(version => [{ ...recording, version }, 'incompatible-version']),
    ...[...STAGE_ORDER.slice(1), 'unknown'].map(stageId => [{ ...recording, stageId }, 'unavailable-stage']),
    [{ ...recording, rulesVersion: 'wrong' }, 'incompatible-rules'],
    ...[-1, 4294967296, NaN, Infinity, 1.5, '42'].map(seed => [{ ...recording, seed }, 'invalid-data']),
    ...[null, {}, [null], Array(1), [{ kind: 'bad' }], [{ kind: 'choose', upgrade: 'bad' }], [{ kind: 'pause', extra: 1 }], [{ kind: 'tick', input: { x: NaN, y: 0, dash: false } }], [{ kind: 'tick', input: { x: 0, y: Infinity, dash: false } }], [{ kind: 'tick', input: { x: 0, y: 0, dash: 1 } }]].map(actions => [{ ...recording, actions }, 'invalid-data']),
    [{ ...recording, finalChecksum: null }, 'invalid-data'], [{ ...recording, finalChecksum: 'wrong' }, 'invalid-data']
  ];
  for (const [input, code] of invalid) { rejects(() => attempt(input), code); assert.equal(current, previous); rejects(() => replay(input), code); }
});
test('valid out-of-range vectors keep normalizeInput semantics and altered battle actions fail final verification', () => {
  const wide = parseActionBuffer({ ...startRecording(createWorld(request(42))), actions: [{ kind: 'tick', input: { x: 25, y: -30, dash: true } }] });
  const a = createWorld(request(42)), b = createWorld(request(42));
  dispatch(a, wide.actions[0]); dispatch(b, { kind: 'tick', input: { x: 1, y: -1, dash: true } }); assert.deepEqual(a, b);
  const altered = structuredClone(recording), lastTick = altered.actions.findLast(action => action.kind === 'tick');
  lastTick.input.x = lastTick.input.x > 0 ? -1 : 1;
  rejects(() => replay(altered), 'checksum-mismatch');
  rejects(() => replay({ ...recording, finalChecksum: '00000000' }), 'checksum-mismatch');
  rejects(() => replay({ ...recording, actions: [] }), 'nonterminal-replay');
});
test('fresh world and recording reset every build field after a real terminal run', () => {
  const fresh = createWorld(request(123)); const buffer = startRecording(fresh);
  assert.equal(fresh.tick, 0); assert.equal(fresh.level, 1); assert.equal(fresh.xp, 0); assert.equal(fresh.player.hp, 100); assert.equal(fresh.player.maxHp, 100);
  assert.deepEqual(fresh.upgrades, { pulse: 1, orbit: 0, nova: 0, boots: 0, hull: 0, magnet: 0 });
  assert.deepEqual(buffer.actions, []); assert.equal(buffer.seed, 123); assert.equal(terminal.seed, 42);
});
test('both languages distinguish compatibility failures and unfinished desert content', () => {
  for (const language of ['zh', 'en']) {
    const text = dictionary(language);
    for (const key of ['replayVersion', 'replayStage', 'replayRules', 'replayInvalid', 'replayFailed', 'pendingContent']) assert(text[key].length > 5);
    assert.equal(new Set([text.replayVersion, text.replayStage, text.replayRules, text.replayInvalid]).size, 4);
    assert(!/MARE|静海|25°/.test(text.mission));
  }
});
