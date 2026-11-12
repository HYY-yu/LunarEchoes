export const RAINFOREST_ANCHORS = Object.freeze({
  canopy: Object.freeze({ x: 0, y: 0 }),
  ruins: Object.freeze({ x: 720, y: 0 }),
  roots: Object.freeze({ x: 1440, y: 0 })
});

const tones = {
  canopy: ['#1d3633', '#243f39', '#2b473d', '#315044'],
  ruins: ['#283e37', '#30473e', '#384f44', '#40564a'],
  roots: ['#273a33', '#30423a', '#39493f', '#414f44']
};

function box(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  const left = Math.round(x);
  const top = Math.round(y);
  ctx.fillRect(left, top, Math.round(x + width) - left, Math.round(y + height) - top);
}

function foliage(ctx, x, y, scale) {
  for (const [dx, dy, width, height, color] of [
    [-20, -10, 40, 17, '#142b2b'], [-14, -17, 29, 25, '#142b2b'],
    [-18, -8, 36, 12, '#243d36'], [-11, -15, 24, 16, '#2b4539'],
    [-3, -17, 11, 9, '#365347'], [9, -10, 10, 10, '#2d493e'],
    [-14, -9, 10, 4, '#365347'], [-8, 1, 24, 4, '#203a34']
  ]) box(ctx, color, x + dx * scale, y + dy * scale, width * scale, height * scale);
}

function canopy(ctx) {
  for (const [x, y, scale] of [
    [-110, -105, 2], [-55, -90, 2], [15, -122, 3], [90, -94, 2], [132, -127, 3],
    [-134, -41, 2], [125, -22, 2], [-127, 57, 2], [112, 71, 2], [-62, 112, 2],
    [60, 127, 3], [-200, -112, 3], [213, -91, 3], [-223, 48, 3], [206, 50, 3]
  ]) foliage(ctx, x, y, scale);
  for (let x = -94; x < 95; x += 18) {
    const y = Math.round(x / 3);
    box(ctx, '#263f36', x, y - 14, 30, 26);
    box(ctx, '#2b4539', x + 7, y - 7, 18, 13);
  }
}

function ruins(ctx) {
  for (let y = -72; y <= 60; y += 15) {
    for (let x = -102; x <= 85; x += 22) {
      if (Math.abs(x + 9) + Math.abs(y) > 140) continue;
      const shade = (Math.abs(x * 3 + y * 7) % 3);
      box(ctx, ['#42574c', '#465a4e', '#3c5248'][shade], x + (y % 2 ? 4 : 0), y, 20, 12);
      box(ctx, '#4d6052', x + 5, y + 1, 11, 2);
    }
  }
  for (const [x, y, width, height] of [[-90,-78,36,14], [-44,-86,30,17], [32,-83,34,13], [82,-59,15,32], [-96,43,15,25], [67,58,28,17]]) {
    box(ctx, '#1f3430', x + 4, y + 5, width, height);
    box(ctx, '#576659', x, y, width, height);
    box(ctx, '#41574b', x + 3, y + 3, width - 6, height - 4);
    box(ctx, '#334b41', x + Math.floor(width / 2), y + 3, 2, height - 3);
    foliage(ctx, x + width, y + height, .5);
  }
  for (const [x, y] of [[-139,-62],[117,-83],[-141,76],[121,96],[-214,30],[222,-23]]) foliage(ctx, x, y, 2);
}

function rootTrail(ctx) {
  for (let y = -220; y < 220; y += 8) {
    const center = Math.round(Math.sin(y / 61) * 28);
    box(ctx, '#4e5040', center - 53, y, 106, 8);
    box(ctx, '#434d40', center - 43, y, 86, 8);
    box(ctx, '#555545', center + ((y * 11 % 75 + 75) % 75) - 38, y + 3, 13, 2);
  }
  for (const [x, y, direction] of [[-91,-92,1],[84,-66,-1],[-86,-15,1],[82,32,-1],[-85,77,1],[93,128,-1]]) {
    for (let step = 0; step < 10; step++) {
      const px = x + direction * step * 5;
      const py = y + Math.round(Math.sin(step / 4) * 12) - step;
      box(ctx, '#262e2b', px - 4, py + 2, 15, 8);
      box(ctx, '#655c45', px - 4, py, 14, 3);
      box(ctx, '#504c3b', px - 2, py + 3, 10, 3);
    }
    foliage(ctx, x + direction * -12, y - 2, 1.5);
  }
}

const regions = [
  { anchor: RAINFOREST_ANCHORS.canopy, left: -Infinity, right: 360, colors: tones.canopy, draw: canopy },
  { anchor: RAINFOREST_ANCHORS.ruins, left: 360, right: 1080, colors: tones.ruins, draw: ruins },
  { anchor: RAINFOREST_ANCHORS.roots, left: 1080, right: Infinity, colors: tones.roots, draw: rootTrail }
];

export function drawRainforestTerrain(ctx, view) {
  const right = view.left + view.width;
  const bottom = view.top + view.height;
  for (const region of regions) {
    const left = Math.max(view.left, region.left);
    const edge = Math.min(right, region.right);
    if (left >= edge) continue;
    const { anchor, colors, draw } = region;
    ctx.save();
    const clip = new Path2D();
    clip.rect(left, view.top, edge - left, view.height);
    ctx.clip(clip);
    ctx.fillStyle = colors[0];
    ctx.fillRect(left, view.top, edge - left, view.height);
    ctx.translate(anchor.x, anchor.y);
    const firstX = Math.floor((left - anchor.x) / 12) * 12;
    const firstY = Math.floor((view.top - anchor.y) / 12) * 12;
    for (let y = firstY; y < bottom - anchor.y; y += 12) {
      for (let x = firstX; x < edge - anchor.x; x += 12) {
        const seed = ((Math.imul(x + 19, 2654435761) ^ Math.imul(y - 33, 1597334677)) >>> 0);
        box(ctx, colors[seed % 4], x + (seed % 5), y + ((seed >>> 4) % 5), 2 + ((seed >>> 7) % 6), 2);
      }
    }
    draw(ctx);
    ctx.restore();
  }
}
