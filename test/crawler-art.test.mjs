import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createAtlas } from '../dist/art.js';
import { createRenderer } from '../dist/render.js';
import { ARENA, createWorld, dispatch } from '../dist/core.js';

class Canvas {
  width = 0; height = 0; clientWidth = 1280; clientHeight = 720; pixels = new Map(); calls = []; arcs = []; ellipses = [];
  constructor(rasterize = false) {
    const canvas = this;
    this.context = {
      fillStyle: '', globalAlpha: 1,
      fillRect(x, y, width, height) { if (!rasterize) return; for (let row = y; row < y + height; row++) for (let col = x; col < x + width; col++) canvas.pixels.set(`${col},${row}`, this.fillStyle); },
      drawImage(...args) { canvas.calls.push({ args, alpha: this.globalAlpha }); },
      arc(...args) { canvas.arcs.push(args); },
      createPattern() { return '#707c80'; }, createRadialGradient() { return { addColorStop() {} }; },
      ellipse(...args) { canvas.ellipses.push(args); },
      save() {}, restore() {}, scale() {}, translate() {}, beginPath() {}, fill() {}, stroke() {}, strokeRect() {}, setLineDash() {}, moveTo() {}, lineTo() {}
    };
  }
  getContext() { return this.context; }
}
function environment(t, rasterize = false) {
  const previous = globalThis.document;
  globalThis.document = { createElement() { return new Canvas(rasterize); } };
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
}
function tile(atlas, name, tick = 0) {
  let result;
  atlas.draw({ drawImage(canvas, x, y) { result = Array.from({ length: 256 }, (_, i) => canvas.pixels.get(`${x + i % 16},${y + Math.floor(i / 16)}`) ?? ''); } }, name, 0, 0, 1, tick);
  return result;
}
function hash(pixels) { return createHash('sha256').update(JSON.stringify(pixels)).digest('hex'); }
const baseline = {
  astronaut: '91a28aa48f0f2b5b3bec956be175e559ce5d063d0c7722558840348fbaa2a91f',
  crawler: 'a08eca8819532399b8ce3f95a496749e29d9022960fa0ad7b2dc70c224513996',
  drone: 'b7dceae82d62aa8315964c0dac3b5b15861894e143b95373b14b6d5a50139d7c',
  sentry: '85661dcb8b1c49ff06136460ab6114cfd8dfeed07795c27dc9772305168630ff',
  boss: 'a4a2ec76dae3bd0e528463d25d989a86e2a90f8f97697b6828e6e5f3127e6c99',
  crystal: 'f5ba3e279a7bf081301b0869c2d6e8422750653c1af05fad7cdf6e7086307c50'
};
test('legacy sprite pixels remain unchanged and crawler has three contained leg poses', t => {
  environment(t, true); const atlas = createAtlas();
  for (const [name, expected] of Object.entries(baseline)) assert.equal(hash(tile(atlas, name)), expected, name);
  for (const name of ['drone', 'sentry', 'boss', 'crystal']) for (const tick of [6, 18, 600]) assert.equal(hash(tile(atlas, name, tick)), baseline[name], name);
  const poses = [0, 6, 18].map(tick => tile(atlas, 'crawler', tick));
  assert.equal(new Set(poses.map(hash)).size, 3);
  for (const pose of poses) {
    assert.deepEqual(pose.slice(0, 11 * 16), poses[0].slice(0, 11 * 16));
    for (const [i, color] of pose.entries()) if (color) { assert(i % 16 >= 1 && i % 16 <= 14); assert(Math.floor(i / 16) >= 3 && Math.floor(i / 16) <= 12); assert(poses[0].includes(color)); }
  }
  assert.equal(hash(tile(atlas, 'crawler', 12)), baseline.crawler);
  assert.equal(hash(tile(atlas, 'crawler', 24)), baseline.crawler);
});
function enemy(id, kind, x) { return { id, kind, x, y: 750, hp: 100, maxHp: 100, radius: 11, attack: 24, flash: 0 }; }
function crawlerCall(canvas) { return canvas.calls.find(call => call.args[1] === 16); }
test('crawler animation uses simulation ticks, freezes with combat and leaves all World data unchanged', t => {
  environment(t); const canvas = new Canvas(), render = createRenderer(canvas), world = createWorld(42);
  world.enemies = [enemy(1, 'crawler', 690), enemy(2, 'sentry', 820)]; world.fireCooldown = 1000; world.spawnCooldown = 1000;
  function draw(time) { canvas.calls.length = 0; const before = structuredClone(world); render(world, time); assert.deepEqual(world, before); return crawlerCall(canvas); }
  const first = draw(0); assert.equal(draw(5000).args[2], first.args[2]);
  for (let i = 0; i < 6; i++) dispatch(world, { kind: 'tick', input: { x: 0, y: 0, dash: false } });
  const advanced = draw(6000); assert.notEqual(advanced.args[2], first.args[2]);
  dispatch(world, { kind: 'pause' }); const paused = draw(7000);
  for (let i = 0; i < 12; i++) dispatch(world, { kind: 'tick', input: { x: 1, y: 1, dash: false } });
  assert.equal(draw(12000).args[2], paused.args[2]);
  for (const phase of [{ kind: 'upgrading', offers: ['pulse'] }, { kind: 'won' }, { kind: 'lost' }]) {
    world.phase = phase; const frozen = draw(13000); dispatch(world, { kind: 'tick', input: { x: 0, y: 0, dash: false } }); assert.equal(draw(20000).args[2], frozen.args[2]);
  }
  const restarted = createWorld(42); restarted.enemies = [enemy(1, 'crawler', 690)];
  canvas.calls.length = 0; render(restarted, 99999); assert.equal(crawlerCall(canvas).args[2], first.args[2]);
});
test('walk phases retain hurt alpha and other enemies telegraphs', t => {
  environment(t); const canvas = new Canvas(), render = createRenderer(canvas), world = createWorld(42);
  world.enemies = [enemy(1, 'crawler', 690), enemy(2, 'sentry', 820)];
  for (const tick of [0, 6, 12, 18]) {
    world.tick = tick; world.enemies[0].flash = 6; canvas.calls.length = 0; canvas.arcs.length = 0; render(world, 0);
    assert.equal(crawlerCall(canvas).alpha, .45); assert(canvas.arcs.some(arc => arc[0] === 820 && arc[2] === 25));
    world.enemies[0].flash = 0; canvas.calls.length = 0; render(world, 0); assert.equal(crawlerCall(canvas).alpha, 1);
  }
});
test('astronaut preserves its torso and palette across three contained leg poses', t => {
  environment(t, true); const atlas = createAtlas();
  const poses = [0, 6, 18].map(tick => tile(atlas, 'astronaut', tick));
  assert.equal(hash(poses[0]), baseline.astronaut);
  assert.equal(new Set(poses.map(hash)).size, 3);
  for (const pose of poses) {
    assert.deepEqual(pose.slice(0, 12 * 16), poses[0].slice(0, 12 * 16));
    for (const [i, color] of pose.entries()) if (color) { assert(i % 16 >= 2 && i % 16 <= (i < 12 * 16 ? 12 : 11)); assert(poses[0].includes(color)); }
  }
  for (const tick of [12, 24]) assert.equal(hash(tile(atlas, 'astronaut', tick)), baseline.astronaut);
});
function astronautScene(t) {
  environment(t); const canvas = new Canvas(), render = createRenderer(canvas);
  function fresh() { const world = createWorld(42); world.fireCooldown = 1000000; world.spawnCooldown = 1000000; return world; }
  function draw(world, time = 0) {
    canvas.calls.length = 0; canvas.ellipses.length = 0;
    const before = structuredClone(world); render(world, time); assert.deepEqual(world, before);
    return canvas.calls.find(call => call.args[1] === 0);
  }
  function ticks(world, count, x = 0, y = 0) { for (let i = 0; i < count; i++) dispatch(world, { kind: 'tick', input: { x, y, dash: false } }); }
  return { canvas, fresh, draw, ticks };
}
test('astronaut walks only after observed movement, remains stable within one tick and stops at idle', t => {
  const { fresh, draw, ticks } = astronautScene(t), world = fresh(); draw(world);
  ticks(world, 6); const idle = draw(world);
  assert.equal(idle.args[2], 0); assert.equal(idle.args[6], Math.round(world.player.y - 8 * 1.7));
  ticks(world, 1, 1); const walking = draw(world); assert.equal(walking.args[2], 16);
  for (let i = 0; i < 100; i++) assert.deepEqual(draw(world, i * 1000).args, walking.args);
  ticks(world, 1); assert.equal(draw(world).args[2], 0); assert.equal(world.player.dx, 1);
  const movingPoses = new Set();
  for (let i = 0; i < 24; i++) { ticks(world, 1, 1); movingPoses.add(draw(world).args[2]); }
  assert.deepEqual([...movingPoses].sort((a, b) => a - b), [0, 16, 32]);
  for (let i = 0; i < 24; i++) { ticks(world, 1); assert.equal(draw(world, i * 300).args[2], 0); }
});
test('astronaut freezes its selected pose through pause upgrade and terminal states', t => {
  const { fresh, draw, ticks } = astronautScene(t), world = fresh(); draw(world); ticks(world, 6, 1);
  const walking = draw(world); assert.equal(walking.args[2], 16);
  dispatch(world, { kind: 'pause' });
  for (let i = 0; i < 10; i++) { ticks(world, 1, 1); assert.equal(draw(world, i * 1000).args[2], walking.args[2]); }
  dispatch(world, { kind: 'resume' }); assert.equal(draw(world).args[2], walking.args[2]);
  world.xp = world.threshold; ticks(world, 1, 1); assert.equal(world.phase.kind, 'upgrading');
  for (let i = 0; i < 10; i++) { ticks(world, 1, 1); assert.equal(draw(world, i * 2000).args[2], walking.args[2]); }
  dispatch(world, { kind: 'choose', upgrade: world.phase.offers[0] }); ticks(world, 1); assert.equal(draw(world).args[2], 0);
  ticks(world, 10, 1); const selected = draw(world).args[2]; assert.equal(selected, 32);
  for (const kind of ['won', 'lost']) { world.phase = { kind }; ticks(world, 1, 1); assert.equal(draw(world, 99999).args[2], selected); }
});
test('astronaut sampling resets on world replacement and rewind, and handles skipped ticks without history guesses', t => {
  const { fresh, draw, ticks } = astronautScene(t), world = fresh(); draw(world); ticks(world, 102, 1);
  assert.equal(draw(world).args[2], 16); ticks(world, 6); assert.equal(draw(world).args[2], 0);
  const next = fresh(); assert.equal(draw(next, 90000).args[2], 0); ticks(next, 6, 1); assert.equal(draw(next).args[2], 16);
  next.tick = 1; assert.equal(draw(next).args[2], 0); ticks(next, 6, 1); assert.equal(draw(next).args[2], 16);
});
test('astronaut boundary input stays idle and preserves hurt alpha and shadow anchor', t => {
  const { canvas, fresh, draw, ticks } = astronautScene(t), world = fresh(); world.player.x = ARENA - 36; draw(world);
  ticks(world, 24, 1); const idle = draw(world); assert.equal(idle.args[2], 0); assert.equal(world.player.x, ARENA - 36);
  assert.deepEqual(canvas.ellipses[0].slice(0, 4), [world.player.x + 3, world.player.y + 12, 12, 5]);
  world.player.invincible = 10; assert.equal(draw(world).alpha, .45);
  ticks(world, 3); assert.equal(draw(world).alpha, 1);
});
