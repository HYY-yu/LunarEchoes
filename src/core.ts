import { resolveStage, stageRules, SimulationError, type StageContext } from './stage-rules.js';
export const VERSION = 'lunar-2';
export const HZ = 60;
export const ARMOR_RULES = Object.freeze({ hpPerCell: 10, initialCells: 10, hullCapacityCells: 2, hullRepairCells: 4, repairEveryTicks: HZ * 30 });
export type Upgrade = 'pulse' | 'orbit' | 'nova' | 'boots' | 'hull' | 'magnet';
export type Phase = { kind: 'running' } | { kind: 'upgrading'; offers: Upgrade[] } | { kind: 'paused'; previous: 'running' } | { kind: 'won' } | { kind: 'lost' };
export type Input = { x: number; y: number; dash: boolean };
export type Action = { kind: 'tick'; input: Input } | { kind: 'choose'; upgrade: Upgrade } | { kind: 'pause' } | { kind: 'resume' };
export type EnemyKind = 'crawler' | 'drone' | 'sentry' | 'boss';
export type Enemy = { id: number; kind: EnemyKind; x: number; y: number; hp: number; maxHp: number; radius: number; attack: number; flash: number };
export type Shot = { x: number; y: number; vx: number; vy: number; life: number; damage: number; hostile: boolean };
export type Crystal = { x: number; y: number; value: number };
export type Fx = { x: number; y: number; kind: 'hit' | 'kill' | 'nova' | 'dash'; life: number; size: number };
export type Event = 'enemy-hit' | 'shot' | 'hit' | 'kill' | 'pickup' | 'upgrade' | 'dash' | 'won' | 'lost' | 'boss';
export type World = {
  readonly context: StageContext;
  readonly seed: number; rng: number; tick: number; phase: Phase; nextId: number;
  player: { x: number; y: number; hp: number; maxHp: number; invincible: number; dashCooldown: number; dashTicks: number; dx: number; dy: number };
  enemies: Enemy[]; shots: Shot[]; crystals: Crystal[]; effects: Fx[]; events: Event[];
  level: number; xp: number; threshold: number; kills: number; upgrades: Record<Upgrade, number>;
  fireCooldown: number; novaCooldown: number; spawnCooldown: number; bossSpawned: boolean; bossKilled: boolean;
};
export type ActionBuffer = { version: typeof VERSION; stageId: StageContext['stageId']; rulesVersion: StageContext['rulesVersion']; seed: number; actions: Action[] };
export type Recording = Readonly<Omit<ActionBuffer, 'actions'> & { actions: readonly Action[]; finalChecksum: string }>;
export const UPGRADE_ORDER: readonly Upgrade[] = Object.freeze<Upgrade[]>(['pulse', 'orbit', 'nova', 'boots', 'hull', 'magnet']);
export function createWorld(request: unknown): World {
  if (!object(request)) throw new SimulationError('invalid-data');
  keys(request, ['stageId', 'rulesVersion', 'seed']);
  const context = resolveStage(request.stageId, request.rulesVersion), rules = stageRules(context);
  const seed = parseSeed(request.seed);
  const world: World = { context, seed, rng: seed || 1, tick: 0, phase: { kind: 'running' }, nextId: 1,
    player: { x: rules.arenaSize / 2, y: rules.arenaSize / 2, hp: ARMOR_RULES.initialCells * ARMOR_RULES.hpPerCell, maxHp: ARMOR_RULES.initialCells * ARMOR_RULES.hpPerCell, invincible: 0, dashCooldown: 0, dashTicks: 0, dx: 1, dy: 0 },
    enemies: [], shots: [], crystals: [], effects: [], events: [], level: 1, xp: 0, threshold: 5, kills: 0,
    upgrades: { pulse: 1, orbit: 0, nova: 0, boots: 0, hull: 0, magnet: 0 }, fireCooldown: 0, novaCooldown: 0, spawnCooldown: 45, bossSpawned: false, bossKilled: false };
  Object.defineProperties(world, { context: { writable: false, configurable: false }, seed: { writable: false, configurable: false } });
  return world;
}
export function random(world: World): number {
  let n = world.rng;
  n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
  world.rng = n >>> 0;
  return world.rng / 4294967296;
}
export function normalizeInput(input: Input): Input {
  const x = Number.isFinite(input.x) ? Math.max(-1, Math.min(1, input.x)) : 0;
  const y = Number.isFinite(input.y) ? Math.max(-1, Math.min(1, input.y)) : 0;
  const length = Math.max(1, Math.hypot(x, y));
  return { x: x / length, y: y / length, dash: input.dash === true };
}
function clamp(world: World, n: number): number { return Math.max(36, Math.min(stageRules(world.context).arenaSize - 36, n)); }
function distance(x: number, y: number, bx: number, by: number): number { return Math.hypot(x - bx, y - by); }
function spawn(world: World, kind: EnemyKind): void {
  const angle = random(world) * Math.PI * 2;
  const d = kind === 'boss' ? 350 : 400 + random(world) * 100;
  const hp = kind === 'boss' ? 950 : kind === 'sentry' ? 50 : kind === 'drone' ? 22 : 30;
  let x = clamp(world, world.player.x + Math.cos(angle) * d), y = clamp(world, world.player.y + Math.sin(angle) * d);
  if (distance(x, y, world.player.x, world.player.y) < 250) { x = clamp(world, world.player.x - Math.cos(angle) * d); y = clamp(world, world.player.y - Math.sin(angle) * d); }
  world.enemies.push({ id: world.nextId++, kind, x, y, hp, maxHp: hp, radius: kind === 'boss' ? 27 : kind === 'sentry' ? 15 : 11, attack: 75 + Math.floor(random(world) * 120), flash: 0 });
}
function kill(world: World, enemy: Enemy): void {
  world.kills++;
  world.crystals.push({ x: enemy.x, y: enemy.y, value: enemy.kind === 'boss' ? 20 : enemy.kind === 'sentry' ? 3 : 1 });
  world.effects.push({ x: enemy.x, y: enemy.y, kind: 'kill', life: 24, size: enemy.radius });
  world.events.push('kill');
  if (enemy.kind === 'boss') world.bossKilled = true;
}
function damagePlayer(world: World): void {
  const p = world.player;
  if (p.invincible > 0 || p.dashTicks > 0) return;
  p.hp = Math.max(0, p.hp - ARMOR_RULES.hpPerCell);
  p.invincible = 60;
  world.events.push('hit');
  world.effects.push({ x: p.x, y: p.y, kind: 'hit', life: 20, size: 18 });
  if (p.hp === 0) { world.phase = { kind: 'lost' }; world.events.push('lost'); }
}
function offers(world: World): Upgrade[] {
  const pool = [...UPGRADE_ORDER];
  const result: Upgrade[] = [];
  while (result.length < 3) result.push(pool.splice(Math.floor(random(world) * pool.length), 1)[0]);
  return result;
}
export function dispatch(world: World, action: Action): void {
  world.events.length = 0;
  if (action.kind === 'pause') {
    if (world.phase.kind === 'running') world.phase = { kind: 'paused', previous: 'running' };
    return;
  }
  if (action.kind === 'resume') {
    if (world.phase.kind === 'paused') world.phase = { kind: 'running' };
    return;
  }
  if (action.kind === 'choose') {
    if (world.phase.kind !== 'upgrading' || !world.phase.offers.includes(action.upgrade)) return;
    world.upgrades[action.upgrade]++;
    if (action.upgrade === 'hull') { world.player.maxHp += ARMOR_RULES.hullCapacityCells * ARMOR_RULES.hpPerCell; world.player.hp = Math.min(world.player.maxHp, world.player.hp + ARMOR_RULES.hullRepairCells * ARMOR_RULES.hpPerCell); }
    world.phase = { kind: 'running' };
    world.events.push('upgrade');
    return;
  }
  if (world.phase.kind !== 'running') return;
  step(world, normalizeInput(action.input));
}
function step(world: World, input: Input): void {
  world.tick++;
  const p = world.player;
  if (p.invincible > 0) p.invincible--;
  if (p.dashCooldown > 0) p.dashCooldown--;
  if (input.dash && p.dashCooldown === 0 && (input.x !== 0 || input.y !== 0)) {
    p.dashTicks = 12; p.dashCooldown = 150; p.dx = input.x; p.dy = input.y;
    world.events.push('dash');
  }
  const speed = 2.5 + world.upgrades.boots * .24;
  if (p.dashTicks > 0) {
    p.dashTicks--; p.x = clamp(world, p.x + p.dx * 8); p.y = clamp(world, p.y + p.dy * 8);
    if (world.tick % 2 === 0) world.effects.push({ x: p.x, y: p.y, kind: 'dash', life: 16, size: 10 });
  } else { p.x = clamp(world, p.x + input.x * speed); p.y = clamp(world, p.y + input.y * speed); }
  if (input.x !== 0 || input.y !== 0) { p.dx = input.x; p.dy = input.y; }
  if (world.tick % ARMOR_RULES.repairEveryTicks === 0) p.hp = Math.min(p.maxHp, p.hp + ARMOR_RULES.hpPerCell);
  world.spawnCooldown--;
  if (world.spawnCooldown <= 0 && world.enemies.length < 180) {
    const t = world.tick / HZ;
    const kind: EnemyKind = t > 30 && random(world) < .2 ? 'sentry' : t > 12 && random(world) < .35 ? 'drone' : 'crawler';
    spawn(world, kind);
    world.spawnCooldown = Math.max(13, 60 - Math.floor(t / 3));
  }
  if (world.tick >= stageRules(world.context).bossSpawnTick && !world.bossSpawned) { spawn(world, 'boss'); world.bossSpawned = true; world.events.push('boss'); }
  world.fireCooldown--;
  if (world.fireCooldown <= 0 && world.enemies.length) {
    let target = world.enemies[0];
    let nearest = Infinity;
    for (const enemy of world.enemies) {
      const d = distance(p.x, p.y, enemy.x, enemy.y);
      if (d < nearest) { nearest = d; target = enemy; }
    }
    const angle = Math.atan2(target.y - p.y, target.x - p.x);
    const count = Math.min(3, 1 + Math.floor(world.upgrades.pulse / 3));
    for (let i = 0; i < count; i++) {
      const a = angle + (i - (count - 1) / 2) * .15;
      world.shots.push({ x: p.x, y: p.y, vx: Math.cos(a) * 8, vy: Math.sin(a) * 8, life: 70, damage: 17 + world.upgrades.pulse * 6, hostile: false });
    }
    world.fireCooldown = Math.max(8, 31 - world.upgrades.pulse * 3);
    world.events.push('shot');
  }
  world.novaCooldown--;
  if (world.upgrades.nova > 0 && world.novaCooldown <= 0) {
    const radius = 95 + world.upgrades.nova * 18;
    for (const enemy of world.enemies) if (distance(p.x, p.y, enemy.x, enemy.y) < radius) { enemy.hp -= 35 + world.upgrades.nova * 16; world.events.push('enemy-hit'); enemy.flash = 8; }
    world.effects.push({ x: p.x, y: p.y, kind: 'nova', life: 30, size: radius });
    world.novaCooldown = Math.max(90, 240 - world.upgrades.nova * 15);
  }
  for (const enemy of world.enemies) {
    if (enemy.flash > 0) enemy.flash--;
    const angle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
    const d = distance(p.x, p.y, enemy.x, enemy.y);
    const speed = enemy.kind === 'boss' ? .65 : enemy.kind === 'drone' ? 1.45 : enemy.kind === 'sentry' ? .35 : .8;
    if (enemy.kind !== 'sentry' || d > 230) { enemy.x += Math.cos(angle) * speed; enemy.y += Math.sin(angle) * speed; }
    enemy.attack--;
    if ((enemy.kind === 'sentry' || enemy.kind === 'boss') && enemy.attack <= 0) {
      const count = enemy.kind === 'boss' ? 12 : 1;
      for (let i = 0; i < count; i++) {
        const a = count === 1 ? angle : i / count * Math.PI * 2 + world.tick * .01;
        world.shots.push({ x: enemy.x, y: enemy.y, vx: Math.cos(a) * 2.2, vy: Math.sin(a) * 2.2, life: 220, damage: ARMOR_RULES.hpPerCell, hostile: true });
      }
      enemy.attack = enemy.kind === 'boss' ? 135 : 180;
    }
    if (d < enemy.radius + 10) damagePlayer(world);
    if (world.upgrades.orbit > 0) {
      const count = Math.min(4, world.upgrades.orbit);
      for (let i = 0; i < count; i++) {
        const a = world.tick * .055 + i * Math.PI * 2 / count;
        if (distance(enemy.x, enemy.y, p.x + Math.cos(a) * 58, p.y + Math.sin(a) * 58) < enemy.radius + 12) {
          enemy.hp -= 1.3 + world.upgrades.orbit * .3; world.events.push('enemy-hit'); enemy.flash = 3;
        }
      }
    }
  }
  for (const shot of world.shots) {
    shot.x += shot.vx; shot.y += shot.vy; shot.life--;
    if (shot.hostile) {
      if (distance(shot.x, shot.y, p.x, p.y) < 12) { damagePlayer(world); shot.life = 0; }
    } else {
      for (const enemy of world.enemies) {
        if (enemy.hp > 0 && distance(shot.x, shot.y, enemy.x, enemy.y) < enemy.radius + 5) {
          enemy.hp -= shot.damage; world.events.push('enemy-hit'); enemy.flash = 6; shot.life = 0; break;
        }
      }
    }
  }
  for (const enemy of world.enemies) if (enemy.hp <= 0) kill(world, enemy);
  world.enemies = world.enemies.filter(enemy => enemy.hp > 0);
  world.shots = world.shots.filter(shot => shot.life > 0);
  const pickupRadius = 115 + world.upgrades.magnet * 25;
  for (const crystal of world.crystals) {
    const d = distance(p.x, p.y, crystal.x, crystal.y);
    if (d < pickupRadius) {
      crystal.x += (p.x - crystal.x) * .2; crystal.y += (p.y - crystal.y) * .2;
      if (d < 14) { world.xp += crystal.value; crystal.value = 0; world.events.push('pickup'); }
    }
  }
  world.crystals = world.crystals.filter(crystal => crystal.value > 0);
  for (const effect of world.effects) effect.life--;
  world.effects = world.effects.filter(effect => effect.life > 0);
  if (world.phase.kind === 'running' && world.xp >= world.threshold) {
    world.xp -= world.threshold; world.level++; world.threshold = Math.floor(world.threshold * 1.24) + 2;
    world.phase = { kind: 'upgrading', offers: offers(world) };
  }
  if (world.phase.kind === 'running' && world.tick >= stageRules(world.context).durationTicks) {
    world.phase = { kind: world.bossKilled ? 'won' : 'lost' };
    world.events.push(world.bossKilled ? 'won' : 'lost');
  }
}
function hash(data: string): string {
  let value = 2166136261;
  for (let i = 0; i < data.length; i++) value = Math.imul(value ^ data.charCodeAt(i), 16777619);
  return (value >>> 0).toString(16).padStart(8, '0');
}
export function checksum(world: World): string {
  const { context, ...battle } = world;
  return hash(JSON.stringify({ ...battle, events: [] }));
}
export function finalChecksum(world: World): string {
  return hash(JSON.stringify([VERSION, world.context.stageId, world.context.rulesVersion, world.seed, checksum(world)]));
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}
function keys(value: Record<string, unknown>, expected: readonly string[]): void {
  if (Reflect.ownKeys(value).length !== expected.length || expected.some(key => !Object.hasOwn(value, key))) throw new SimulationError('invalid-data');
}
function parseSeed(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 4294967295) throw new SimulationError('invalid-data');
  return value;
}
function parseAction(value: unknown): Action {
  if (!object(value)) throw new SimulationError('invalid-data');
  if (value.kind === 'tick') {
    keys(value, ['kind', 'input']);
    if (!object(value.input)) throw new SimulationError('invalid-data');
    keys(value.input, ['x', 'y', 'dash']);
    const { x, y, dash } = value.input;
    if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y) || typeof dash !== 'boolean') throw new SimulationError('invalid-data');
    return { kind: 'tick', input: Object.freeze({ x, y, dash }) };
  }
  if (value.kind === 'choose') {
    keys(value, ['kind', 'upgrade']);
    const upgrade = UPGRADE_ORDER.find(id => id === value.upgrade);
    if (!upgrade) throw new SimulationError('invalid-data');
    return { kind: 'choose', upgrade };
  }
  if (value.kind === 'pause' || value.kind === 'resume') { keys(value, ['kind']); return { kind: value.kind }; }
  throw new SimulationError('invalid-data');
}
export function parseActionBuffer(input: unknown): ActionBuffer {
  if (!object(input)) throw new SimulationError('invalid-data');
  if (input.version !== VERSION) throw new SimulationError('incompatible-version');
  keys(input, ['version', 'stageId', 'rulesVersion', 'seed', 'actions']);
  const context = resolveStage(input.stageId, input.rulesVersion), seed = parseSeed(input.seed);
  if (!Array.isArray(input.actions)) throw new SimulationError('invalid-data');
  const actions = Array.from(input.actions, value => Object.freeze(parseAction(value)));
  return { version: VERSION, ...context, seed, actions };
}
export function startRecording(world: World): ActionBuffer {
  return { version: VERSION, ...world.context, seed: world.seed, actions: [] };
}
export function finishRecording(world: World, actions: readonly Action[]): Recording {
  if (world.phase.kind !== 'won' && world.phase.kind !== 'lost') throw new SimulationError('nonterminal-replay');
  const buffer = parseActionBuffer({ ...startRecording(world), actions });
  return Object.freeze({ ...buffer, actions: Object.freeze(buffer.actions), finalChecksum: finalChecksum(world) });
}
export function prepareReplay(input: unknown): { world: World; recording: Recording } {
  if (!object(input)) throw new SimulationError('invalid-data');
  if (input.version !== VERSION) throw new SimulationError('incompatible-version');
  keys(input, ['version', 'stageId', 'rulesVersion', 'seed', 'actions', 'finalChecksum']);
  const { finalChecksum: expected, ...prefix } = input;
  const buffer = parseActionBuffer(prefix);
  if (typeof expected !== 'string' || !/^[0-9a-f]{8}$/.test(expected)) throw new SimulationError('invalid-data');
  const recording = Object.freeze({ ...buffer, actions: Object.freeze(buffer.actions), finalChecksum: expected });
  return { world: createWorld({ stageId: recording.stageId, rulesVersion: recording.rulesVersion, seed: recording.seed }), recording };
}
export function verifyReplay(world: World, recording: Recording, consumedActions: number): void {
  if (consumedActions !== recording.actions.length) throw new SimulationError('incomplete-replay');
  if (world.phase.kind !== 'won' && world.phase.kind !== 'lost') throw new SimulationError('nonterminal-replay');
  if (world.context.stageId !== recording.stageId || world.context.rulesVersion !== recording.rulesVersion || world.seed !== recording.seed || finalChecksum(world) !== recording.finalChecksum) throw new SimulationError('checksum-mismatch');
}
export function replay(input: unknown): World {
  const { world, recording } = prepareReplay(input);
  for (const action of recording.actions) dispatch(world, action);
  verifyReplay(world, recording, recording.actions.length);
  return world;
}
