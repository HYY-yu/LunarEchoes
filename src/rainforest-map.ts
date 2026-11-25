type View = Readonly<{ left: number; top: number; width: number; height: number }>;
type Point = readonly [number, number];

export const RAINFOREST_ANCHORS = Object.freeze({
  canopy: Object.freeze({ x: 250, y: 750 }),
  ruins: Object.freeze({ x: 750, y: 750 }),
  roots: Object.freeze({ x: 1250, y: 750 })
});

const floorBase = '#253d36';
const floorDeep = '#1f342e';
const floorMid = '#2a443b';
const floorLight = '#314d42';
const floorSun = '#385648';
const soilBase = '#34473a';
const soilMid = '#3d4c3c';
const soilWarm = '#49523f';
const leafSpeck = '#595b42';
const puddleRim = '#2b4748';
const puddleDeep = '#23444b';
const puddleMid = '#2f5960';
const puddleShine = '#5c8c90';
const stoneShadow = '#1a2f2c';
const stoneDark = '#3a4d45';
const stoneMid = '#4c5f55';
const stoneLight = '#5f7266';
const stoneEdge = '#728376';
const plankShadow = '#1b3332';
const plankFrame = '#485b53';
const plankDark = '#596c62';
const plankMid = '#6e7c70';
const plankLight = '#7b8a7d';
const plankRim = '#8d988a';
const thicketDeep = '#0e1f1e';
const thicketMid = '#152b28';
const canopyDark = '#18332e';
const canopyMid = '#21423a';
const canopyLight = '#2c5346';
const canopyRim = '#396654';
const bankShadow = '#192d29';
const bankDeep = '#282019';
const bankDark = '#3c2e22';
const bankMid = '#513f2d';
const bankRoot = '#68533b';
const bankRootHi = '#7c6548';
const mossRim = '#466f51';
const mossHi = '#59845f';
const fenceInk = '#1a2422';
const fenceDark = '#3e382e';
const fenceWood = '#5f5646';
const fenceHi = '#7d735d';
const lanternTeal = '#7ef2d4';
const lanternTealGlow = '#d2fff0';
const lanternAmber = '#f4bc68';
const lanternAmberGlow = '#ffebb5';

function surface(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Rainforest map canvas is unavailable');
  return { canvas, ctx };
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function polygon(ctx: CanvasRenderingContext2D, points: readonly Point[], color: string) {
  const low = Math.min(...points.map(point => point[1]));
  const high = Math.max(...points.map(point => point[1]));
  for (let y = low; y < high; y++) {
    const hits: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        hits.push(Math.round(x1 + (y - y1) * (x2 - x1) / (y2 - y1)));
      }
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2) {
      rect(ctx, hits[i], y, hits[i + 1] - hits[i], 1, color);
    }
  }
}

function hash(x: number, y: number): number {
  return (Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1274126177, 2246822519)) >>> 0;
}

function drawCrown(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, clipSize?: number) {
  const fillBox = (x: number, y: number, w: number, h: number, color: string) => {
    let x0 = Math.round(x);
    let y0 = Math.round(y);
    let x1 = Math.round(x + w);
    let y1 = Math.round(y + h);
    if (clipSize !== undefined) {
      x0 = Math.max(0, x0);
      y0 = Math.max(0, y0);
      x1 = Math.min(clipSize, x1);
      y1 = Math.min(clipSize, y1);
    }
    if (x1 > x0 && y1 > y0) {
      ctx.fillStyle = color;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  };
  const fillPoly = (points: readonly Point[], color: string) => {
    const low = Math.min(...points.map(point => point[1]));
    const high = Math.max(...points.map(point => point[1]));
    for (let y = low; y < high; y++) {
      if (clipSize !== undefined && (y < 0 || y >= clipSize)) continue;
      const hits: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          hits.push(Math.round(x1 + (y - y1) * (x2 - x1) / (y2 - y1)));
        }
      }
      hits.sort((a, b) => a - b);
      for (let i = 0; i + 1 < hits.length; i += 2) {
        fillBox(hits[i], y, hits[i + 1] - hits[i], 1, color);
      }
    }
  };
  fillPoly([
    [cx - rx, cy + 2], [cx - Math.round(rx * 0.72), cy - Math.round(ry * 0.78)],
    [cx, cy - ry], [cx + Math.round(rx * 0.72), cy - Math.round(ry * 0.76)],
    [cx + rx, cy + 2], [cx + Math.round(rx * 0.76), cy + Math.round(ry * 0.8)],
    [cx, cy + ry], [cx - Math.round(rx * 0.76), cy + Math.round(ry * 0.78)]
  ], thicketDeep);
  fillPoly([
    [cx - rx + 3, cy], [cx - Math.round(rx * 0.65), cy - Math.round(ry * 0.74)],
    [cx, cy - ry + 2], [cx + Math.round(rx * 0.66), cy - Math.round(ry * 0.7)],
    [cx + rx - 3, cy], [cx + Math.round(rx * 0.62), cy + Math.round(ry * 0.62)],
    [cx, cy + Math.round(ry * 0.72)], [cx - Math.round(rx * 0.62), cy + Math.round(ry * 0.62)]
  ], canopyDark);
  fillPoly([
    [cx - Math.round(rx * 0.76), cy - 2], [cx - Math.round(rx * 0.48), cy - Math.round(ry * 0.68)],
    [cx + 2, cy - ry + 4], [cx + Math.round(rx * 0.56), cy - Math.round(ry * 0.54)],
    [cx + Math.round(rx * 0.68), cy + 1], [cx + Math.round(rx * 0.2), cy + Math.round(ry * 0.4)],
    [cx - Math.round(rx * 0.45), cy + Math.round(ry * 0.34)]
  ], canopyMid);
  fillPoly([
    [cx - Math.round(rx * 0.45), cy - Math.round(ry * 0.34)],
    [cx - Math.round(rx * 0.12), cy - Math.round(ry * 0.74)],
    [cx + Math.round(rx * 0.34), cy - Math.round(ry * 0.56)],
    [cx + Math.round(rx * 0.38), cy - Math.round(ry * 0.16)],
    [cx - Math.round(rx * 0.18), cy - Math.round(ry * 0.08)]
  ], canopyLight);
  fillBox(cx - Math.round(rx * 0.24), cy - Math.round(ry * 0.62), Math.max(4, Math.round(rx * 0.42)), 2, canopyRim);
  fillBox(cx + Math.round(rx * 0.1), cy - Math.round(ry * 0.42), Math.max(3, Math.round(rx * 0.24)), 2, canopyRim);
}

function buildFloorTile(ctx: CanvasRenderingContext2D) {
  rect(ctx, 0, 0, 128, 128, floorBase);
  for (let i = 0; i < 24; i++) {
    const h = hash(i * 41 + 7, i * 83 + 13);
    const cx = 10 + (h % 108);
    const cy = 10 + ((h >>> 8) % 108);
    const rx = 6 + ((h >>> 15) % 8);
    const ry = 4 + ((h >>> 20) % 5);
    const tone = i % 3 === 0 ? floorDeep : floorMid;
    rect(ctx, cx - rx + 2, cy - ry, rx * 2 - 4, ry * 2, tone);
    rect(ctx, cx - rx, cy - ry + 2, rx * 2, ry * 2 - 4, tone);
    if (i % 3 === 1) {
      rect(ctx, cx - rx + 4, cy - ry + 2, Math.max(4, rx * 2 - 8), Math.max(2, ry * 2 - 4), floorLight);
    }
  }
  for (let i = 0; i < 120; i++) {
    const h = hash(i * 23 + 3, i * 67 + 19);
    const x = h % 126;
    const y = (h >>> 7) % 126;
    const w = 1 + ((h >>> 14) % 3);
    const color = i % 11 === 0 ? floorSun : i % 4 === 0 ? floorDeep : i % 2 === 0 ? floorMid : floorLight;
    rect(ctx, x, y, w, 1 + ((h >>> 18) % 2), color);
  }
  for (let i = 0; i < 10; i++) {
    const h = hash(i * 97 + 5, i * 31 + 11);
    const x = 4 + (h % 120);
    const y = 4 + ((h >>> 8) % 120);
    rect(ctx, x, y, 2, 1, leafSpeck);
  }
}

function buildBorderSurface(ctx: CanvasRenderingContext2D) {
  rect(ctx, 0, 0, 128, 128, thicketDeep);
  for (const [cx, cy, rx, ry] of [
    [18, 20, 28, 22], [68, 16, 30, 22], [112, 26, 26, 20],
    [40, 56, 30, 24], [92, 62, 28, 22], [6, 72, 26, 20],
    [26, 108, 28, 22], [78, 104, 30, 22], [118, 114, 24, 20]
  ]) {
    for (const ox of [-128, 0, 128]) {
      for (const oy of [-128, 0, 128]) {
        const px = cx + ox;
        const py = cy + oy;
        if (px + rx < 0 || px - rx > 128 || py + ry < 0 || py - ry > 128) continue;
        drawCrown(ctx, px, py, rx, ry, 128);
      }
    }
  }
  for (let i = 0; i < 36; i++) {
    const h = hash(i * 53 + 11, i * 71 + 3);
    rect(ctx, h % 125, (h >>> 8) % 125, 2, 2, i % 3 === 0 ? canopyRim : thicketMid);
  }

  drawCrown(ctx, 168, 32, 26, 20);
  drawCrown(ctx, 226, 32, 22, 18);

  polygon(ctx, [
    [142, 92], [156, 76], [184, 70], [214, 72], [238, 82],
    [246, 98], [230, 112], [198, 116], [164, 110], [146, 102]
  ], soilBase);
  polygon(ctx, [
    [156, 90], [172, 79], [200, 77], [226, 84],
    [232, 98], [212, 108], [180, 106], [160, 100]
  ], soilMid);
  polygon(ctx, [
    [172, 90], [190, 84], [212, 87], [218, 97], [198, 101], [176, 98]
  ], soilWarm);
  for (let i = 0; i < 14; i++) {
    const h = hash(i * 47 + 9, i * 29 + 5);
    rect(ctx, 160 + (h % 66), 80 + ((h >>> 8) % 26), 2 + (h % 3), 1, i % 3 === 0 ? leafSpeck : floorLight);
  }
}

function buildAtlas(a: CanvasRenderingContext2D) {
  polygon(a, [
    [14, 34], [28, 20], [58, 16], [84, 22], [96, 36],
    [86, 52], [56, 56], [26, 50]
  ], puddleRim);
  polygon(a, [
    [20, 34], [32, 23], [58, 20], [80, 25], [89, 36],
    [80, 48], [56, 51], [30, 46]
  ], puddleDeep);
  polygon(a, [
    [26, 33], [38, 25], [60, 23], [78, 29], [82, 37], [68, 45], [40, 43]
  ], puddleMid);
  rect(a, 34, 27, 16, 2, puddleShine);
  rect(a, 58, 29, 10, 2, puddleShine);
  rect(a, 46, 38, 12, 1, puddleShine);

  polygon(a, [
    [122, 38], [134, 24], [156, 20], [174, 28], [178, 42], [160, 50], [132, 48]
  ], puddleRim);
  polygon(a, [
    [128, 37], [138, 27], [156, 24], [170, 31], [171, 41], [156, 46], [136, 44]
  ], puddleMid);
  rect(a, 140, 29, 12, 2, puddleShine);

  for (const [fx, fy] of [[218, 34], [260, 34]]) {
    for (const [dx, dy, w, h, color] of [
      [-14, -4, 28, 8, floorDeep], [-4, -12, 8, 24, floorDeep],
      [-12, -3, 10, 4, canopyMid], [2, -3, 10, 4, canopyMid],
      [-3, -10, 6, 9, canopyLight], [-3, 1, 6, 9, canopyMid],
      [-9, -8, 6, 5, canopyLight], [4, -8, 6, 5, canopyRim],
      [-9, 3, 6, 5, canopyMid], [4, 3, 6, 5, canopyLight],
      [-2, -2, 4, 4, mossHi]
    ] as const) {
      rect(a, fx + dx, fy + dy, w, h, color);
    }
  }

  for (const [rx, ry, rw, rh] of [
    [20, 88, 42, 20], [66, 92, 34, 18], [34, 112, 46, 16], [84, 114, 28, 16]
  ]) {
    rect(a, rx + 2, ry + 2, rw, rh, stoneShadow);
    rect(a, rx, ry, rw, rh, stoneDark);
    rect(a, rx + 2, ry + 2, rw - 4, rh - 4, stoneMid);
    rect(a, rx + 3, ry + 2, rw - 7, 2, stoneLight);
    rect(a, rx + Math.floor(rw / 2), ry + 4, 2, rh - 7, stoneDark);
  }
  rect(a, 24, 92, 10, 6, mossRim);
  rect(a, 70, 96, 12, 5, mossRim);
  rect(a, 52, 116, 14, 5, canopyLight);

  for (let i = 0; i < 16; i++) {
    const px = 152 + i * 7;
    const py = 104 + Math.round(Math.sin(i * 0.45) * 9);
    const thick = i < 4 ? 7 : i < 10 ? 5 : 3;
    rect(a, px, py + thick, 9, 2, floorDeep);
    rect(a, px, py, 9, thick, bankDark);
    rect(a, px + 1, py + 1, 7, Math.max(1, thick - 2), bankRoot);
    if (i % 2 === 0) rect(a, px + 2, py, 5, 1, bankRootHi);
    if (i % 4 === 1) rect(a, px + 2, py + 1, 4, 2, mossRim);
  }

  polygon(a, [
    [304, 54], [326, 30], [368, 22], [412, 28], [442, 46],
    [438, 72], [404, 86], [352, 88], [314, 74]
  ], floorMid);
  polygon(a, [
    [322, 54], [342, 36], [378, 32], [414, 40], [422, 62], [392, 74], [346, 74]
  ], floorLight);
  polygon(a, [
    [346, 52], [366, 42], [394, 44], [402, 58], [378, 64], [352, 60]
  ], floorSun);
}

type RainforestAssets = {
  tile: ReturnType<typeof surface>;
  border: ReturnType<typeof surface>;
  atlas: ReturnType<typeof surface>;
  patterns: WeakMap<CanvasRenderingContext2D, CanvasPattern>;
};

let cachedAssets: RainforestAssets | undefined;

function getAssets(): RainforestAssets | undefined {
  if (cachedAssets) return cachedAssets;
  if (typeof document === 'undefined') return undefined;
  const tile = surface(128, 128);
  const border = surface(256, 128);
  const atlas = surface(512, 160);
  buildFloorTile(tile.ctx);
  buildBorderSurface(border.ctx);
  buildAtlas(atlas.ctx);
  cachedAssets = { tile, border, atlas, patterns: new WeakMap() };
  return cachedAssets;
}

export function drawRainforestTerrain(ctx: CanvasRenderingContext2D, view: View): void {
  const assets = getAssets();
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  const viewRight = view.left + view.width;
  const viewBottom = view.top + view.height;

  if (assets) {
    let pattern = assets.patterns.get(ctx);
    if (!pattern) {
      const created = ctx.createPattern(assets.tile.canvas, 'repeat');
      if (created) {
        pattern = created;
        assets.patterns.set(ctx, created);
      }
    }
    ctx.fillStyle = pattern ?? floorBase;
  } else {
    ctx.fillStyle = floorBase;
  }
  ctx.fillRect(Math.floor(view.left), Math.floor(view.top), Math.ceil(view.width) + 2, Math.ceil(view.height) + 2);

  const visible = (x: number, y: number, w: number, h: number) =>
    x + w >= view.left - 8 && x <= viewRight + 8 && y + h >= view.top - 8 && y <= viewBottom + 8;

  const drawRect = (x: number, y: number, w: number, h: number, color: string) => {
    if (!visible(x, y, w, h)) return;
    const dx = Math.round(x);
    const dy = Math.round(y);
    const dw = Math.max(1, Math.round(x + w) - dx);
    const dh = Math.max(1, Math.round(y + h) - dy);
    ctx.fillStyle = color;
    ctx.fillRect(dx, dy, dw, dh);
  };

  const stampAtlas = (sx: number, sy: number, sw: number, sh: number, x: number, y: number, w: number, h: number) => {
    if (!assets || !visible(x, y, w, h)) return;
    ctx.drawImage(assets.atlas.canvas, sx, sy, sw, sh, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };

  const stampBorder = (sx: number, sy: number, sw: number, sh: number, x: number, y: number, w: number, h: number) => {
    if (!assets || !visible(x, y, w, h)) return;
    ctx.drawImage(assets.border.canvas, sx, sy, sw, sh, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };

  for (const [x, y, w, h] of [
    [130, 150, 270, 128],
    [1010, 160, 285, 132],
    [155, 1020, 280, 126],
    [1045, 1055, 275, 126],
    [595, 1185, 260, 112],
    [610, 195, 250, 108]
  ]) {
    stampBorder(138, 66, 112, 54, x, y, w, h);
  }

  for (const [x, y, w, h] of [
    [185, 365, 220, 104],
    [1040, 385, 225, 108],
    [220, 860, 215, 102],
    [1065, 845, 220, 104],
    [455, 1275, 225, 102],
    [875, 1265, 225, 102]
  ]) {
    stampAtlas(300, 18, 148, 74, x, y, w, h);
  }

  for (const [x, y, w, h, small] of [
    [255, 275, 92, 52, false],
    [1140, 295, 76, 44, true],
    [245, 1145, 88, 50, false],
    [1155, 1135, 90, 50, false],
    [1175, 675, 72, 42, true]
  ] as const) {
    if (small) stampAtlas(118, 16, 66, 38, x, y, w, h);
    else stampAtlas(10, 12, 92, 48, x, y, w, h);
  }

  for (const [x, y, w, h] of [
    [265, 530, 124, 58],
    [1055, 555, 118, 54],
    [325, 1045, 112, 52]
  ]) {
    stampAtlas(16, 84, 102, 50, x, y, w, h);
  }

  for (const [x, y, w, h] of [
    [1015, 235, 134, 42],
    [1150, 480, 130, 40],
    [1045, 935, 136, 42],
    [1160, 1265, 128, 38],
    [110, 445, 126, 38],
    [125, 960, 124, 38]
  ]) {
    stampAtlas(148, 88, 120, 36, x, y, w, h);
  }

  for (const [fx, fy] of [
    [98, 148], [142, 310], [88, 625], [116, 855], [96, 1185], [165, 1375],
    [1385, 165], [1345, 390], [1390, 640], [1365, 895], [1385, 1195], [1325, 1380],
    [410, 94], [610, 106], [895, 98], [1120, 104],
    [395, 1396], [625, 1388], [890, 1392], [1125, 1386],
    [525, 535], [965, 535], [525, 965], [965, 965]
  ]) {
    stampAtlas(200, 16, 36, 36, fx - 18, fy - 18, 36, 36);
  }

  const trailStep = (x: number, y: number, horizontal: boolean, fade: boolean) => {
    const base = fade ? floorMid : soilBase;
    const inner = fade ? floorLight : soilMid;
    if (horizontal) {
      drawRect(x - 2, y - 13, 20, 26, base);
      drawRect(x, y - 9, 16, 18, inner);
    } else {
      drawRect(x - 13, y - 2, 26, 20, base);
      drawRect(x - 9, y, 18, 16, inner);
    }
  };

  for (let i = 0; i < 20; i++) {
    const d = 222 + i * 16;
    const curve = Math.round(Math.sin(i * 0.22) * i * 1.9);
    const fade = i > 13;
    trailStep(750 - d, 750 - curve, true, fade);
    trailStep(750 + d, 750 + curve, true, fade);
    trailStep(750 + curve, 750 - d, false, fade);
    trailStep(750 - curve, 750 + d, false, fade);
  }

  const drawSteppingStone = (x: number, y: number, w: number, h: number) => {
    drawRect(x + 1, y + 2, w, h, stoneShadow);
    drawRect(x, y, w, h, stoneDark);
    drawRect(x + 1, y + 1, w - 2, h - 2, stoneMid);
    drawRect(x + 2, y + 1, w - 4, 2, stoneLight);
  };

  for (const [sx, sy, sw, sh] of [
    [734, 514, 18, 12], [755, 504, 14, 10], [741, 488, 16, 11],
    [736, 974, 18, 12], [756, 988, 15, 11], [740, 1004, 16, 10],
    [514, 734, 12, 18], [500, 754, 11, 15], [484, 740, 11, 16],
    [974, 736, 12, 18], [988, 755, 11, 15], [1004, 742, 10, 16]
  ]) {
    drawSteppingStone(sx, sy, sw, sh);
  }

  if (visible(510, 510, 480, 480)) {
    drawRect(560, 564, 380, 372, stoneShadow);
    drawRect(564, 560, 372, 380, stoneShadow);
    drawRect(566, 566, 368, 368, stoneDark);
    drawRect(574, 574, 352, 352, stoneMid);

    for (let step = 0; step < 18; step++) {
      const h = hash(step * 43 + 7, step * 79 + 13);
      const along = 574 + step * 20;
      const ext = 5 + (h % 9);
      drawSteppingStone(along, 560 - ext, 15, ext + 3);
      drawSteppingStone(along, 938, 15, ext + 3);
      drawSteppingStone(560 - ext, along, ext + 3, 15);
      drawSteppingStone(938, along, ext + 3, 15);
    }

    for (const [cx, cy] of [[590, 590], [910, 590], [910, 910], [590, 910]]) {
      drawRect(cx - 30, cy - 24, 60, 48, stoneShadow);
      drawRect(cx - 27, cy - 21, 54, 42, stoneDark);
      drawRect(cx - 24, cy - 18, 48, 36, stoneMid);
      drawRect(cx - 22, cy - 16, 44, 2, stoneEdge);
      drawRect(cx - 23, cy - 15, 4, 4, mossRim);
      drawRect(cx + 19, cy + 11, 4, 4, mossRim);
    }

    const drawBoardwalk = (x: number, y: number, w: number, h: number, vertical: boolean) => {
      drawRect(x + 2, y + 3, w, h, plankShadow);
      drawRect(x, y, w, h, plankFrame);
      if (vertical) {
        drawRect(x + 2, y + 1, 3, h - 2, plankDark);
        drawRect(x + w - 5, y + 1, 3, h - 2, plankDark);
        for (let py = y + 2; py < y + h - 2; py += 6) {
          drawRect(x + 5, py, w - 10, 4, ((py - y) / 6) % 2 === 0 ? plankLight : plankMid);
          drawRect(x + 5, py, w - 10, 1, plankRim);
        }
      } else {
        drawRect(x + 1, y + 2, w - 2, 3, plankDark);
        drawRect(x + 1, y + h - 5, w - 2, 3, plankDark);
        for (let px = x + 2; px < x + w - 2; px += 6) {
          drawRect(px, y + 5, 4, h - 10, ((px - x) / 6) % 2 === 0 ? plankLight : plankMid);
          drawRect(px, y + 5, 1, h - 10, plankRim);
        }
      }
    };

    drawBoardwalk(724, 536, 52, 56, true);
    drawRect(736, 540, 28, 2, lanternAmber);
    drawBoardwalk(724, 908, 52, 56, true);
    drawRect(736, 958, 28, 2, lanternAmber);
    drawBoardwalk(536, 724, 56, 52, false);
    drawRect(540, 736, 2, 28, lanternAmber);
    drawBoardwalk(908, 724, 56, 52, false);
    drawRect(958, 736, 2, 28, lanternAmber);

    for (const [mx, my, mw, mh] of [
      [564, 626, 26, 10], [566, 838, 24, 10], [912, 642, 24, 10], [910, 822, 26, 10],
      [632, 564, 30, 10], [824, 564, 28, 10], [642, 926, 30, 10], [820, 926, 28, 10]
    ]) {
      drawRect(mx, my, mw, mh, canopyMid);
      drawRect(mx + 2, my + 1, mw - 6, 4, mossRim);
      drawRect(mx + 5, my + 2, Math.max(4, mw - 14), 2, mossHi);
    }
  }

  const fillThicketBlock = (x0: number, y0: number, x1: number, y1: number) => {
    if (x1 <= x0 || y1 <= y0) return;
    drawRect(x0, y0, x1 - x0, y1 - y0, thicketDeep);
    const startX = Math.floor(x0 / 128) * 128;
    const startY = Math.floor(y0 / 128) * 128;
    for (let ty = startY; ty < y1; ty += 128) {
      for (let tx = startX; tx < x1; tx += 128) {
        const cx0 = Math.max(tx, x0);
        const cy0 = Math.max(ty, y0);
        const cx1 = Math.min(tx + 128, x1);
        const cy1 = Math.min(ty + 128, y1);
        const sw = Math.ceil(cx1 - cx0);
        const sh = Math.ceil(cy1 - cy0);
        if (sw > 0 && sh > 0) stampBorder(Math.floor(cx0 - tx), Math.floor(cy0 - ty), sw, sh, cx0, cy0, sw, sh);
      }
    }
  };

  const worldLeft = Math.floor(view.left) - 24;
  const worldTop = Math.floor(view.top) - 24;
  const worldRight = Math.ceil(viewRight) + 24;
  const worldBottom = Math.ceil(viewBottom) + 24;

  if (worldTop < 20) fillThicketBlock(worldLeft, worldTop, worldRight, 20);
  if (worldBottom > 1480) fillThicketBlock(worldLeft, 1480, worldRight, worldBottom);
  if (worldLeft < 20) fillThicketBlock(worldLeft, Math.max(worldTop, 20), 20, Math.min(worldBottom, 1480));
  if (worldRight > 1480) fillThicketBlock(1480, Math.max(worldTop, 20), worldRight, Math.min(worldBottom, 1480));

  for (let x = 20; x < 1480; x += 36) {
    const segW = Math.min(36, 1480 - x);
    const hn = hash(x + 17, 11);
    const stepN = (hn % 7) - 3;
    if (visible(x, -22, segW + 4, 68)) {
      drawRect(x, 22 + stepN, segW, 11, bankShadow);
      drawRect(x, 12 + stepN, segW, 11, bankDeep);
      drawRect(x, 2 + stepN, segW, 11, bankDark);
      drawRect(x, -7 + stepN, segW, 10, bankMid);
      drawRect(x, -13 + stepN, segW, 6, mossRim);
      drawRect(x, -15 + stepN, segW, 2, mossHi);
      drawRect(x + 6 + (hn % 10), -5 + stepN, 4, 22, bankRoot);
      drawRect(x + 7 + (hn % 10), -5 + stepN, 2, 18, bankRootHi);
      if (hn % 2 === 0) drawRect(x + 22, -2 + stepN, 3, 16, bankRoot);
    }
    const hs = hash(x + 29, 12);
    const stepS = (hs % 7) - 3;
    if (visible(x, 1466, segW + 4, 62)) {
      drawRect(x, 1472 + stepS, segW, 5, bankDeep);
      drawRect(x, 1477 + stepS, segW, 6, mossHi);
      drawRect(x, 1483 + stepS, segW, 8, mossRim);
      drawRect(x, 1491 + stepS, segW, 12, bankDark);
      drawRect(x + 8 + (hs % 10), 1479 + stepS, 4, 18, bankRoot);
    }
  }

  for (let y = 20; y < 1480; y += 36) {
    const segH = Math.min(36, 1480 - y);
    const hw = hash(13, y + 41);
    const stepW = (hw % 7) - 3;
    if (visible(-22, y, 66, segH + 4)) {
      drawRect(22 + stepW, y, 11, segH, bankShadow);
      drawRect(13 + stepW, y, 10, segH, bankDeep);
      drawRect(3 + stepW, y, 11, segH, bankDark);
      drawRect(-6 + stepW, y, 10, segH, bankMid);
      drawRect(-12 + stepW, y, 6, segH, mossRim);
      drawRect(-14 + stepW, y, 2, segH, mossHi);
      drawRect(-4 + stepW, y + 6 + (hw % 10), 22, 4, bankRoot);
      drawRect(-4 + stepW, y + 7 + (hw % 10), 18, 2, bankRootHi);
    }
    const he = hash(14, y + 53);
    const stepE = (he % 7) - 3;
    if (visible(1466, y, 66, segH + 4)) {
      drawRect(1472 + stepE, y, 5, segH, bankDeep);
      drawRect(1477 + stepE, y, 6, segH, mossHi);
      drawRect(1483 + stepE, y, 8, segH, mossRim);
      drawRect(1491 + stepE, y, 12, segH, bankDark);
      drawRect(1479 + stepE, y + 8 + (he % 10), 18, 4, bankRoot);
    }
  }

  for (const [cx, cy] of [[16, 16], [1484, 16], [16, 1484], [1484, 1484]]) {
    drawRect(cx - 24, cy - 24, 48, 48, bankDeep);
    drawRect(cx - 20, cy - 20, 40, 40, bankDark);
    drawRect(cx - 15, cy - 15, 30, 30, mossRim);
    drawRect(cx - 11, cy - 11, 22, 6, mossHi);
  }

  const drawHFence = (x: number, y: number, w: number) => {
    drawRect(x + 2, y + 7, w, 3, bankShadow);
    drawRect(x, y, w, 7, fenceInk);
    drawRect(x + 1, y + 4, w - 2, 2, fenceDark);
    drawRect(x + 1, y + 1, w - 2, 3, fenceWood);
    drawRect(x + 2, y + 1, w - 4, 1, fenceHi);
  };

  const drawVFence = (x: number, y: number, h: number) => {
    drawRect(x + 7, y + 2, 3, h, bankShadow);
    drawRect(x, y, 7, h, fenceInk);
    drawRect(x + 4, y + 1, 2, h - 2, fenceDark);
    drawRect(x + 1, y + 1, 3, h - 2, fenceWood);
    drawRect(x + 1, y + 2, 1, h - 4, fenceHi);
  };

  const drawLantern = (x: number, y: number, teal: boolean) => {
    drawRect(x - 4, y - 4, 9, 9, fenceInk);
    drawRect(x - 3, y - 3, 7, 7, fenceDark);
    drawRect(x - 2, y - 2, 5, 5, teal ? lanternTeal : lanternAmber);
    drawRect(x - 1, y - 1, 3, 2, teal ? lanternTealGlow : lanternAmberGlow);
  };

  drawRect(28, 24, 1444, 3, fenceDark);
  drawRect(28, 1473, 1444, 3, fenceDark);
  drawRect(24, 28, 3, 1444, fenceDark);
  drawRect(1473, 28, 3, 1444, fenceDark);

  for (let p = 56; p <= 1444; p += 96) {
    if (Math.abs(p - 750) < 55) continue;
    if (((p - 56) / 96) % 2 === 0) {
      drawHFence(p - 24, 21, 48);
      drawHFence(p - 24, 1471, 48);
      drawVFence(21, p - 24, 48);
      drawVFence(1471, p - 24, 48);
    } else {
      drawRect(p - 3, 20, 6, 9, fenceInk);
      drawRect(p - 2, 21, 4, 7, fenceWood);
      drawRect(p - 3, 1470, 6, 9, fenceInk);
      drawRect(p - 2, 1471, 4, 7, fenceWood);
      drawRect(20, p - 3, 9, 6, fenceInk);
      drawRect(21, p - 2, 7, 4, fenceWood);
      drawRect(1470, p - 3, 9, 6, fenceInk);
      drawRect(1471, p - 2, 7, 4, fenceWood);
    }
  }

  drawRect(706, 17, 88, 14, stoneDark);
  drawRect(708, 19, 84, 10, stoneMid);
  drawHFence(710, 21, 36);
  drawHFence(754, 21, 36);

  drawRect(706, 1469, 88, 14, stoneDark);
  drawRect(708, 1471, 84, 10, stoneMid);
  drawHFence(710, 1472, 36);
  drawHFence(754, 1472, 36);

  drawRect(17, 706, 14, 88, stoneDark);
  drawRect(19, 708, 10, 84, stoneMid);
  drawVFence(21, 710, 36);
  drawVFence(21, 754, 36);

  drawRect(1469, 706, 14, 88, stoneDark);
  drawRect(1471, 708, 10, 84, stoneMid);
  drawVFence(1472, 710, 36);
  drawVFence(1472, 754, 36);

  for (const [bx, by, teal] of [
    [29, 29, true], [1471, 29, false], [29, 1471, false], [1471, 1471, true],
    [370, 25, false], [704, 25, true], [796, 25, false], [1130, 25, true],
    [370, 1475, true], [704, 1475, false], [796, 1475, true], [1130, 1475, false],
    [25, 370, false], [25, 704, false], [25, 796, true], [25, 1130, true],
    [1475, 370, true], [1475, 704, false], [1475, 796, true], [1475, 1130, false]
  ] as const) {
    drawLantern(bx, by, teal);
  }

  for (const [tx, ty, large] of [
    [-58, 120, true], [-46, 360, false], [-54, 610, true], [-48, 920, false], [-56, 1230, true],
    [1510, 140, true], [1508, 420, false], [1512, 660, true], [1506, 980, false], [1514, 1260, true],
    [180, -52, true], [480, -48, false], [860, -54, true], [1220, -48, false],
    [220, 1508, false], [540, 1512, true], [920, 1508, false], [1260, 1512, true]
  ] as const) {
    if (large) stampBorder(138, 8, 60, 48, tx, ty, 78, 62);
    else stampBorder(200, 10, 52, 44, tx, ty, 66, 54);
  }

  ctx.restore();
}
