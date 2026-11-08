import { createAtlas } from '/art.js';
import { createRenderer } from '/render.js';
import { createWorld, dispatch, checksum } from '/core.js';
const scene = document.getElementById('scene'), context = scene.getContext('2d', { alpha: false }), originalDraw = context.drawImage;
let observedPose = 0, observedAlpha = 1, observedY = 0;
context.drawImage = function (...args) {
  if (args.length === 9 && args[1] === 0 && args[3] === 16 && args[4] === 16) { observedPose = args[2] / 16; observedAlpha = this.globalAlpha; observedY = args[6]; }
  return originalDraw.apply(this, args);
};
const render = createRenderer(scene), atlas = createAtlas(), poses = document.getElementById('poses').getContext('2d');
poses.imageSmoothingEnabled = false;
for (const [index, tick] of [0, 6, 12, 18].entries()) { atlas.draw(poses, 'astronaut', 80 + index * 160, 30, 1.7, tick); atlas.draw(poses, 'astronaut', 80 + index * 160, 106, 5, tick); }
let world, checkpoint, playing = false, accumulator = 0, last = 0, unchanged = true, lastEvents = [];
const input = { x: 0, y: 0, dash: false };
function report(error) { document.getElementById('errors').textContent += `${String(error)}\n`; console.error({ level: 'error', event: 'astronaut_audition.failure', error: String(error) }); }
function reset() {
  world = createWorld({ stageId: 'desert-base', rulesVersion: 'desert-base-1', seed: 42 }); world.fireCooldown = 1000000; world.spawnCooldown = 1000000; world.bossSpawned = true;
  dispatch(world, { kind: 'pause' }); checkpoint = structuredClone(world); playing = false; input.x = 0; input.y = 0; accumulator = 0; unchanged = true; lastEvents = [];
}
function resume() { if (world.phase.kind === 'paused') dispatch(world, { kind: 'resume' }); else if (world.phase.kind === 'upgrading') dispatch(world, { kind: 'choose', upgrade: world.phase.offers[0] }); }
function tick() { dispatch(world, { kind: 'tick', input }); lastEvents = [...world.events]; }
function sample(now) { const before = JSON.stringify(world); render(world, now); unchanged = unchanged && before === JSON.stringify(world); if (!unchanged) { playing = false; throw new Error('Renderer changed World'); } }
function control(label, action) { const node = document.createElement('button'); node.textContent = label; node.onclick = () => { try { action(); } catch (error) { report(error); } }; document.getElementById('controls').append(node); }
control('Idle', () => { input.x = 0; input.y = 0; resume(); playing = true; accumulator = 0; });
control('Move right', () => { input.x = 1; input.y = 0; resume(); playing = true; accumulator = 0; });
control('Move left', () => { input.x = -1; input.y = 0; resume(); playing = true; accumulator = 0; });
control('Stop', () => { input.x = 0; input.y = 0; });
control('Pause', () => { dispatch(world, { kind: 'pause' }); playing = false; accumulator = 0; });
control('Play', () => { resume(); playing = true; accumulator = 0; });
control('Step 6 ticks', () => { playing = false; if (world.phase.kind === 'upgrading') return; resume(); for (let i = 0; i < 6; i++) tick(); sample(performance.now()); dispatch(world, { kind: 'pause' }); });
control('Upgrade freeze', () => { playing = false; resume(); world.xp = world.threshold; tick(); });
control('Hit', () => {
  if (world.phase.kind === 'upgrading') throw new Error('Use Play to finish the QA upgrade first');
  playing = false; resume(); world.player.invincible = 0;
  world.shots.push({ x: world.player.x, y: world.player.y, vx: 0, vy: 0, life: 2, damage: 5, hostile: true }); tick();
  while (world.tick % 6 >= 3) tick(); sample(performance.now()); dispatch(world, { kind: 'pause' });
});
control('Restart', reset);
control('Rewind', () => { Object.assign(world, structuredClone(checkpoint)); playing = false; input.x = 0; input.y = 0; accumulator = 0; lastEvents = []; });
window.addEventListener('error', event => report(event.message)); window.addEventListener('unhandledrejection', event => report(event.reason));
reset();
function frame(now) {
  try {
    const delta = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
    if (playing && !document.hidden) { accumulator += delta; while (accumulator >= 1 / 60) { tick(); accumulator -= 1 / 60; if (world.phase.kind !== 'running') { playing = false; break; } } }
    sample(now);
    document.getElementById('state').textContent = JSON.stringify({ tick: world.tick, phase: world.phase.kind, playing, input, x: world.player.x, y: world.player.y, observedPose, observedAlpha, observedY, invincible: world.player.invincible, renderWorldUnchanged: unchanged, checksum: checksum(world), lastEvents }, null, 2);
  } catch (error) { report(error); playing = false; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
