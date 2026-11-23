import type { World } from './core.js';
import { rainforestBroodSites, rainforestBroodWarning, type RainforestBrood } from './rainforest-brood.js';

const FULL_TURN = Math.PI * 2;
const BURST_TICKS = 24;
type BroodSite = ReturnType<typeof rainforestBroodSites>[number];

export function rainforestBroodBurstProgress(release: RainforestBrood, tick: number): number | undefined {
  const age = tick - release.tick;
  return age >= 0 && age < BURST_TICKS ? age / BURST_TICKS : undefined;
}

export function drawRainforestBrood(ctx: CanvasRenderingContext2D, world: World, arena: number): void {
  const progress = rainforestBroodWarning(world.context, world.tick);
  if (progress !== undefined) {
    const mother = world.enemies.find(enemy => enemy.kind === 'boss' && enemy.hp > 0);
    if (mother) {
      ctx.save();
      for (const site of rainforestBroodSites(mother.x, mother.y, arena)) drawPuddle(ctx, site, progress);
      ctx.restore();
    }
  }

  const release = world.rainforestBrood;
  if (!release) return;
  const burst = rainforestBroodBurstProgress(release, world.tick);
  if (burst === undefined) return;
  ctx.save();
  for (const site of release.sites) drawBurst(ctx, site, burst);
  ctx.restore();
}

function drawPuddle(ctx: CanvasRenderingContext2D, { x, y }: BroodSite, progress: number): void {
  const radius = 18 + 8 * progress;
  ctx.beginPath();
  ctx.ellipse(x, y, radius, radius * .58, 0, 0, FULL_TURN);
  ctx.fillStyle = '#362248e8';
  ctx.fill();
  ctx.strokeStyle = '#c48bea';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(x, y, radius - 5, (radius - 5) * .53, 0, 0, FULL_TURN);
  ctx.fillStyle = '#9b4fbb';
  ctx.globalAlpha = .46 + .44 * progress;
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.fillStyle = '#f1bcfa';
  for (let mote = 0; mote < 5; mote++) {
    const angle = mote * FULL_TURN / 5 + progress * 1.3;
    const reach = 5 + (mote % 2) * 5 + progress * 3;
    const size = mote % 2 === 0 ? 3 : 2;
    ctx.fillRect(x + Math.cos(angle) * reach - size / 2, y + Math.sin(angle) * reach * .5 - size / 2, size, size);
  }
}

function drawBurst(ctx: CanvasRenderingContext2D, { x, y }: BroodSite, progress: number): void {
  const radius = 9 + 27 * (1 - (1 - progress) ** 2);
  ctx.globalAlpha = (1 - progress) ** 2;
  ctx.beginPath();
  ctx.ellipse(x, y, radius, radius * .55, 0, 0, FULL_TURN);
  ctx.fillStyle = '#9b4fbb';
  ctx.fill();
  ctx.strokeStyle = '#e5a1fb';
  ctx.lineWidth = 3 - progress * 2;
  ctx.stroke();

  for (let mote = 0; mote < 10; mote++) {
    const angle = mote * FULL_TURN / 10;
    const reach = radius * (.45 + (mote % 3) * .25);
    const lift = 4 * progress * (1 - progress) * (8 + (mote % 3) * 6);
    const size = mote % 3 === 0 ? 4 : 3;
    ctx.fillStyle = mote % 2 === 0 ? '#fce0ff' : '#d57fff';
    ctx.fillRect(x + Math.cos(angle) * reach - size / 2, y + Math.sin(angle) * reach * .55 - lift - size / 2, size, size);
  }
}
