import { WATCHTOWER_STRIKE, type WatchtowerStrike } from './watchtower-strike.js';

const FULL_TURN = Math.PI * 2;
const SEGMENTS = 12;
const CORAL = '#ff826d';
const GOLD = '#ffc86a';
const DARK = '#2d1721';

function drawWarning(ctx: CanvasRenderingContext2D, radius: number, progress: number) {
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, FULL_TURN);
  ctx.fillStyle = '#e4593b';
  ctx.globalAlpha = .12 + progress * .18;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = DARK;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.strokeStyle = CORAL;
  ctx.lineWidth = 3;
  ctx.stroke();

  const trackRadius = radius * .82;
  const segmentAngle = FULL_TURN / SEGMENTS;
  for (let segment = 0; segment < SEGMENTS; segment++) {
    const start = -Math.PI / 2 + segment * segmentAngle + segmentAngle * .12;
    const length = segmentAngle * .76;
    ctx.beginPath();
    ctx.arc(0, 0, trackRadius, start, start + length);
    ctx.strokeStyle = '#71363a';
    ctx.lineWidth = 4;
    ctx.stroke();

    const charge = Math.min(1, progress * SEGMENTS - segment);
    if (charge > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, trackRadius, start, start + length * charge);
      ctx.strokeStyle = GOLD;
      ctx.stroke();
    }
  }

  const chevron = Math.min(8, radius * .13);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2.5;
  for (let quarter = 0; quarter < 4; quarter++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(radius * .68, -chevron);
    ctx.lineTo(radius * .53, 0);
    ctx.lineTo(radius * .68, chevron);
    ctx.stroke();
  }
}

function drawImpact(ctx: CanvasRenderingContext2D, radius: number, progress: number) {
  const shock = 1 - (1 - progress) ** 2;
  const fade = 1 - progress;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, FULL_TURN);
  ctx.fillStyle = '#d6503b';
  ctx.globalAlpha = .5 * fade ** 2;
  ctx.fill();
  ctx.globalAlpha = .8 * fade;
  ctx.strokeStyle = CORAL;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, radius * (.22 + .78 * shock), 0, FULL_TURN);
  ctx.strokeStyle = GOLD;
  ctx.globalAlpha = fade;
  ctx.lineWidth = 2 + fade * 3;
  ctx.stroke();

  const pulse = Math.max(0, 1 - progress * 3);
  if (pulse > 0) {
    const height = Math.min(120, radius * 1.55) * pulse;
    const halfWidth = Math.min(14, radius * .24) * (.5 + pulse * .5);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = CORAL;
    ctx.beginPath();
    ctx.moveTo(-halfWidth * .55, -height);
    ctx.lineTo(halfWidth * .55, -height);
    ctx.lineTo(halfWidth, -halfWidth);
    ctx.lineTo(0, halfWidth * .6);
    ctx.lineTo(-halfWidth, -halfWidth);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff0ad';
    ctx.fillRect(-halfWidth * .3, -height, halfWidth * .6, height + halfWidth * .15);
  }

  ctx.globalAlpha = fade ** 1.5;
  for (let fragment = 0; fragment < 16; fragment++) {
    const angle = (fragment + (fragment % 3) * .17) * FULL_TURN / 16;
    const reach = radius * (.2 + shock * (.52 + (fragment % 4) * .12));
    const x = Math.round(Math.cos(angle) * reach);
    const y = Math.round(Math.sin(angle) * reach - radius * Math.sin(progress * Math.PI) * .18);
    const size = 2 + fragment % 3;
    ctx.fillStyle = fragment % 3 === 0 ? GOLD : CORAL;
    ctx.fillRect(x, y, size, size);
  }
}

export function drawWatchtowerStrike(ctx: CanvasRenderingContext2D, strike: WatchtowerStrike, tick: number) {
  const elapsed = tick - strike.impactTick;
  const duration = strike.kind === 'warning' ? WATCHTOWER_STRIKE.warningTicks : WATCHTOWER_STRIKE.aftermathTicks;
  const progress = Math.max(0, Math.min(1, (strike.kind === 'warning' ? 1 : 0) + elapsed / duration));

  for (const { x, y, radius } of strike.marks) {
    ctx.save();
    ctx.translate(x, y);
    if (strike.kind === 'warning') drawWarning(ctx, radius, progress);
    else drawImpact(ctx, radius, progress);
    ctx.restore();
  }
}
