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

function drawAntarctica(ctx: CanvasRenderingContext2D, view: View) {
  floor(ctx, view, '#233745');
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
  floor(ctx, view, '#1e252f');
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

function crater(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const perimeter: readonly [Point, ...Point[]] = [[x - size, y - size * .2], [x - size * .72, y - size * .53], [x - size * .27, y - size * .7], [x + size * .53, y - size * .65], [x + size, y - size * .2], [x + size * .86, y + size * .29], [x + size * .42, y + size * .54], [x - size * .24, y + size * .56], [x - size * .81, y + size * .28]];
  polygon(ctx, '#686c74', perimeter);
  polygon(ctx, '#505763', [[x - size * .8, y - size * .17], [x - size * .56, y - size * .44], [x + size * .44, y - size * .48], [x + size * .74, y - size * .1], [x + size * .55, y + size * .24], [x - size * .28, y + size * .37], [x - size * .65, y + size * .14]]);
  polygon(ctx, '#5e626d', [[x - size * .7, y + size * .02], [x + size * .13, y - size * .06], [x + size * .7, y - size * .14], [x + size * .55, y + size * .24], [x - size * .28, y + size * .37]]);
}

function drawLunar(ctx: CanvasRenderingContext2D, view: View) {
  floor(ctx, view, '#202732');
  fill(ctx, '#5b606c', 0, 0, designSize, designSize);
  const craters = [[141, 154, 137], [465, 503, 91], [839, 578, 70], [675, 843, 54], [1055, 928, 112], [1270, 274, 162], [237, 1104, 155], [417, 1370, 71], [918, 1317, 149], [1283, 1174, 92]];
  for (const [x, y, size] of craters) {
    if (x + size >= view.left && x - size <= view.left + view.width && y + size >= view.top && y - size <= view.top + view.height) crater(ctx, x, y, size);
  }
  texture(ctx, view, ['#535965', '#646a75', '#656473'], 22);
  polygon(ctx, '#454355', [[251, 745], [471, 746], [582, 629], [752, 629], [826, 698], [1041, 698], [1173, 825], [1538, 826], [1538, 885], [1151, 885], [1019, 758], [803, 758], [728, 686], [608, 686], [496, 803], [251, 803]]);
  polygon(ctx, '#6d596c', [[251, 772], [480, 772], [593, 654], [741, 654], [815, 725], [1032, 725], [1163, 853], [1538, 853], [1538, 858], [1161, 858], [1030, 730], [813, 730], [739, 659], [595, 659], [482, 777], [251, 777]]);
  fill(ctx, '#504756', 691, 611, 94, 46);
  fill(ctx, '#655467', 698, 617, 80, 32);
  for (let x = 703; x < 769; x += 15) fill(ctx, '#776577', x, 622, 7, 22);
  fill(ctx, '#464354', 1497, 801, 61, 110);
  fill(ctx, '#746068', 1532, 821, 19, 69);
}

export function drawCampaignTerrain(ctx: CanvasRenderingContext2D, view: View, stageId: CampaignTerrainStage, arenaSize: number, tick: number): void {
  const scale = arenaSize / designSize;
  const mapView = { left: view.left / scale, top: view.top / scale, width: view.width / scale, height: view.height / scale };
  ctx.save();
  ctx.scale(scale, scale);
  switch (stageId) {
    case 'antarctica': drawAntarctica(ctx, mapView); break;
    case 'space-elevator': drawElevator(ctx, mapView, tick); break;
    case 'watchtower': drawWatchtower(ctx, mapView); break;
    case 'lunar-echoes': drawLunar(ctx, mapView); break;
  }
  ctx.restore();
}
