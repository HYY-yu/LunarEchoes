import type { Enemy, Shot, World } from './core.js';
import { DESERT_STASIS, type DesertStasis } from './desert-stasis.js';

const STASIS_CYAN = '#c6f5ff';
const STASIS_DARK = '#16323f';
const WARNING_METER_LIFT = 51;

export function desertStasisBossInView(boss: Enemy, view: { left: number; top: number; width: number; height: number }) {
  const extent = boss.radius + 8;
  return boss.x - extent >= view.left && boss.x + extent <= view.left + view.width
    && boss.y - WARNING_METER_LIFT - 4 >= view.top && boss.y + extent <= view.top + view.height;
}

export function drawDesertStasisClock(ctx: CanvasRenderingContext2D, player: World['player'], stasis: DesertStasis, tick: number, active: boolean) {
  const x = Math.round(player.x);
  const y = Math.round(player.y) + 23;
  const remaining = active
    ? (stasis.endsAt - tick) / (stasis.endsAt - stasis.beginsAt)
    : Math.min(1, (stasis.beginsAt - tick) / DESERT_STASIS.warningTicks);
  const noon = -Math.PI / 2;
  const hand = noon + Math.PI * 2 * remaining;

  ctx.save();
  ctx.fillStyle = active ? '#285365' : STASIS_DARK;
  ctx.strokeStyle = '#57899a';
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = STASIS_CYAN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 8, noon, hand);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 4);
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(hand) * 5, y + Math.sin(hand) * 5);
  ctx.stroke();
  ctx.restore();
}

export function drawDesertStasisWarning(ctx: CanvasRenderingContext2D, boss: Enemy, remainingTicks: number) {
  const x = Math.round(boss.x) - 28;
  const y = Math.round(boss.y) - WARNING_METER_LIFT;
  const segments = 6;
  const remaining = segments * Math.min(1, remainingTicks / DESERT_STASIS.warningTicks);

  ctx.fillStyle = STASIS_DARK;
  ctx.fillRect(x - 2, y - 2, 60, 9);
  for (let segment = 0; segment < segments; segment++) {
    const left = x + segment * 9 + 1;
    ctx.fillStyle = '#467080';
    ctx.fillRect(left, y, 8, 5);
    const fill = Math.ceil(8 * Math.min(1, remaining - segment));
    if (fill > 0) {
      ctx.fillStyle = STASIS_CYAN;
      ctx.fillRect(left, y, fill, 5);
    }
  }
}

export function drawDesertStasisRipple(ctx: CanvasRenderingContext2D, boss: Enemy, stasis: DesertStasis, tick: number) {
  const progress = (tick - stasis.beginsAt) / (stasis.endsAt - stasis.beginsAt);
  const radius = boss.radius + 15;
  ctx.save();
  ctx.strokeStyle = STASIS_CYAN;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = .65;
  ctx.beginPath();
  ctx.ellipse(boss.x, boss.y, radius, radius * .72, 0, -.85, .85);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(boss.x, boss.y, radius, radius * .72, 0, Math.PI - .85, Math.PI + .85);
  ctx.stroke();
  ctx.globalAlpha = .45 * (1 - progress);
  const ripple = radius + 4 + 20 * progress;
  ctx.beginPath();
  ctx.ellipse(boss.x, boss.y, ripple, ripple * .72, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawFrozenHostileBolt(ctx: CanvasRenderingContext2D, shot: Shot) {
  const x = Math.round(shot.x);
  const y = Math.round(shot.y);
  ctx.fillStyle = STASIS_DARK;
  ctx.fillRect(x - 6, y - 4, 13, 9);
  ctx.fillStyle = STASIS_CYAN;
  ctx.fillRect(x - 5, y - 3, 3, 7);
  ctx.fillRect(x + 3, y - 3, 3, 7);
  ctx.fillRect(x - 2, y - 3, 5, 1);
  ctx.fillRect(x - 2, y + 3, 5, 1);
  ctx.fillStyle = '#f6b77c';
  ctx.fillRect(x - 1, y - 1, 3, 3);
}
