import test from 'node:test';
import assert from 'node:assert/strict';
import { DESERT_SCENE_SIZE, drawDesertScene } from '../dist/desert-scene.js';
function raster() {
  const pixels = Array(DESERT_SCENE_SIZE.width * DESERT_SCENE_SIZE.height).fill(null);
  const stack = [];
  return {
    pixels, fillStyle: '#ff00ff', imageSmoothingEnabled: true,
    save() { stack.push([this.fillStyle, this.imageSmoothingEnabled]); },
    restore() { [this.fillStyle, this.imageSmoothingEnabled] = stack.pop(); },
    fillRect(x, y, width, height) {
      for (const value of [x, y, width, height]) assert.ok(Number.isInteger(value));
      assert.ok(x >= 0 && y >= 0 && x + width <= DESERT_SCENE_SIZE.width && y + height <= DESERT_SCENE_SIZE.height);
      for (let row = y; row < y + height; row++) for (let col = x; col < x + width; col++) pixels[row * DESERT_SCENE_SIZE.width + col] = this.fillStyle;
    }
  };
}
test('desert illustrations cover their pixel frame, remain deterministic and distinguish outcomes', () => {
  const results = [];
  for (const scene of ['opening', 'victory', 'defeat']) {
    const first = raster(), repeated = raster();
    drawDesertScene(first, scene); drawDesertScene(repeated, scene);
    assert.ok(first.pixels.every(color => color !== null));
    assert.deepEqual(first.pixels, repeated.pixels);
    results.push(first.pixels.join(','));
  }
  assert.equal(new Set(results).size, 3);
});
test('desert illustration leaves the caller drawing state intact', () => {
  for (const scene of ['opening', 'victory', 'defeat']) {
    const target = raster(); drawDesertScene(target, scene);
    assert.equal(target.fillStyle, '#ff00ff');
    assert.equal(target.imageSmoothingEnabled, true);
  }
});
