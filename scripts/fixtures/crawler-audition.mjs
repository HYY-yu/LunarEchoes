import { createAtlas } from '/art.js';
import { createRenderer } from '/render.js';
import { createWorld, dispatch, checksum } from '/core.js';
const scene = document.getElementById('scene'), render = createRenderer(scene), atlas = createAtlas();
const poses = document.getElementById('poses').getContext('2d');
poses.imageSmoothingEnabled = false;
for (const [index, tick] of [0, 6, 12, 18].entries()) { atlas.draw(poses, 'crawler', 80 + index * 160, 30, 1.5, tick); atlas.draw(poses, 'crawler', 80 + index * 160, 106, 5, tick); }
let world, playing = false, accumulator = 0, last = 0, unchanged = true, lastEvents = [];
function report(error) { document.getElementById('errors').textContent += `${String(error)}\n`; console.error({ event: 'crawler_audition.failure', error: String(error) }); }
function reset() {
  world = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: 42 }); world.fireCooldown = 1000000; world.spawnCooldown = 1000000; world.bossSpawned = true; world.player.invincible = 1000000;
  world.enemies = [
    { id: 1, kind: 'crawler', x: 680, y: 715, hp: 10000, maxHp: 10000, radius: 11, attack: 1000, flash: 0 },
    { id: 2, kind: 'crawler', x: 805, y: 790, hp: 10000, maxHp: 10000, radius: 11, attack: 1000, flash: 0 },
    { id: 3, kind: 'sentry', x: 815, y: 695, hp: 10000, maxHp: 10000, radius: 15, attack: 1000000, flash: 0 }
  ];
  world.nextId = 4; dispatch(world, { kind: 'pause' }); playing = false; accumulator = 0; unchanged = true; lastEvents = [];
}
function resume() { if (world.phase.kind === 'paused') dispatch(world, { kind: 'resume' }); else if (world.phase.kind === 'upgrading') dispatch(world, { kind: 'choose', upgrade: world.phase.offers[0] }); }
function tick() { dispatch(world, { kind: 'tick', input: { x: 0, y: 0, dash: false } }); lastEvents = [...world.events]; }
function control(label, action) { const node = document.createElement('button'); node.textContent = label; node.onclick = () => { try { action(); } catch (error) { report(error); } }; document.getElementById('controls').append(node); }
control('Play', () => { resume(); playing = true; accumulator = 0; });
control('Pause', () => { dispatch(world, { kind: 'pause' }); playing = false; accumulator = 0; });
control('Step 6 ticks', () => { playing = false; if (world.phase.kind === 'upgrading') return; resume(); for (let i = 0; i < 6; i++) tick(); dispatch(world, { kind: 'pause' }); });
control('Upgrade freeze', () => { playing = false; resume(); world.xp = world.threshold; tick(); });
control('Hit crawler', () => {
  if (world.phase.kind === 'upgrading') throw new Error('Use Play to finish the QA upgrade first');
  playing = false; resume(); const crawler = world.enemies[0];
  world.shots.push({ x: crawler.x, y: crawler.y, vx: 0, vy: 0, life: 2, damage: 5, hostile: false }); tick(); dispatch(world, { kind: 'pause' });
});
control('Preview telegraph', () => { playing = false; world.enemies[2].attack = 24; dispatch(world, { kind: 'pause' }); });
control('Restart', reset);
window.addEventListener('error', event => report(event.message)); window.addEventListener('unhandledrejection', event => report(event.reason));
reset();
function frame(now) {
  const delta = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
  if (playing && !document.hidden) { accumulator += delta; while (accumulator >= 1 / 60) { tick(); accumulator -= 1 / 60; if (world.phase.kind !== 'running') { playing = false; break; } } }
  const before = JSON.stringify(world); render(world, now); unchanged = unchanged && before === JSON.stringify(world);
  if (!unchanged) { playing = false; report('Renderer changed World'); }
  document.getElementById('status').textContent = JSON.stringify({ tick: world.tick, phase: world.phase.kind, playing, renderWorldUnchanged: unchanged, checksum: checksum(world), lastEvents, crawlerFlash: world.enemies[0].flash, sentryAttack: world.enemies[2].attack }, null, 2);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
