import { stageRules } from './stage-rules.js';
import { type World } from './core.js';
import { createAtlas } from './art.js';
import { createDesertMap } from './desert-map.js';
export function createRenderer(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas 2D is unavailable');
  const ctx = context;
  const atlas = createAtlas();
  let playerMotion: { world: World; tick: number; x: number; y: number; animationTick: number } | undefined;
  const drawMap = createDesertMap();
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
    drawMap(ctx, arena, { left: cameraX - vw / 2, top: cameraY - vh / 2, width: vw, height: vh });
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
    }
  };
}
