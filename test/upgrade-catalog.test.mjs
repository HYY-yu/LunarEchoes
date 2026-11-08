import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorld, dispatch, checksum, UPGRADE_ORDER } from '../dist/core.js';

const expected = ['pulse', 'orbit', 'nova', 'boots', 'hull', 'magnet'];
const candidate = JSON.parse(readFileSync(new URL('../docs/evidence/armor22/catalog-candidate.json', import.meta.url)));
const baseline = JSON.parse(readFileSync(new URL('../docs/evidence/equipment22/baseline.json', import.meta.url)));

test('upgrade catalog matches every world upgrade exactly once in offer order', () => {
  assert.deepEqual(UPGRADE_ORDER, expected);
  assert.deepEqual(UPGRADE_ORDER, Object.keys(createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: 42 }).upgrades));
  assert.equal(new Set(UPGRADE_ORDER).size, UPGRADE_ORDER.length);
});

test('external mutation is rejected and offers preserve the catalog and baseline simulation', () => {
  assert.equal(Object.isFrozen(UPGRADE_ORDER), true);
  assert.throws(() => UPGRADE_ORDER.push('pulse'), TypeError);
  assert.throws(() => { UPGRADE_ORDER[0] = 'hull'; }, TypeError);
  assert.throws(() => UPGRADE_ORDER.reverse(), TypeError);
  for (const original of baseline.results) {
    const world = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: original.seed }), offers = [];
    for (let n = 0; n < 8; n++) {
      world.xp = world.threshold;
      dispatch(world, { kind: 'tick', input: { x: 0, y: 0, dash: false } });
      assert.equal(world.phase.kind, 'upgrading');
      offers.push([...world.phase.offers]);
      assert.equal(new Set(world.phase.offers).size, 3);
      assert(world.phase.offers.every(id => UPGRADE_ORDER.includes(id)));
      dispatch(world, { kind: 'choose', upgrade: world.phase.offers[0] });
      assert.deepEqual(UPGRADE_ORDER, expected);
    }
    assert.deepEqual(offers, original.offers);
    assert.equal(checksum(world), candidate.results.find(result => result.seed === original.seed).checksum);
    assert.equal(world.rng, original.rng);
  }
});
