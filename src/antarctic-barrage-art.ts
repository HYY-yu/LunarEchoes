import { ANTARCTIC_BARRAGE } from './antarctic-barrage.js';
import type { Shot, World } from './core.js';

export function drawAntarcticBarrageWarning(ctx: CanvasRenderingContext2D, world: World) {
  const barrage = world.antarcticBarrage;
  if (!barrage || world.tick >= barrage.firstVolleyTick) return;
  const boss = world.enemies.find(enemy => enemy.id === barrage.bossId && enemy.kind === 'boss' && enemy.hp > 0);
  if (!boss) return;

  const { warningTicks, spread, shotSpeed, shotLife } = ANTARCTIC_BARRAGE;
  const reach = shotSpeed * shotLife;
  const remaining = barrage.firstVolleyTick - world.tick;
  const progress = Math.max(0, 1 - remaining / warningTicks);
  const pulse = progress ** 3;
  const edgeX = reach * Math.cos(spread), edgeY = reach * Math.sin(spread);

  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.rotate(barrage.angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(edgeX, -edgeY);
  ctx.arc(0, 0, reach, -spread, spread);
  ctx.closePath();
  ctx.globalAlpha = .20 + .32 * pulse;
  ctx.fillStyle = '#3759a8';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(edgeX, -edgeY);
  ctx.lineTo(0, 0);
  ctx.lineTo(edgeX, edgeY);
  ctx.globalAlpha = .85;
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#1b2c55';
  ctx.stroke();
  ctx.globalAlpha = .68 + .32 * pulse;
  ctx.lineWidth = 1.5 + 1.5 * pulse;
  ctx.strokeStyle = '#b5ccff';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, reach, -spread, spread);
  for (let x = boss.radius + 20; x < reach - 12; x += 48) {
    ctx.moveTo(x - 8, -7);
    ctx.lineTo(x, 0);
    ctx.lineTo(x - 8, 7);
  }
  ctx.strokeStyle = '#e5ecff';
  ctx.globalAlpha = .55 + .45 * pulse;
  ctx.stroke();
  ctx.restore();
}

export function drawIceShard(ctx: CanvasRenderingContext2D, shot: Shot) {
  ctx.save();
  ctx.translate(shot.x, shot.y);
  ctx.rotate(Math.atan2(shot.vy, shot.vx));
  ctx.beginPath();
  ctx.moveTo(11, 0);
  ctx.lineTo(-6, 5);
  ctx.lineTo(-17, 1);
  ctx.lineTo(-6, -5);
  ctx.closePath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#202c56';
  ctx.stroke();
  ctx.fillStyle = '#819bf4';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(11, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-11, 0);
  ctx.closePath();
  ctx.fillStyle = '#eef2ff';
  ctx.fill();
  ctx.restore();
}
