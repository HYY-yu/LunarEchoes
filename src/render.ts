import { stageRules } from './stage-rules.js';
import { type World } from './core.js';
import { createAtlas } from './art.js';
export function createRenderer(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas 2D is unavailable');
  const ctx = context;
  const atlas = createAtlas();
  let playerMotion: { world: World; tick: number; x: number; y: number; animationTick: number } | undefined;
  const terrain = document.createElement('canvas'); terrain.width = 256; terrain.height = 256;
  const ground = terrain.getContext('2d');
  if (!ground) throw new Error('Terrain canvas is unavailable');
  ground.fillStyle = '#707c80'; ground.fillRect(0, 0, 256, 256);
  let rng = 529;
  function noise() { rng = Math.imul(rng, 1664525) + 1013904223; return (rng >>> 0) / 4294967296; }
  for (let i = 0; i < 1800; i++) { ground.fillStyle = noise() > .5 ? '#7c8687' : '#657277'; ground.fillRect(noise() * 256, noise() * 256, noise() * 3 + 1, 1); }
  for (let i = 0; i < 9; i++) {
    const x = noise() * 256, y = noise() * 256, r = 3 + noise() * 14;
    ground.fillStyle = '#8a9492'; ground.beginPath(); ground.ellipse(x, y + 1, r + 2, r * .53, 0, 0, Math.PI * 2); ground.fill();
    ground.fillStyle = '#536369'; ground.beginPath(); ground.ellipse(x, y - 1, r, r * .48, 0, 0, Math.PI * 2); ground.fill();
    ground.fillStyle = '#616e72'; ground.beginPath(); ground.ellipse(x + 2, y, r - 2, r * .3, 0, 0, Math.PI * 2); ground.fill();
  }
  function structure(x: number, y: number, kind: number) {
    ctx.fillStyle = '#374b55'; ctx.fillRect(x - 43, y + 11, 100, 15);
    if (kind === 0) {
      ctx.fillStyle = '#314550'; ctx.fillRect(x - 35, y - 30, 74, 52);
      ctx.fillStyle = '#b0b9b1'; ctx.fillRect(x - 38, y - 35, 70, 45);
      ctx.fillStyle = '#d0d4c6'; ctx.fillRect(x - 32, y - 40, 58, 7);
      ctx.fillStyle = '#819395'; ctx.fillRect(x - 28, y - 28, 18, 31); ctx.fillRect(x + 3, y - 28, 19, 31);
      ctx.fillStyle = '#142d3b'; ctx.fillRect(x - 24, y - 23, 10, 9); ctx.fillRect(x + 7, y - 23, 11, 9);
      ctx.fillStyle = '#7de4db'; ctx.fillRect(x - 24, y - 21, 10, 2); ctx.fillRect(x + 7, y - 21, 11, 2);
      ctx.fillStyle = '#e9b778'; ctx.fillRect(x - 1, y - 48, 3, 8);
    } else {
      ctx.fillStyle = '#263e51'; ctx.fillRect(x - 38, y - 18, 75, 34);
      ctx.fillStyle = '#496d7e'; ctx.fillRect(x - 41, y - 22, 74, 29);
      ctx.strokeStyle = '#78b5c0'; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x - 37 + i * 12, y - 21); ctx.lineTo(x - 37 + i * 12, y + 7); ctx.stroke(); }
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - 40, y - 19 + i * 11); ctx.lineTo(x + 32, y - 19 + i * 11); ctx.stroke(); }
    }
  }
  return function render(world: World, time: number, title = false) {
    const p = world.player, arena = stageRules(world.context).arenaSize;
    if (!playerMotion || playerMotion.world !== world || world.tick < playerMotion.tick) {
      playerMotion = { world, tick: world.tick, x: p.x, y: p.y, animationTick: 0 };
    } else if (world.tick > playerMotion.tick) {
      if (world.phase.kind === 'running') playerMotion.animationTick = p.x !== playerMotion.x || p.y !== playerMotion.y ? world.tick : 0;
      playerMotion.tick = world.tick; playerMotion.x = p.x; playerMotion.y = p.y;
    }
    const width = Math.ceil(canvas.clientWidth / 2), height = Math.ceil(canvas.clientHeight / 2);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    ctx.imageSmoothingEnabled = false;
    const zoom = Math.max(.8, Math.min(1.2, width / 600));
    const cameraX = title ? 700 + Math.sin(time * .00008) * 30 : world.player.x;
    const cameraY = title ? 660 : world.player.y;
    ctx.save(); ctx.scale(zoom, zoom);
    const vw = width / zoom, vh = height / zoom;
    ctx.translate(vw / 2 - cameraX, vh / 2 - cameraY);
    const pattern = ctx.createPattern(terrain, 'repeat');
    ctx.fillStyle = pattern ?? '#707c80'; ctx.fillRect(cameraX - vw, cameraY - vh, vw * 2, vh * 2);
    ctx.strokeStyle = '#91a9a155'; ctx.lineWidth = 1;
    for (let x = 0; x < arena; x += 100) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, arena); ctx.stroke(); }
    for (let y = 0; y < arena; y += 100) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(arena, y); ctx.stroke(); }
    ctx.strokeStyle = '#a5c5b844'; ctx.setLineDash([5, 7]); ctx.strokeRect(36, 36, arena - 72, arena - 72); ctx.setLineDash([]);
    for (const [x, y] of [[500, 430], [930, 920], [300, 1030], [1170, 330]]) { structure(x, y, 0); structure(x + 105, y + 8, 1); }
    ctx.fillStyle = '#475e60'; ctx.fillRect(638, 617, 134, 106); ctx.fillStyle = '#9ea9a0'; ctx.fillRect(640, 610, 130, 100);
    ctx.strokeStyle = '#657d7c'; ctx.strokeRect(648, 618, 114, 84);
    ctx.fillStyle = '#3c6366'; ctx.fillRect(693, 639, 24, 43); ctx.fillStyle = '#8beddd'; ctx.fillRect(697, 633, 16, 33);
    ctx.fillStyle = '#d8ffef'; ctx.fillRect(701, 635, 4, 26);
    ctx.strokeStyle = '#83e5d655'; ctx.beginPath(); ctx.arc(705, 663, 45 + Math.sin(time * .002) * 2, 0, Math.PI * 2); ctx.stroke();
    for (const crystal of world.crystals) atlas.draw(ctx, 'crystal', crystal.x, crystal.y + Math.sin(time * .004 + crystal.x) * 2, .9);
    for (const enemy of world.enemies) {
      const scale = enemy.kind === 'boss' ? 3.8 : enemy.kind === 'sentry' ? 1.8 : 1.5;
      ctx.fillStyle = '#1a2e3b55'; ctx.beginPath(); ctx.ellipse(enemy.x + 3, enemy.y + 9, scale * 6, scale * 3, 0, 0, Math.PI * 2); ctx.fill();
      if ((enemy.kind === 'sentry' || enemy.kind === 'boss') && enemy.attack < 36) {
        ctx.strokeStyle = '#ffd499'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.radius + 10 + (36 - enemy.attack) / 3, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.globalAlpha = enemy.flash > 0 ? .45 : 1;
      atlas.draw(ctx, enemy.kind, enemy.x, enemy.y + (enemy.kind === 'drone' ? Math.sin(time * .006 + enemy.id) * 3 - 5 : 0), scale, world.tick + enemy.id * 7);
      ctx.globalAlpha = 1;
      if (enemy.kind === 'boss') { ctx.fillStyle = '#172c3d'; ctx.fillRect(enemy.x - 30, enemy.y - 39, 60, 3); ctx.fillStyle = '#f5ba78'; ctx.fillRect(enemy.x - 30, enemy.y - 39, 60 * Math.max(0, enemy.hp / enemy.maxHp), 3); }
    }
    for (const shot of world.shots) {
      ctx.fillStyle = shot.hostile ? '#f6b77c' : '#d9fff2';
      ctx.fillRect(Math.round(shot.x) - 2, Math.round(shot.y) - 2, shot.hostile ? 5 : 3, shot.hostile ? 5 : 3);
      ctx.strokeStyle = shot.hostile ? '#dc916166' : '#8af5e5aa'; ctx.beginPath(); ctx.moveTo(shot.x, shot.y); ctx.lineTo(shot.x - shot.vx * 2, shot.y - shot.vy * 2); ctx.stroke();
    }
    ctx.fillStyle = '#1c344455'; ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + 12, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = p.invincible > 0 && world.tick % 6 < 3 ? .45 : 1;
    atlas.draw(ctx, 'astronaut', p.x, p.y, 1.7, playerMotion.animationTick); ctx.globalAlpha = 1;
    for (let i = 0; i < Math.min(4, world.upgrades.orbit); i++) {
      const angle = world.tick * .055 + i * Math.PI * 2 / Math.min(4, world.upgrades.orbit);
      const x = p.x + Math.cos(angle) * 58, y = p.y + Math.sin(angle) * 58;
      ctx.strokeStyle = '#a4f8e333'; ctx.beginPath(); ctx.arc(p.x, p.y, 58, 0, Math.PI * 2); ctx.stroke(); atlas.draw(ctx, 'drone', x, y, .9);
    }
    for (const effect of world.effects) {
      ctx.globalAlpha = Math.min(1, effect.life / 15);
      ctx.strokeStyle = effect.kind === 'hit' ? '#f2a177' : '#b5ffe5'; ctx.fillStyle = ctx.strokeStyle;
      if (effect.kind === 'nova') {
        const frame = Math.floor((30 - effect.life) / 2);
        const progress = Math.min(1, (frame * 2 + 1) / 30);
        const radius = effect.size * (.14 + .82 * (1 - (1 - progress) ** 2));
        const fragments = effect.life > 16 ? 11 : Math.max(1, Math.ceil(effect.life * 11 / 16));
        for (let segment = 0; segment < 64; segment++) {
          if (segment * 7 % 11 >= fragments) continue;
          const angle = segment * Math.PI / 32;
          const nextAngle = (segment + 1) * Math.PI / 32;
          const reach = radius - (segment * 5 % 9);
          const nextReach = radius - ((segment + 1) * 5 % 9);
          const x = Math.cos(angle) * reach, y = Math.sin(angle) * reach;
          const nextX = Math.cos(nextAngle) * nextReach, nextY = Math.sin(nextAngle) * nextReach;
          for (let point = 0; point < 4; point++) {
            const px = Math.round(effect.x + x + (nextX - x) * point / 4);
            const py = Math.round(effect.y + y + (nextY - y) * point / 4);
            const spark = effect.life >= 27 && segment % 16 === 0;
            const size = spark ? 3 : 2;
            if (Math.max((px - effect.x) ** 2, (px + size - effect.x) ** 2) + Math.max((py - effect.y) ** 2, (py + size - effect.y) ** 2) > effect.size ** 2) continue;
            ctx.fillStyle = spark || segment % 8 === 0 && point < 2 ? '#d9fff2' : '#50d9ee';
            ctx.fillRect(px, py, size, size);
          }
        }
      }
      else for (let i = 0; i < 6; i++) { const a = i * 1.047 + effect.x; const d = (25 - effect.life) * .7; ctx.fillRect(effect.x + Math.cos(a) * d, effect.y + Math.sin(a) * d, 2, 2); }
    }
    ctx.globalAlpha = 1; ctx.restore();
    const shade = ctx.createRadialGradient(width / 2, height / 2, width * .15, width / 2, height / 2, width * .7); shade.addColorStop(0, '#04141b00'); shade.addColorStop(1, '#06182799'); ctx.fillStyle = shade; ctx.fillRect(0, 0, width, height);
    if (title) {
      ctx.fillStyle = '#071420aa'; ctx.fillRect(0, 0, width, height);
      const ex = width * .81, ey = height * .23;
      ctx.fillStyle = '#668d9c'; ctx.beginPath(); ctx.arc(ex, ey, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#80a79e'; ctx.fillRect(ex - 15, ey - 16, 14, 7); ctx.fillRect(ex - 9, ey - 9, 19, 8); ctx.fillRect(ex + 3, ey + 4, 10, 13);
      ctx.fillStyle = '#0c263b88'; ctx.beginPath(); ctx.arc(ex + 12, ey - 3, 25, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#9bdcc355'; ctx.beginPath(); ctx.arc(ex, ey, 28, 0, Math.PI * 2); ctx.stroke();
    }
  };
}
