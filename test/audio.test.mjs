import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Synth } from '../dist/audio.js';

test('pending audio activation preserves the latest session pause state', async t => {
  let resume;
  const resumed = new Promise(resolve => { resume = resolve; });
  const previous = globalThis.AudioContext;
  globalThis.AudioContext = class {
    currentTime = 0;
    destination = {};
    createGain() { return { gain: { value: 0 }, connect() {} }; }
    resume() { return resumed; }
  };
  t.after(() => {
    if (previous === undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext = previous;
  });
  t.mock.method(globalThis, 'setInterval', () => 0);
  const synth = new Synth();
  synth.pause(false);
  const activation = synth.start();
  synth.pause(true);
  resume();
  await activation;
  assert.equal(synth.active, false);
  synth.pause(false);
  assert.equal(synth.active, true);
});
