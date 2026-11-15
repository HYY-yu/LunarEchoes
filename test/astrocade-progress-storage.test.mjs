import test from 'node:test';
import assert from 'node:assert/strict';
import { openAstrocadeProgressStorage } from '../dist/astrocade-progress-storage.js';

const advanced = stage => ({ kind: 'advanced', progress: { version: 1, highestUnlockedStageId: stage } });

function port(initial = null) {
  let value = initial;
  const calls = [];
  return {
    calls,
    getUserGameState: async () => ({ state: value, success: true }),
    saveUserGameState: async state => { calls.push(state); value = state; return { success: true }; }
  };
}

test('Astrocade unlock is persisted and restored', async () => {
  const bridge = port();
  const session = await openAstrocadeProgressStorage(bridge);
  assert.equal((await session.saveAdvanced(advanced('rainforest'))).result.kind, 'saved');
  assert.equal((await openAstrocadeProgressStorage(bridge)).snapshot().progress.highestUnlockedStageId, 'rainforest');
});

test('unknown progress is protected until an explicit reset', async () => {
  const bridge = port({ version: 9, highestUnlockedStageId: 'rainforest' });
  const session = await openAstrocadeProgressStorage(bridge);
  assert.equal(session.snapshot().result.kind, 'recovery_required');
  assert.equal((await session.saveAdvanced(advanced('rainforest'))).result.kind, 'protected');
  assert.equal(bridge.calls.length, 0);
  assert.equal((await session.reset('cancelled')).result.kind, 'cancelled');
  assert.equal(bridge.calls.length, 0);
  assert.equal((await session.reset('confirmed')).result.kind, 'reset');
  assert.equal(bridge.calls.length, 1);
});

test('failed writes and verification never report a save', async () => {
  const bridge = port();
  bridge.saveUserGameState = async () => ({ success: false });
  const session = await openAstrocadeProgressStorage(bridge);
  assert.equal((await session.saveAdvanced(advanced('rainforest'))).result.kind, 'not_saved');
  assert.equal(session.snapshot().progress.highestUnlockedStageId, 'rainforest');
  const second = port();
  second.saveUserGameState = async () => ({ success: true });
  const other = await openAstrocadeProgressStorage(second);
  assert.equal((await other.saveAdvanced(advanced('rainforest'))).result.kind, 'uncertain');
});

test('overlapping unlocks are serialized and cannot downgrade progress', async () => {
  const bridge = port();
  let release;
  const original = bridge.saveUserGameState;
  bridge.saveUserGameState = async state => {
    if (state.highestUnlockedStageId === 'rainforest') await new Promise(resolve => { release = resolve; });
    return original(state);
  };
  const session = await openAstrocadeProgressStorage(bridge);
  const first = session.saveAdvanced(advanced('rainforest'));
  const second = session.saveAdvanced(advanced('antarctica'));
  while (!release) await new Promise(resolve => setImmediate(resolve));
  release();
  assert.equal((await first).result.kind, 'saved');
  assert.equal((await second).result.kind, 'saved');
  assert.deepEqual(bridge.calls.map(item => item.highestUnlockedStageId), ['rainforest', 'antarctica']);
  assert.equal((await openAstrocadeProgressStorage(bridge)).snapshot().progress.highestUnlockedStageId, 'antarctica');
});
