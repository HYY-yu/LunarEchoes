import { DESERT_CONTEXT, stageRules } from '../dist/stage-rules.js';
const DURATION = stageRules(DESERT_CONTEXT).durationTicks;
import assert from 'node:assert/strict';
import { createWorld, dispatch, replay, checksum, startRecording, finishRecording } from '../dist/core.js';
export function play(seed) {
  const world = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: seed });
  const buffer = startRecording(world);
  function act(action) { buffer.actions.push(action); dispatch(world, action); }
  let iterations = 0;
  while (world.phase.kind !== 'won' && world.phase.kind !== 'lost' && iterations++ < DURATION * 2) {
    if (world.phase.kind === 'upgrading') {
      const priority = world.player.hp < 50 ? ['hull', 'pulse', 'orbit', 'nova', 'boots', 'magnet'] : ['pulse', 'orbit', 'nova', 'hull', 'magnet', 'boots'];
      act({ kind: 'choose', upgrade: priority.find(id => world.phase.offers.includes(id)) });
      continue;
    }
    const p = world.player;
    let x = 0, y = 0;
    let closest = null, nearest = Infinity;
    for (const enemy of world.enemies) {
      const distance = Math.hypot(enemy.x - p.x, enemy.y - p.y);
      if (distance < nearest) { nearest = distance; closest = enemy; }
      if (distance < 120) { x += (p.x - enemy.x) / Math.max(1, distance * distance) * 180; y += (p.y - enemy.y) / Math.max(1, distance * distance) * 180; }
    }
    for (const shot of world.shots) {
      if (!shot.hostile) continue;
      const d = Math.hypot(shot.x - p.x, shot.y - p.y);
      if (d < 65) { x += (p.x - shot.x) / Math.max(1, d * d) * 130; y += (p.y - shot.y) / Math.max(1, d * d) * 130; }
    }
    let crystal = null, cd = Infinity;
    for (const c of world.crystals) { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < cd) { cd = d; crystal = c; } }
    if (crystal) { x += (crystal.x - p.x) / Math.max(1, cd) * .9; y += (crystal.y - p.y) / Math.max(1, cd) * .9; }
    else { x += Math.cos(world.tick / 140) * .5; y += Math.sin(world.tick / 140) * .5; }
    if (p.x < 150) x += 2; if (p.x > 1350) x -= 2;
    if (p.y < 150) y += 2; if (p.y > 1350) y -= 2;
    if (closest && nearest < 30) { x = p.x - closest.x; y = p.y - closest.y; }
    act({ kind: 'tick', input: { x, y, dash: nearest < 45 && world.tick % 30 === 0 } });
    assert(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert(world.enemies.length <= 180);
  }
  const recording = finishRecording(world, buffer.actions);
  assert.equal(checksum(replay(recording)), checksum(world));
  return { world, recording };
}
