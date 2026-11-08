import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const dir = process.argv[2];
const { play } = await import(pathToFileURL(`${dir}/scripts/simulate.mjs`));
const { createWorld, dispatch, checksum, UPGRADE_ORDER } = await import(pathToFileURL(`${dir}/dist/core.js`));
const expected = JSON.parse(await readFile('/private/tmp/equipment22-balance-baseline.json', 'utf8'));
const order = ['pulse', 'orbit', 'nova', 'boots', 'hull', 'magnet'];
assert.deepEqual(UPGRADE_ORDER, order);
assert.ok(Object.isFrozen(UPGRADE_ORDER));
assert.throws(() => UPGRADE_ORDER.splice(0, 1), TypeError);
assert.deepEqual(UPGRADE_ORDER, order);
for (const item of expected) {
 const { recording } = play(item.seed); const world = createWorld(item.seed); const offers = [];
 for (const action of recording.actions) { if (action.kind === 'choose') offers.push({tick:world.tick, offers:[...world.phase.offers], choice:action.upgrade}); dispatch(world, action); }
 assert.deepEqual({seed:item.seed, offers, checksum:checksum(world), actions:recording.actions.length}, item);
}
console.log(JSON.stringify({result:'passed', seeds:expected.map(item => item.seed), offers:expected.reduce((n,item)=>n+item.offers.length,0), checksums:expected.map(item => item.checksum)}));
