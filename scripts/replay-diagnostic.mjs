import { resolveStage } from '../dist/stage-rules.js';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createWorld, dispatch, checksum, parseActionBuffer, UPGRADE_ORDER } from '../dist/core.js';

const digest = value => createHash('sha256').update(value).digest('hex');
const inputDigest = recording => digest(JSON.stringify(recording));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fixture = new URL('./fixtures/checksum-prefix.json', import.meta.url);

function numericRecord(value, path, numbers, other = []) {
  const keys = [...numbers, ...other];
  if (!object(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) throw new Error(`Invalid World structure at ${path}`);
  for (const key of numbers) if (!Number.isFinite(value[key])) throw new Error(`Invalid World number at ${path}.${key}`);
}

function variant(value, choices, path) {
  if (!choices.includes(value)) throw new Error(`Invalid World variant at ${path}`);
}

function worldInput(world) {
  numericRecord(world, '$', ['seed', 'rng', 'tick', 'nextId', 'level', 'xp', 'threshold', 'kills', 'fireCooldown', 'novaCooldown', 'spawnCooldown'], ['context', 'phase', 'player', 'enemies', 'shots', 'crystals', 'effects', 'events', 'upgrades', 'bossSpawned', 'bossKilled']);
  numericRecord(world.context, '$.context', [], ['stageId', 'rulesVersion']);
  try { resolveStage(world.context.stageId, world.context.rulesVersion); } catch { throw new Error('Invalid World context'); }
  for (const key of ['bossSpawned', 'bossKilled']) if (typeof world[key] !== 'boolean') throw new Error(`Invalid World boolean at $.${key}`);
  numericRecord(world.player, '$.player', ['x', 'y', 'hp', 'maxHp', 'invincible', 'dashCooldown', 'dashTicks', 'dx', 'dy']);
  const upgrades = UPGRADE_ORDER;
  numericRecord(world.upgrades, '$.upgrades', upgrades);
  if (!object(world.phase)) throw new Error('Invalid World phase');
  variant(world.phase.kind, ['running', 'upgrading', 'paused', 'won', 'lost'], '$.phase.kind');
  const phaseKeys = world.phase.kind === 'upgrading' ? ['kind', 'offers'] : world.phase.kind === 'paused' ? ['kind', 'previous'] : ['kind'];
  numericRecord(world.phase, '$.phase', [], phaseKeys);
  if (world.phase.kind === 'paused') variant(world.phase.previous, ['running'], '$.phase.previous');
  if (world.phase.kind === 'upgrading') {
    if (!Array.isArray(world.phase.offers)) throw new Error('Invalid World offers');
    for (const offer of world.phase.offers) variant(offer, upgrades, '$.phase.offers');
  }
  for (const key of ['enemies', 'shots', 'crystals', 'effects', 'events']) if (!Array.isArray(world[key])) throw new Error(`Invalid World array at $.${key}`);
  if (world.events.length) throw new Error('Invalid World events: diagnostic snapshots require an empty array');
  for (const enemy of world.enemies) {
    numericRecord(enemy, '$.enemies[]', ['id', 'x', 'y', 'hp', 'maxHp', 'radius', 'attack', 'flash'], ['kind']);
    variant(enemy.kind, ['crawler', 'drone', 'sentry', 'boss'], '$.enemies[].kind');
  }
  for (const shot of world.shots) {
    numericRecord(shot, '$.shots[]', ['x', 'y', 'vx', 'vy', 'life', 'damage'], ['hostile']);
    if (typeof shot.hostile !== 'boolean') throw new Error('Invalid World boolean at $.shots[].hostile');
  }
  for (const crystal of world.crystals) numericRecord(crystal, '$.crystals[]', ['x', 'y', 'value']);
  for (const effect of world.effects) {
    numericRecord(effect, '$.effects[]', ['x', 'y', 'life', 'size'], ['kind']);
    variant(effect.kind, ['hit', 'kill', 'nova', 'dash'], '$.effects[].kind');
  }
}

function recordingInput(value) {
  value = parseActionBuffer(value);
  if (!Array.isArray(value.actions) || value.actions.length < 1 || value.actions.length > 90) throw new Error('Diagnostic prefix must contain 1 to 90 actions');
  for (const action of value.actions) {
    if (!object(action) || action.kind !== 'tick' || !object(action.input)) throw new Error('Diagnostic prefix supports only tick actions');
    const { x, y, dash } = action.input;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1 || Math.abs(y) > 1 || typeof dash !== 'boolean') throw new Error('Invalid diagnostic tick input');
  }
  return value;
}

export async function captureTrace(input) {
  const recording = recordingInput(input);
  const world = createWorld({ stageId: recording.stageId, rulesVersion: recording.rulesVersion, seed: recording.seed });
  const frames = [];
  function snapshot(actionIndex) {
    frames.push({ actionIndex, checksum: checksum(world), world: JSON.parse(JSON.stringify({ ...world, events: [] })) });
  }
  snapshot(0);
  for (const [index, action] of recording.actions.entries()) { dispatch(world, action); snapshot(index + 1); }
  return {
    format: 'checksum-prefix-trace-2',
    environment: { node: process.versions.node, v8: process.versions.v8, platform: process.platform, arch: process.arch },
    coreSha256: digest(await readFile(new URL('../dist/core.js', import.meta.url))),
    rulesSha256: digest(await readFile(new URL('../dist/stage-rules.js', import.meta.url))),
    recordingSha256: inputDigest(recording), recording, frames
  };
}

function traceInput(value) {
  if (!object(value) || value.format !== 'checksum-prefix-trace-2' || !object(value.environment)) throw new Error('Invalid diagnostic trace');
  for (const key of ['node', 'v8', 'platform', 'arch']) if (typeof value.environment[key] !== 'string' || !value.environment[key]) throw new Error(`Missing trace environment ${key}`);
  if (!/^[0-9a-f]{64}$/.test(value.coreSha256)) throw new Error('Invalid core digest');
  if (!/^[0-9a-f]{64}$/.test(value.rulesSha256)) throw new Error('Invalid rules digest');
  const recording = recordingInput(value.recording);
  if (inputDigest(recording) !== value.recordingSha256) throw new Error('Trace recording digest is invalid');
  if (!Array.isArray(value.frames) || value.frames.length !== recording.actions.length + 1) throw new Error('Trace frame count is invalid');
  for (const [index, frame] of value.frames.entries()) {
    if (!object(frame) || frame.actionIndex !== index || !object(frame.world) || !Number.isInteger(frame.world.tick) || frame.world.tick < 0) throw new Error(`Invalid trace frame ${index}`);
    worldInput(frame.world);
    if (frame.world.context.stageId !== recording.stageId || frame.world.context.rulesVersion !== recording.rulesVersion || frame.world.seed !== recording.seed) throw new Error(`Invalid World recording context at ${index}`);
    if (checksum(frame.world) !== frame.checksum) throw new Error(`Trace frame checksum is invalid at ${index}`);
  }
  return value;
}

function difference(left, right, path = '$') {
  if (Object.is(left, right)) return null;
  if (object(left) && object(right) || Array.isArray(left) && Array.isArray(right)) {
    const a = Object.keys(left), b = Object.keys(right);
    if (JSON.stringify(a) !== JSON.stringify(b)) return { path: `${path}.[keys]`, left: a, right: b };
    for (const key of a) {
      const result = difference(left[key], right[key], Array.isArray(left) ? `${path}[${key}]` : `${path}.${key}`);
      if (result) return result;
    }
    return null;
  }
  const result = { path, left, right };
  if (typeof left === 'number' && typeof right === 'number') {
    const bits = number => { const bytes = Buffer.alloc(8); bytes.writeDoubleBE(number); return bytes.toString('hex'); };
    return { ...result, leftFloat64: bits(left), rightFloat64: bits(right) };
  }
  return result;
}

export function compareTraces(leftInput, rightInput) {
  const left = traceInput(leftInput), right = traceInput(rightInput);
  if (left.coreSha256 !== right.coreSha256) throw new Error('Cannot compare different core builds');
  if (left.rulesSha256 !== right.rulesSha256) throw new Error('Cannot compare different rules builds');
  if (left.recordingSha256 !== right.recordingSha256) throw new Error('Cannot compare different action recordings');
  if (left.environment.node !== right.environment.node) throw new Error('Cannot compare different Node versions');
  for (let index = 0; index < left.frames.length; index++) {
    const a = left.frames[index], b = right.frames[index];
    const field = difference(a.world, b.world);
    if (field) return { result: 'different', actionIndex: index, ticks: [a.world.tick, b.world.tick], checksums: [a.checksum, b.checksum], ...field };
  }
  return { result: 'same', actionsCompared: left.recording.actions.length, finalTick: left.frames.at(-1).world.tick, checksum: left.frames.at(-1).checksum };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [command, first, second, ...extra] = process.argv.slice(2);
    if (!first || !second || extra.length) throw new Error('Usage: replay-diagnostic.mjs capture output.json expected-node | compare left.json right.json');
    if (command === 'capture') {
      if (process.versions.node !== second) throw new Error(`Expected Node ${second}, received ${process.versions.node}`);
      const trace = await captureTrace(JSON.parse(await readFile(fixture, 'utf8')));
      await writeFile(first, JSON.stringify(trace));
      console.info({ event: 'replay.diagnostic.captured', environment: trace.environment, coreSha256: trace.coreSha256, recordingSha256: trace.recordingSha256, actions: trace.recording.actions.length, finalTick: trace.frames.at(-1).world.tick, checksum: trace.frames.at(-1).checksum });
    } else if (command === 'compare') {
      const left = JSON.parse(await readFile(first, 'utf8')), right = JSON.parse(await readFile(second, 'utf8'));
      console.info(JSON.stringify({ event: 'replay.diagnostic.compared', ...compareTraces(left, right), environments: [left.environment, right.environment], coreSha256: left.coreSha256, recordingSha256: left.recordingSha256, scope: 'synthetic action prefix, not terminal replay verification' }));
    } else throw new Error(`Unknown diagnostic command ${command}`);
  } catch (error) {
    console.error({ event: 'replay.diagnostic.failed', error: String(error) });
    process.exitCode = 1;
  }
}
