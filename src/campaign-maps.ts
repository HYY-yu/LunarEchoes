import { createLunarMap } from './lunar-map.js';

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

const iceRifts = [
  [[-90, 440], [105, 490], [204, 472], [301, 535], [425, 520], [498, 552]],
  [[388, 625], [530, 676], [624, 650], [690, 698], [835, 687], [971, 757], [1106, 741], [1280, 817], [1540, 796]],
  [[-47, 1122], [172, 1141], [297, 1090], [489, 1119], [610, 1077]],
  [[982, 1011], [1090, 970], [1237, 998], [1373, 917], [1581, 947]]
] as const;

function drawAntarcticOutskirts(ctx: CanvasRenderingContext2D, view: View) {
  floor(ctx, view, '#586f7e');
  const strideX = 196, strideY = 128;
  const left = Math.floor((view.left - 52) / strideX) * strideX;
  const top = Math.floor((view.top - 24) / strideY) * strideY;
  for (let y = top; y < view.top + view.height; y += strideY) {
    for (let x = left; x < view.left + view.width; x += strideX) {
      if (x >= 0 && x + strideX + 52 <= designSize && y >= 0 && y + strideY + 24 <= designSize) continue;
      const grain = (Math.imul(x + 819, 2654435761) ^ Math.imul(y + 417, 2246822519)) >>> 0;
      const driftX = x + grain % 63, driftY = y + (grain >>> 9) % 70;
      polygon(ctx, '#627b89', [[driftX, driftY + 33], [driftX + 41, driftY + 14], [driftX + 110, driftY], [driftX + 160, driftY + 12], [driftX + 128, driftY + 28], [driftX + 46, driftY + 42]]);
      polygon(ctx, '#718995', [[driftX + 21, driftY + 28], [driftX + 59, driftY + 12], [driftX + 110, driftY + 3], [driftX + 141, driftY + 10], [driftX + 89, driftY + 17]]);
      for (let fleck = 0; fleck < 10; fleck++) {
        const bits = Math.imul(grain ^ fleck, 1597334677) >>> 0;
        fill(ctx, bits & 1 ? '#667e8c' : '#506977', x + (bits >>> 3) % strideX, y + (bits >>> 15) % strideY, 3 + (bits >>> 25) % 10, 2);
      }
    }
  }
}

function drawAntarctica(ctx: CanvasRenderingContext2D, view: View) {
  drawAntarcticOutskirts(ctx, view);
  fill(ctx, '#637b8a', 0, 0, designSize, designSize);
  for (const [x, y] of [[37, 80], [476, 190], [1059, 438], [147, 870], [579, 1163], [1155, 1200]]) {
    polygon(ctx, '#6d8592', [[x, y + 100], [x + 64, y + 36], [x + 146, y + 36], [x + 174, y + 11], [x + 264, y], [x + 286, y + 40], [x + 180, y + 104], [x + 126, y + 104], [x + 101, y + 123], [x + 30, y + 123]]);
    polygon(ctx, '#758c98', [[x + 64, y + 84], [x + 159, y + 49], [x + 219, y + 38], [x + 192, y + 69], [x + 123, y + 87]]);
  }
  texture(ctx, view, ['#5d7585', '#718793', '#6a8392'], 23);
  for (const rift of iceRifts) {
    for (let point = 1; point < rift.length; point++) {
      const [x, y] = rift[point - 1];
      const [nextX, nextY] = rift[point];
      polygon(ctx, '#4c6677', [[x, y], [nextX, nextY], [nextX, nextY + 5], [x, y + 11]]);
      polygon(ctx, '#8298a3', [[x, y + 11], [nextX, nextY + 5], [nextX, nextY + 8], [x, y + 14]]);
    }
  }
  fill(ctx, '#5e727b', 667, 596, 166, 72);
  fill(ctx, '#708592', 673, 600, 154, 62);
  fill(ctx, '#526a78', 687, 618, 126, 31);
  for (let x = 697; x < 809; x += 24) {
    fill(ctx, '#435c6a', x, 623, 19, 19);
    fill(ctx, '#8da1a8', x + 3, 627, 13, 2);
    fill(ctx, '#778f9a', x + 3, 633, 13, 5);
  }
  fill(ctx, '#455867', 702, -72, 96, 72);
  fill(ctx, '#84949d', 708, -67, 84, 29);
  fill(ctx, '#4d6b7e', 719, -57, 62, 8);
  fill(ctx, '#637c8a', 733, -84, 34, 12);
}

function drawElevator(ctx: CanvasRenderingContext2D, view: View, tick: number) {
  floor(ctx, view, '#17252e');
  fill(ctx, '#31444d', 0, 0, designSize, designSize);
  fill(ctx, '#354b56', 512, 0, 476, designSize);
  fill(ctx, '#3c535d', 654, 0, 192, designSize);
  const row = Math.max(0, Math.floor(view.top / 75) * 75);
  for (let y = row; y <= Math.min(designSize, view.top + view.height); y += 75) {
    fill(ctx, '#293c47', 0, y, designSize, 2);
    fill(ctx, '#48606a', 510, y + 4, 480, 2);
    fill(ctx, '#6b6862', 651, y + 14, 5, 23);
    fill(ctx, '#6b6862', 844, y + 14, 5, 23);
    for (const side of [576, 876]) {
      fill(ctx, '#263b47', side, y + 14, 48, 42);
      fill(ctx, '#425662', side + 4, y + 16, 40, 30);
      for (let grille = 6; grille <= 24; grille += 6) fill(ctx, '#304651', side + 8, y + 16 + grille, 32, 2);
    }
  }
  for (const x of [0, 509, 648, 848, 988, 1497]) fill(ctx, '#51626a', x, 0, 3, designSize);
  for (const x of [-19, -39, -61, 1514, 1534, 1556]) fill(ctx, '#465765', x, view.top, 5, Math.ceil(view.height) + 2);
  for (const x of [638, 853]) fill(ctx, '#2a3d48', x, 0, 9, designSize);
  const phase = Math.floor(tick / 2) % 104;
  const firstFrame = Math.floor((view.top - phase) / 104) * 104 + phase;
  for (let y = firstFrame; y < view.top + view.height; y += 104) {
    if (y >= 0 && y <= designSize - 18) {
      for (const x of [638, 853]) fill(ctx, '#65737a', x, y, 9, 18);
    }
    for (const x of [-95, 1500]) {
      fill(ctx, '#243742', x, y, 95, 12);
      fill(ctx, '#5d5960', x + 7, y + 3, 15, 5);
      fill(ctx, '#4d6269', x + 42, y + 3, 29, 4);
    }
  }
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
    case 'antarctica': drawAntarctica(ctx, mapView); break;
    case 'space-elevator': drawElevator(ctx, mapView, tick); break;
    case 'watchtower': drawWatchtower(ctx, mapView); break;
  }
  ctx.restore();
}
