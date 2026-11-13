import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesertMap } from '../dist/desert-map.js';
import { createRenderer } from '../dist/render.js';
import { createWorld, checksum, dispatch } from '../dist/core.js';

function context() {
  const calls = [], stack = [];
  const state = { fillStyle: '#ff00ff', strokeStyle: '#00ff00', globalAlpha: .3, globalCompositeOperation: 'xor', imageSmoothingEnabled: true, lineWidth: 7, dash: [2, 9] };
  return {
    ...state, calls,
    save() { stack.push(Object.fromEntries(Object.keys(state).map(key => [key, this[key]]))); },
    restore() { Object.assign(this, stack.pop()); },
    fillRect(...args) { calls.push(['rect', this.fillStyle, this.globalAlpha, ...args]); },
    drawImage(canvas, ...args) { calls.push(['image', canvas.width, canvas.height, ...args]); },
    createPattern(canvas) { calls.push(['pattern', canvas.width, canvas.height]); return 'sand-pattern'; },
    setLineDash(value) { this.dash = value; },
    strokeRect(...args) { calls.push(['outline', ...args]); },
    createRadialGradient() { return { addColorStop() {} }; },
    scale() {}, translate() {}, clip() {}, beginPath() {}, ellipse() {}, arc() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {}
  };
}
function environment(t) {
  const previous = globalThis.document, surfaces = [];
  globalThis.document = { createElement() { const canvas = { width: 0, height: 0, ctx: context(), getContext() { return this.ctx; } }; surfaces.push(canvas); return canvas; } };
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
  return surfaces;
}
const view = { left: 300, top: 450, width: 900, height: 500 };

test('desert map caches small integer pixel sources and restores all modified caller state', t => {
  const surfaces = environment(t), ctx = context(), draw = createDesertMap();
  assert.equal(surfaces.length, 3);
  assert.ok(surfaces.every(canvas => canvas.width <= 512 && canvas.height <= 256));
  for (const canvas of surfaces) for (const call of canvas.ctx.calls) if (call[0] === 'rect') assert.ok(call.slice(3).every(Number.isInteger));
  const before = Object.fromEntries(['fillStyle', 'strokeStyle', 'globalAlpha', 'globalCompositeOperation', 'imageSmoothingEnabled', 'lineWidth', 'dash'].map(key => [key, ctx[key]]));
  draw(ctx, 1500, view);
  for (const [key, expected] of Object.entries(before)) assert.deepEqual(ctx[key], expected, key);
  const sourceCalls = surfaces.map(canvas => canvas.ctx.calls.length);
  for (let i = 0; i < 10; i++) draw(ctx, 1500, view);
  assert.equal(surfaces.length, 3);
  assert.deepEqual(surfaces.map(canvas => canvas.ctx.calls.length), sourceCalls);
  assert.equal(ctx.calls.filter(call => call[0] === 'pattern').length, 1);
});

test('desert map repeats geometry without randomness and separates west wreckage and east array', t => {
  environment(t);
  const random = Math.random;
  Math.random = () => { throw new Error('Background used global randomness'); };
  t.after(() => { Math.random = random; });
  const draw = createDesertMap(), ctx = context();
  function frame(left) { ctx.calls.length = 0; draw(ctx, 1500, { left, top: 450, width: 450, height: 500 }); return structuredClone(ctx.calls.filter(call => call[0] !== 'pattern')); }
  const west = frame(250), east = frame(850);
  assert.deepEqual(frame(250), west);
  assert.notDeepEqual(east, west);
  const crops = calls => calls.filter(call => call[0] === 'image' && call.length === 11).map(call => call.slice(3, 7));
  assert.ok(crops(west).some(crop => crop[0] === 1 && crop[1] === 128));
  assert.ok(crops(east).some(crop => crop[0] === 188 && crop[1] === 132));
  assert.ok(!crops(west).some(crop => crop[1] === 0));
  assert.ok(!crops(east).some(crop => crop[1] === 0));
});

test('actual renderer leaves complete World and checksum untouched across movement pause and restart', t => {
  environment(t);
  const ctx = context(), canvas = { width: 0, height: 0, clientWidth: 1280, clientHeight: 720, getContext() { return ctx; } };
  const render = createRenderer(canvas);
  const world = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: 42 });
  function draw(current) {
    const json = JSON.stringify(current), hash = checksum(current);
    render(current, 1000); render(current, 9000, true);
    assert.equal(JSON.stringify(current), json); assert.equal(checksum(current), hash);
  }
  draw(world);
  for (let i = 0; i < 240; i++) dispatch(world, { kind: 'tick', input: { x: 1, y: 0, dash: i === 0 } });
  draw(world); dispatch(world, { kind: 'pause' }); draw(world);
  draw(createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: 101 }));
});

test('renderer selects terrain by the world stage and keeps shared projectile styles', t => {
  environment(t);
  const previous = globalThis.Path2D;
  globalThis.Path2D = class { rect() {} };
  t.after(() => { if (previous === undefined) delete globalThis.Path2D; else globalThis.Path2D = previous; });
  const ctx = context(), canvas = { width: 0, height: 0, clientWidth: 390, clientHeight: 600, getContext() { return ctx; } };
  ctx.globalAlpha = 1;
  const render = createRenderer(canvas);
  const styles = [];
  for (const [stageId, rulesVersion, background] of [['rainforest', 'rainforest-1', '#283e37'], ['desert-base', 'desert-base-1', 'sand-pattern']]) {
    const world = createWorld({ stageId, rulesVersion, seed: 42 });
    world.shots.push(
      { x: 715, y: 725, vx: 8, vy: 0, life: 10, damage: 1, hostile: false },
      { x: 785, y: 725, vx: -2.2, vy: 0, life: 10, damage: 1, hostile: true }
    );
    const before = JSON.stringify(world);
    ctx.calls.length = 0;
    render(world, 0);
    assert.equal(JSON.stringify(world), before);
    assert.equal(ctx.calls.find(call => call[0] === 'rect')[1], background);
    styles.push(ctx.calls.filter(call => call[0] === 'rect' && ['#d9fff2', '#f6b77c'].includes(call[1])));
  }
  assert.deepEqual(styles[0], [
    ['rect', '#d9fff2', 1, 713, 723, 3, 3],
    ['rect', '#f6b77c', 1, 783, 723, 5, 5]
  ]);
  assert.deepEqual(styles[1], styles[0]);
});
