import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer } from '../dist/render.js';
import { createWorld, dispatch } from '../dist/core.js';

function scene(t) {
  const pixels = [], arcs = [];
  const context = {
    fillStyle: '', globalAlpha: 1,
    fillRect(x, y, width, height) { if (this.fillStyle === '#50d9ee' || this.fillStyle === '#d9fff2') pixels.push({ x, y, width, height, color: this.fillStyle, alpha: this.globalAlpha }); },
    arc(...args) { arcs.push(args); },
    createPattern() { return '#707c80'; }, createRadialGradient() { return { addColorStop() {} }; },
    drawImage() {}, ellipse() {}, save() {}, restore() {}, scale() {}, translate() {}, beginPath() {}, fill() {}, stroke() {}, strokeRect() {}, setLineDash() {}, moveTo() {}, lineTo() {}
  };
  const canvas = { width: 0, height: 0, clientWidth: 1280, clientHeight: 720, getContext() { return context; } };
  const previous = globalThis.document;
  globalThis.document = { createElement() { return { getContext() { return { ...context, fillRect() {} }; } }; } };
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
  const render = createRenderer(canvas), world = createWorld(42);
  world.fireCooldown = 100000; world.spawnCooldown = 100000;
  function draw(time = 0) {
    pixels.length = 0; arcs.length = 0;
    const before = structuredClone(world); render(world, time); assert.deepEqual(world, before);
    return structuredClone(pixels);
  }
  return { world, draw, arcs };
}

test('nova has distinct expanding and dissolving pixel frames inside its existing radius', t => {
  const { world, draw } = scene(t);
  for (const size of [113, 149, 239]) {
    const frames = [];
    for (const life of [29, 25, 21, 17, 13, 9, 5, 1]) {
      const fx = { x: 750.3, y: 749.7, kind: 'nova', life, size }; world.effects = [fx];
      const pixels = draw(); assert(pixels.length > 0); assert(pixels.length <= 300);
      for (const pixel of pixels) {
        assert(Number.isInteger(pixel.x) && Number.isInteger(pixel.y));
        for (const x of [pixel.x, pixel.x + pixel.width]) for (const y of [pixel.y, pixel.y + pixel.height]) assert(Math.hypot(x - fx.x, y - fx.y) <= size);
      }
      frames.push(pixels);
    }
    assert.equal(new Set(frames.map(frame => JSON.stringify(frame))).size, frames.length);
    assert(frames[0].every(pixel => Math.hypot(pixel.x - 750.3, pixel.y - 749.7) < size * .4));
    assert(frames.at(-1).length < frames[3].length / 3);
    assert(frames[3].some(pixel => Math.hypot(pixel.x - 750.3, pixel.y - 749.7) > size * .6));
    assert.deepEqual(draw(0), draw(999999));
  }
});

test('nova freezes through pause upgrade and terminal states and repeats after restart', t => {
  const { world, draw } = scene(t);
  world.upgrades.nova = 1;
  dispatch(world, { kind: 'tick', input: { x: 0, y: 0, dash: false } });
  assert.equal(world.effects.find(fx => fx.kind === 'nova').life, 29);
  const ignition = draw(); assert(ignition.length > 0);
  for (const phase of [{ kind: 'paused', previous: 'running' }, { kind: 'upgrading', offers: ['pulse'] }, { kind: 'won' }, { kind: 'lost' }]) {
    world.phase = phase; const frozen = draw();
    for (let i = 0; i < 3; i++) dispatch(world, { kind: 'tick', input: { x: 1, y: 0, dash: false } });
    assert.deepEqual(draw(50000), frozen);
  }
  world.phase = { kind: 'running' };
  for (let i = 0; i < 29; i++) dispatch(world, { kind: 'tick', input: { x: 0, y: 0, dash: false } });
  assert.equal(world.effects.filter(fx => fx.kind === 'nova').length, 0);
  assert.equal(draw().length, 0);
  world.effects = [{ x: 750, y: 750, kind: 'nova', life: 29, size: 113 }];
  assert.deepEqual(draw(), ignition);
});

test('nova leaves enemy danger telegraphs and non nova effects intact', t => {
  const { world, draw, arcs } = scene(t);
  world.enemies = [{ id: 1, kind: 'sentry', x: 820, y: 750, hp: 100, maxHp: 100, radius: 11, attack: 24, flash: 0 }];
  world.effects = [{ x: 750, y: 750, kind: 'nova', life: 17, size: 113 }, { x: 740, y: 750, kind: 'hit', life: 10, size: 18 }];
  assert(draw().length > 0);
  assert(arcs.some(arc => arc[0] === 820 && arc[2] === 25));
});
