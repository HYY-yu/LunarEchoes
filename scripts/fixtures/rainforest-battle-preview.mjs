import { createAtlas } from '/art.js';

import { drawRainforestTerrain, RAINFOREST_ANCHORS } from '/rainforest-terrain.mjs';

function shot(ctx, x, y, hostile, travelX, travelY) {
  const size = hostile ? 5 : 3;
  const tail = (hostile ? 2.2 : 8) * 2 / Math.hypot(travelX, travelY);
  ctx.fillStyle = hostile ? '#f6b77c' : '#d9fff2';
  ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, size, size);
  ctx.strokeStyle = hostile ? '#dc916166' : '#8af5e5aa';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - travelX * tail, y - travelY * tail);
  ctx.stroke();
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
    const travelX = Math.sin(index * 1.3) * 65;
    const travelY = 112;
    const phase = ((time / 17 + index * 16 + 8) % 117) / 117;
    shot(ctx, sentryX + travelX * phase - 5, sentryY + travelY * phase, true, travelX, travelY);
  }
  for (let index = 0; index < 4; index++) {
    const phase = ((time / 13 + index * 24) % 95) / 95;
    shot(ctx, x - phase * 54 - 12, y - phase * 82 - 8, false, -54, -82);
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
    const anchor = RAINFOREST_ANCHORS[area];
    const width = map.width / zoom;
    const height = map.height / zoom;
    const left = anchor.x - width / 2;
    const top = anchor.y - height / 2;
    mapCtx.setTransform(zoom, 0, 0, zoom, -left * zoom, -top * zoom);
    drawRainforestTerrain(mapCtx, { left, top, width, height });
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
