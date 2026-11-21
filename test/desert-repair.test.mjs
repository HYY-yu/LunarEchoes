import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorld, dispatch, finishRecording, replay } from '../dist/core.js';
import { DESERT_REPAIR_CONTEXT } from '../dist/stage-rules.js';

test('Desert repair records limited pickups and charges only for the first repair', () => {
  const world = createWorld({ ...DESERT_REPAIR_CONTEXT, seed: 42 });
  const actions = [];
  function act(action) {
    actions.push(action);
    dispatch(world, action);
  }
  function tick(x, y) {
    if (world.phase.kind === 'upgrading') {
      act({ kind: 'choose', upgrade: world.phase.offers.find(upgrade => upgrade !== 'boots') });
    }
    act({ kind: 'tick', input: { x, y, dash: false } });
  }
  function moveTo(x, y) {
    for (let i = 0; i < 200 && (world.player.x !== x || world.player.y !== y); i++) {
      tick(Math.sign(x - world.player.x) * Math.min(1, Math.abs(x - world.player.x) / 2.5),
        Math.sign(y - world.player.y) * Math.min(1, Math.abs(y - world.player.y) / 2.5));
    }
    assert.deepEqual([world.player.x, world.player.y], [x, y]);
  }

  const repair = world.desertRepair;
  moveTo(750, 670);
  assert.equal(repair.tower.kind, 'damaged');
  moveTo(750, 750);
  moveTo(550, 750);
  assert.deepEqual(repair.inventory, { wood: 3, iron: 0 });
  assert(repair.supplies.some(supply => supply.material === 'wood' && supply.x === 550));
  moveTo(750, 750);
  moveTo(750, 670);
  assert.deepEqual(repair.inventory, { wood: 3, iron: 0 });
  assert.equal(repair.tower.kind, 'damaged');

  moveTo(750, 750);
  moveTo(950, 750);
  assert.deepEqual(repair.inventory, { wood: 3, iron: 3 });
  assert(repair.supplies.some(supply => supply.material === 'iron' && supply.x === 950));
  moveTo(750, 750);
  moveTo(750, 670);
  assert.equal(repair.tower.kind, 'repaired');
  assert.deepEqual(repair.inventory, { wood: 1, iron: 2 });
  moveTo(750, 750);
  moveTo(550, 750);
  moveTo(750, 750);
  moveTo(750, 670);
  assert.deepEqual(repair.inventory, { wood: 2, iron: 2 });

  while (world.phase.kind === 'running' || world.phase.kind === 'upgrading') tick(0, 0);
  const recording = finishRecording(world, actions);
  assert.deepEqual(replay(recording).desertRepair, repair);
  assert.equal(createWorld({ ...DESERT_REPAIR_CONTEXT, seed: 42 }).desertRepair.tower.kind, 'damaged');
});
