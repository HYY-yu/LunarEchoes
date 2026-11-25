type View = Readonly<{ left: number; top: number; width: number; height: number }>;
type Point = readonly [number, number];

const voidBase = '#090d17';
const voidDeep = '#060910';
const starBright = '#cddbf0';
const starMid = '#7587a6';
const starDim = '#3f4d69';

const regolithBase = '#5c656e';
const regolithLight = '#656f78';
const regolithHi = '#727c85';
const regolithMid = '#555e67';
const regolithShade = '#4c555e';
const regolithDeep = '#424a54';

const mareBase = '#535c66';
const mareInner = '#4e5761';
const dustDrift = '#737b84';
const dustLight = '#818992';

const basaltDeep = '#1a1e29';
const basaltDark = '#292f3c';
const basaltMid = '#3b4250';
const basaltUpper = '#4f5766';
const basaltRim = '#6d7584';
const basaltShadow = '#3f4752';

const padInk = '#272b38';
const padDark = '#3a3f4e';
const padMid = '#4f5362';
const padTop = '#6d6f7d';
const padHi = '#8c8d9a';

const railInk = '#1d212e';
const railDark = '#363b4b';
const railMid = '#585d6d';
const railTop = '#898b99';
const hazardDark = '#212533';
const hazardAmber = '#c89b58';

const solarFrame = '#3f4b56';
const solarBase = '#364d5c';
const solarGrid = '#4d6f80';
const solarSpec = '#6c91a1';

const beaconCyan = '#84e4e6';
const beaconCyanGlow = '#dcffff';
const beaconRose = '#df92b4';
const beaconRoseGlow = '#ffd8e8';
const beaconAmber = '#f3bc6c';

function surface(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Lunar map canvas is unavailable');
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

function oval(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  for (let dy = -ry; dy <= ry; dy++) {
    const t = dy / ry;
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)));
    if (half > 0) ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2, 1);
  }
}

function hash(x: number, y: number): number {
  return (Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1274126177, 2246822519)) >>> 0;
}

function buildRegolithTile(ctx: CanvasRenderingContext2D) {
  rect(ctx, 0, 0, 128, 128, regolithBase);
  for (let i = 0; i < 150; i++) {
    const h = hash(i * 23 + 5, i * 47 + 13);
    const x = h % 126;
    const y = (h >>> 8) % 126;
    const w = 1 + ((h >>> 16) % 3);
    const color = i % 5 === 0 ? regolithShade : i % 3 === 0 ? regolithLight : regolithMid;
    rect(ctx, x, y, w, 1, color);
  }
  for (let i = 0; i < 12; i++) {
    const h = hash(i * 79 + 3, i * 31 + 17);
    const x = 4 + (h % 118);
    const y = 4 + ((h >>> 9) % 118);
    rect(ctx, x, y, 2, 1, regolithDeep);
    rect(ctx, x + 1, y + 1, 2, 1, regolithHi);
  }
}

function buildDecals(ctx: CanvasRenderingContext2D) {
  oval(ctx, 48, 36, 40, 26, regolithLight);
  oval(ctx, 47, 35, 37, 23, regolithShade);
  oval(ctx, 49, 37, 33, 20, regolithMid);
  oval(ctx, 51, 39, 25, 14, regolithBase);
  for (let i = 0; i < 8; i++) {
    const h = hash(i * 41, i * 29);
    rect(ctx, 28 + (h % 40), 26 + ((h >>> 8) % 20), 2 + (h % 3), 1, i % 2 === 0 ? regolithShade : regolithLight);
  }

  oval(ctx, 124, 34, 24, 16, regolithLight);
  oval(ctx, 123, 33, 21, 13, regolithShade);
  oval(ctx, 125, 35, 17, 10, regolithBase);

  polygon(ctx, [
    [162, 34], [174, 18], [198, 12], [224, 16], [244, 26],
    [248, 42], [232, 54], [202, 58], [174, 52], [160, 44]
  ], mareBase);
  polygon(ctx, [
    [174, 34], [188, 22], [216, 22], [236, 32], [232, 46], [202, 50], [176, 44]
  ], mareInner);
  for (let i = 0; i < 10; i++) {
    const h = hash(i * 53 + 7, i * 19 + 3);
    rect(ctx, 178 + (h % 52), 24 + ((h >>> 8) % 22), 2 + (h % 4), 1, i % 2 === 0 ? regolithBase : regolithShade);
  }

  rect(ctx, 12, 76, 62, 34, regolithShade);
  rect(ctx, 14, 78, 58, 30, solarFrame);
  rect(ctx, 16, 80, 54, 26, solarBase);
  for (let x = 24; x <= 62; x += 9) rect(ctx, x, 80, 1, 26, solarGrid);
  for (let y = 86; y <= 98; y += 6) rect(ctx, 16, y, 54, 1, solarGrid);
  rect(ctx, 16, 80, 54, 2, solarSpec);
  polygon(ctx, [[12, 98], [32, 96], [42, 106], [14, 110]], regolithBase);
  polygon(ctx, [[56, 76], [74, 76], [74, 88], [62, 84]], regolithLight);

  rect(ctx, 96, 78, 52, 32, regolithShade);
  rect(ctx, 98, 80, 48, 28, padDark);
  rect(ctx, 100, 82, 44, 24, padMid);
  rect(ctx, 102, 84, 40, 2, padTop);
  for (let x = 106; x <= 134; x += 10) rect(ctx, x, 89, 5, 12, padDark);
  rect(ctx, 114, 103, 16, 2, beaconRose);
  polygon(ctx, [[132, 78], [148, 78], [148, 92], [138, 88]], regolithBase);
}

export function createLunarMap() {
  const tile = surface(128, 128);
  const decals = surface(256, 128);

  buildRegolithTile(tile.ctx);
  buildDecals(decals.ctx);

  const patterns = new WeakMap<CanvasRenderingContext2D, CanvasPattern>();

  return function drawLunarMap(ctx: CanvasRenderingContext2D, view: View, arenaSize: number, time = 0): void {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    const s = arenaSize / 1500;
    const viewRight = view.left + view.width;
    const viewBottom = view.top + view.height;

    const visible = (x: number, y: number, w: number, h: number) => {
      const dx = x * s;
      const dy = y * s;
      const dw = w * s;
      const dh = h * s;
      return dx + dw >= view.left - 8 && dx <= viewRight + 8 && dy + dh >= view.top - 8 && dy <= viewBottom + 8;
    };

    const drawRect = (x: number, y: number, w: number, h: number, color: string) => {
      if (!visible(x, y, w, h)) return;
      const dx = Math.round(x * s);
      const dy = Math.round(y * s);
      const dw = Math.max(1, Math.round((x + w) * s) - dx);
      const dh = Math.max(1, Math.round((y + h) * s) - dy);
      ctx.fillStyle = color;
      ctx.fillRect(dx, dy, dw, dh);
    };

    const stampDecal = (sx: number, sy: number, sw: number, sh: number, x: number, y: number, w: number, h: number) => {
      const dx = Math.round(x * s);
      const dy = Math.round(y * s);
      const dw = Math.round(w * s);
      const dh = Math.round(h * s);
      if (dx + dw < view.left || dx > viewRight || dy + dh < view.top || dy > viewBottom) return;
      ctx.drawImage(decals.canvas, sx, sy, sw, sh, dx, dy, dw, dh);
    };

    ctx.fillStyle = voidBase;
    ctx.fillRect(Math.floor(view.left), Math.floor(view.top), Math.ceil(view.width) + 2, Math.ceil(view.height) + 2);

    const starGrid = 40;
    const worldLeft = Math.floor(view.left / s) - starGrid;
    const worldTop = Math.floor(view.top / s) - starGrid;
    const worldRight = Math.ceil(viewRight / s) + starGrid;
    const worldBottom = Math.ceil(viewBottom / s) + starGrid;
    const sLeft = Math.floor(worldLeft / starGrid) * starGrid;
    const sTop = Math.floor(worldTop / starGrid) * starGrid;
    for (let sy = sTop; sy < worldBottom; sy += starGrid) {
      for (let sx = sLeft; sx < worldRight; sx += starGrid) {
        if (sx > -34 && sx < 1534 && sy > -34 && sy < 1534) continue;
        const star = hash(sx + 719, sy + 313);
        if ((star >>> 8) % 3 === 0) continue;
        const size = (star >>> 12) % 11 === 0 ? 3 : 2;
        drawRect(
          sx + ((star >>> 5) % 32),
          sy + ((star >>> 14) % 32),
          size,
          size,
          size === 3 ? starBright : ((star >>> 4) & 1) === 0 ? starMid : starDim
        );
      }
    }

    drawRect(-38, -38, 1576, 1576, voidDeep);

    let pattern = patterns.get(ctx);
    if (!pattern) {
      const created = ctx.createPattern(tile.canvas, 'repeat');
      if (created) {
        pattern = created;
        patterns.set(ctx, created);
      }
    }
    ctx.fillStyle = pattern ?? regolithBase;
    const floorLeft = Math.max(Math.round(16 * s), Math.floor(view.left));
    const floorTop = Math.max(Math.round(16 * s), Math.floor(view.top));
    const floorRight = Math.min(Math.round(1484 * s), Math.ceil(viewRight));
    const floorBottom = Math.min(Math.round(1484 * s), Math.ceil(viewBottom));
    if (floorRight > floorLeft && floorBottom > floorTop) {
      ctx.fillRect(floorLeft, floorTop, floorRight - floorLeft, floorBottom - floorTop);
    }

    for (const [x, y, w, h] of [
      [140, 150, 260, 130],
      [1010, 140, 280, 140],
      [125, 980, 275, 135],
      [1045, 1020, 265, 135],
      [585, 1180, 250, 115]
    ]) {
      stampDecal(156, 8, 96, 54, x, y, w, h);
    }

    for (const [x, y, w, h, large] of [
      [215, 310, 108, 72, true],
      [1135, 305, 124, 82, true],
      [195, 1165, 128, 84, true],
      [1185, 1185, 104, 68, true],
      [445, 215, 62, 42, false],
      [965, 425, 58, 38, false],
      [355, 865, 64, 42, false],
      [1245, 815, 62, 40, false],
      [885, 1265, 60, 40, false]
    ] as const) {
      if (large) stampDecal(4, 6, 88, 60, x, y, w, h);
      else stampDecal(96, 14, 56, 40, x, y, w, h);
    }

    for (let q = 0; q < 28; q++) {
      const h = hash(q * 109 + 11, q * 71 + 19);
      const px = 86 + (h % 1328);
      const py = 86 + ((h >>> 10) % 1328);
      if (px > 510 && px < 990 && py > 510 && py < 990) continue;
      if (!visible(px - 10, py - 10, 24, 20)) continue;
      drawRect(px, py, 4, 2, regolithDeep);
      drawRect(px + 1, py - 1, 2, 1, regolithHi);
      drawRect(px + 7, py + 4, 3, 2, regolithShade);
      if (q % 2 === 0) drawRect(px - 5, py + 5, 2, 1, regolithLight);
    }

    for (const [x, y] of [
      [300, 555], [1115, 585], [405, 995], [1040, 925]
    ]) {
      stampDecal(10, 74, 66, 38, x, y, 78, 44);
    }
    for (const [x, y] of [
      [510, 360], [955, 360], [510, 1105], [955, 1105]
    ]) {
      stampDecal(94, 76, 56, 36, x, y, 64, 40);
    }

    const trackPair = (x: number, y: number, horizontal: boolean, fade: boolean) => {
      const color = fade ? regolithMid : regolithShade;
      const rim = fade ? regolithBase : regolithLight;
      if (horizontal) {
        drawRect(x, y - 9, 10, 2, color);
        drawRect(x + 1, y - 10, 8, 1, rim);
        drawRect(x, y + 7, 10, 2, color);
        drawRect(x + 1, y + 9, 8, 1, rim);
      } else {
        drawRect(x - 9, y, 2, 10, color);
        drawRect(x - 10, y + 1, 1, 8, rim);
        drawRect(x + 7, y, 2, 10, color);
        drawRect(x + 9, y + 1, 1, 8, rim);
      }
    };

    for (let d = 56; d <= 516; d += 18) {
      const fade = d < 120;
      trackPair(750, d, false, fade);
      trackPair(750, 1490 - d, false, fade);
      trackPair(d, 750, true, fade);
      trackPair(1490 - d, 750, true, fade);
    }

    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const angle = t * 1.25;
      const rx = Math.round(978 + Math.cos(angle - 0.1) * 210 * t);
      const ry = Math.round(750 + Math.sin(angle) * 225 * t);
      const col = i > 11 ? regolithMid : regolithShade;
      drawRect(rx, ry, 6, 2, col);
      drawRect(rx - 8, ry + 11, 6, 2, col);
      const lx = Math.round(522 - Math.cos(angle - 0.1) * 210 * t);
      const ly = Math.round(750 - Math.sin(angle) * 215 * t);
      drawRect(lx, ly, 6, 2, col);
      drawRect(lx + 8, ly - 11, 6, 2, col);
    }

    if (visible(510, 510, 480, 480)) {
      for (let row = -174; row <= 174; row += 6) {
        const cut = Math.max(0, Math.abs(row) - 134);
        drawRect(750 - 174 + cut, 750 + row, 348 - 2 * cut, 6, regolithShade);
      }
      for (let row = -166; row <= 166; row += 6) {
        const cut = Math.max(0, Math.abs(row) - 130);
        drawRect(750 - 166 + cut, 750 + row, 332 - 2 * cut, 6, padInk);
      }
      for (let row = -162; row <= 162; row += 6) {
        const cut = Math.max(0, Math.abs(row) - 127);
        drawRect(750 - 162 + cut, 750 + row, 324 - 2 * cut, 6, padDark);
      }

      drawRect(730, 588, 40, 324, padMid);
      drawRect(588, 730, 324, 40, padMid);
      drawRect(733, 590, 2, 320, padTop);
      drawRect(765, 590, 2, 320, padTop);
      drawRect(590, 733, 320, 2, padTop);
      drawRect(590, 765, 320, 2, padTop);
      for (let offset = 602; offset <= 894; offset += 16) {
        if (offset > 674 && offset < 818) continue;
        drawRect(746, offset, 8, 2, padHi);
        drawRect(offset, 746, 2, 8, padHi);
      }

      for (const [cx, cy] of [[590, 590], [910, 590], [910, 910], [590, 910]]) {
        drawRect(cx - 28, cy - 22, 56, 44, padInk);
        drawRect(cx - 25, cy - 19, 50, 38, padDark);
        drawRect(cx - 22, cy - 16, 44, 32, padMid);
        drawRect(cx - 20, cy - 15, 40, 2, padHi);
        drawRect(cx - 20, cy - 12, 2, 2, padInk);
        drawRect(cx + 18, cy - 12, 2, 2, padInk);
        drawRect(cx - 20, cy + 10, 2, 2, padInk);
        drawRect(cx + 18, cy + 10, 2, 2, padInk);
      }

      const drawLunarRamp = (x: number, y: number, w: number, h: number, vertical: boolean) => {
        drawRect(x + 2, y + 3, w, h, regolithDeep);
        drawRect(x, y, w, h, padInk);
        drawRect(x + 2, y + 2, w - 4, h - 4, padDark);
        if (vertical) {
          drawRect(x + 3, y + 2, 3, h - 4, padHi);
          drawRect(x + w - 6, y + 2, 3, h - 4, padHi);
          for (let ry = y + 6; ry < y + h - 4; ry += 6) {
            drawRect(x + 7, ry, w - 14, 3, padMid);
            drawRect(x + 7, ry, w - 14, 1, padTop);
          }
        } else {
          drawRect(x + 2, y + 3, w - 4, 3, padHi);
          drawRect(x + 2, y + h - 6, w - 4, 3, padHi);
          for (let rx = x + 6; rx < x + w - 4; rx += 6) {
            drawRect(rx, y + 7, 3, h - 14, padMid);
            drawRect(rx, y + 7, 1, h - 14, padTop);
          }
        }
      };

      drawLunarRamp(724, 534, 52, 58, true);
      drawRect(724, 532, 4, 4, beaconCyan);
      drawRect(772, 532, 4, 4, beaconAmber);

      drawLunarRamp(724, 908, 52, 58, true);
      drawRect(724, 964, 4, 4, beaconCyan);
      drawRect(772, 964, 4, 4, beaconAmber);

      drawLunarRamp(534, 724, 58, 52, false);
      drawRect(532, 724, 4, 4, beaconCyan);
      drawRect(532, 772, 4, 4, beaconAmber);

      drawLunarRamp(908, 724, 58, 52, false);
      drawRect(964, 724, 4, 4, beaconCyan);
      drawRect(964, 772, 4, 4, beaconAmber);

      const moonDrift = (x: number, y: number, w: number, h: number, flipX: boolean) => {
        for (let row = 0; row < h; row += 2) {
          const span = Math.max(8, Math.round(w * (1 - row / (h + 10))));
          const rx = flipX ? x + w - span : x;
          drawRect(rx, y + row, span, 2, row < 4 ? dustLight : dustDrift);
        }
      };

      moonDrift(558, 634, 22, 14, true);
      moonDrift(560, 846, 20, 14, true);
      moonDrift(920, 640, 20, 14, false);
      moonDrift(920, 836, 22, 14, false);
      moonDrift(636, 566, 34, 10, false);
      moonDrift(830, 566, 34, 10, true);
      moonDrift(636, 926, 34, 10, false);
      moonDrift(830, 926, 34, 10, true);
    }

    for (let x = 16; x < 1484; x += 32) {
      const segW = Math.min(32, 1484 - x);
      const hn = hash(x + 19, 1);
      const stepN = (hn % 9) - 4;
      const cragN = (hn >>> 6) % 10;
      if (visible(x, -52, segW + 4, 88)) {
        drawRect(x, 18 + stepN, segW, 10, basaltShadow);
        drawRect(x, 2 + stepN, segW, 18, basaltDeep);
        drawRect(x, -12 + stepN, segW, 16, basaltDark);
        drawRect(x, -24 + stepN, segW, 14, basaltMid);
        drawRect(x, -32 + stepN, segW, 9, basaltUpper);
        drawRect(x, -36 + stepN, segW, 4, basaltRim);
        drawRect(x + 4, -40 - cragN + stepN, Math.max(10, segW - 10), 6 + cragN, basaltDark);
        drawRect(x + 7, -40 - cragN + stepN, Math.max(6, segW - 16), 3, basaltMid);
        if (hn % 2 === 0) drawRect(x + 5, -18 + stepN, Math.max(6, segW - 12), 2, basaltRim);
      }
      const hs = hash(x + 31, 2);
      const stepS = (hs % 9) - 4;
      const cragS = (hs >>> 6) % 10;
      if (visible(x, 1472, segW + 4, 88)) {
        drawRect(x, 1476 + stepS, segW, 6, basaltDeep);
        drawRect(x, 1482 + stepS, segW, 7, basaltRim);
        drawRect(x, 1489 + stepS, segW, 12, basaltUpper);
        drawRect(x, 1501 + stepS, segW, 14, basaltMid);
        drawRect(x, 1515 + stepS, segW, 14, basaltDark);
        drawRect(x + 4, 1529 + stepS, Math.max(10, segW - 10), 6 + cragS, basaltDeep);
      }
    }

    for (let y = 16; y < 1484; y += 32) {
      const segH = Math.min(32, 1484 - y);
      const hw = hash(3, y + 43);
      const stepW = (hw % 9) - 4;
      const cragW = (hw >>> 6) % 10;
      if (visible(-52, y, 88, segH + 4)) {
        drawRect(18 + stepW, y, 10, segH, basaltShadow);
        drawRect(2 + stepW, y, 18, segH, basaltDeep);
        drawRect(-12 + stepW, y, 16, segH, basaltDark);
        drawRect(-24 + stepW, y, 14, segH, basaltMid);
        drawRect(-32 + stepW, y, 9, segH, basaltUpper);
        drawRect(-36 + stepW, y, 4, segH, basaltRim);
        drawRect(-40 - cragW + stepW, y + 4, 6 + cragW, Math.max(10, segH - 10), basaltDark);
        drawRect(-40 - cragW + stepW, y + 7, 3, Math.max(6, segH - 16), basaltMid);
        if (hw % 2 === 0) drawRect(-18 + stepW, y + 5, 2, Math.max(6, segH - 12), basaltRim);
      }
      const he = hash(4, y + 59);
      const stepE = (he % 9) - 4;
      const cragE = (he >>> 6) % 10;
      if (visible(1472, y, 88, segH + 4)) {
        drawRect(1476 + stepE, y, 6, segH, basaltDeep);
        drawRect(1482 + stepE, y, 7, segH, basaltRim);
        drawRect(1489 + stepE, y, 12, segH, basaltUpper);
        drawRect(1501 + stepE, y, 14, segH, basaltMid);
        drawRect(1515 + stepE, y, 14, segH, basaltDark);
        drawRect(1529 + stepE, y + 4, 6 + cragE, Math.max(10, segH - 10), basaltDeep);
      }
    }

    for (const [cx, cy] of [[-2, -2], [1502, -2], [-2, 1502], [1502, 1502]]) {
      drawRect(cx - 34, cy - 34, 68, 68, basaltDeep);
      drawRect(cx - 28, cy - 28, 56, 56, basaltDark);
      drawRect(cx - 22, cy - 22, 44, 44, basaltMid);
      drawRect(cx - 16, cy - 16, 32, 32, basaltUpper);
      drawRect(cx - 14, cy - 14, 28, 5, basaltRim);
    }

    for (let p = 32; p < 1468; p += 16) {
      const color = ((p - 32) / 16) % 2 === 0 ? hazardAmber : hazardDark;
      drawRect(p, 28, 16, 4, color);
      drawRect(p, 1468, 16, 4, color);
      drawRect(28, p, 4, 16, color);
      drawRect(1468, p, 4, 16, color);
    }

    drawRect(16, 16, 1468, 12, railInk);
    drawRect(18, 18, 1464, 8, railDark);
    drawRect(20, 19, 1460, 4, railMid);
    drawRect(20, 19, 1460, 2, railTop);

    drawRect(16, 1472, 1468, 12, railInk);
    drawRect(18, 1474, 1464, 8, railDark);
    drawRect(20, 1475, 1460, 4, railMid);
    drawRect(20, 1475, 1460, 2, railTop);

    drawRect(16, 16, 12, 1468, railInk);
    drawRect(18, 18, 8, 1464, railDark);
    drawRect(19, 20, 4, 1460, railMid);
    drawRect(19, 20, 2, 1460, railTop);

    drawRect(1472, 16, 12, 1468, railInk);
    drawRect(1474, 18, 8, 1464, railDark);
    drawRect(1475, 20, 4, 1460, railMid);
    drawRect(1475, 20, 2, 1460, railTop);

    for (let p = 72; p <= 1428; p += 72) {
      if (Math.abs(p - 750) < 78) continue;
      drawRect(p - 5, 12, 10, 16, railInk);
      drawRect(p - 3, 14, 6, 12, railTop);
      drawRect(p - 5, 1472, 10, 16, railInk);
      drawRect(p - 3, 1474, 6, 12, railTop);
      drawRect(12, p - 5, 16, 10, railInk);
      drawRect(14, p - 3, 12, 6, railTop);
      drawRect(1472, p - 5, 16, 10, railInk);
      drawRect(1474, p - 3, 12, 6, railTop);
    }

    const drawHAirlock = (y: number) => {
      drawRect(686, y - 6, 128, 24, railInk);
      drawRect(690, y - 3, 120, 18, padDark);
      drawRect(696, y, 108, 12, padMid);
      drawRect(698, y + 1, 104, 2, padHi);
      drawRect(749, y, 2, 12, railInk);
      drawRect(708, y + 5, 30, 3, padInk);
      drawRect(762, y + 5, 30, 3, padInk);
    };

    const drawVAirlock = (x: number) => {
      drawRect(x - 6, 686, 24, 128, railInk);
      drawRect(x - 3, 690, 18, 120, padDark);
      drawRect(x, 696, 12, 108, padMid);
      drawRect(x + 1, 698, 2, 104, padHi);
      drawRect(x, 749, 12, 2, railInk);
      drawRect(x + 5, 708, 3, 30, padInk);
      drawRect(x + 5, 762, 3, 30, padInk);
    };

    drawHAirlock(12);
    drawHAirlock(1476);
    drawVAirlock(12);
    drawVAirlock(1476);

    const pulse = Math.sin(time * 0.004) > 0;
    const drawBeacon = (x: number, y: number, cyan: boolean) => {
      drawRect(x - 4, y - 4, 9, 9, railInk);
      drawRect(x - 3, y - 3, 7, 7, railDark);
      drawRect(x - 2, y - 2, 5, 5, cyan ? beaconCyan : beaconRose);
      drawRect(x - 1, y - 1, 3, pulse ? 3 : 2, cyan ? beaconCyanGlow : beaconRoseGlow);
    };

    for (const [bx, by, cyan] of [
      [24, 24, true], [1476, 24, true], [24, 1476, true], [1476, 1476, true],
      [370, 22, true], [682, 22, false], [818, 22, false], [1130, 22, true],
      [370, 1478, true], [682, 1478, false], [818, 1478, false], [1130, 1478, true],
      [22, 370, true], [22, 682, false], [22, 818, false], [22, 1130, true],
      [1478, 370, true], [1478, 682, false], [1478, 818, false], [1478, 1130, true]
    ] as const) {
      drawBeacon(bx, by, cyan);
    }

    ctx.restore();
  };
}
