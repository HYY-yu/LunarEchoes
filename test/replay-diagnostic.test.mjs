import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { checksum, createWorld, dispatch, replay } from '../dist/core.js';
import { captureTrace, compareTraces } from '../scripts/replay-diagnostic.mjs';

const prefix = JSON.parse(await readFile(new URL('../scripts/fixtures/checksum-prefix.json', import.meta.url), 'utf8'));

test('the fixed diagnostic prefix uses real dispatch and repeated captures match', async () => {
  const first = await captureTrace(prefix), second = await captureTrace(prefix);
  assert.equal(first.frames.length, 91);
  const world = createWorld({ stageId: prefix.stageId, rulesVersion: prefix.rulesVersion, seed: prefix.seed }); for (const action of prefix.actions) dispatch(world, action);
  assert.equal(first.frames.at(-1).checksum, checksum(world));
  assert.throws(() => replay(prefix), error => error.code === 'invalid-data');
  assert.ok(first.frames[45].world.enemies.length > 0);
  assert.ok(first.frames.some(frame => frame.world.shots.length > 0));
  assert.equal(compareTraces(first, second).result, 'same');
});

test('comparison identifies the first changed state field and its saved double bits', async () => {
  const first = await captureTrace(prefix), changed = structuredClone(first);
  changed.frames[46].world.enemies[0].x += .125;
  changed.frames[46].checksum = checksum(changed.frames[46].world);
  const result = compareTraces(first, changed);
  assert.equal(result.result, 'different');
  assert.equal(result.actionIndex, 46);
  assert.deepEqual(result.ticks, [46, 46]);
  assert.equal(result.path, '$.enemies[0].x');
  assert.notEqual(result.leftFloat64, result.rightFloat64);
  assert.equal(result.right - result.left, .125);
});

test('comparison rejects mismatched core, actions, Node and corrupted frames', async () => {
  const first = await captureTrace(prefix);
  const otherCore = structuredClone(first); otherCore.coreSha256 = '0'.repeat(64);
  assert.throws(() => compareTraces(first, otherCore), /different core builds/);
  const otherRules = structuredClone(first); otherRules.rulesSha256 = '0'.repeat(64);
  assert.throws(() => compareTraces(first, otherRules), /different rules builds/);
  const otherInput = structuredClone(first); otherInput.recording.actions[0].input.x = 0;
  otherInput.recordingSha256 = createHash('sha256').update(JSON.stringify(otherInput.recording)).digest('hex');
  assert.throws(() => compareTraces(first, otherInput), /different action recordings/);
  const otherNode = structuredClone(first); otherNode.environment.node = '24.0.0';
  assert.throws(() => compareTraces(first, otherNode), /different Node versions/);
  const broken = structuredClone(first); broken.frames[45].world.player.x += 1;
  assert.throws(() => compareTraces(first, broken), /checksum is invalid at 45/);
  const missing = structuredClone(first); missing.frames.pop();
  assert.throws(() => compareTraces(first, missing), /frame count/);
});

test('comparison rejects malformed World structures even when their checksum is recomputed', async () => {
  const trace = await captureTrace(prefix);
  const mutations = [
    world => { delete world.player; },
    world => { world.player.x = '750'; },
    world => { delete world.upgrades.magnet; },
    world => { world.shots = {}; },
    world => { world.enemies[0].kind = 'unknown'; },
    world => { world.shots[0].hostile = 0; },
    world => { world.crystals = [{ x: 1, y: 2, value: '3' }]; },
    world => { world.effects = [{ x: 1, y: 2, kind: 'unknown', life: 3, size: 4 }]; },
    world => { world.phase = { kind: 'paused', previous: 'lost' }; },
    world => { world.phase = { kind: 'upgrading', offers: ['unknown'] }; },
    world => { world.bossKilled = 'false'; },
    world => { world.events = ['shot']; },
    world => { world.extra = 1; },
    world => { world.context.stageId = 'lunar-echoes'; },
    world => { world.context.rulesVersion = 'wrong'; },
    world => { world.context.extra = 1; },
    world => { world.seed = 42; }
  ];
  for (const mutate of mutations) {
    const broken = structuredClone(trace);
    mutate(broken.frames[46].world);
    broken.frames[46].checksum = checksum(broken.frames[46].world);
    assert.throws(() => compareTraces(broken, broken), /Invalid World/);
  }
  const directory = await mkdtemp(join(tmpdir(), 'lunar-diagnostic-schema-'));
  try {
    const broken = structuredClone(trace);
    delete broken.frames[1].world.player;
    broken.frames[1].checksum = checksum(broken.frames[1].world);
    const file = join(directory, 'missing-player.json');
    await writeFile(file, JSON.stringify(broken));
    const result = spawnSync(process.execPath, ['scripts/replay-diagnostic.mjs', 'compare', file, file], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid World/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('valid state differences remain diagnosable without matching local values or entity counts', async () => {
  const first = await captureTrace(prefix), changed = structuredClone(first);
  changed.frames[46].world.player.hp -= .125;
  changed.frames[46].world.enemies.push({ ...changed.frames[46].world.enemies[0], id: 99 });
  changed.frames[46].checksum = checksum(changed.frames[46].world);
  const result = compareTraces(first, changed);
  assert.equal(result.result, 'different');
  assert.equal(result.path, '$.player.hp');
  const extraEnemy = structuredClone(first);
  extraEnemy.frames[46].world.enemies.push({ ...extraEnemy.frames[46].world.enemies[0], id: 99 });
  extraEnemy.frames[46].checksum = checksum(extraEnemy.frames[46].world);
  assert.equal(compareTraces(first, extraEnemy).path, '$.enemies.[keys]');
  for (const phase of [{ kind: 'upgrading', offers: ['pulse', 'magnet'] }, { kind: 'paused', previous: 'running' }, { kind: 'won' }, { kind: 'lost' }]) {
    const otherPhase = structuredClone(first);
    otherPhase.frames[46].world.phase = phase;
    otherPhase.frames[46].world.tick = 45;
    otherPhase.frames[46].checksum = checksum(otherPhase.frames[46].world);
    assert.equal(compareTraces(first, otherPhase).path, '$.tick');
  }
});

test('CLI fails on missing files, malformed arguments and the wrong required Node', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lunar-diagnostic-test-'));
  try {
    for (const args of [[], ['compare', join(directory, 'missing.json'), join(directory, 'other.json')], ['capture', join(directory, 'trace.json'), '0.0.0']]) {
      const result = spawnSync(process.execPath, ['scripts/replay-diagnostic.mjs', ...args], { encoding: 'utf8' });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /replay.diagnostic.failed/);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
