import { createAtlas } from '/art.js';

const tones = {
  canopy: ['#1d3633', '#243f39', '#2b473d', '#315044'],
  ruins: ['#283e37', '#30473e', '#384f44', '#40564a'],
  roots: ['#273a33', '#30423a', '#39493f', '#414f44']
};

function box(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), width, height);
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

const areas = { canopy, ruins, roots: rootTrail };

function terrain(ctx, area, width, height, zoom) {
  const halfWidth = Math.ceil(width / zoom / 2);
  const halfHeight = Math.ceil(height / zoom / 2);
  const colors = tones[area];
  box(ctx, colors[0], -halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2);
  for (let y = Math.floor(-halfHeight / 12) * 12; y < halfHeight; y += 12) {
    for (let x = Math.floor(-halfWidth / 12) * 12; x < halfWidth; x += 12) {
      const seed = ((Math.imul(x + 19, 2654435761) ^ Math.imul(y - 33, 1597334677)) >>> 0);
      box(ctx, colors[seed % 4], x + (seed % 5), y + ((seed >>> 4) % 5), 2 + ((seed >>> 7) % 6), 2);
    }
  }
  areas[area](ctx);
}

function shot(ctx, x, y, hostile, direction) {
  const length = hostile ? 8 : 12;
  box(ctx, '#14232c', x - 3, y - 2, 7, 7);
  ctx.fillStyle = hostile ? '#bb8167' : '#6ac2ba';
  ctx.fillRect(Math.round(x - length / 2), Math.round(y - length * direction), 2, 2);
  ctx.fillRect(Math.round(x - length / 4), Math.round(y - length * direction / 2), 2, 2);
  box(ctx, hostile ? '#f6b77c' : '#d9fff2', x - 2, y - 1, hostile ? 5 : 3, hostile ? 5 : 3);
}

function encounter(ctx, atlas, elapsed) {
  const time = elapsed % 4000;
  const tick = Math.floor(time * .06);
  const x = Math.sin(time * Math.PI / 2000) * 28 - 7;
  const y = 29 + Math.cos(time * Math.PI / 2000) * 7;
  const sentryX = 33;
  const sentryY = -39;
  const warning = time < 1450 || time >= 3250;
  if (warning) {
    const progress = (time < 1450 ? time + 750 : time - 3250) / 2200;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(sentryX, sentryY, 26 + progress * 11, 0, Math.PI * 2);
    ctx.strokeStyle = '#17272a';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = '#ffd499';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const [dx, dy, id] of [[-53,-12,1], [-76,46,2], [73,44,3]]) {
    atlas.draw(ctx, 'crawler', dx + Math.sin(time * Math.PI / 2000 + id) * 9, dy, 1.5, tick + id * 7);
  }
  atlas.draw(ctx, 'sentry', sentryX, sentryY, 1.8, tick);
  for (let index = 0; index < 7; index++) {
    const phase = ((time / 17 + index * 16 + 8) % 117) / 117;
    shot(ctx, sentryX + Math.sin(index * 1.3) * phase * 65 - 5, sentryY + phase * 112, true, 1);
  }
  for (let index = 0; index < 4; index++) {
    const phase = ((time / 13 + index * 24) % 95) / 95;
    shot(ctx, x - phase * 54 - 12, y - phase * 82 - 8, false, -1);
  }
  ctx.fillStyle = '#0d262777';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 12, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  atlas.draw(ctx, 'astronaut', x, y, 1.7, tick);
}

export function createBattlefieldPreview(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const map = document.createElement('canvas');
  const mapCtx = map.getContext('2d', { alpha: false });
  if (!ctx || !mapCtx) throw new Error('Canvas 2D is unavailable');
  const atlas = createAtlas();
  let area = 'canopy';
  let elapsed = 0;
  let frame = 0;
  let previous = 0;
  let paused = true;

  function resize() {
    canvas.width = Math.max(1, Math.ceil(canvas.clientWidth / 2));
    canvas.height = Math.max(1, Math.ceil(canvas.clientHeight / 2));
    map.width = canvas.width;
    map.height = canvas.height;
    const zoom = Math.max(.8, Math.min(1.2, canvas.width / 600));
    mapCtx.setTransform(zoom, 0, 0, zoom, map.width / 2, map.height / 2);
    terrain(mapCtx, area, map.width, map.height, zoom);
    draw();
  }

  function draw() {
    const zoom = Math.max(.8, Math.min(1.2, canvas.width / 600));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(map, 0, 0);
    ctx.setTransform(zoom, 0, 0, zoom, canvas.width / 2, canvas.height / 2);
    encounter(ctx, atlas, elapsed);
  }

  function animate(now) {
    if (previous) elapsed += Math.min(50, now - previous);
    previous = now;
    draw();
    frame = requestAnimationFrame(animate);
  }

  new ResizeObserver(resize).observe(canvas);
  resize();
  return {
    select(name) {
      area = name;
      elapsed = 0;
      previous = 0;
      resize();
    },
    setPaused(value) {
      if (value === paused) return;
      paused = value;
      previous = 0;
      if (paused) cancelAnimationFrame(frame);
      else frame = requestAnimationFrame(animate);
    }
  };
}
