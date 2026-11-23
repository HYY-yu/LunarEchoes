import { DESERT_CONTEXT, stageRules } from '../dist/stage-rules.js';
const ARENA = stageRules(DESERT_CONTEXT).arenaSize;
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createAtlas } from '../dist/art.js';
import { createRenderer } from '../dist/render.js';
import { createWorld, dispatch } from '../dist/core.js';

class Canvas {
  width = 0; height = 0; frames = new Map(); clientWidth = 1280; clientHeight = 720; pixels = new Map(); calls = []; arcs = []; ellipses = []; clips = []; rectangles = []; gloves = [];
  constructor(rasterize = false) {
    const canvas = this;
    this.context = {
      fillStyle: '', globalAlpha: 1,
      createImageData(width, height) { return { data: new Uint8ClampedArray(width * height * 4) }; },
      putImageData(image, x, y) { canvas.frames.set(`${x},${y}`, image.data); },
      fillRect(x, y, width, height) { if (this.fillStyle === '#d4dcd6') canvas.gloves.push([x, y, width, height]); if (!rasterize) return; for (let row = y; row < y + height; row++) for (let col = x; col < x + width; col++) canvas.pixels.set(`${col},${row}`, this.fillStyle); },
      drawImage(...args) { canvas.calls.push({ args, alpha: this.globalAlpha }); },
      arc(...args) { canvas.arcs.push(args); },
      createPattern() { return '#707c80'; }, createRadialGradient() { return { addColorStop() {} }; },
      ellipse(...args) { canvas.ellipses.push(args); },
      rect(...args) { canvas.rectangles.push(args); },
      clip(rule) { canvas.clips.push({ rule, rectangles: canvas.rectangles.slice() }); },
      save() {}, restore() {}, scale() {}, translate() {}, beginPath() { canvas.rectangles.length = 0; }, fill() {}, stroke() {}, strokeRect() {}, setLineDash() {}, moveTo() {}, lineTo() {}
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
  environment(t); const canvas = new Canvas(), render = createRenderer(canvas), world = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: 42 });
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
  const restarted = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: 42 }); restarted.enemies = [enemy(1, 'crawler', 690)];
  canvas.calls.length = 0; render(restarted, 99999); assert.equal(crawlerCall(canvas).args[2], first.args[2]);
});
test('walk phases retain hurt alpha and other enemies telegraphs', t => {
  environment(t); const canvas = new Canvas(), render = createRenderer(canvas), world = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: 42 });
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
  function fresh() { const world = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: 42 }); world.fireCooldown = 1000000; world.spawnCooldown = 1000000; return world; }
  function draw(world, time = 0) {
    canvas.calls.length = 0; canvas.ellipses.length = 0; canvas.clips.length = 0; canvas.gloves.length = 0;
    const before = structuredClone(world); render(world, time); assert.deepEqual(world, before);
    const call = canvas.calls.find(call => call.args[7] === 38 && call.args[8] === 43);
    const [atlas, x, y, width, height] = call.args;
    return { ...call, facing: y / height, pose: x / width, pixels: hash(atlas.frames.get(`${x},${y}`)) };
  }
  function ticks(world, count, x = 0, y = 0, dash = false) { for (let i = 0; i < count; i++) dispatch(world, { kind: 'tick', input: { x, y, dash } }); }
  return { canvas, fresh, draw, ticks };
}
test('astronaut turns with actual movement in eight directions and retains facing at idle', t => {
  const { fresh, draw, ticks } = astronautScene(t), world = fresh();
  const south = draw(world);
  assert.equal(south.facing, 0);
  ticks(world, 6); const idle = draw(world);
  assert.equal(idle.pixels, south.pixels);
  assert.deepEqual(idle.args.slice(5), [Math.round(world.player.x) - 19, Math.round(world.player.y) - 24, 38, 43]);
  const idleFrames = new Set();
  for (const [facing, [x, y]] of [[0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1]].entries()) {
    ticks(world, 1, x, y);
    const turning = draw(world);
    assert.equal(turning.facing, facing);
    assert.equal(turning.pose, 0);
    ticks(world, 5, x, y);
    const walking = draw(world);
    assert.equal(walking.facing, facing);
    assert.notEqual(walking.pixels, turning.pixels);
    assert.deepEqual(draw(world, 500000).args, walking.args);
    ticks(world, 1);
    const stopped = draw(world);
    assert.equal(stopped.facing, facing);
    assert.equal(stopped.pixels, turning.pixels);
    idleFrames.add(stopped.pixels);
  }
  assert.equal(idleFrames.size, 8);

  const movingPoses = new Set();
  for (let i = 0; i < 24; i++) {
    ticks(world, 1, 1);
    movingPoses.add(draw(world).pixels);
  }
  assert.equal(movingPoses.size, 3);
  ticks(world, 1, -1, 0, true);
  assert.equal(draw(world).facing, 2);
  ticks(world, 1, 1);
  assert.equal(draw(world).facing, 2);
  ticks(world, 1);
  assert.equal(draw(world).facing, 6);
  ticks(world, 10);
  assert.equal(draw(world).pose, 0);
  assert.equal(draw(world).facing, 6);
});
test('astronaut freezes its selected pose through pause upgrade and terminal states', t => {
  const { fresh, draw, ticks } = astronautScene(t), world = fresh(); draw(world); ticks(world, 6, 1);
  const walking = draw(world); assert.equal(walking.pose, 1);
  dispatch(world, { kind: 'pause' });
  for (let i = 0; i < 10; i++) { ticks(world, 1, 1); assert.equal(draw(world, i * 1000).pixels, walking.pixels); }
  dispatch(world, { kind: 'resume' }); assert.equal(draw(world).pixels, walking.pixels);
  world.xp = world.threshold; ticks(world, 1, 1); assert.equal(world.phase.kind, 'upgrading');
  for (let i = 0; i < 10; i++) { ticks(world, 1, 1); assert.equal(draw(world, i * 2000).pixels, walking.pixels); }
  dispatch(world, { kind: 'choose', upgrade: world.phase.offers[0] }); ticks(world, 1); assert.equal(draw(world).pose, 0);
  ticks(world, 18, 1); const selected = draw(world);
  assert.equal(selected.pose, 2);
  assert.equal(selected.facing, 6);
  for (const kind of ['won', 'lost']) { world.phase = { kind }; ticks(world, 1, -1); assert.equal(draw(world, 99999).pixels, selected.pixels); }
});
test('astronaut sampling resets on world replacement and rewind, and handles skipped ticks without history guesses', t => {
  const { fresh, draw, ticks } = astronautScene(t), world = fresh();
  const south = draw(world); ticks(world, 102, 1);
  const east = draw(world); assert.equal(east.pose, 1); assert.equal(east.facing, 6);
  ticks(world, 6); assert.equal(draw(world).pose, 0); assert.equal(draw(world).facing, 6);
  const next = fresh(); assert.equal(draw(next, 90000).pixels, south.pixels);
  ticks(next, 6, 1); assert.equal(draw(next).pixels, east.pixels);
  next.tick = 1; assert.equal(draw(next).pixels, south.pixels);
  ticks(next, 6, 1); assert.equal(draw(next).pixels, east.pixels);
});
test('astronaut boundary input stays idle and preserves hurt alpha and shadow anchor', t => {
  const { canvas, fresh, draw, ticks } = astronautScene(t), world = fresh(); world.player.x = ARENA - 36; draw(world);
  ticks(world, 24, 1); const idle = draw(world); assert.equal(idle.pose, 0); assert.equal(world.player.x, ARENA - 36);
  assert.deepEqual(canvas.ellipses[0].slice(0, 4), [world.player.x + 3, world.player.y + 12, 12, 5]);
  world.player.invincible = 10; assert.equal(draw(world).alpha, .45);
  ticks(world, 3); assert.equal(draw(world).alpha, 1);
  assert.deepEqual(canvas.clips, []);
  world.materialMotions = [{ kind: 'pickup', tick: world.tick, source: { ...world.player }, material: 'wood' }];
  draw(world);
  assert.equal(canvas.clips.length, 1);
  assert.equal(canvas.clips[0].rule, 'evenodd');
  assert.deepEqual(canvas.clips[0].rectangles[1], [Math.round(world.player.x) - 6, Math.round(world.player.y) - 15, 13, 10]);
  ticks(world, 1, 0, -1);
  assert.equal(draw(world).facing, 4);
  assert.deepEqual(canvas.clips, []);
  assert.deepEqual(canvas.gloves, [[Math.round(world.player.x) + 10, Math.round(world.player.y) - 1, 4, 4]]);
  ticks(world, 1, -1);
  assert.equal(draw(world).facing, 2);
  assert.deepEqual(canvas.gloves, [[Math.round(world.player.x) - 9, Math.round(world.player.y) + 4, 4, 4]]);
});
