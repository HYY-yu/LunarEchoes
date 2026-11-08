type View = Readonly<{ left: number; top: number; width: number; height: number }>;
type Point = readonly [number, number];
const sand = '#967c5e', grain = '#9b8162', shade = '#8d7359', ridge = '#a38a68';
const ink = '#273c4b', steel = '#536974', worn = '#84959d', cyan = '#7de4db', amber = '#f3b76b';

function surface(width: number, height: number) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Desert map canvas is unavailable');
  return { canvas, ctx };
}
function rect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) {
  ctx.fillStyle = color; ctx.fillRect(x, y, width, height);
}
function polygon(ctx: CanvasRenderingContext2D, points: readonly Point[], color: string) {
  const low = Math.min(...points.map(point => point[1])), high = Math.max(...points.map(point => point[1]));
  for (let y = low; y < high; y++) {
    const hits: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) hits.push(Math.round(x1 + (y - y1) * (x2 - x1) / (y2 - y1)));
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2) rect(ctx, hits[i], y, hits[i + 1] - hits[i], 1, color);
  }
}

export function createDesertMap() {
  const tile = surface(128, 128), atlas = surface(512, 256), dune = surface(256, 80);
  rect(tile.ctx, 0, 0, 128, 128, sand);
  for (let i = 0; i < 95; i++) rect(tile.ctx, (i * 73 + 11) % 128, (i * 29 + 7) % 128, 1 + i % 3, 1, i % 3 ? grain : shade);
  polygon(dune.ctx, [[0, 50], [40, 38], [96, 14], [144, 9], [192, 21], [231, 12], [256, 0], [256, 20], [212, 40], [169, 44], [105, 35], [48, 53], [0, 72]], shade);
  polygon(dune.ctx, [[0, 49], [40, 37], [96, 13], [144, 8], [192, 20], [231, 11], [256, 0], [256, 3], [232, 16], [192, 25], [143, 13], [98, 18], [42, 42], [0, 54]], ridge);
  for (let i = 0; i < 12; i++) rect(dune.ctx, 18 + i * 17, 63 + i % 3 * 4, 9 + i % 5, 1, grain);
  const a = atlas.ctx;
  polygon(a, [[4, 102], [12, 40], [40, 10], [126, 10], [162, 39], [177, 102]], ink);
  polygon(a, [[12, 92], [20, 43], [45, 17], [123, 17], [153, 42], [165, 92]], steel);
  for (let x = 35; x < 145; x += 22) { rect(a, x, 36, 3, 53, worn); rect(a, x - 4, 28, 12, 3, worn); }
  polygon(a, [[18, 94], [27, 58], [50, 42], [118, 42], [148, 61], [157, 103], [18, 103]], ink);
  polygon(a, [[109, 11], [133, 14], [147, 38], [130, 33], [123, 53], [111, 47]], sand);
  rect(a, 46, 48, 37, 3, cyan); rect(a, 94, 48, 19, 3, cyan);
  rect(a, 9, 101, 163, 4, worn); rect(a, 27, 106, 119, 3, shade);
  rect(a, 170, 66, 15, 35, ink); rect(a, 174, 71, 4, 3, amber); rect(a, 174, 79, 4, 3, amber);
  polygon(a, [[209, 104], [237, 56], [243, 56], [271, 104]], ink);
  polygon(a, [[225, 98], [240, 66], [252, 98]], worn);
  rect(a, 238, 49, 4, 31, ink);
  polygon(a, [[193, 18], [231, 33], [278, 7], [264, 39], [239, 52], [214, 44]], ink);
  polygon(a, [[198, 20], [232, 35], [272, 12], [259, 35], [238, 46], [217, 39]], worn);
  polygon(a, [[210, 25], [233, 35], [259, 20], [245, 34], [234, 39], [220, 35]], steel);
  rect(a, 235, 22, 3, 17, ink); rect(a, 234, 20, 5, 4, amber);
  rect(a, 207, 102, 64, 7, ink); rect(a, 216, 105, 47, 3, steel);
  rect(a, 274, 87, 24, 22, ink); rect(a, 278, 91, 16, 11, steel); rect(a, 280, 93, 4, 3, cyan);
  polygon(a, [[314, 98], [328, 73], [331, 73], [345, 98]], ink);
  polygon(a, [[309, 57], [328, 65], [350, 53], [342, 70], [329, 77], [317, 71]], steel);
  rect(a, 328, 60, 2, 12, worn); rect(a, 313, 98, 33, 4, ink);
  polygon(a, [[4, 154], [24, 138], [138, 138], [157, 150], [149, 208], [126, 222], [18, 218], [4, 204]], '#8b7c68');
  for (let y = 148; y < 211; y += 17) { rect(a, 18, y, 40, 2, '#a18f74'); rect(a, 83, y, 51, 2, '#a18f74'); }
  polygon(a, [[11, 156], [42, 145], [53, 150], [28, 160], [47, 164], [42, 169], [16, 163]], steel);
  polygon(a, [[100, 183], [137, 171], [146, 178], [132, 192], [104, 196]], steel);
  rect(a, 111, 180, 22, 2, worn); rect(a, 23, 152, 12, 2, worn);
  rect(a, 19, 198, 31, 3, '#687d79'); rect(a, 92, 143, 25, 3, '#687d79');
  polygon(a, [[4, 207], [42, 201], [70, 213], [104, 210], [145, 199], [150, 211], [125, 222], [19, 219]], sand);
  polygon(a, [[194, 147], [225, 159], [276, 137], [262, 171], [238, 187], [213, 177]], '#697c7b');
  polygon(a, [[201, 151], [225, 162], [268, 144], [257, 168], [237, 181], [217, 172]], '#929080');
  polygon(a, [[205, 154], [235, 174], [237, 171], [221, 160]], '#747e76');
  polygon(a, [[258, 149], [235, 174], [238, 175], [264, 147]], '#747e76');
  polygon(a, [[217, 144], [231, 165], [235, 165], [222, 142]], steel);
  rect(a, 217, 142, 6, 3, '#8d9c94');
  polygon(a, [[236, 184], [255, 195], [277, 191], [278, 194], [254, 200], [232, 187]], '#747e76');
  polygon(a, [[241, 155], [244, 166], [239, 178], [249, 181], [255, 173], [250, 161], [248, 151]], sand);
  rect(a, 202, 191, 16, 3, '#687d79'); rect(a, 261, 182, 9, 3, '#687d79');
  const patterns = new WeakMap<CanvasRenderingContext2D, CanvasPattern>();
  return function drawDesertMap(ctx: CanvasRenderingContext2D, arenaSize: number, view: View): void {
    ctx.save();
    ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    let pattern = patterns.get(ctx);
    if (!pattern) { const created = ctx.createPattern(tile.canvas, 'repeat'); if (created) { pattern = created; patterns.set(ctx, created); } }
    ctx.fillStyle = pattern ?? sand; ctx.fillRect(Math.floor(view.left), Math.floor(view.top), Math.ceil(view.width) + 1, Math.ceil(view.height) + 1);
    const s = arenaSize / 1500;
    function stamp(sx: number, sy: number, sw: number, sh: number, x: number, y: number, width: number, height: number) {
      const dx = Math.round(x * s), dy = Math.round(y * s), dw = Math.round(width * s), dh = Math.round(height * s);
      if (dx + dw < view.left || dx > view.left + view.width || dy + dh < view.top || dy > view.top + view.height) return;
      ctx.drawImage(atlas.canvas, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    for (const [x, y, width] of [[-120, 220, 660], [570, 155, 750], [1080, 230, 620], [-60, 600, 520], [1020, 600, 540], [-80, 1100, 660], [550, 1150, 700], [1160, 1040, 590]]) {
      const dx = Math.round(x * s), dy = Math.round(y * s), dw = Math.round(width * s), dh = Math.round(110 * s);
      if (dx + dw >= view.left && dx <= view.left + view.width && dy + dh >= view.top && dy <= view.top + view.height) ctx.drawImage(dune.canvas, dx, dy, dw, dh);
    }
    for (let i = 0; i < 30; i++) {
      const x = Math.round((410 + i * 23) * s), y = Math.round((750 + Math.floor(i / 5) % 2 * 3) * s);
      rect(ctx, x, y, Math.max(1, Math.round(9 * s)), 2, shade); rect(ctx, x, y + Math.round(24 * s), Math.max(1, Math.round(9 * s)), 2, shade);
    }
    for (const [x, y, width] of [[625, 652, 58], [804, 652, 43], [620, 875, 31], [815, 875, 40]]) rect(ctx, Math.round(x * s), Math.round(y * s), Math.round(width * s), 2, '#78867a');
    stamp(1, 128, 160, 100, 398, 606, 224, 140);
    stamp(188, 132, 96, 72, 984, 636, 134, 101);
    stamp(188, 132, 96, 72, 1110, 856, 86, 64);
    stamp(1, 128, 160, 100, 630, 1120, 112, 70);
    stamp(1, 0, 188, 112, -248, 545, 235, 140);
    stamp(188, 0, 164, 112, 1514, 550, 246, 168);
    ctx.strokeStyle = '#b6a18266'; ctx.lineWidth = 1; ctx.setLineDash([5, 7]); ctx.strokeRect(36, 36, arenaSize - 72, arenaSize - 72);
    ctx.restore();
  };
}
