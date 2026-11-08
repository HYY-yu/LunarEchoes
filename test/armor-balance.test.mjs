import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist/core.js';
import { playArmorCase } from '../scripts/armor-balance.mjs';
test('balance driver records actual input replay and integer candidate armor without filtering failures', () => {
  for (const strategy of ['stationary', 'novice', 'skilled']) {
    const result = playArmorCase(core, 42, strategy, 'attack');
    assert.equal(result.error, null); assert.equal(result.timeout, false); assert.equal(result.replayMatch, true);
    assert(['won', 'lost'].includes(result.phase)); assert.equal(result.recording.actions.length, result.actionCount);
    assert.equal(result.hp % core.ARMOR_RULES.hpPerCell, 0); assert.equal(result.actualRawDamage / core.ARMOR_RULES.hpPerCell, result.acceptedHits);
    assert.match(result.actionsSha256, /^[0-9a-f]{64}$/);
  }
});
