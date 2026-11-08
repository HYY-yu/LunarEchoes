import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialProgress, applyStageResult, encodeProgress } from '../dist/progress.js';
import { STAGE_ORDER } from '../dist/stage-contract.js';
import { openProgressStorage, PROGRESS_STORAGE_KEY } from '../dist/progress-storage.js';

const progress = id => Object.freeze({ version: 1, highestUnlockedStageId: id });
const advanced = id => ({ kind: 'advanced', progress: progress(id) });
function store(initial = null) {
  let raw = initial;
  const calls = [];
  return {
    calls,
    get raw() { return raw; },
    set raw(value) { raw = value; },
    getItem(key) { calls.push(['get', key]); return raw; },
    setItem(key, value) { calls.push(['set', key, value]); raw = value; }
  };
}
function assertProgress(snapshot, id, kind) {
  assert.equal(snapshot.progress.highestUnlockedStageId, id);
  assert.equal(snapshot.result.kind, kind);
}

test('opening absent or valid progress only reads and exposes immutable snapshots', () => {
  for (const raw of [null, ...STAGE_ORDER.map(id => encodeProgress(progress(id)))]) {
    const storage = store(raw);
    const session = openProgressStorage(storage);
    const view = session.snapshot();
    assert.deepEqual(storage.calls, [['get', PROGRESS_STORAGE_KEY]]);
    assert.equal(view.result.kind, 'loaded');
    assert.equal(view.result.source, raw === null ? 'missing' : 'valid');
    assert.equal(view.progress.highestUnlockedStageId, raw === null ? 'desert-base' : JSON.parse(raw).highestUnlockedStageId);
    assert.equal(view.protection.kind, 'ready');
    for (const object of [session, view, view.progress, view.protection, view.result]) assert.ok(Object.isFrozen(object));
    assert.throws(() => { view.progress.highestUnlockedStageId = 'lunar-echoes'; }, TypeError);
    assert.throws(() => { view.protection.kind = 'ready'; }, TypeError);
  }
});

test('rejected saves preserve exact bytes, request immediate recovery and block future automatic writes', () => {
  for (const [raw, reason] of [
    [' bad JSON 原文\n', 'invalid_json'],
    [' {"version":2,"highestUnlockedStageId":"lunar-echoes"}\n', 'unknown_version'],
    ['{"version":1,"highestUnlockedStageId":"unknown"}', 'unknown_stage'],
    ['{"version":1,"highestUnlockedStageId":"desert-base","extra":1}', 'invalid_fields']
  ]) {
    const storage = store(raw);
    const session = openProgressStorage(storage);
    assert.deepEqual(session.snapshot().result, { kind: 'recovery_required', phase: 'load', reason });
    assert.deepEqual(session.snapshot().protection, { kind: 'protected', reason });
    assertProgress(session.snapshot(), 'desert-base', 'recovery_required');
    assertProgress(session.reset('cancelled'), 'desert-base', 'cancelled');
    assertProgress(session.saveAdvanced(advanced('rainforest')), 'rainforest', 'protected');
    assertProgress(session.saveAdvanced(advanced('antarctica')), 'antarctica', 'protected');
    assert.equal(storage.raw, raw);
    assert.deepEqual(storage.calls, [['get', PROGRESS_STORAGE_KEY]]);
    assert.ok(!JSON.stringify(session.snapshot()).includes(raw));
  }
});

test('successful advanced persistence uses preflight, write, exact readback and skips duplicate or older results', () => {
  const storage = store();
  const session = openProgressStorage(storage);
  const transition = applyStageResult({ progress: createInitialProgress(), stageId: 'desert-base', source: 'live', outcome: 'won' });
  assert.equal(transition.kind, 'advanced');
  assertProgress(session.saveAdvanced(transition), 'rainforest', 'saved');
  assert.equal(storage.raw, encodeProgress(progress('rainforest')));
  assert.deepEqual(storage.calls.map(call => call[0]), ['get', 'get', 'set', 'get']);
  const count = storage.calls.length;
  assertProgress(session.saveAdvanced(transition), 'rainforest', 'unchanged');
  assertProgress(session.saveAdvanced(advanced('desert-base')), 'rainforest', 'unchanged');
  assert.equal(storage.calls.length, count);
  for (const call of storage.calls) assert.equal(call[1], PROGRESS_STORAGE_KEY);
  assert.throws(() => session.saveAdvanced({ kind: 'unchanged' }), TypeError);
});

test('a newer valid disk boundary is retained in both session and storage across sequential sessions', () => {
  const storage = store();
  const first = openProgressStorage(storage);
  const second = openProgressStorage(storage);
  assertProgress(second.saveAdvanced(advanced('space-elevator')), 'space-elevator', 'saved');
  assertProgress(first.saveAdvanced(advanced('rainforest')), 'space-elevator', 'saved');
  assert.equal(storage.raw, encodeProgress(progress('space-elevator')));
  assertProgress(openProgressStorage(storage).snapshot(), 'space-elevator', 'loaded');
});

test('save preflight rejects replacement bad data before writing and retains the in-session advancement', () => {
  for (const raw of ['{', '{"version":9}']) {
    const storage = store();
    const session = openProgressStorage(storage);
    storage.raw = raw;
    const view = session.saveAdvanced(advanced('rainforest'));
    assertProgress(view, 'rainforest', 'recovery_required');
    assert.equal(view.result.phase, 'save_read');
    assert.equal(view.protection.kind, 'protected');
    assert.equal(storage.raw, raw);
    assert.deepEqual(storage.calls.map(call => call[0]), ['get', 'get']);
    assertProgress(session.saveAdvanced(advanced('antarctica')), 'antarctica', 'protected');
    assert.equal(storage.calls.length, 2);
  }
});

test('load and save preflight read failures retain the original exception and protect against writes', () => {
  for (const phase of ['load', 'save_read']) {
    const storage = store(encodeProgress(progress('rainforest')));
    const error = new Error('storage read denied');
    let fail = phase === 'load';
    const session = openProgressStorage({
      getItem(key) { if (fail) throw error; return storage.getItem(key); },
      setItem: (key, value) => storage.setItem(key, value)
    });
    fail = true;
    const view = phase === 'load' ? session.snapshot() : session.saveAdvanced(advanced('antarctica'));
    assert.equal(view.result.kind, 'not_saved');
    assert.equal(view.result.phase, phase);
    assert.equal(view.result.error, error);
    assert.equal(view.protection.kind, 'protected');
    assert.equal(view.protection.error, error);
    assertProgress(session.saveAdvanced(advanced('lunar-echoes')), 'lunar-echoes', 'protected');
    assert.ok(!storage.calls.some(call => call[0] === 'set'));
    assert.equal(storage.raw, encodeProgress(progress('rainforest')));
  }
});

test('a write error keeps the advance, does not roll back and permits only a genuinely newer retry', () => {
  const storage = store();
  const error = new Error('quota');
  let fail = true;
  const session = openProgressStorage({
    getItem: key => storage.getItem(key),
    setItem(key, raw) { if (fail) { storage.calls.push(['failed-set', key]); throw error; } storage.setItem(key, raw); }
  });
  const view = session.saveAdvanced(advanced('rainforest'));
  assertProgress(view, 'rainforest', 'not_saved');
  assert.equal(view.result.phase, 'save_write');
  assert.equal(view.result.error, error);
  assert.equal(view.protection.kind, 'ready');
  assert.equal(storage.raw, null);
  const count = storage.calls.length;
  fail = false;
  assertProgress(session.saveAdvanced(advanced('rainforest')), 'rainforest', 'unchanged');
  assert.equal(storage.calls.length, count);
  assertProgress(session.saveAdvanced(advanced('antarctica')), 'antarctica', 'saved');
  assert.equal(storage.raw, encodeProgress(progress('antarctica')));
});

test('post-write failures and every unequal readback are uncertain without rollback or inferred protection', () => {
  for (const replacement of ['throw', null, '{', '{"version":9}', ' {"version":1,"highestUnlockedStageId":"rainforest"} ']) {
    const storage = store();
    const error = new Error('readback blocked');
    let afterWrite = false;
    let fail = true;
    const session = openProgressStorage({
      getItem(key) {
        if (afterWrite && fail) { afterWrite = false; if (replacement === 'throw') throw error; return replacement; }
        return storage.getItem(key);
      },
      setItem(key, raw) { storage.setItem(key, raw); afterWrite = true; }
    });
    const view = session.saveAdvanced(advanced('rainforest'));
    assertProgress(view, 'rainforest', 'uncertain');
    assert.equal(view.result.phase, 'save_verify');
    assert.equal(view.result.reason, replacement === 'throw' ? 'read_error' : 'mismatch');
    if (replacement === 'throw') assert.equal(view.result.error, error);
    assert.equal(view.protection.kind, 'ready');
    assert.equal(storage.raw, encodeProgress(progress('rainforest')));
    assert.equal(storage.calls.filter(call => call[0] === 'set').length, 1);
    fail = false;
    assertProgress(session.saveAdvanced(advanced('antarctica')), 'antarctica', 'saved');
  }
});

test('cancelled or invalid reset makes no storage call and does not change ready or protected state', () => {
  for (const raw of [encodeProgress(progress('antarctica')), '{"version":2}']) {
    const storage = store(raw);
    const session = openProgressStorage(storage);
    const before = session.snapshot();
    assert.equal(session.reset('cancelled').progress, before.progress);
    assert.equal(session.snapshot().protection, before.protection);
    assert.throws(() => session.reset(undefined), TypeError);
    assert.throws(() => session.reset(true), TypeError);
    assert.equal(storage.raw, raw);
    assert.equal(storage.calls.length, 1);
    if (before.protection.kind === 'ready') assertProgress(session.saveAdvanced(advanced('space-elevator')), 'space-elevator', 'saved');
  }
});

test('confirmed reset rereads, overwrites even an unsupported save, verifies, then resets and unprotects', () => {
  for (const raw of [null, encodeProgress(progress('lunar-echoes')), ' malformed 原文\n', '{"version":8}']) {
    const storage = store(raw);
    const session = openProgressStorage(storage);
    const view = session.reset('confirmed');
    assertProgress(view, 'desert-base', 'reset');
    assert.equal(view.protection.kind, 'ready');
    assert.equal(storage.raw, encodeProgress(createInitialProgress()));
    assert.deepEqual(storage.calls.map(call => call[0]), ['get', 'get', 'set', 'get']);
    assertProgress(session.saveAdvanced(advanced('rainforest')), 'rainforest', 'saved');
  }
});

test('each reset failure stage preserves the prior session and protection and never rolls back', () => {
  for (const initial of [encodeProgress(progress('antarctica')), '{"version":2}']) {
    for (const phase of ['reset_read', 'reset_write', 'reset_verify', 'mismatch']) {
      const storage = store(initial);
      const error = new Error(phase);
      let reading = 0;
      const session = openProgressStorage({
        getItem(key) {
          reading++;
          if (phase === 'reset_read' && reading === 2 || phase === 'reset_verify' && reading === 3) throw error;
          if (phase === 'mismatch' && reading === 3) return '{"version":99}';
          return storage.getItem(key);
        },
        setItem(key, raw) { if (phase === 'reset_write') throw error; storage.setItem(key, raw); }
      });
      const before = session.snapshot();
      const view = session.reset('confirmed');
      assert.equal(view.progress, before.progress);
      assert.equal(view.protection, before.protection);
      assert.equal(view.result.kind, phase === 'reset_read' || phase === 'reset_write' ? 'not_saved' : 'uncertain');
      assert.equal(view.result.phase, phase === 'mismatch' ? 'reset_verify' : phase);
      if (phase !== 'mismatch') assert.equal(view.result.error, error);
      assert.equal(storage.raw, phase === 'reset_read' || phase === 'reset_write' ? initial : encodeProgress(createInitialProgress()));
      assert.equal(storage.calls.filter(call => call[0] === 'set').length, phase === 'reset_read' || phase === 'reset_write' ? 0 : 1);
    }
  }
});

test('injected caller objects and previously exposed snapshots cannot mutate retained progress', () => {
  const storage = store();
  const session = openProgressStorage(storage);
  const previous = session.snapshot();
  const input = { kind: 'advanced', progress: { version: 1, highestUnlockedStageId: 'rainforest' } };
  session.saveAdvanced(input);
  input.progress.highestUnlockedStageId = 'lunar-echoes';
  assert.equal(previous.progress.highestUnlockedStageId, 'desert-base');
  assert.equal(session.snapshot().progress.highestUnlockedStageId, 'rainforest');
  assert.deepEqual(Object.keys(JSON.parse(storage.raw)), ['version', 'highestUnlockedStageId']);
});
