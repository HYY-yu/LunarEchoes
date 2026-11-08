import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
const seeds = [208907, 42, 101, 1, 2, 3, 4, 5, 6];
const digest = value => createHash('sha256').update(value).digest('hex');
function skilled(world) {
  const p = world.player; let x = 0, y = 0, closest = null, nearest = Infinity;
  for (const enemy of world.enemies) {
    const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (d < nearest) { nearest = d; closest = enemy; }
    if (d < 120) { x += (p.x - enemy.x) / Math.max(1, d * d) * 180; y += (p.y - enemy.y) / Math.max(1, d * d) * 180; }
  }
  for (const shot of world.shots) {
    if (!shot.hostile) continue;
    const d = Math.hypot(shot.x - p.x, shot.y - p.y);
    if (d < 65) { x += (p.x - shot.x) / Math.max(1, d * d) * 130; y += (p.y - shot.y) / Math.max(1, d * d) * 130; }
  }
  let crystal = null, cd = Infinity;
  for (const c of world.crystals) { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < cd) { cd = d; crystal = c; } }
  if (crystal) { x += (crystal.x - p.x) / Math.max(1, cd) * .9; y += (crystal.y - p.y) / Math.max(1, cd) * .9; }
  else { x += Math.cos(world.tick / 140) * .5; y += Math.sin(world.tick / 140) * .5; }
  if (p.x < 150) x += 2; if (p.x > 1350) x -= 2; if (p.y < 150) y += 2; if (p.y > 1350) y -= 2;
  if (closest && nearest < 30) { x = p.x - closest.x; y = p.y - closest.y; }
  return { x, y, dash: nearest < 45 && world.tick % 30 === 0 };
}
function novice(world) {
  const p = world.player; let nearest = null, d = Infinity;
  for (const enemy of world.enemies) { const n = Math.hypot(enemy.x - p.x, enemy.y - p.y); if (n < d) { d = n; nearest = enemy; } }
  if (nearest && d < 85) return { x: p.x - nearest.x, y: p.y - nearest.y, dash: false };
  let crystal = null, cd = Infinity;
  for (const c of world.crystals) { const n = Math.hypot(c.x - p.x, c.y - p.y); if (n < cd) { cd = n; crystal = c; } }
  if (crystal) return { x: crystal.x - p.x, y: crystal.y - p.y, dash: false };
  return { x: Math.cos(world.tick / 240), y: Math.sin(world.tick / 240), dash: false };
}
export function playArmorCase(core, seed, strategy, preference) {
  const world = core.createWorld(seed), recording = { version: core.VERSION, seed, actions: [] }, upgrades = [];
  let acceptedHits = 0, actualRawDamage = 0, bossKillTick = null, iterations = 0, error = null, cached = { x: 0, y: 0, dash: false };
  const cell = core.ARMOR_RULES?.hpPerCell ?? null;
  const repairTicks = core.ARMOR_RULES?.repairEveryTicks ?? 180, repairAmount = cell ?? 1;
  try {
    while (!['won', 'lost'].includes(world.phase.kind) && iterations++ < core.DURATION * 2) {
      if (world.phase.kind === 'upgrading') {
        const order = preference === 'hull' || world.player.hp < 50 ? ['hull', 'pulse', 'orbit', 'nova', 'boots', 'magnet'] : ['pulse', 'orbit', 'nova', 'hull', 'magnet', 'boots'];
        const upgrade = order.find(id => world.phase.offers.includes(id));
        if (!upgrade) throw new Error('No offered upgrade');
        const action = { kind: 'choose', upgrade }; recording.actions.push(action); core.dispatch(world, action); upgrades.push({ tick: world.tick, upgrade }); continue;
      }
      if (strategy === 'skilled') cached = skilled(world);
      else if (strategy === 'novice' && world.tick % 15 === 0) cached = novice(world);
      const input = strategy === 'stationary' ? { x: 0, y: 0, dash: false } : { ...cached };
      const before = world.player.hp, maximum = world.player.maxHp, nextTick = world.tick + 1;
      const healed = nextTick % repairTicks === 0 ? Math.min(maximum - before, repairAmount) : 0;
      const action = { kind: 'tick', input }; recording.actions.push(action); core.dispatch(world, action);
      const hits = world.events.filter(event => event === 'hit').length; acceptedHits += hits;
      if (hits) actualRawDamage += before + healed - world.player.hp;
      if (world.bossKilled && bossKillTick === null) bossKillTick = world.tick;
      if (![world.player.hp, world.player.maxHp, world.player.x, world.player.y].every(Number.isFinite)) throw new Error('Nonfinite player state');
      if (cell !== null && (world.player.hp % cell || world.player.maxHp % cell)) throw new Error('Fractional armor cell');
      if (hits > 1 || world.enemies.length > 180) throw new Error('Combat bound exceeded');
    }
  } catch (caught) { error = String(caught); }
  const finalChecksum = core.checksum(world);
  let replayMatch = false;
  try { replayMatch = core.checksum(core.replay(recording)) === finalChecksum; } catch (caught) { error = String(caught); }
  const timeout = !['won', 'lost'].includes(world.phase.kind);
  const seconds = world.tick / core.HZ;
  if (world.phase.kind === 'won' && (seconds < 180 || seconds > 300)) error = 'Winning duration outside 180–300';
  return { seed, strategy, preference, phase: world.phase.kind, timeout, error, ticks: world.tick, combatSeconds: seconds, storySeconds: 0, acceptedHits, actualRawDamage, damageCells: cell === null ? null : actualRawDamage / cell, hp: world.player.hp, maxHp: world.player.maxHp, capacityCells: cell === null ? null : world.player.maxHp / cell, level: world.level, kills: world.kills, bossSpawned: world.bossSpawned, bossKilled: world.bossKilled, bossKillTick, upgrades, actionCount: recording.actions.length, actionsSha256: digest(JSON.stringify(recording.actions)), checksum: finalChecksum, replayMatch, recording };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 4 || args[0] !== '--core' || args[2] !== '--out') throw new Error('Usage: armor-balance.mjs --core path/dist/core.js --out results.json');
    const coreFile = resolve(args[1]), core = await import(pathToFileURL(coreFile).href), rows = [], samples = [];
    for (const strategy of ['stationary', 'novice', 'skilled']) for (const preference of ['attack', 'hull']) for (const seed of seeds) {
      const { recording, ...row } = playArmorCase(core, seed, strategy, preference); rows.push(row);
      if (seed === 42 && preference === 'attack' && strategy !== 'novice') samples.push({ strategy, recording, checksum: row.checksum });
    }
    const identity = { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dirname(dirname(coreFile)), encoding: 'utf8' }).trim(), sourceDirty: execFileSync('git', ['status', '--porcelain', '--', 'src/core.ts'], { cwd: dirname(dirname(coreFile)), encoding: 'utf8' }).trim() !== '', version: core.VERSION, coreSha256: digest(await readFile(coreFile)), strategySha256: digest(await readFile(new URL(import.meta.url))), node: process.versions.node, platform: process.platform, arch: process.arch, scope: 'prototype paired seeds and same adaptive algorithms, not identical action recordings' };
    const summary = { runs: rows.length, won: rows.filter(r => r.phase === 'won').length, lost: rows.filter(r => r.phase === 'lost').length, timeouts: rows.filter(r => r.timeout).length, errors: rows.filter(r => r.error).length, replayFailures: rows.filter(r => !r.replayMatch).length, maximumHull: Math.max(...rows.map(r => r.upgrades.filter(u => u.upgrade === 'hull').length)), maximumCapacityCells: core.ARMOR_RULES ? Math.max(...rows.map(r => r.capacityCells)) : null };
    await writeFile(args[3], JSON.stringify({ identity, summary, rows }, null, 2) + '\n');
    await writeFile(args[3] + '.samples.json', JSON.stringify({ identity, samples }) + '\n');
    console.info({ event: 'armor.balance.finished', identity, summary });
    if (summary.errors || summary.timeouts || summary.replayFailures) process.exitCode = 1;
  } catch (error) { console.error({ event: 'armor.balance.failed', error: String(error) }); process.exitCode = 1; }
}
