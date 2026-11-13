import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createWorld, dispatch, checksum, finalChecksum, finishRecording, startRecording, prepareReplay, verifyReplay, replay, parseActionBuffer, HZ, VERSION } from '../dist/core.js';
import { DESERT_CONTEXT, stageRules } from '../dist/stage-rules.js';
import { STAGE_ORDER } from '../dist/stage-contract.js';
import { dictionary } from '../dist/i18n.js';
import { loadCoreRevision } from '../scripts/load-core-revision.mjs';
const idle = { kind: 'tick', input: { x: 0, y: 0, dash: false } };
const request = seed => ({ ...DESERT_CONTEXT, seed });
const fullTerminal = fullTerminalMode(process.env.LUNAR_FULL_TERMINAL, process.versions);
const fixtureGzip = readFileSync(new URL('../docs/evidence/desert34/baseline-actions.json.gz', import.meta.url));
const captured = JSON.parse(gunzipSync(fixtureGzip));
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
if (fullTerminal) fullTerminalInput(captured, fixtureGzip);
const terminal = createWorld(request(sample.seed));
for (const action of sample.recording.actions) dispatch(terminal, action);
const recording = finishRecording(terminal, sample.recording.actions);
const rejects = (fn, code) => assert.throws(fn, error => error.code === code);
test('a desert world retains its validated stage and seed identity', () => {
  const world = createWorld(request(0));
  assert.equal(world.seed, 0); assert.equal(world.rng, 1);
  assert.deepEqual(world.context, DESERT_CONTEXT); assert(Object.isFrozen(world.context));
  assert.throws(() => { world.context.stageId = 'rainforest'; }, TypeError);
  assert.throws(() => { world.context = { ...DESERT_CONTEXT }; }, TypeError);
  assert.throws(() => { world.seed = 42; }, TypeError);
  for (const stageId of [...STAGE_ORDER.slice(2), 'unknown', null]) rejects(() => createWorld({ ...request(42), stageId }), 'unavailable-stage');
  for (const rulesVersion of ['desert-base-2', 'rainforest-1']) rejects(() => createWorld({ ...request(42), rulesVersion }), 'incompatible-rules');
  rejects(() => createWorld({ ...request(42), stageId: 'rainforest' }), 'incompatible-rules');
  for (const seed of [-1, 4294967296, .5, NaN, Infinity, '42', null]) rejects(() => createWorld(request(seed)), 'invalid-data');
  for (const input of [null, 42, {}, { ...request(42), rules: { durationTicks: 1 } }]) rejects(() => createWorld(input), 'invalid-data');
});
test('the real desert run matches the frozen engine on this platform at every captured action', t => {
  assert.equal(terminal.phase.kind, 'won'); assert.equal(terminal.tick, 180 * HZ);
  const before = baseline.createWorld(sample.seed), world = createWorld(request(sample.seed)), bossTicks = [];
  assertSameBattle(before, world, 'initial state');
  const prefix = fullTerminal ? { firstAction: null, initial: JSON.parse(JSON.stringify(world)), afterFirst: null, states: [[world.tick, sha256(JSON.stringify(world))]] } : null;
  for (const [index, action] of sample.recording.actions.entries()) {
    baseline.dispatch(before, action); dispatch(world, action);
    assertSameBattle(before, world, `captured action ${index}`);
    if (prefix && index < 64) {
      prefix.states.push([world.tick, sha256(JSON.stringify(world))]);
      if (index === 0) {
        prefix.firstAction = JSON.parse(JSON.stringify(action));
        prefix.afterFirst = JSON.parse(JSON.stringify(world));
      }
    }
    if (world.events.includes('boss')) bossTicks.push(world.tick);
  }
  assert.deepEqual(world, terminal);
  assert.equal(world.phase.kind, before.phase.kind); assert.equal(world.tick, before.tick);
  assert.deepEqual(bossTicks, [140 * HZ]);
  assert.equal(stageRules(world.context).durationTicks, world.tick);
  if (fullTerminal) {
    const buffer = parseActionBuffer({ version: VERSION, ...DESERT_CONTEXT, seed: sample.seed, actions: sample.recording.actions });
    assert.equal(sha256(JSON.stringify(buffer.actions)), sample.actionsSha256, 'full terminal parsed actions identity mismatch');
    assert.equal(prefix.states.length, 65, 'full terminal prefix state count');
    assert.equal(prefix.initial.tick, 0, 'full terminal initial tick');
    assert.equal(prefix.afterFirst.tick, 1, 'full terminal afterFirst tick');
    assert.deepEqual(prefix.firstAction, sample.recording.actions[0], 'full terminal firstAction identity');
    assert.deepEqual(prefix.states[0], [prefix.initial.tick, sha256(JSON.stringify(prefix.initial))], 'full terminal initial fingerprint');
    assert.deepEqual(prefix.states[1], [prefix.afterFirst.tick, sha256(JSON.stringify(prefix.afterFirst))], 'full terminal afterFirst fingerprint');
    t.diagnostic(terminalJson({
      event: 'lunar.full-terminal-pinned',
      runtime: { node: process.versions.node, v8: process.versions.v8, platform: process.platform, arch: process.arch },
      modules: Object.fromEntries(['core', 'stage-rules', 'stage-contract'].map(name => [`dist/${name}.js`, sha256(readFileSync(new URL(`../dist/${name}.js`, import.meta.url)))])),
      input: { baseline: captured.baseline, gzipSha256: sha256(fixtureGzip), actionsSha256: sample.actionsSha256, bufferSha256: sha256(JSON.stringify(buffer)), seed: sample.seed, strategy: sample.strategy, preference: sample.preference, actionCount: buffer.actions.length, tickCount: 10800, chooseCount: 11 },
      context: { version: buffer.version, stageId: buffer.stageId, rulesVersion: buffer.rulesVersion },
      terminal: { phase: world.phase.kind, tick: world.tick, battleChecksum: checksum(world), finalChecksum: finalChecksum(world) },
      prefix
    }));
  }
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
    ...[...STAGE_ORDER.slice(2), 'unknown'].map(stageId => [{ ...recording, stageId }, 'unavailable-stage']),
    ...['wrong', 'rainforest-1'].map(rulesVersion => [{ ...recording, rulesVersion }, 'incompatible-rules']),
    [{ ...recording, stageId: 'rainforest' }, 'incompatible-rules'],
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

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function fullTerminalMode(mode, versions) {
  assert(mode === undefined || mode === '1', 'full terminal mode must be unset or 1');
  if (mode === undefined) return false;
  assert.equal(versions.node, '24.21.0', 'full terminal requires Node 24.21.0');
  assert.equal(versions.v8, '13.6.233.17-node.53', 'full terminal requires V8 13.6.233.17-node.53');
  return true;
}
function fullTerminalInput(fixture, gzip) {
  assert.equal(sha256(gzip), 'd21bf773c29a32bec82ca34af79bae655626f2fea446df7609e97a2805a9caf8', 'full terminal gzip identity mismatch');
  assert.equal(fixture.baseline, 'bde5936d13d6890a72d24d36bb0039e48e36df44', 'full terminal baseline identity mismatch');
  const matches = fixture.cases.filter(row => row.seed === 42 && row.strategy === 'skilled' && row.preference === 'attack');
  assert.equal(matches.length, 1, 'full terminal requires one seed42 skilled attack case');
  const row = matches[0], actions = row.recording.actions;
  assert.equal(row.recording.seed, 42, 'full terminal recording seed mismatch');
  assert.deepEqual([row.actionCount, actions.length, actions.filter(action => action.kind === 'tick').length, actions.filter(action => action.kind === 'choose').length], [10811, 10811, 10800, 11], 'full terminal action counts mismatch');
  assert.equal(sha256(JSON.stringify(actions)), 'ffd6e8dbdccc4aa7d0ad82df3d1ad2147c5d051184c88953025438d41306bef4', 'full terminal frozen actions identity mismatch');
  assert.equal(row.actionsSha256, sha256(JSON.stringify(actions)), 'full terminal declared actions identity mismatch');
  return row;
}
function terminalJson(value) {
  const json = JSON.stringify(value);
  assert(Buffer.byteLength(json, 'utf8') <= 8192, 'full terminal record exceeds 8192 UTF8 bytes');
  return json;
}
test('full terminal diagnostic rejects invalid mode and synthetic runtime identities', () => {
  assert.equal(fullTerminalMode(undefined, { node: 'other', v8: 'other' }), false);
  assert.equal(fullTerminalMode('1', { node: '24.21.0', v8: '13.6.233.17-node.53' }), true);
  for (const mode of ['', '0', 'true']) assert.throws(() => fullTerminalMode(mode, process.versions), /full terminal mode must be unset or 1/);
  assert.throws(() => fullTerminalMode('1', { node: '24.22.2', v8: '13.6.233.17-node.53' }), /full terminal requires Node 24.21.0/);
  assert.throws(() => fullTerminalMode('1', { node: '24.21.0', v8: 'different' }), /full terminal requires V8 13.6.233.17-node.53/);
});
test('full terminal diagnostic rejects changed frozen input even with a recomputed declaration', () => {
  const gzip = readFileSync(new URL('../docs/evidence/desert34/baseline-actions.json.gz', import.meta.url));
  const fixture = () => ({ baseline: captured.baseline, cases: [structuredClone(sample)] });
  assert.equal(fullTerminalInput(captured, gzip), sample);
  assert.throws(() => fullTerminalInput(captured, Buffer.from('changed')), /full terminal gzip identity mismatch/);
  const baselineChanged = fixture(); baselineChanged.baseline = '0'.repeat(40);
  assert.throws(() => fullTerminalInput(baselineChanged, gzip), /full terminal baseline identity mismatch/);
  const duplicate = fixture(); duplicate.cases.push(duplicate.cases[0]);
  assert.throws(() => fullTerminalInput(duplicate, gzip), /full terminal requires one seed42 skilled attack case/);
  assert.throws(() => fullTerminalInput({ ...fixture(), cases: [] }, gzip), /full terminal requires one seed42 skilled attack case/);
  const seedChanged = fixture(); seedChanged.cases[0].recording.seed = 43;
  assert.throws(() => fullTerminalInput(seedChanged, gzip), /full terminal recording seed mismatch/);
  const countChanged = fixture(); countChanged.cases[0].actionCount--;
  assert.throws(() => fullTerminalInput(countChanged, gzip), /full terminal action counts mismatch/);
  const kindChanged = fixture(); kindChanged.cases[0].recording.actions[0] = { kind: 'pause' };
  assert.throws(() => fullTerminalInput(kindChanged, gzip), /full terminal action counts mismatch/);
  const declaredChanged = fixture(); declaredChanged.cases[0].actionsSha256 = '0'.repeat(64);
  assert.throws(() => fullTerminalInput(declaredChanged, gzip), /full terminal declared actions identity mismatch/);
  const actionChanged = fixture(); actionChanged.cases[0].recording.actions[0].input.x += .125;
  actionChanged.cases[0].actionsSha256 = createHash('sha256').update(JSON.stringify(actionChanged.cases[0].recording.actions)).digest('hex');
  assert.throws(() => fullTerminalInput(actionChanged, gzip), /full terminal frozen actions identity mismatch/);
});
test('full terminal diagnostic enforces the UTF8 byte boundary before emission', () => {
  assert.equal(Buffer.byteLength(terminalJson('a'.repeat(8190)), 'utf8'), 8192);
  assert.throws(() => terminalJson('a'.repeat(8191)), /full terminal record exceeds 8192 UTF8 bytes/);
  assert.throws(() => terminalJson('月'.repeat(2731)), /full terminal record exceeds 8192 UTF8 bytes/);
});

test('the full terminal subprocess exposes the frozen first64 states or rejects its actual runtime', () => {
  const env = { ...process.env, LUNAR_FULL_TERMINAL: '1' };
  delete env.NODE_TEST_CONTEXT;
  const child = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern=^the real desert run matches the frozen engine on this platform at every captured action$', fileURLToPath(import.meta.url)], { env, encoding: 'utf8' });
  assert.ifError(child.error);
  assert.equal(child.signal, null);
  const records = child.stdout.split('\n').filter(line => line.startsWith('# {')).map(line => line.slice(2)).filter(line => JSON.parse(line).event === 'lunar.full-terminal-pinned');
  if (process.versions.node !== '24.21.0' || process.versions.v8 !== '13.6.233.17-node.53') {
    assert.notEqual(child.status, 0);
    assert.equal(records.length, 0);
    assert.match(child.stdout + child.stderr, process.versions.node !== '24.21.0' ? /full terminal requires Node 24\.21\.0/ : /full terminal requires V8 13\.6\.233\.17-node\.53/);
    return;
  }
  assert.equal(child.status, 0, child.stdout + child.stderr);
  assert.equal(records.length, 1, 'one full terminal event');
  assert(Buffer.byteLength(records[0], 'utf8') <= 8192);
  const record = JSON.parse(records[0]);
  assert(record.prefix, 'full terminal prefix is missing');
  assert.deepEqual(Object.keys(record), ['event', 'runtime', 'modules', 'input', 'context', 'terminal', 'prefix']);
  const world = createWorld(request(42));
  const initial = JSON.parse(JSON.stringify(world));
  const states = [[world.tick, sha256(JSON.stringify(world))]];
  let afterFirst;
  for (const [index, action] of sample.recording.actions.slice(0, 64).entries()) {
    dispatch(world, action);
    states.push([world.tick, sha256(JSON.stringify(world))]);
    if (index === 0) afterFirst = JSON.parse(JSON.stringify(world));
  }
  assert.deepEqual(record.prefix.firstAction, sample.recording.actions[0], 'full terminal firstAction');
  assert.deepEqual(record.prefix.initial, initial, 'full terminal initial');
  assert.deepEqual(record.prefix.afterFirst, afterFirst, 'full terminal afterFirst');
  assert.deepEqual(record.prefix.states, states, 'full terminal first64 states');
});
