type View = Readonly<{ left: number; top: number; width: number; height: number }>;
type Point = readonly [number, number];

const sandBase = '#9e8260';
const sandLight = '#a98d69';
const sandCrest = '#b29773';
const sandMid = '#967b5b';
const sandShade = '#8c7153';
const sandDeep = '#7c6248';
const siltBase = '#947a5b';
const siltInner = '#8f7557';
const gravelOuter = '#8f785c';
const gravelBase = '#82705a';
const gravelSpec = '#a79375';
const gravelDark = '#6a5b4a';
const concreteTop = '#9c9076';
const concreteMid = '#877c66';
const concreteSide = '#625e54';
const concreteShadow = '#5c4d3e';
const mesaTop = '#77523d';
const mesaLight = '#895f46';
const mesaDark = '#654332';
const cliffRim = '#bc855e';
const cliffUpper = '#945d40';
const cliffMid = '#754732';
const cliffDeep = '#4a2b21';
const cliffShadow = '#725b45';
const barrierTop = '#9b978a';
const barrierSide = '#636867';
const barrierInk = '#303b43';
const fencePost = '#444f56';
const fenceWire = '#6f7778';
const ink = '#273c4b';
const steel = '#536974';
const worn = '#84959d';
const cyan = '#7de4db';
const amber = '#f3b76b';
const amberGlow = '#ffe4a6';

function surface(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Desert map canvas is unavailable');
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

function buildSandTile(ctx: CanvasRenderingContext2D) {
  rect(ctx, 0, 0, 128, 128, sandBase);
  for (let row = 0; row < 128; row += 16) {
    const waveOffset = (row / 16) % 2 === 0 ? 0 : 32;
    for (let x = 0; x < 128; x += 2) {
      const yShift = Math.round(Math.sin((x + waveOffset) * Math.PI / 64) * 2);
      const y = (row + 7 + yShift + 128) % 128;
      if ((x + row * 3) % 8 < 5) {
        rect(ctx, x, y, 2, 1, sandLight);
        rect(ctx, x, (y + 1) % 128, 2, 1, sandMid);
      }
    }
  }
  for (let i = 0; i < 96; i++) {
    const h = hash(i * 19, i * 37);
    const x = h % 126;
    const y = (h >>> 8) % 127;
    const w = 1 + ((h >>> 16) % 3);
    const color = i % 5 === 0 ? sandShade : i % 3 === 0 ? sandLight : sandMid;
    rect(ctx, x, y, w, 1, color);
  }
  for (let i = 0; i < 8; i++) {
    const h = hash(i * 73 + 9, i * 41 + 5);
    const x = 4 + (h % 120);
    const y = 4 + ((h >>> 9) % 120);
    rect(ctx, x, y, 2, 1, sandShade);
    rect(ctx, x, y - 1, 1, 1, sandCrest);
  }
}

function buildBorderSurface(ctx: CanvasRenderingContext2D) {
  rect(ctx, 0, 0, 128, 128, mesaTop);
  for (let i = 0; i < 16; i++) {
    const h = hash(i * 53 + 11, i * 97 + 7);
    const x = 4 + (h % 98);
    const y = 4 + ((h >>> 8) % 108);
    const w = 12 + ((h >>> 16) % 18);
    const height = 4 + ((h >>> 21) % 6);
    rect(ctx, x, y, w, height, i % 2 === 0 ? mesaLight : mesaDark);
    if (i % 2 === 0) rect(ctx, x + 1, y, w - 2, 1, cliffRim);
  }
  for (let i = 0; i < 110; i++) {
    const h = hash(i * 31 + 3, i * 67 + 11);
    const x = 2 + (h % 122);
    const y = 2 + ((h >>> 7) % 122);
    rect(ctx, x, y, 1 + ((h >>> 15) % 3), 1, i % 3 === 0 ? mesaLight : mesaDark);
  }

  polygon(ctx, [[136, 36], [148, 30], [182, 31], [188, 37], [174, 41], [142, 40]], cliffDeep);
  polygon(ctx, [[134, 34], [142, 14], [166, 9], [183, 21], [184, 35], [150, 37]], mesaDark);
  polygon(ctx, [[139, 29], [146, 14], [165, 11], [178, 19], [176, 30], [150, 32]], mesaTop);
  polygon(ctx, [[145, 22], [150, 14], [165, 12], [173, 17], [165, 22]], cliffRim);

  polygon(ctx, [[199, 31], [212, 26], [236, 28], [240, 34], [226, 37], [204, 35]], cliffDeep);
  polygon(ctx, [[198, 30], [206, 16], [225, 13], [238, 22], [236, 32], [209, 33]], mesaDark);
  polygon(ctx, [[203, 26], [210, 16], [224, 15], [233, 21], [229, 28]], mesaLight);
  rect(ctx, 211, 16, 12, 2, cliffRim);

  polygon(ctx, [
    [146, 86], [158, 72], [182, 65], [206, 68], [226, 63],
    [244, 74], [248, 88], [234, 102], [206, 106], [176, 102], [154, 98]
  ], siltBase);
  polygon(ctx, [
    [160, 84], [174, 74], [198, 72], [224, 72], [236, 84],
    [224, 96], [194, 98], [166, 94]
  ], siltInner);
  polygon(ctx, [[156, 76], [176, 68], [194, 70], [176, 76]], sandLight);
  polygon(ctx, [[210, 67], [228, 65], [240, 74], [224, 74]], sandLight);
  polygon(ctx, [[184, 96], [212, 98], [232, 92], [218, 102], [192, 102]], sandBase);
  for (let i = 0; i < 12; i++) {
    const h = hash(i * 43 + 5, i * 29 + 9);
    const px = 162 + (h % 68);
    const py = 74 + ((h >>> 8) % 22);
    rect(ctx, px, py, 3 + (h % 5), 1, i % 2 === 0 ? sandMid : sandLight);
  }
}

function buildAtlas(a: CanvasRenderingContext2D) {
  polygon(a, [[4, 102], [12, 40], [40, 10], [126, 10], [162, 39], [177, 102]], ink);
  polygon(a, [[12, 92], [20, 43], [45, 17], [123, 17], [153, 42], [165, 92]], steel);
  for (let x = 35; x < 145; x += 22) {
    rect(a, x, 36, 3, 53, worn);
    rect(a, x - 4, 28, 12, 3, worn);
  }
  polygon(a, [[18, 94], [27, 58], [50, 42], [118, 42], [148, 61], [157, 103], [18, 103]], ink);
  polygon(a, [[109, 11], [133, 14], [147, 38], [130, 33], [123, 53], [111, 47]], mesaTop);
  rect(a, 46, 48, 37, 3, cyan);
  rect(a, 94, 48, 19, 3, cyan);
  rect(a, 9, 101, 163, 4, worn);
  rect(a, 27, 106, 119, 3, cliffDeep);
  rect(a, 170, 66, 15, 35, ink);
  rect(a, 174, 71, 4, 3, amber);
  rect(a, 174, 79, 4, 3, amber);

  polygon(a, [[209, 104], [237, 56], [243, 56], [271, 104]], ink);
  polygon(a, [[225, 98], [240, 66], [252, 98]], worn);
  rect(a, 238, 49, 4, 31, ink);
  polygon(a, [[193, 18], [231, 33], [278, 7], [264, 39], [239, 52], [214, 44]], ink);
  polygon(a, [[198, 20], [232, 35], [272, 12], [259, 35], [238, 46], [217, 39]], worn);
  polygon(a, [[210, 25], [233, 35], [259, 20], [245, 34], [234, 39], [220, 35]], steel);
  rect(a, 235, 22, 3, 17, ink);
  rect(a, 234, 20, 5, 4, amber);
  rect(a, 207, 102, 64, 7, ink);
  rect(a, 216, 105, 47, 3, steel);
  rect(a, 274, 87, 24, 22, ink);
  rect(a, 278, 91, 16, 11, steel);
  rect(a, 280, 93, 4, 3, cyan);
  polygon(a, [[314, 98], [328, 73], [331, 73], [345, 98]], ink);
  polygon(a, [[309, 57], [328, 65], [350, 53], [342, 70], [329, 77], [317, 71]], steel);
  rect(a, 328, 60, 2, 12, worn);
  rect(a, 313, 98, 33, 4, ink);

  polygon(a, [[26, 168], [48, 160], [110, 162], [128, 173], [122, 195], [98, 202], [44, 199], [26, 188]], sandMid);
  polygon(a, [[36, 170], [88, 166], [96, 176], [78, 191], [40, 192]], '#787971');
  for (let x = 46; x <= 82; x += 12) rect(a, x, 170, 2, 19, '#666b68');
  rect(a, 42, 172, 42, 2, '#9a9481');
  rect(a, 54, 183, 22, 2, '#b39a76');
  polygon(a, [[94, 175], [119, 173], [116, 190], [95, 192]], '#81796a');
  rect(a, 99, 178, 12, 2, '#9d937e');
  polygon(a, [[24, 188], [56, 183], [84, 192], [118, 186], [130, 195], [108, 206], [34, 204]], sandBase);
  polygon(a, [[28, 166], [60, 159], [78, 166], [48, 172]], sandLight);

  polygon(a, [[208, 159], [236, 154], [261, 162], [259, 181], [237, 186], [211, 181]], sandMid);
  rect(a, 217, 163, 34, 15, '#767871');
  for (let x = 223; x <= 245; x += 8) rect(a, x, 164, 2, 13, '#626867');
  rect(a, 219, 164, 30, 2, '#999482');
  rect(a, 224, 172, 17, 2, '#b09a76');
  polygon(a, [[234, 157], [249, 160], [243, 182], [262, 180], [252, 189], [228, 185]], sandBase);
  rect(a, 214, 179, 16, 2, sandLight);

  polygon(a, [
    [306, 174], [330, 164], [360, 162], [386, 169], [404, 178],
    [392, 188], [362, 184], [332, 186], [312, 182]
  ], sandLight);
  polygon(a, [
    [318, 171], [342, 165], [368, 165], [390, 173],
    [374, 175], [346, 172], [322, 176]
  ], sandCrest);
  polygon(a, [
    [316, 180], [344, 178], [374, 181], [398, 186],
    [386, 193], [354, 190], [324, 190]
  ], sandMid);
}

export function createDesertMap() {
  const tile = surface(128, 128);
  const border = surface(256, 128);
  const atlas = surface(512, 256);

  buildSandTile(tile.ctx);
  buildBorderSurface(border.ctx);
  buildAtlas(atlas.ctx);

  const patterns = new WeakMap<CanvasRenderingContext2D, CanvasPattern>();

  return function drawDesertMap(ctx: CanvasRenderingContext2D, arenaSize: number, view: View): void {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    let pattern = patterns.get(ctx);
    if (!pattern) {
      const created = ctx.createPattern(tile.canvas, 'repeat');
      if (created) {
        pattern = created;
        patterns.set(ctx, created);
      }
    }
    ctx.fillStyle = pattern ?? sandBase;
    ctx.fillRect(Math.floor(view.left), Math.floor(view.top), Math.ceil(view.width) + 2, Math.ceil(view.height) + 2);

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

    const stampAtlas = (sx: number, sy: number, sw: number, sh: number, x: number, y: number, w: number, h: number) => {
      const dx = Math.round(x * s);
      const dy = Math.round(y * s);
      const dw = Math.round(w * s);
      const dh = Math.round(h * s);
      if (dx + dw < view.left || dx > viewRight || dy + dh < view.top || dy > viewBottom) return;
      ctx.drawImage(atlas.canvas, sx, sy, sw, sh, dx, dy, dw, dh);
    };

    const stampBorder = (sx: number, sy: number, sw: number, sh: number, x: number, y: number, w: number, h: number) => {
      const dx = Math.round(x * s);
      const dy = Math.round(y * s);
      const dw = Math.round(w * s);
      const dh = Math.round(h * s);
      if (dx + dw < view.left || dx > viewRight || dy + dh < view.top || dy > viewBottom) return;
      ctx.drawImage(border.canvas, sx, sy, sw, sh, dx, dy, dw, dh);
    };

    for (const [x, y, w, h] of [
      [150, 170, 260, 118],
      [980, 165, 290, 125],
      [130, 1020, 275, 120],
      [1040, 1075, 265, 118],
      [625, 1170, 235, 102]
    ]) {
      stampBorder(140, 58, 112, 52, x, y, w, h);
    }

    for (const [x, y, w, h] of [
      [165, 360, 240, 84],
      [980, 355, 250, 86],
      [530, 240, 240, 80],
      [175, 860, 225, 78],
      [1070, 845, 230, 80],
      [420, 1260, 245, 84],
      [910, 1250, 240, 82]
    ]) {
      stampAtlas(302, 158, 106, 40, x, y, w, h);
    }

    for (let q = 0; q < 26; q++) {
      const h = hash(q * 113 + 7, q * 61 + 19);
      const px = 88 + (h % 1324);
      const py = 88 + ((h >>> 10) % 1324);
      if (px > 515 && px < 985 && py > 515 && py < 985) continue;
      if (!visible(px - 10, py - 10, 24, 20)) continue;
      drawRect(px, py, 4, 2, sandShade);
      drawRect(px + 1, py - 1, 2, 1, sandCrest);
      drawRect(px + 8, py + 4, 3, 2, sandMid);
      if (q % 2 === 0) drawRect(px - 5, py + 6, 2, 1, sandDeep);
    }

    stampAtlas(1, 128, 160, 100, 275, 535, 186, 116);
    stampAtlas(188, 132, 96, 72, 1035, 610, 128, 96);
    stampAtlas(188, 132, 96, 72, 1075, 965, 100, 75);
    stampAtlas(1, 128, 160, 100, 310, 1055, 132, 82);

    const trackPair = (x: number, y: number, horizontal: boolean, fade: boolean) => {
      const color = fade ? sandMid : sandShade;
      const rim = fade ? sandBase : sandLight;
      if (horizontal) {
        drawRect(x, y - 8, 9, 2, color);
        drawRect(x + 1, y - 9, 7, 1, rim);
        drawRect(x, y + 6, 9, 2, color);
        drawRect(x + 1, y + 8, 7, 1, rim);
      } else {
        drawRect(x - 8, y, 2, 9, color);
        drawRect(x - 9, y + 1, 1, 7, rim);
        drawRect(x + 6, y, 2, 9, color);
        drawRect(x + 8, y + 1, 1, 7, rim);
      }
    };

    for (let i = 0; i < 20; i++) {
      const d = 216 + i * 16;
      const curve = Math.round(Math.sin(i * 0.2) * i * 2.1);
      const fade = i > 13;
      trackPair(750 - d, 750 - curve, true, fade);
      trackPair(750 + d, 750 + curve, true, fade);
      trackPair(750 + curve, 750 - d, false, fade);
      trackPair(750 - curve, 750 + d, false, fade);
    }

    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const angle = t * 1.1;
      const rx = Math.round(976 + Math.cos(angle - 0.15) * 150 * t);
      const ry = Math.round(750 + Math.sin(angle) * 185 * t);
      drawRect(rx, ry, 6, 2, i > 8 ? sandMid : sandShade);
      drawRect(rx - 7, ry + 11, 6, 2, i > 8 ? sandMid : sandShade);
      const lx = Math.round(524 - Math.cos(angle - 0.15) * 150 * t);
      const ly = Math.round(750 - Math.sin(angle) * 175 * t);
      drawRect(lx, ly, 6, 2, i > 8 ? sandMid : sandShade);
      drawRect(lx + 7, ly - 11, 6, 2, i > 8 ? sandMid : sandShade);
    }

    if (visible(515, 515, 470, 470)) {
      drawRect(560, 564, 380, 372, gravelOuter);
      drawRect(564, 560, 372, 380, gravelOuter);
      drawRect(568, 568, 364, 364, gravelBase);
      drawRect(576, 576, 348, 348, gravelOuter);

      for (let step = 0; step < 18; step++) {
        const h = hash(step * 47 + 3, step * 89 + 17);
        const along = 576 + (step * 20);
        const ext = 4 + (h % 8);
        drawRect(along, 560 - ext, 14, ext, gravelOuter);
        drawRect(along, 940, 14, ext, gravelOuter);
        drawRect(560 - ext, along, ext, 14, gravelOuter);
        drawRect(940, along, ext, 14, gravelOuter);
      }

      for (const [cx, cy] of [[590, 590], [910, 590], [910, 910], [590, 910]]) {
        drawRect(cx - 28, cy - 22, 56, 44, gravelDark);
        drawRect(cx - 25, cy - 19, 50, 38, concreteMid);
        drawRect(cx - 23, cy - 17, 46, 2, concreteTop);
        drawRect(cx - 22, cy - 14, 2, 2, gravelDark);
        drawRect(cx + 20, cy - 14, 2, 2, gravelDark);
        drawRect(cx - 22, cy + 12, 2, 2, gravelDark);
        drawRect(cx + 20, cy + 12, 2, 2, gravelDark);
      }

      drawRect(590, 910, 323, 5, concreteShadow);
      drawRect(910, 590, 5, 325, concreteShadow);

      drawRect(722, 540, 56, 52, concreteSide);
      drawRect(725, 543, 50, 49, concreteMid);
      drawRect(725, 543, 50, 3, concreteTop);
      for (let y = 552; y <= 582; y += 10) drawRect(727, y, 46, 2, gravelDark);
      drawRect(736, 546, 28, 2, amber);

      drawRect(722, 908, 56, 52, concreteSide);
      drawRect(725, 908, 50, 48, concreteMid);
      drawRect(725, 954, 50, 3, concreteShadow);
      for (let y = 918; y <= 946; y += 10) drawRect(727, y, 46, 2, gravelDark);
      drawRect(736, 950, 28, 2, amber);

      drawRect(540, 722, 52, 56, concreteSide);
      drawRect(543, 725, 49, 50, concreteMid);
      drawRect(543, 725, 3, 50, concreteTop);
      for (let x = 552; x <= 582; x += 10) drawRect(x, 727, 2, 46, gravelDark);
      drawRect(546, 736, 2, 28, amber);

      drawRect(908, 722, 52, 56, concreteSide);
      drawRect(908, 725, 48, 50, concreteMid);
      drawRect(954, 725, 3, 50, concreteShadow);
      for (let x = 918; x <= 946; x += 10) drawRect(x, 727, 2, 46, gravelDark);
      drawRect(950, 736, 2, 28, amber);

      const sandDrift = (x: number, y: number, w: number, h: number, flipX: boolean) => {
        for (let row = 0; row < h; row += 2) {
          const span = Math.max(4, Math.round(w * (1 - row / (h + 4))));
          const rx = flipX ? x + w - span : x;
          drawRect(rx, y + row, span, 2, row < 4 ? sandLight : sandBase);
        }
      };

      sandDrift(560, 622, 30, 14, true);
      sandDrift(562, 826, 28, 12, true);
      sandDrift(910, 646, 26, 14, false);
      sandDrift(910, 814, 28, 12, false);
      sandDrift(634, 560, 36, 12, false);
      sandDrift(814, 562, 34, 12, true);
      sandDrift(646, 912, 38, 12, false);
      sandDrift(814, 912, 34, 12, true);

      for (let i = 0; i < 48; i++) {
        const h = hash(i * 59 + 11, i * 83 + 5);
        const side = i % 4;
        const along = 566 + (h % 368);
        const off = 4 + ((h >>> 10) % 28);
        const px = side === 0 ? along : side === 1 ? along : side === 2 ? 590 - off : 910 + off;
        const py = side === 0 ? 590 - off : side === 1 ? 910 + off : along;
        drawRect(px, py, 2 + (h % 3), 2, i % 3 === 0 ? gravelDark : gravelSpec);
      }
    }

    const fillMesaBlock = (x0: number, y0: number, x1: number, y1: number) => {
      if (x1 <= x0 || y1 <= y0) return;
      drawRect(x0, y0, x1 - x0, y1 - y0, mesaTop);
      const startX = Math.floor(x0 / 128) * 128;
      const startY = Math.floor(y0 / 128) * 128;
      for (let ty = startY; ty < y1; ty += 128) {
        for (let tx = startX; tx < x1; tx += 128) {
          const cx0 = Math.max(tx, x0);
          const cy0 = Math.max(ty, y0);
          const cx1 = Math.min(tx + 128, x1);
          const cy1 = Math.min(ty + 128, y1);
          const sx = Math.floor(cx0 - tx);
          const sy = Math.floor(cy0 - ty);
          const sw = Math.ceil(cx1 - cx0);
          const sh = Math.ceil(cy1 - cy0);
          if (sw > 0 && sh > 0) stampBorder(sx, sy, sw, sh, cx0, cy0, sw, sh);
        }
      }
    };

    const worldLeft = Math.floor(view.left / s) - 20;
    const worldTop = Math.floor(view.top / s) - 20;
    const worldRight = Math.ceil(viewRight / s) + 20;
    const worldBottom = Math.ceil(viewBottom / s) + 20;

    if (worldTop < 20) fillMesaBlock(worldLeft, worldTop, worldRight, 20);
    if (worldBottom > 1480) fillMesaBlock(worldLeft, 1480, worldRight, worldBottom);
    if (worldLeft < 20) fillMesaBlock(worldLeft, Math.max(worldTop, 20), 20, Math.min(worldBottom, 1480));
    if (worldRight > 1480) fillMesaBlock(1480, Math.max(worldTop, 20), worldRight, Math.min(worldBottom, 1480));

    for (let x = 20; x < 1480; x += 36) {
      const segW = Math.min(36, 1480 - x);
      const h = hash(x + 17, 1);
      const step = (h % 9) - 4;
      if (visible(x, -22, segW + 4, 68)) {
        drawRect(x, 22 + step, segW, 11, cliffShadow);
        drawRect(x, 12 + step, segW, 11, cliffDeep);
        drawRect(x, 2 + step, segW, 11, cliffMid);
        drawRect(x, -8 + step, segW, 11, cliffUpper);
        drawRect(x, -13 + step, segW, 5, cliffRim);
        drawRect(x, -15 + step, segW, 2, cliffDeep);
        if (h % 3 !== 0) drawRect(x + 5, -2 + step, Math.max(6, segW - 14), 2, cliffRim);
        if (h % 2 === 0) drawRect(x + 10, 7 + step, Math.max(6, segW - 18), 2, cliffUpper);
      }
      const hs = hash(x + 29, 2);
      const stepS = (hs % 9) - 4;
      if (visible(x, 1468, segW + 4, 62)) {
        drawRect(x, 1473 + stepS, segW, 5, cliffDeep);
        drawRect(x, 1478 + stepS, segW, 7, cliffRim);
        drawRect(x, 1485 + stepS, segW, 10, cliffUpper);
        drawRect(x, 1495 + stepS, segW, 11, cliffMid);
        drawRect(x, 1506 + stepS, segW, 3, mesaDark);
      }
    }

    for (let y = 20; y < 1480; y += 36) {
      const segH = Math.min(36, 1480 - y);
      const hw = hash(3, y + 41);
      const stepW = (hw % 9) - 4;
      if (visible(-22, y, 66, segH + 4)) {
        drawRect(22 + stepW, y, 11, segH, cliffShadow);
        drawRect(13 + stepW, y, 10, segH, cliffDeep);
        drawRect(3 + stepW, y, 11, segH, cliffMid);
        drawRect(-7 + stepW, y, 11, segH, cliffUpper);
        drawRect(-12 + stepW, y, 5, segH, cliffRim);
        drawRect(-14 + stepW, y, 2, segH, cliffDeep);
        if (hw % 2 === 0) drawRect(0 + stepW, y + 6, 2, Math.max(8, segH - 14), cliffRim);
      }
      const he = hash(4, y + 53);
      const stepE = (he % 9) - 4;
      if (visible(1466, y, 66, segH + 4)) {
        drawRect(1473 + stepE, y, 6, segH, cliffDeep);
        drawRect(1479 + stepE, y, 8, segH, cliffMid);
        drawRect(1487 + stepE, y, 9, segH, cliffUpper);
        drawRect(1496 + stepE, y, 5, segH, cliffRim);
        drawRect(1501 + stepE, y, 3, segH, mesaDark);
      }
    }

    for (const [cx, cy] of [[16, 16], [1484, 16], [16, 1484], [1484, 1484]]) {
      drawRect(cx - 24, cy - 24, 48, 48, cliffDeep);
      drawRect(cx - 20, cy - 20, 40, 40, cliffMid);
      drawRect(cx - 15, cy - 15, 30, 30, cliffUpper);
      drawRect(cx - 12, cy - 12, 24, 6, cliffRim);
    }

    const drawHBarrier = (x: number, y: number, w: number) => {
      drawRect(x + 2, y + 7, w, 3, cliffShadow);
      drawRect(x, y, w, 8, barrierInk);
      drawRect(x + 1, y + 4, w - 2, 3, barrierSide);
      drawRect(x + 1, y + 1, w - 2, 3, barrierTop);
      drawRect(x + 6, y + 1, 5, 2, amber);
      drawRect(x + w - 11, y + 1, 5, 2, amber);
    };

    const drawVBarrier = (x: number, y: number, h: number) => {
      drawRect(x + 7, y + 2, 3, h, cliffShadow);
      drawRect(x, y, 8, h, barrierInk);
      drawRect(x + 4, y + 1, 3, h - 2, barrierSide);
      drawRect(x + 1, y + 1, 3, h - 2, barrierTop);
      drawRect(x + 1, y + 6, 2, 5, amber);
      drawRect(x + 1, y + h - 11, 2, 5, amber);
    };

    const drawBeacon = (x: number, y: number) => {
      drawRect(x - 4, y - 3, 9, 9, barrierInk);
      drawRect(x - 3, y - 2, 7, 7, fencePost);
      drawRect(x - 2, y - 2, 5, 5, amber);
      drawRect(x - 1, y - 1, 3, 2, amberGlow);
    };

    drawRect(30, 25, 1440, 2, fenceWire);
    drawRect(30, 1473, 1440, 2, fenceWire);
    drawRect(25, 30, 2, 1440, fenceWire);
    drawRect(1473, 30, 2, 1440, fenceWire);

    for (let p = 56; p <= 1444; p += 96) {
      if (Math.abs(p - 750) < 55) continue;
      if (((p - 56) / 96) % 2 === 0) {
        drawHBarrier(p - 22, 22, 44);
        drawHBarrier(p - 22, 1470, 44);
        drawVBarrier(22, p - 22, 44);
        drawVBarrier(1470, p - 22, 44);
      } else {
        drawRect(p - 2, 22, 5, 8, fencePost);
        drawRect(p - 2, 1470, 5, 8, fencePost);
        drawRect(22, p - 2, 8, 5, fencePost);
        drawRect(1470, p - 2, 8, 5, fencePost);
      }
    }

    drawRect(704, 18, 92, 14, concreteSide);
    drawRect(706, 20, 88, 10, concreteMid);
    for (let hx = 712; hx < 788; hx += 12) drawRect(hx, 30, 6, 2, amber);
    drawHBarrier(710, 21, 36);
    drawHBarrier(754, 21, 36);

    drawRect(704, 1468, 92, 14, concreteSide);
    drawRect(706, 1470, 88, 10, concreteMid);
    for (let hx = 712; hx < 788; hx += 12) drawRect(hx, 1468, 6, 2, amber);
    drawHBarrier(710, 1471, 36);
    drawHBarrier(754, 1471, 36);

    drawRect(18, 704, 14, 92, concreteSide);
    drawRect(20, 706, 10, 88, concreteMid);
    for (let hy = 712; hy < 788; hy += 12) drawRect(30, hy, 2, 6, amber);
    drawVBarrier(21, 710, 36);
    drawVBarrier(21, 754, 36);

    drawRect(1468, 704, 14, 92, concreteSide);
    drawRect(1470, 706, 10, 88, concreteMid);
    for (let hy = 712; hy < 788; hy += 12) drawRect(1468, hy, 2, 6, amber);
    drawVBarrier(1471, 710, 36);
    drawVBarrier(1471, 754, 36);

    for (const [bx, by] of [
      [30, 30], [1470, 30], [30, 1470], [1470, 1470],
      [370, 26], [704, 26], [796, 26], [1130, 26],
      [370, 1474], [704, 1474], [796, 1474], [1130, 1474],
      [26, 370], [26, 704], [26, 796], [26, 1130],
      [1474, 370], [1474, 704], [1474, 796], [1474, 1130]
    ]) {
      drawBeacon(bx, by);
    }

    for (const [x, y, large] of [
      [-120, 160, true], [-160, 1080, false], [-90, 1340, true],
      [1550, 180, true], [1565, 960, false], [1545, 1310, true],
      [240, -110, true], [620, -95, false], [1180, -115, true],
      [280, 1545, false], [880, 1555, true], [1260, 1540, false]
    ] as const) {
      if (large) stampBorder(132, 6, 58, 38, x, y, 78, 52);
      else stampBorder(196, 10, 48, 30, x, y, 64, 40);
    }

    stampAtlas(1, 0, 188, 112, -248, 545, 235, 140);
    stampAtlas(188, 0, 164, 112, 1514, 550, 246, 168);

    ctx.restore();
  };
}
