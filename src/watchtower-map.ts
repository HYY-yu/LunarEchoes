type View = Readonly<{ left: number; top: number; width: number; height: number }>;

const spaceBase = '#0d1221';
const spaceDeep = '#090d19';
const starBright = '#aebdd6';
const starMid = '#627191';
const starDim = '#384461';
const strutDark = '#232538';
const strutMid = '#3b3c52';
const strutHi = '#5f5e76';
const deckBase = '#38384c';
const deckSeam = '#2c2c3e';
const deckMid = '#3f3f54';
const deckLight = '#47465d';
const ringBand = '#424157';
const ringEdge = '#4e4b63';
const corridorBase = '#414056';
const apronDark = '#27283a';
const apronMid = '#46455a';
const apronRim = '#6b687e';
const rampInk = '#1d1f2e';
const rampDark = '#3a3b4f';
const rampMid = '#515066';
const rampHi = '#76738a';
const wallInk = '#191b29';
const wallDark = '#303145';
const wallMid = '#4a4960';
const wallHi = '#727087';
const merlonTop = '#5e5c73';
const merlonHi = '#848198';
const gateDark = '#292a3d';
const gateMid = '#424258';
const gateHi = '#67667e';
const hazardDark = '#212232';
const hazardAmber = '#c59452';
const laneBronze = '#9b8368';
const beaconAmber = '#f4bc68';
const beaconAmberGlow = '#ffebb5';
const beaconCyan = '#84e4e6';
const beaconCyanGlow = '#dbffff';

function surface(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Watchtower map canvas is unavailable');
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
  rect(ctx, 66, 2, 60, 60, deckMid);
  rect(ctx, 68, 4, 56, 56, deckBase);
  for (const [rx, ry] of [
    [6, 6], [56, 6], [6, 56], [56, 56],
    [70, 6], [120, 6], [70, 56], [120, 56],
    [6, 70], [56, 70], [6, 120], [56, 120],
    [70, 70], [120, 70], [70, 120], [120, 120]
  ]) {
    rect(ctx, rx, ry, 2, 2, deckSeam);
    rect(ctx, rx, ry - 1, 2, 1, deckLight);
  }
}

function buildAtlas(a: CanvasRenderingContext2D) {
  rect(a, 10, 10, 64, 44, deckSeam);
  rect(a, 12, 12, 60, 40, apronDark);
  for (let y = 16; y <= 44; y += 6) rect(a, 16, y, 52, 2, wallMid);
  rect(a, 12, 12, 60, 2, apronRim);
  rect(a, 16, 48, 14, 2, laneBronze);
  rect(a, 54, 48, 14, 2, laneBronze);

  rect(a, 90, 10, 68, 44, deckSeam);
  rect(a, 92, 12, 64, 40, corridorBase);
  rect(a, 94, 14, 60, 2, apronRim);
  rect(a, 98, 22, 52, 20, deckBase);
  for (let x = 104; x <= 142; x += 12) rect(a, x, 26, 4, 12, deckSeam);
  rect(a, 118, 46, 12, 2, beaconCyan);
}

type WatchtowerAssets = {
  tile: ReturnType<typeof surface>;
  atlas: ReturnType<typeof surface>;
  patterns: WeakMap<CanvasRenderingContext2D, CanvasPattern>;
};

let cachedAssets: WatchtowerAssets | undefined;

function getAssets(): WatchtowerAssets | undefined {
  if (cachedAssets) return cachedAssets;
  if (typeof document === 'undefined') return undefined;
  const tile = surface(128, 128);
  const atlas = surface(172, 64);
  buildDeckTile(tile.ctx);
  buildAtlas(atlas.ctx);
  cachedAssets = { tile, atlas, patterns: new WeakMap() };
  return cachedAssets;
}

export function drawWatchtowerTerrain(ctx: CanvasRenderingContext2D, view: View): void {
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

  ctx.fillStyle = spaceBase;
  ctx.fillRect(Math.floor(view.left), Math.floor(view.top), Math.ceil(view.width) + 2, Math.ceil(view.height) + 2);

  const grid = 36;
  const sLeft = Math.floor(view.left / grid) * grid;
  const sTop = Math.floor(view.top / grid) * grid;
  for (let sy = sTop; sy < viewBottom; sy += grid) {
    for (let sx = sLeft; sx < viewRight; sx += grid) {
      if (sx > -8 && sx < 1508 && sy > -8 && sy < 1508) continue;
      const star = (Math.imul(sx + 719, 2654435761) ^ Math.imul(sy + 313, 2246822519)) >>> 0;
      if ((star >>> 8) % 3 === 0) continue;
      const size = (star >>> 12) % 9 === 0 ? 3 : 2;
      drawRect(
        sx + ((star >>> 6) % 30),
        sy + ((star >>> 15) % 30),
        size,
        size,
        size === 3 ? starBright : ((star >>> 4) & 1) === 0 ? starMid : starDim
      );
    }
  }

  for (const pos of [260, 520, 980, 1240]) {
    drawRect(pos - 10, -48, 20, 58, strutDark);
    drawRect(pos - 6, -44, 12, 54, strutMid);
    drawRect(pos - 4, -44, 2, 50, strutHi);
    drawRect(pos - 16, -24, 32, 6, strutMid);

    drawRect(pos - 10, 1490, 20, 58, strutDark);
    drawRect(pos - 6, 1490, 12, 54, strutMid);
    drawRect(pos - 4, 1494, 2, 50, strutHi);
    drawRect(pos - 16, 1518, 32, 6, strutMid);

    drawRect(-48, pos - 10, 58, 20, strutDark);
    drawRect(-44, pos - 6, 54, 12, strutMid);
    drawRect(-44, pos - 4, 50, 2, strutHi);
    drawRect(-24, pos - 16, 6, 32, strutMid);

    drawRect(1490, pos - 10, 58, 20, strutDark);
    drawRect(1490, pos - 6, 54, 12, strutMid);
    drawRect(1494, pos - 4, 50, 2, strutHi);
    drawRect(1518, pos - 16, 6, 32, strutMid);
  }

  drawRect(-6, -6, 1512, 1512, spaceDeep);

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

  const drawArcRing = (radius: number, band: number) => {
    if (!visible(750 - radius - band, 750 - radius - band, (radius + band) * 2, (radius + band) * 2)) return;
    const steps = 64;
    for (let i = 0; i < steps; i++) {
      if (i % 16 === 0 || i % 16 === 15) continue;
      const a = (i / steps) * Math.PI * 2;
      const x = 750 + Math.cos(a) * radius;
      const y = 750 + Math.sin(a) * radius;
      drawRect(x - band / 2, y - band / 2, band, band, ringBand);
      if (i % 2 === 0) drawRect(x - 2, y - 2, 4, 4, ringEdge);
    }
  };

  drawArcRing(340, 14);
  drawArcRing(545, 16);

  drawRect(692, 34, 116, 1432, corridorBase);
  drawRect(34, 692, 1432, 116, corridorBase);
  drawRect(690, 34, 2, 1432, deckSeam);
  drawRect(808, 34, 2, 1432, deckSeam);
  drawRect(34, 690, 1432, 2, deckSeam);
  drawRect(34, 808, 1432, 2, deckSeam);

  for (let d = 56; d <= 520; d += 24) {
    drawRect(718, d, 3, 12, laneBronze);
    drawRect(779, d, 3, 12, laneBronze);
    drawRect(718, 1488 - d, 3, 12, laneBronze);
    drawRect(779, 1488 - d, 3, 12, laneBronze);
    drawRect(d, 718, 12, 3, laneBronze);
    drawRect(d, 779, 12, 3, laneBronze);
    drawRect(1488 - d, 718, 12, 3, laneBronze);
    drawRect(1488 - d, 779, 12, 3, laneBronze);
  }

  for (const [x, y] of [
    [165, 185], [1255, 185], [165, 1245], [1255, 1245],
    [350, 390], [1075, 390], [350, 1045], [1075, 1045]
  ]) {
    stampAtlas(8, 8, 68, 48, x, y, 68, 48);
  }

  for (const [x, y] of [
    [225, 520], [1195, 520], [225, 920], [1195, 920],
    [495, 195], [925, 195], [495, 1235], [925, 1235]
  ]) {
    stampAtlas(88, 8, 72, 48, x, y, 72, 48);
  }

  if (visible(510, 510, 480, 480)) {
    for (let y = -176; y <= 176; y += 8) {
      const cut = Math.max(0, Math.abs(y) - 124);
      drawRect(750 - 176 + cut, 750 + y, 352 - 2 * cut, 8, apronDark);
    }
    for (let y = -170; y <= 170; y += 8) {
      const cut = Math.max(0, Math.abs(y) - 120);
      drawRect(750 - 170 + cut, 750 + y, 340 - 2 * cut, 8, apronMid);
    }

    for (const [cx, cy] of [[590, 590], [910, 590], [910, 910], [590, 910]]) {
      drawRect(cx - 28, cy - 22, 56, 44, apronDark);
      drawRect(cx - 25, cy - 19, 50, 38, wallDark);
      drawRect(cx - 22, cy - 16, 44, 32, wallMid);
      drawRect(cx - 20, cy - 15, 40, 2, apronRim);
    }

    const drawArmoredRamp = (x: number, y: number, w: number, h: number, vertical: boolean) => {
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

    drawArmoredRamp(724, 536, 52, 60, true);
    drawRect(736, 540, 28, 2, hazardAmber);
    drawArmoredRamp(724, 904, 52, 60, true);
    drawRect(736, 958, 28, 2, hazardAmber);
    drawArmoredRamp(536, 724, 60, 52, false);
    drawRect(540, 736, 2, 28, hazardAmber);
    drawArmoredRamp(904, 724, 60, 52, false);
    drawRect(958, 736, 2, 28, hazardAmber);
  }

  for (let p = 32; p < 1468; p += 16) {
    const color = ((p - 32) / 16) % 2 === 0 ? hazardAmber : hazardDark;
    drawRect(p, 28, 16, 4, color);
    drawRect(p, 1468, 16, 4, color);
    drawRect(28, p, 4, 16, color);
    drawRect(1468, p, 4, 16, color);
  }

  drawRect(8, 8, 1484, 20, wallInk);
  drawRect(10, 10, 1480, 16, wallDark);
  drawRect(12, 12, 1476, 8, wallMid);
  drawRect(12, 12, 1476, 2, wallHi);

  drawRect(8, 1472, 1484, 20, wallInk);
  drawRect(10, 1474, 1480, 16, wallDark);
  drawRect(12, 1476, 1476, 8, wallMid);
  drawRect(12, 1476, 1476, 2, wallHi);

  drawRect(8, 8, 20, 1484, wallInk);
  drawRect(10, 10, 16, 1480, wallDark);
  drawRect(12, 12, 8, 1476, wallMid);
  drawRect(12, 12, 2, 1476, wallHi);

  drawRect(1472, 8, 20, 1484, wallInk);
  drawRect(1474, 10, 16, 1480, wallDark);
  drawRect(1476, 12, 8, 1476, wallMid);
  drawRect(1476, 12, 2, 1476, wallHi);

  for (let p = 72; p <= 1428; p += 72) {
    if (Math.abs(p - 750) < 84) continue;
    drawRect(p - 16, 4, 32, 14, wallInk);
    drawRect(p - 14, 6, 28, 10, merlonTop);
    drawRect(p - 14, 6, 28, 2, merlonHi);

    drawRect(p - 16, 1482, 32, 14, wallInk);
    drawRect(p - 14, 1484, 28, 10, merlonTop);
    drawRect(p - 14, 1484, 28, 2, merlonHi);

    drawRect(4, p - 16, 14, 32, wallInk);
    drawRect(6, p - 14, 10, 28, merlonTop);
    drawRect(6, p - 14, 2, 28, merlonHi);

    drawRect(1482, p - 16, 14, 32, wallInk);
    drawRect(1484, p - 14, 10, 28, merlonTop);
    drawRect(1484, p - 14, 2, 28, merlonHi);
  }

  for (const [cx, cy] of [[18, 18], [1482, 18], [18, 1482], [1482, 1482]]) {
    drawRect(cx - 18, cy - 18, 36, 36, wallInk);
    drawRect(cx - 15, cy - 15, 30, 30, gateDark);
    drawRect(cx - 12, cy - 12, 24, 24, merlonTop);
    drawRect(cx - 10, cy - 10, 20, 3, merlonHi);
  }

  const drawHGate = (y: number) => {
    drawRect(680, y - 6, 140, 28, wallInk);
    drawRect(684, y - 3, 132, 22, gateDark);
    drawRect(690, y, 120, 16, gateMid);
    drawRect(692, y + 1, 116, 3, gateHi);
    drawRect(749, y, 2, 16, wallInk);
    drawRect(704, y + 6, 34, 4, wallDark);
    drawRect(762, y + 6, 34, 4, wallDark);
  };

  const drawVGate = (x: number) => {
    drawRect(x - 6, 680, 28, 140, wallInk);
    drawRect(x - 3, 684, 22, 132, gateDark);
    drawRect(x, 690, 16, 120, gateMid);
    drawRect(x + 1, 692, 3, 116, gateHi);
    drawRect(x, 749, 16, 2, wallInk);
    drawRect(x + 6, 704, 4, 34, wallDark);
    drawRect(x + 6, 762, 4, 34, wallDark);
  };

  drawHGate(8);
  drawHGate(1476);
  drawVGate(8);
  drawVGate(1476);

  const drawBeacon = (x: number, y: number, cyan: boolean) => {
    drawRect(x - 4, y - 4, 9, 9, wallInk);
    drawRect(x - 3, y - 3, 7, 7, wallDark);
    drawRect(x - 2, y - 2, 5, 5, cyan ? beaconCyan : beaconAmber);
    drawRect(x - 1, y - 1, 3, 2, cyan ? beaconCyanGlow : beaconAmberGlow);
  };

  for (const [bx, by, cyan] of [
    [28, 28, false], [1472, 28, true], [28, 1472, false], [1472, 1472, true],
    [370, 22, true], [682, 22, false], [818, 22, true], [1130, 22, false],
    [370, 1478, false], [682, 1478, true], [818, 1478, false], [1130, 1478, true],
    [22, 370, false], [22, 682, true], [22, 818, false], [22, 1130, true],
    [1478, 370, true], [1478, 682, false], [1478, 818, true], [1478, 1130, false]
  ] as const) {
    drawBeacon(bx, by, cyan);
  }

  ctx.restore();
}
