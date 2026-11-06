import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Synth } from '../dist/audio.js';
class Param { value = 0; setValueAtTime() {} exponentialRampToValueAtTime() {} linearRampToValueAtTime() {} }
class Node {
  gain = new Param(); frequency = new Param(); stopped = false; disconnected = false;
  connect() {} disconnect() { this.disconnected = true; } start(at) { this.at = at; } stop() { this.stopped = true; }
}
class Context {
  static latest; currentTime = 1; destination = {}; sources = []; pending = null;
  constructor() { Context.latest = this; }
  createGain() { return new Node(); }
  createOscillator() { const node = new Node(); this.sources.push(node); return node; }
  resume() { return this.pending ?? Promise.resolve(); }
}
globalThis.AudioContext = Context;
test('mute and hidden create no sources, cancel active and future voices', async () => {
  const synth = new Synth(); synth.setMuted(true); await synth.activate(); synth.play('won'); assert.equal(synth.status.voices, 0);
  synth.reset(); synth.setMuted(false); await synth.activate(); synth.setSession('running'); synth.play('won');
  const context = Context.latest; assert(context.sources.some(node => node.at > context.currentTime));
  synth.setMuted(true); assert(context.sources.every(node => node.stopped && node.disconnected));
  const count = context.sources.length; synth.play('ui-confirm'); assert.equal(context.sources.length, count);
  synth.setMuted(false); await synth.activate(); synth.setHidden(true); synth.play('ui-confirm'); assert.equal(context.sources.length, count); synth.reset();
});
test('pause cancels battle while feedback and exactly one outcome remain possible', async () => {
  const synth = new Synth(); await synth.activate(); synth.setSession('running'); synth.play('boss');
  const context = Context.latest; synth.setSession('paused'); assert(context.sources.every(node => node.stopped));
  synth.play('shot'); assert.equal(context.sources.length, 1); synth.play('ui-confirm'); assert.equal(context.sources.length, 2);
  synth.events(['shot', 'hit', 'won']); assert.equal(context.sources.length, 6);
  const terminal = context.sources.slice(-4); synth.setSession('terminal'); synth.events(['won']); assert.equal(context.sources.length, 6); assert(terminal.every(node => !node.disconnected)); synth.reset();
});
test('duplicate cues throttle and polyphony stays bounded', async () => {
  const synth = new Synth(); await synth.activate(); synth.setSession('running'); synth.events(['shot', 'shot', 'enemy-hit']); synth.events(['shot', 'enemy-hit']);
  assert.equal(Context.latest.sources.length, 2);
  for (let i = 0; i < 100; i++) { Context.latest.currentTime += .2; synth.play('shot'); }
  assert(synth.status.voices <= 24); synth.reset();
});
test('pending activation cannot revive muted hidden or restarted generation', async () => {
  for (const change of [synth => synth.setMuted(true), synth => synth.setHidden(true), synth => synth.reset()]) {
    const synth = new Synth(); await synth.activate(); let resolve;
    Context.latest.pending = new Promise(done => { resolve = done; });
    const pending = synth.activate(); change(synth); resolve(); await pending;
    assert.equal(synth.status.ready, false); assert.equal(synth.status.voices, 0); synth.reset();
  }
});
test('music retains bass and percussion and resume never catches up stale beats', async () => {
  const originalInterval = globalThis.setInterval, originalClear = globalThis.clearInterval;
  let schedule;
  globalThis.setInterval = callback => { schedule = callback; return 1; }; globalThis.clearInterval = () => {};
  try {
    const synth = new Synth(); await synth.activate(); synth.setSession('running'); const context = Context.latest;
    schedule(); assert.equal(context.sources.length, 3);
    assert.deepEqual(context.sources.map(source => source.type), ['square', 'triangle', 'sine']);
    synth.setSession('paused'); assert(context.sources.every(source => source.disconnected));
    context.currentTime += 100; schedule(); assert.equal(context.sources.length, 3);
    synth.setSession('running'); schedule(); assert(context.sources.length <= 6); assert(context.sources.slice(3).every(source => source.at >= context.currentTime)); synth.reset();
  } finally { globalThis.setInterval = originalInterval; globalThis.clearInterval = originalClear; }
});
test('mode transitions cancel old feedback but same mode preserves its own cue', async () => {
  const synth = new Synth(); await synth.activate(); synth.setSession('running'); synth.play('upgrade');
  synth.setSession('paused'); assert.equal(synth.status.voices, 0); synth.play('ui-confirm'); synth.setSession('paused'); assert.equal(synth.status.voices, 1);
  synth.reset();
});
test('pending audio activation preserves the latest session pause state', async () => {
  const synth = new Synth(); await synth.activate(); let resolve;
  Context.latest.pending = new Promise(done => { resolve = done; });
  synth.setSession('running'); const pending = synth.activate(); synth.setSession('paused'); resolve(); await pending;
  assert.equal(synth.status.session, 'paused'); synth.play('shot'); assert.equal(synth.status.voices, 0);
  synth.setSession('running'); synth.play('shot'); assert.equal(synth.status.voices, 1); synth.reset();
});
