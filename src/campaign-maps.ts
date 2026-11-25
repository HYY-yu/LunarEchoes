import { createLunarMap } from './lunar-map.js';
import { drawAntarcticaTerrain } from './antarctica-map.js';
import { drawSpaceElevatorTerrain } from './space-elevator-map.js';

export type CampaignTerrainStage = 'antarctica' | 'space-elevator' | 'watchtower' | 'lunar-echoes';

type View = Readonly<{ left: number; top: number; width: number; height: number }>;
type Point = readonly [number, number];

const designSize = 1500;
const center = designSize / 2;

function fill(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, width: number, height: number) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), width, height);
}

function polygon(ctx: CanvasRenderingContext2D, color: string, points: readonly [Point, ...Point[]]) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const [[x, y], ...rest] = points;
  ctx.moveTo(x, y);
  for (const [nextX, nextY] of rest) ctx.lineTo(nextX, nextY);
  ctx.closePath();
  ctx.fill();
}

function texture(ctx: CanvasRenderingContext2D, view: View, shades: readonly [string, string, string], grid: number) {
  const firstX = Math.max(0, Math.floor(view.left / grid) * grid);
  const firstY = Math.max(0, Math.floor(view.top / grid) * grid);
  const lastX = Math.min(designSize - grid, view.left + view.width);
  const lastY = Math.min(designSize - grid, view.top + view.height);
  for (let y = firstY; y < lastY; y += grid) {
    for (let x = firstX; x < lastX; x += grid) {
      const grain = (Math.imul(x + 359, 2654435761) ^ Math.imul(y + 173, 2246822519)) >>> 0;
      fill(ctx, shades[grain % shades.length], x + (grain >>> 4) % (grid - 8), y + (grain >>> 12) % (grid - 6), 3 + (grain >>> 8) % 8, 2);
    }
  }
}

function floor(ctx: CanvasRenderingContext2D, view: View, color: string) {
  fill(ctx, color, Math.floor(view.left), Math.floor(view.top), Math.ceil(view.width) + 2, Math.ceil(view.height) + 2);
}

function ring(ctx: CanvasRenderingContext2D, radius: number, color: string, gap: number, steps = 48) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let step = 0; step < steps; step++) {
    const angle = step * Math.PI * 2 / steps;
    if (step % (steps / 4) < gap) continue;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    const nextAngle = (step + 1) * Math.PI * 2 / steps;
    const nextX = center + Math.cos(nextAngle) * radius;
    const nextY = center + Math.sin(nextAngle) * radius;
    const innerX = center + Math.cos(angle) * (radius - 4);
    const innerY = center + Math.sin(angle) * (radius - 4);
    const nextInnerX = center + Math.cos(nextAngle) * (radius - 4);
    const nextInnerY = center + Math.sin(nextAngle) * (radius - 4);
    ctx.moveTo(x, y);
    ctx.lineTo(nextX, nextY);
    ctx.lineTo(nextInnerX, nextInnerY);
    ctx.lineTo(innerX, innerY);
    ctx.closePath();
  }
  ctx.fill();
}

function drawWatchtower(ctx: CanvasRenderingContext2D, view: View) {
  floor(ctx, view, '#101626');
  const grid = 32;
  for (let y = Math.floor(view.top / grid) * grid; y < view.top + view.height; y += grid) {
    for (let x = Math.floor(view.left / grid) * grid; x < view.left + view.width; x += grid) {
      if (x >= 0 && x + grid <= designSize && y >= 0 && y + grid <= designSize) continue;
      const star = (Math.imul(x + 719, 2654435761) ^ Math.imul(y + 313, 2246822519)) >>> 0;
      if (star % 5 === 0) continue;
      const size = star % 9 === 0 ? 3 : 2;
      fill(ctx, size === 3 ? '#9baac4' : star % 2 === 0 ? '#596786' : '#394763', x + (star >>> 6) % 30, y + (star >>> 15) % 30, size, size);
    }
  }
  fill(ctx, '#3e3d50', 0, 0, designSize, designSize);
  fill(ctx, '#45465a', 688, 0, 124, designSize);
  fill(ctx, '#45465a', 0, 688, designSize, 124);
  texture(ctx, view, ['#48485a', '#37394d', '#494559'], 27);
  ring(ctx, 552, '#625362', 2);
  ring(ctx, 311, '#625967', 2);
  ring(ctx, 108, '#746478', 2, 32);
  ring(ctx, 69, '#646077', 1, 32);
  polygon(ctx, '#515064', [[704, 726], [727, 704], [773, 704], [796, 726], [796, 774], [773, 796], [727, 796], [704, 774]]);
  fill(ctx, '#62667d', 741, 725, 18, 51);
  fill(ctx, '#79738a', 728, 725, 44, 12);
  fill(ctx, '#6b647e', 729, 772, 42, 9);
  for (const x of [229, 437, 1001, 1209]) {
    fill(ctx, '#595266', x, 721, 62, 58);
    fill(ctx, '#686275', x + 6, 728, 50, 2);
    fill(ctx, '#686275', x + 6, 768, 50, 2);
  }
  for (const y of [229, 437, 1001, 1209]) {
    fill(ctx, '#595266', 721, y, 58, 62);
    fill(ctx, '#686275', 728, y + 6, 2, 50);
    fill(ctx, '#686275', 768, y + 6, 2, 50);
  }
  fill(ctx, '#544d64', 648, -65, 204, 65);
  fill(ctx, '#6f667f', 744, -109, 12, 73);
  fill(ctx, '#80778b', 721, -88, 58, 11);
}

let drawLunarMap: ReturnType<typeof createLunarMap> | undefined;

export function drawCampaignTerrain(ctx: CanvasRenderingContext2D, view: View, stageId: CampaignTerrainStage, arenaSize: number, tick: number, time = 0): void {
  if (stageId === 'lunar-echoes') {
    drawLunarMap ??= createLunarMap();
    ctx.save();
    drawLunarMap(ctx, view, arenaSize, time);
    ctx.restore();
    return;
  }
  const scale = arenaSize / designSize;
  const mapView = { left: view.left / scale, top: view.top / scale, width: view.width / scale, height: view.height / scale };
  ctx.save();
  ctx.scale(scale, scale);
  switch (stageId) {
    case 'antarctica': drawAntarcticaTerrain(ctx, mapView); break;
    case 'space-elevator': drawSpaceElevatorTerrain(ctx, mapView, tick); break;
    case 'watchtower': drawWatchtower(ctx, mapView); break;
  }
  ctx.restore();
}
