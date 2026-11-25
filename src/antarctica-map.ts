type View = Readonly<{ left: number; top: number; width: number; height: number }>;
type Point = readonly [number, number];

const snowBase = '#617988';
const snowDeep = '#58707f';
const snowMid = '#698190';
const snowLight = '#738b98';
const snowCrest = '#8198a5';
const icePatchOuter = '#566f80';
const icePatchInner = '#4f6879';
const iceGlint = '#7a94a3';
const driftBase = '#778f9c';
const driftTop = '#89a0ac';
const plateShadow = '#3f5666';
const plateDark = '#4a6170';
const plateMid = '#5c7482';
const plateLight = '#748c98';
const plateRim = '#90a7b2';
const cliffShadow = '#4c6372';
const cliffAbyss = '#213545';
const cliffDeep = '#2d4659';
const cliffMid = '#3d5c71';
const cliffUpper = '#52748a';
const cliffLip = '#8da7b5';
const cliffSnow = '#aec4cf';
const ridgeDark = '#334d60';
const ridgeMid = '#466478';
const ridgeLight = '#628194';
const ridgeCap = '#89a4b3';
const railInk = '#1d2d39';
const railDark = '#354856';
const railSteel = '#596e7c';
const railHi = '#8499a6';
const wireColor = '#728996';
const beaconAmber = '#f4bc68';
const beaconAmberGlow = '#ffebb5';
const beaconCyan = '#86ece4';
const beaconCyanGlow = '#d8fffb';

function surface(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Antarctica map canvas is unavailable');
  return { canvas, ctx };
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function polygon(ctx: CanvasRenderingContext2D, points: readonly Point[], color: string, clipSize?: number) {
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
      let x0 = hits[i];
      let x1 = hits[i + 1];
      if (clipSize !== undefined) {
        x0 = Math.max(0, x0);
        x1 = Math.min(clipSize, x1);
      }
      if (x1 > x0) rect(ctx, x0, y, x1 - x0, 1, color);
    }
  }
}

function hash(x: number, y: number): number {
  return (Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1274126177, 2246822519)) >>> 0;
}

function drawRidgeMound(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, clipSize?: number) {
  polygon(ctx, [
    [cx - rx, cy + 4], [cx - Math.round(rx * 0.7), cy - Math.round(ry * 0.72)],
    [cx - 2, cy - ry], [cx + Math.round(rx * 0.68), cy - Math.round(ry * 0.66)],
    [cx + rx, cy + 3], [cx + Math.round(rx * 0.64), cy + ry],
    [cx - Math.round(rx * 0.62), cy + ry]
  ], cliffDeep, clipSize);
  polygon(ctx, [
    [cx - rx + 3, cy + 1], [cx - Math.round(rx * 0.62), cy - Math.round(ry * 0.68)],
    [cx - 1, cy - ry + 2], [cx + Math.round(rx * 0.62), cy - Math.round(ry * 0.6)],
    [cx + rx - 4, cy + 1], [cx + Math.round(rx * 0.48), cy + Math.round(ry * 0.64)],
    [cx - Math.round(rx * 0.5), cy + Math.round(ry * 0.62)]
  ], ridgeDark, clipSize);
  polygon(ctx, [
    [cx - Math.round(rx * 0.72), cy - 2], [cx - Math.round(rx * 0.42), cy - Math.round(ry * 0.66)],
    [cx + 1, cy - ry + 3], [cx + Math.round(rx * 0.54), cy - Math.round(ry * 0.48)],
    [cx + Math.round(rx * 0.58), cy], [cx - Math.round(rx * 0.35), cy + Math.round(ry * 0.25)]
  ], ridgeMid, clipSize);
  polygon(ctx, [
    [cx - Math.round(rx * 0.48), cy - Math.round(ry * 0.26)],
    [cx - Math.round(rx * 0.14), cy - Math.round(ry * 0.74)],
    [cx + Math.round(rx * 0.36), cy - Math.round(ry * 0.54)],
    [cx + Math.round(rx * 0.3), cy - Math.round(ry * 0.14)],
    [cx - Math.round(rx * 0.2), cy - Math.round(ry * 0.08)]
  ], ridgeLight, clipSize);
  polygon(ctx, [
    [cx - Math.round(rx * 0.32), cy - Math.round(ry * 0.46)],
    [cx - Math.round(rx * 0.04), cy - Math.round(ry * 0.76)],
    [cx + Math.round(rx * 0.28), cy - Math.round(ry * 0.58)],
    [cx + Math.round(rx * 0.12), cy - Math.round(ry * 0.34)]
  ], ridgeCap, clipSize);
}

function buildSnowTile(ctx: CanvasRenderingContext2D) {
  rect(ctx, 0, 0, 128, 128, snowBase);
  for (let row = 0; row < 128; row += 16) {
    const shift = (row / 16) % 2 === 0 ? 0 : 32;
    for (let x = 0; x < 128; x += 2) {
      const wave = Math.round(Math.sin((x + shift) * Math.PI / 64) * 2);
      const y = (row + 7 + wave + 128) % 128;
      if ((x + row * 3) % 10 < 6) {
        rect(ctx, x, y, 2, 1, snowLight);
        rect(ctx, x, (y + 1) % 128, 2, 1, snowMid);
      }
    }
  }
  for (let i = 0; i < 88; i++) {
    const h = hash(i * 29 + 7, i * 53 + 11);
    const x = h % 126;
    const y = (h >>> 8) % 127;
    const w = 1 + ((h >>> 15) % 4);
    const color = i % 7 === 0 ? snowCrest : i % 4 === 0 ? snowDeep : i % 2 === 0 ? snowMid : snowLight;
    rect(ctx, x, y, w, 1, color);
  }
}

function buildBorderSurface(ctx: CanvasRenderingContext2D) {
  rect(ctx, 0, 0, 128, 128, cliffAbyss);
  for (const [cx, cy, rx, ry] of [
    [22, 22, 32, 22], [78, 18, 34, 22], [118, 28, 28, 20],
    [46, 62, 34, 24], [100, 66, 30, 22], [8, 72, 28, 20],
    [28, 108, 32, 22], [82, 106, 34, 22], [120, 114, 26, 20]
  ]) {
    for (const ox of [-128, 0, 128]) {
      for (const oy of [-128, 0, 128]) {
        const px = cx + ox;
        const py = cy + oy;
        if (px + rx < 0 || px - rx > 128 || py + ry < 0 || py - ry > 128) continue;
        drawRidgeMound(ctx, px, py, rx, ry, 128);
      }
    }
  }

  drawRidgeMound(ctx, 168, 32, 26, 20);
  drawRidgeMound(ctx, 226, 32, 22, 18);

  polygon(ctx, [
    [140, 92], [156, 74], [186, 68], [216, 72], [240, 84],
    [244, 100], [226, 114], [192, 116], [160, 110], [144, 102]
  ], icePatchOuter);
  polygon(ctx, [
    [154, 90], [172, 78], [202, 76], [228, 84],
    [230, 98], [208, 108], [176, 106], [158, 98]
  ], icePatchInner);
  rect(ctx, 174, 84, 20, 2, iceGlint);
  rect(ctx, 200, 90, 14, 2, iceGlint);
  rect(ctx, 182, 98, 16, 1, snowLight);
}

function buildAtlas(a: CanvasRenderingContext2D) {
  polygon(a, [
    [16, 46], [42, 30], [88, 24], [134, 30], [160, 44],
    [144, 58], [96, 56], [46, 58], [22, 54]
  ], snowLight);
  polygon(a, [
    [32, 42], [60, 30], [102, 28], [138, 36],
    [120, 44], [78, 42], [44, 46]
  ], driftBase);
  polygon(a, [
    [48, 38], [80, 31], [116, 33], [98, 38], [62, 39]
  ], driftTop);

  rect(a, 198, 26, 56, 28, plateShadow);
  rect(a, 196, 24, 56, 28, plateDark);
  rect(a, 198, 26, 52, 24, plateMid);
  rect(a, 200, 26, 48, 2, plateRim);
  for (let x = 208; x <= 240; x += 16) rect(a, x, 28, 2, 20, plateDark);
  polygon(a, [[194, 42], [218, 36], [234, 44], [254, 38], [256, 54], [194, 54]], snowBase);
  polygon(a, [[210, 40], [230, 44], [248, 40], [242, 48], [216, 48]], driftBase);

  rect(a, 284, 28, 42, 22, plateShadow);
  rect(a, 282, 26, 42, 22, plateDark);
  rect(a, 284, 28, 38, 18, plateMid);
  rect(a, 286, 28, 34, 2, plateLight);
  polygon(a, [[280, 24], [302, 24], [296, 34], [280, 36]], driftBase);
  polygon(a, [[306, 38], [326, 34], [326, 50], [300, 50]], snowBase);
}

type AntarcticaAssets = {
  tile: ReturnType<typeof surface>;
  border: ReturnType<typeof surface>;
  atlas: ReturnType<typeof surface>;
  patterns: WeakMap<CanvasRenderingContext2D, CanvasPattern>;
};

let cachedAssets: AntarcticaAssets | undefined;

function getAssets(): AntarcticaAssets | undefined {
  if (cachedAssets) return cachedAssets;
  if (typeof document === 'undefined') return undefined;
  const tile = surface(128, 128);
  const border = surface(256, 128);
  const atlas = surface(360, 80);
  buildSnowTile(tile.ctx);
  buildBorderSurface(border.ctx);
  buildAtlas(atlas.ctx);
  cachedAssets = { tile, border, atlas, patterns: new WeakMap() };
  return cachedAssets;
}

export function drawAntarcticaTerrain(ctx: CanvasRenderingContext2D, view: View): void {
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
    ctx.fillStyle = pattern ?? snowBase;
  } else {
    ctx.fillStyle = snowBase;
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
    [145, 165, 255, 118],
    [1040, 175, 265, 122],
    [155, 1040, 260, 120],
    [1065, 1070, 255, 118],
    [615, 1190, 235, 104]
  ]) {
    stampBorder(138, 66, 112, 54, x, y, w, h);
  }

  for (const [x, y, w, h] of [
    [160, 350, 225, 62],
    [1015, 365, 235, 64],
    [495, 225, 220, 60],
    [180, 855, 215, 60],
    [1080, 845, 225, 62],
    [405, 1265, 230, 62],
    [905, 1255, 230, 62]
  ]) {
    stampAtlas(12, 20, 152, 42, x, y, w, h);
  }

  for (const [x, y, w, h, small] of [
    [515, 520, 68, 36, false],
    [925, 525, 54, 30, true],
    [520, 945, 54, 30, true],
    [915, 938, 68, 36, false],
    [285, 555, 64, 34, false],
    [1095, 580, 52, 28, true]
  ] as const) {
    if (small) stampAtlas(278, 22, 52, 30, x, y, w, h);
    else stampAtlas(192, 20, 66, 36, x, y, w, h);
  }

  const treadPair = (x: number, y: number, horizontal: boolean, fade: boolean) => {
    const groove = fade ? snowMid : snowDeep;
    const ridge = fade ? snowLight : driftBase;
    if (horizontal) {
      drawRect(x, y - 10, 10, 4, groove);
      drawRect(x + 2, y - 11, 6, 1, ridge);
      drawRect(x, y + 6, 10, 4, groove);
      drawRect(x + 2, y + 10, 6, 1, ridge);
    } else {
      drawRect(x - 10, y, 4, 10, groove);
      drawRect(x - 11, y + 2, 1, 6, ridge);
      drawRect(x + 6, y, 4, 10, groove);
      drawRect(x + 10, y + 2, 1, 6, ridge);
    }
  };

  for (let i = 0; i < 30; i++) {
    const d = 220 + i * 16;
    const fade = i > 20;
    treadPair(750 - d, 750, true, fade);
    treadPair(750 + d, 750, true, fade);
    treadPair(750, 750 - d, false, fade);
    treadPair(750, 750 + d, false, fade);
  }

  const drawSnowPole = (x: number, y: number) => {
    drawRect(x + 1, y + 5, 5, 2, cliffShadow);
    drawRect(x, y - 6, 3, 12, railInk);
    drawRect(x + 1, y - 5, 1, 10, railHi);
    drawRect(x, y - 7, 3, 3, beaconAmber);
  };

  for (const [px, py] of [
    [714, 522], [786, 522], [714, 978], [786, 978],
    [522, 714], [522, 786], [978, 714], [978, 786]
  ]) {
    drawSnowPole(px, py);
  }

  if (visible(515, 515, 470, 470)) {
    for (let y = -170; y <= 170; y += 8) {
      const cut = Math.max(0, Math.abs(y) - 126);
      drawRect(750 - 170 + cut, 750 + y, 340 - 2 * cut, 8, plateShadow);
    }
    for (let y = -164; y <= 164; y += 8) {
      const cut = Math.max(0, Math.abs(y) - 122);
      drawRect(750 - 164 + cut, 750 + y, 328 - 2 * cut, 8, plateDark);
    }

    for (const [cx, cy] of [[590, 590], [910, 590], [910, 910], [590, 910]]) {
      drawRect(cx - 28, cy - 22, 56, 44, plateShadow);
      drawRect(cx - 25, cy - 19, 50, 38, plateDark);
      drawRect(cx - 22, cy - 16, 44, 32, plateMid);
      drawRect(cx - 20, cy - 15, 40, 2, plateRim);
    }

    const drawSteelRamp = (x: number, y: number, w: number, h: number, vertical: boolean) => {
      drawRect(x + 2, y + 3, w, h, plateShadow);
      drawRect(x, y, w, h, railInk);
      drawRect(x + 2, y + 2, w - 4, h - 4, plateDark);
      if (vertical) {
        drawRect(x + 3, y + 2, 3, h - 4, plateLight);
        drawRect(x + w - 6, y + 2, 3, h - 4, plateLight);
        for (let ry = y + 5; ry < y + h - 4; ry += 6) {
          drawRect(x + 7, ry, w - 14, 3, plateMid);
          drawRect(x + 7, ry, w - 14, 1, plateRim);
        }
      } else {
        drawRect(x + 2, y + 3, w - 4, 3, plateLight);
        drawRect(x + 2, y + h - 6, w - 4, 3, plateLight);
        for (let rx = x + 5; rx < x + w - 4; rx += 6) {
          drawRect(rx, y + 7, 3, h - 14, plateMid);
          drawRect(rx, y + 7, 1, h - 14, plateRim);
        }
      }
    };

    drawSteelRamp(724, 536, 52, 60, true);
    drawRect(736, 540, 28, 2, beaconAmber);
    drawSteelRamp(724, 904, 52, 60, true);
    drawRect(736, 958, 28, 2, beaconAmber);
    drawSteelRamp(536, 724, 60, 52, false);
    drawRect(540, 736, 2, 28, beaconAmber);
    drawSteelRamp(904, 724, 60, 52, false);
    drawRect(958, 736, 2, 28, beaconAmber);

    for (const [dx, dy, dw, dh] of [
      [574, 628, 24, 12], [574, 836, 24, 12], [902, 640, 24, 12], [902, 824, 24, 12],
      [632, 574, 32, 12], [826, 574, 30, 12], [640, 914, 32, 12], [820, 914, 30, 12]
    ]) {
      drawRect(dx, dy, dw, dh, driftBase);
      drawRect(dx + 3, dy + 2, dw - 8, 4, driftTop);
    }
  }

  const fillMassifBlock = (x0: number, y0: number, x1: number, y1: number) => {
    if (x1 <= x0 || y1 <= y0) return;
    drawRect(x0, y0, x1 - x0, y1 - y0, cliffAbyss);
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

  if (worldTop < 20) fillMassifBlock(worldLeft, worldTop, worldRight, 20);
  if (worldBottom > 1480) fillMassifBlock(worldLeft, 1480, worldRight, worldBottom);
  if (worldLeft < 20) fillMassifBlock(worldLeft, Math.max(worldTop, 20), 20, Math.min(worldBottom, 1480));
  if (worldRight > 1480) fillMassifBlock(1480, Math.max(worldTop, 20), worldRight, Math.min(worldBottom, 1480));

  for (let x = 20; x < 1480; x += 36) {
    const segW = Math.min(36, 1480 - x);
    const hn = hash(x + 17, 21);
    const stepN = (hn % 7) - 3;
    if (visible(x, -22, segW + 4, 68)) {
      drawRect(x, 22 + stepN, segW, 11, cliffShadow);
      drawRect(x, 12 + stepN, segW, 11, cliffDeep);
      drawRect(x, 2 + stepN, segW, 11, cliffMid);
      drawRect(x, -7 + stepN, segW, 10, cliffUpper);
      drawRect(x, -12 + stepN, segW, 5, cliffLip);
      drawRect(x, -15 + stepN, segW, 3, cliffSnow);
      drawRect(x + 7 + (hn % 10), -4 + stepN, 3, 20, cliffLip);
      if (hn % 2 === 0) drawRect(x + 21, -2 + stepN, 2, 16, cliffDeep);
    }
    const hs = hash(x + 29, 22);
    const stepS = (hs % 7) - 3;
    if (visible(x, 1466, segW + 4, 62)) {
      drawRect(x, 1472 + stepS, segW, 5, cliffDeep);
      drawRect(x, 1477 + stepS, segW, 5, cliffSnow);
      drawRect(x, 1482 + stepS, segW, 7, cliffLip);
      drawRect(x, 1489 + stepS, segW, 14, cliffMid);
      drawRect(x + 9 + (hs % 10), 1483 + stepS, 3, 16, cliffUpper);
    }
  }

  for (let y = 20; y < 1480; y += 36) {
    const segH = Math.min(36, 1480 - y);
    const hw = hash(23, y + 41);
    const stepW = (hw % 7) - 3;
    if (visible(-22, y, 66, segH + 4)) {
      drawRect(22 + stepW, y, 11, segH, cliffShadow);
      drawRect(13 + stepW, y, 10, segH, cliffDeep);
      drawRect(3 + stepW, y, 11, segH, cliffMid);
      drawRect(-6 + stepW, y, 10, segH, cliffUpper);
      drawRect(-11 + stepW, y, 5, segH, cliffLip);
      drawRect(-14 + stepW, y, 3, segH, cliffSnow);
      drawRect(-3 + stepW, y + 7 + (hw % 10), 20, 3, cliffLip);
    }
    const he = hash(24, y + 53);
    const stepE = (he % 7) - 3;
    if (visible(1466, y, 66, segH + 4)) {
      drawRect(1472 + stepE, y, 5, segH, cliffDeep);
      drawRect(1477 + stepE, y, 5, segH, cliffSnow);
      drawRect(1482 + stepE, y, 7, segH, cliffLip);
      drawRect(1489 + stepE, y, 14, segH, cliffMid);
      drawRect(1483 + stepE, y + 9 + (he % 10), 16, 3, cliffUpper);
    }
  }

  for (const [cx, cy] of [[16, 16], [1484, 16], [16, 1484], [1484, 1484]]) {
    drawRect(cx - 24, cy - 24, 48, 48, cliffDeep);
    drawRect(cx - 20, cy - 20, 40, 40, cliffMid);
    drawRect(cx - 15, cy - 15, 30, 30, cliffUpper);
    drawRect(cx - 12, cy - 12, 24, 6, cliffSnow);
  }

  const drawHRail = (x: number, y: number, w: number) => {
    drawRect(x + 2, y + 7, w, 3, cliffShadow);
    drawRect(x, y, w, 7, railInk);
    drawRect(x + 1, y + 4, w - 2, 2, railDark);
    drawRect(x + 1, y + 1, w - 2, 3, railSteel);
    drawRect(x + 2, y + 1, w - 4, 1, railHi);
  };

  const drawVRail = (x: number, y: number, h: number) => {
    drawRect(x + 7, y + 2, 3, h, cliffShadow);
    drawRect(x, y, 7, h, railInk);
    drawRect(x + 4, y + 1, 2, h - 2, railDark);
    drawRect(x + 1, y + 1, 3, h - 2, railSteel);
    drawRect(x + 1, y + 2, 1, h - 4, railHi);
  };

  const drawBeacon = (x: number, y: number, cyan: boolean) => {
    drawRect(x - 4, y - 4, 9, 9, railInk);
    drawRect(x - 3, y - 3, 7, 7, railDark);
    drawRect(x - 2, y - 2, 5, 5, cyan ? beaconCyan : beaconAmber);
    drawRect(x - 1, y - 1, 3, 2, cyan ? beaconCyanGlow : beaconAmberGlow);
  };

  drawRect(28, 24, 1444, 2, wireColor);
  drawRect(28, 1474, 1444, 2, wireColor);
  drawRect(24, 28, 2, 1444, wireColor);
  drawRect(1474, 28, 2, 1444, wireColor);

  for (let p = 56; p <= 1444; p += 96) {
    if (Math.abs(p - 750) < 55) continue;
    if (((p - 56) / 96) % 2 === 0) {
      drawHRail(p - 24, 21, 48);
      drawHRail(p - 24, 1471, 48);
      drawVRail(21, p - 24, 48);
      drawVRail(1471, p - 24, 48);
    } else {
      drawRect(p - 3, 20, 6, 9, railInk);
      drawRect(p - 2, 21, 4, 7, railSteel);
      drawRect(p - 3, 1470, 6, 9, railInk);
      drawRect(p - 2, 1471, 4, 7, railSteel);
      drawRect(20, p - 3, 9, 6, railInk);
      drawRect(21, p - 2, 7, 4, railSteel);
      drawRect(1470, p - 3, 9, 6, railInk);
      drawRect(1471, p - 2, 7, 4, railSteel);
    }
  }

  drawRect(704, 17, 92, 15, railInk);
  drawRect(706, 19, 88, 11, plateMid);
  drawHRail(709, 21, 37);
  drawHRail(754, 21, 37);

  drawRect(704, 1468, 92, 15, railInk);
  drawRect(706, 1470, 88, 11, plateMid);
  drawHRail(709, 1472, 37);
  drawHRail(754, 1472, 37);

  drawRect(17, 704, 15, 92, railInk);
  drawRect(19, 706, 11, 88, plateMid);
  drawVRail(21, 709, 37);
  drawVRail(21, 754, 37);

  drawRect(1468, 704, 15, 92, railInk);
  drawRect(1470, 706, 11, 88, plateMid);
  drawVRail(1472, 709, 37);
  drawVRail(1472, 754, 37);

  for (const [bx, by, cyan] of [
    [29, 29, true], [1471, 29, false], [29, 1471, false], [1471, 1471, true],
    [370, 25, false], [702, 25, false], [798, 25, false], [1130, 25, true],
    [370, 1475, true], [702, 1475, false], [798, 1475, false], [1130, 1475, true],
    [25, 370, true], [25, 702, false], [25, 798, false], [25, 1130, true],
    [1475, 370, true], [1475, 702, false], [1475, 798, false], [1475, 1130, true]
  ] as const) {
    drawBeacon(bx, by, cyan);
  }

  for (const [tx, ty, large] of [
    [-64, 125, true], [-52, 390, false], [-60, 650, true], [-54, 960, false], [-62, 1250, true],
    [1514, 150, true], [1510, 440, false], [1516, 690, true], [1510, 1005, false], [1516, 1280, true],
    [195, -56, true], [510, -52, false], [880, -58, true], [1235, -52, false],
    [230, 1510, false], [555, 1514, true], [935, 1510, false], [1270, 1514, true]
  ] as const) {
    if (large) stampBorder(138, 8, 60, 48, tx, ty, 78, 62);
    else stampBorder(200, 10, 52, 44, tx, ty, 66, 54);
  }

  ctx.restore();
}
