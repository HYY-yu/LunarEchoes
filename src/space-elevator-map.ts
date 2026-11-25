type View = Readonly<{ left: number; top: number; width: number; height: number }>;

const voidBase = '#0e1b24';
const voidDeep = '#0a141c';
const trussDark = '#1b2c38';
const trussMid = '#283c4a';
const trussHi = '#3d5564';
const cableDark = '#213441';
const cableLight = '#4c6574';
const deckBase = '#2f424d';
const deckSeam = '#263741';
const deckLight = '#364a56';
const deckHi = '#415764';
const laneDeck = '#354854';
const apronDark = '#24353f';
const apronMid = '#394e5a';
const apronRim = '#5c727e';
const rampInk = '#1a2730';
const rampDark = '#374a55';
const rampMid = '#4c606c';
const rampHi = '#6c808b';
const grateDeep = '#1f2f39';
const grateBar = '#405460';
const parapetInk = '#142029';
const parapetDark = '#2c3d48';
const parapetMid = '#475b67';
const parapetHi = '#738792';
const bulkheadDark = '#253540';
const bulkheadMid = '#3d505c';
const bulkheadHi = '#627682';
const hazardDark = '#1d2830';
const hazardAmber = '#c9974d';
const laneAmber = '#a8844c';
const stripCyan = '#5ca9ab';
const beaconAmber = '#f4bc68';
const beaconAmberGlow = '#ffebb5';
const beaconCyan = '#7ee8e2';
const beaconCyanGlow = '#d6fffc';

function surface(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Space elevator map canvas is unavailable');
  return { canvas, ctx };
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function buildDeckTile(ctx: CanvasRenderingContext2D) {
  rect(ctx, 0, 0, 128, 128, deckBase);
  rect(ctx, 0, 0, 128, 2, deckSeam);
  rect(ctx, 0, 64, 128, 2, deckSeam);
  rect(ctx, 0, 0, 2, 128, deckSeam);
  rect(ctx, 64, 0, 2, 128, deckSeam);
  rect(ctx, 2, 2, 60, 1, deckLight);
  rect(ctx, 66, 66, 60, 1, deckLight);
  rect(ctx, 66, 2, 60, 60, deckLight);
  rect(ctx, 68, 4, 56, 56, deckBase);
  for (const [rx, ry] of [
    [6, 6], [56, 6], [6, 56], [56, 56],
    [70, 6], [120, 6], [70, 56], [120, 56],
    [6, 70], [56, 70], [6, 120], [56, 120],
    [70, 70], [120, 70], [70, 120], [120, 120]
  ]) {
    rect(ctx, rx, ry, 2, 2, deckSeam);
    rect(ctx, rx, ry - 1, 2, 1, deckHi);
  }
}

function buildAtlas(a: CanvasRenderingContext2D) {
  rect(a, 10, 10, 68, 44, deckSeam);
  rect(a, 12, 12, 64, 40, grateDeep);
  for (let y = 16; y <= 46; y += 6) rect(a, 16, y, 56, 2, grateBar);
  rect(a, 12, 12, 64, 2, deckHi);
  rect(a, 12, 50, 64, 2, deckHi);

  rect(a, 94, 10, 76, 48, deckSeam);
  rect(a, 96, 12, 72, 44, laneDeck);
  rect(a, 98, 14, 68, 2, deckHi);
  rect(a, 102, 22, 60, 24, deckBase);
  for (let x = 108; x <= 156; x += 12) rect(a, x, 26, 4, 16, deckSeam);
  rect(a, 100, 48, 14, 2, laneAmber);
  rect(a, 150, 48, 14, 2, laneAmber);
}

type ElevatorAssets = {
  tile: ReturnType<typeof surface>;
  atlas: ReturnType<typeof surface>;
  patterns: WeakMap<CanvasRenderingContext2D, CanvasPattern>;
};

let cachedAssets: ElevatorAssets | undefined;

function getAssets(): ElevatorAssets | undefined {
  if (cachedAssets) return cachedAssets;
  if (typeof document === 'undefined') return undefined;
  const tile = surface(128, 128);
  const atlas = surface(184, 72);
  buildDeckTile(tile.ctx);
  buildAtlas(atlas.ctx);
  cachedAssets = { tile, atlas, patterns: new WeakMap() };
  return cachedAssets;
}

export function drawSpaceElevatorTerrain(ctx: CanvasRenderingContext2D, view: View, tick: number): void {
  const assets = getAssets();
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  const viewRight = view.left + view.width;
  const viewBottom = view.top + view.height;

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

  ctx.fillStyle = voidBase;
  ctx.fillRect(Math.floor(view.left), Math.floor(view.top), Math.ceil(view.width) + 2, Math.ceil(view.height) + 2);

  const starGrid = 48;
  const sLeft = Math.floor(view.left / starGrid) * starGrid;
  const sTop = Math.floor(view.top / starGrid) * starGrid;
  for (let sy = sTop; sy < viewBottom; sy += starGrid) {
    for (let sx = sLeft; sx < viewRight; sx += starGrid) {
      if (sx > -16 && sx < 1516 && sy > -16 && sy < 1516) continue;
      const h = (Math.imul(sx + 401, 2654435761) ^ Math.imul(sy + 733, 2246822519)) >>> 0;
      if (h % 3 !== 0) continue;
      drawRect(sx + (h % 40), sy + ((h >>> 8) % 40), 2, 2, h % 9 === 0 ? '#5c7c92' : '#263c4c');
    }
  }

  for (const x of [-152, -108, -64, -36, 1528, 1556, 1600, 1644]) {
    drawRect(x, view.top - 4, 8, view.height + 8, cableDark);
    drawRect(x + 2, view.top - 4, 3, view.height + 8, cableLight);
  }

  for (const [tx, tw] of [[-124, 18], [1506, 18]] as const) {
    drawRect(tx, view.top - 4, tw, view.height + 8, trussDark);
    drawRect(tx + 2, view.top - 4, 3, view.height + 8, trussHi);
    drawRect(tx + tw - 5, view.top - 4, 3, view.height + 8, trussMid);
  }

  const phase = Math.floor(tick / 2) % 96;
  const firstBeam = Math.floor((view.top - phase) / 96) * 96 + phase;
  for (let y = firstBeam; y < viewBottom + 96; y += 96) {
    for (const bx of [-168, 1500]) {
      drawRect(bx, y, 168, 12, trussDark);
      drawRect(bx + 4, y + 2, 160, 4, trussMid);
      drawRect(bx + 12, y + 3, 26, 2, trussHi);
      drawRect(bx + 94, y + 3, 26, 2, trussHi);
    }
  }

  for (const cx of [310, 720, 770, 1180]) {
    if (view.top < 20) {
      drawRect(cx, view.top - 4, 10, 24 - view.top, trussDark);
      drawRect(cx + 3, view.top - 4, 4, 24 - view.top, trussHi);
    }
    if (viewBottom > 1480) {
      drawRect(cx, 1480, 10, viewBottom - 1476, trussDark);
      drawRect(cx + 3, 1480, 4, viewBottom - 1476, trussHi);
    }
  }

  drawRect(-6, -6, 1512, 1512, voidDeep);

  if (assets) {
    let pattern = assets.patterns.get(ctx);
    if (!pattern) {
      const created = ctx.createPattern(assets.tile.canvas, 'repeat');
      if (created) {
        pattern = created;
        assets.patterns.set(ctx, created);
      }
    }
    ctx.fillStyle = pattern ?? deckBase;
  } else {
    ctx.fillStyle = deckBase;
  }
  const deckLeft = Math.max(18, Math.floor(view.left));
  const deckTop = Math.max(18, Math.floor(view.top));
  const deckRight = Math.min(1482, Math.ceil(viewRight));
  const deckBottom = Math.min(1482, Math.ceil(viewBottom));
  if (deckRight > deckLeft && deckBottom > deckTop) {
    ctx.fillRect(deckLeft, deckTop, deckRight - deckLeft, deckBottom - deckTop);
  }

  drawRect(674, 34, 152, 1432, laneDeck);
  drawRect(34, 674, 1432, 152, laneDeck);
  drawRect(672, 34, 2, 1432, deckSeam);
  drawRect(826, 34, 2, 1432, deckSeam);
  drawRect(34, 672, 1432, 2, deckSeam);
  drawRect(34, 826, 1432, 2, deckSeam);

  for (let d = 56; d <= 520; d += 24) {
    drawRect(706, d, 4, 14, laneAmber);
    drawRect(790, d, 4, 14, laneAmber);
    drawRect(706, 1486 - d, 4, 14, laneAmber);
    drawRect(790, 1486 - d, 4, 14, laneAmber);
    drawRect(d, 706, 14, 4, laneAmber);
    drawRect(d, 790, 14, 4, laneAmber);
    drawRect(1486 - d, 706, 14, 4, laneAmber);
    drawRect(1486 - d, 790, 14, 4, laneAmber);
  }

  for (const [x, y] of [
    [160, 180], [1220, 180], [160, 1210], [1220, 1210],
    [350, 380], [1040, 380], [350, 1010], [1040, 1010]
  ]) {
    stampAtlas(8, 8, 72, 48, x, y, 72, 48);
  }

  for (const [x, y] of [
    [220, 505], [1160, 505], [220, 915], [1160, 915],
    [480, 190], [920, 190], [480, 1230], [920, 1230]
  ]) {
    stampAtlas(92, 8, 80, 52, x, y, 80, 52);
  }

  if (visible(510, 510, 480, 480)) {
    for (let y = -174; y <= 174; y += 8) {
      const cut = Math.max(0, Math.abs(y) - 134);
      drawRect(750 - 174 + cut, 750 + y, 348 - 2 * cut, 8, apronDark);
    }
    for (let y = -168; y <= 168; y += 8) {
      const cut = Math.max(0, Math.abs(y) - 130);
      drawRect(750 - 168 + cut, 750 + y, 336 - 2 * cut, 8, apronMid);
    }
    drawRect(622, 578, 256, 2, stripCyan);
    drawRect(622, 920, 256, 2, stripCyan);
    drawRect(578, 622, 2, 256, stripCyan);
    drawRect(920, 622, 2, 256, stripCyan);

    for (const [cx, cy] of [[590, 590], [910, 590], [910, 910], [590, 910]]) {
      drawRect(cx - 28, cy - 22, 56, 44, apronDark);
      drawRect(cx - 25, cy - 19, 50, 38, bulkheadDark);
      drawRect(cx - 22, cy - 16, 44, 32, bulkheadMid);
      drawRect(cx - 20, cy - 15, 40, 2, apronRim);
    }

    const drawCargoRamp = (x: number, y: number, w: number, h: number, vertical: boolean) => {
      drawRect(x + 2, y + 3, w, h, apronDark);
      drawRect(x, y, w, h, rampInk);
      drawRect(x + 2, y + 2, w - 4, h - 4, rampDark);
      if (vertical) {
        drawRect(x + 3, y + 2, 3, h - 4, rampHi);
        drawRect(x + w - 6, y + 2, 3, h - 4, rampHi);
        for (let ry = y + 5; ry < y + h - 4; ry += 6) {
          drawRect(x + 7, ry, w - 14, 3, rampMid);
          drawRect(x + 7, ry, w - 14, 1, rampHi);
        }
      } else {
        drawRect(x + 2, y + 3, w - 4, 3, rampHi);
        drawRect(x + 2, y + h - 6, w - 4, 3, rampHi);
        for (let rx = x + 5; rx < x + w - 4; rx += 6) {
          drawRect(rx, y + 7, 3, h - 14, rampMid);
          drawRect(rx, y + 7, 1, h - 14, rampHi);
        }
      }
    };

    drawCargoRamp(724, 536, 52, 60, true);
    drawRect(736, 540, 28, 2, hazardAmber);
    drawCargoRamp(724, 904, 52, 60, true);
    drawRect(736, 958, 28, 2, hazardAmber);
    drawCargoRamp(536, 724, 60, 52, false);
    drawRect(540, 736, 2, 28, hazardAmber);
    drawCargoRamp(904, 724, 60, 52, false);
    drawRect(958, 736, 2, 28, hazardAmber);
  }

  for (let p = 32; p < 1468; p += 16) {
    const color = ((p - 32) / 16) % 2 === 0 ? hazardAmber : hazardDark;
    drawRect(p, 28, 16, 4, color);
    drawRect(p, 1468, 16, 4, color);
    drawRect(28, p, 4, 16, color);
    drawRect(1468, p, 4, 16, color);
  }

  drawRect(10, 10, 1480, 18, parapetInk);
  drawRect(12, 12, 1476, 14, parapetDark);
  drawRect(14, 14, 1472, 6, parapetMid);
  drawRect(14, 14, 1472, 2, parapetHi);

  drawRect(10, 1472, 1480, 18, parapetInk);
  drawRect(12, 1474, 1476, 14, parapetDark);
  drawRect(14, 1476, 1472, 6, parapetMid);
  drawRect(14, 1476, 1472, 2, parapetHi);

  drawRect(10, 10, 18, 1480, parapetInk);
  drawRect(12, 12, 14, 1476, parapetDark);
  drawRect(14, 14, 6, 1472, parapetMid);
  drawRect(14, 14, 2, 1472, parapetHi);

  drawRect(1472, 10, 18, 1480, parapetInk);
  drawRect(1474, 12, 14, 1476, parapetDark);
  drawRect(1476, 14, 6, 1472, parapetMid);
  drawRect(1476, 14, 2, 1472, parapetHi);

  for (let p = 64; p <= 1436; p += 64) {
    if (Math.abs(p - 750) < 76) continue;
    drawRect(p - 3, 12, 6, 14, parapetInk);
    drawRect(p - 2, 13, 4, 12, parapetHi);
    drawRect(p - 3, 1474, 6, 14, parapetInk);
    drawRect(p - 2, 1475, 4, 12, parapetHi);
    drawRect(12, p - 3, 14, 6, parapetInk);
    drawRect(13, p - 2, 12, 4, parapetHi);
    drawRect(1474, p - 3, 14, 6, parapetInk);
    drawRect(1475, p - 2, 12, 4, parapetHi);
  }

  for (const [cx, cy] of [[18, 18], [1482, 18], [18, 1482], [1482, 1482]]) {
    drawRect(cx - 16, cy - 16, 32, 32, parapetInk);
    drawRect(cx - 13, cy - 13, 26, 26, bulkheadDark);
    drawRect(cx - 10, cy - 10, 20, 20, bulkheadMid);
    drawRect(cx - 8, cy - 8, 16, 3, bulkheadHi);
  }

  const drawHBulkhead = (y: number) => {
    drawRect(682, y - 6, 136, 28, parapetInk);
    drawRect(686, y - 3, 128, 22, bulkheadDark);
    drawRect(692, y, 116, 16, bulkheadMid);
    drawRect(694, y + 1, 112, 3, bulkheadHi);
    drawRect(749, y, 2, 16, parapetInk);
    drawRect(706, y + 6, 32, 4, parapetDark);
    drawRect(762, y + 6, 32, 4, parapetDark);
  };

  const drawVBulkhead = (x: number) => {
    drawRect(x - 6, 682, 28, 136, parapetInk);
    drawRect(x - 3, 686, 22, 128, bulkheadDark);
    drawRect(x, 692, 16, 116, bulkheadMid);
    drawRect(x + 1, 694, 3, 112, bulkheadHi);
    drawRect(x, 749, 16, 2, parapetInk);
    drawRect(x + 6, 706, 4, 32, parapetDark);
    drawRect(x + 6, 762, 4, 32, parapetDark);
  };

  drawHBulkhead(8);
  drawHBulkhead(1476);
  drawVBulkhead(8);
  drawVBulkhead(1476);

  const drawBeacon = (x: number, y: number, cyan: boolean) => {
    drawRect(x - 4, y - 4, 9, 9, parapetInk);
    drawRect(x - 3, y - 3, 7, 7, parapetDark);
    drawRect(x - 2, y - 2, 5, 5, cyan ? beaconCyan : beaconAmber);
    drawRect(x - 1, y - 1, 3, 2, cyan ? beaconCyanGlow : beaconAmberGlow);
  };

  for (const [bx, by, cyan] of [
    [28, 28, false], [1472, 28, false], [28, 1472, false], [1472, 1472, false],
    [370, 22, true], [684, 22, true], [816, 22, false], [1130, 22, true],
    [370, 1478, true], [684, 1478, false], [816, 1478, true], [1130, 1478, true],
    [22, 370, true], [22, 684, false], [22, 816, true], [22, 1130, true],
    [1478, 370, true], [1478, 684, true], [1478, 816, false], [1478, 1130, true]
  ] as const) {
    drawBeacon(bx, by, cyan);
  }

  ctx.restore();
}
