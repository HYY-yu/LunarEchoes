import type { createAtlas } from './art.js';
import type { Fx, World } from './core.js';
import { LUNAR_ECHO_CAST } from './lunar-echo-cast.js';

const ECHO_LIGHT = '#a8f3ff';
const ECHO_SHADE = '#1a3a53';
const DISPERSAL_TICKS = 18;

export function drawLunarEchoSites(ctx: CanvasRenderingContext2D, world: World) {
  const cast = world.lunarEchoCast;
  if (cast?.kind === 'warning') {
    const progress = 1 - Math.min(1, Math.max(0, (cast.splitTick - world.tick) / LUNAR_ECHO_CAST.warningTicks));
    for (const site of cast.sites) drawSite(ctx, site.x, site.y, .66 + .34 * progress, true);
  } else if (cast?.kind === 'active') {
    for (const enemy of world.enemies) {
      if (enemy.kind === 'boss-echo') drawSite(ctx, enemy.x, enemy.y, .66, false);
    }
  }
}

function drawSite(ctx: CanvasRenderingContext2D, x: number, y: number, opacity: number, warning: boolean) {
  ctx.save();
  ctx.translate(x, y + 12);
  ctx.beginPath();
  ctx.ellipse(0, 0, 35, 15, 0, 0, Math.PI * 2);
  ctx.globalAlpha = .65;
  ctx.fillStyle = ECHO_SHADE;
  ctx.fill();
  ctx.strokeStyle = ECHO_SHADE;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = ECHO_LIGHT;
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 4]);
  ctx.stroke();
  if (warning) {
    ctx.fillStyle = ECHO_LIGHT;
    ctx.fillRect(-1, -5, 2, 10);
    ctx.fillRect(-5, -1, 10, 2);
  }
  ctx.restore();
}

export function createLunarEchoArt(drawSprite: ReturnType<typeof createAtlas>['draw']) {
  const sprite = document.createElement('canvas');
  const size = 16;
  sprite.width = sprite.height = size;
  const pixels = sprite.getContext('2d');
  if (!pixels) throw new Error('Lunar echo canvas unavailable');
  drawSprite(pixels, 'boss', size / 2, size / 2);
  const frame = pixels.getImageData(0, 0, size, size);
  for (let i = 0; i < frame.data.length; i += 4) {
    if (frame.data[i + 3] === 0) continue;
    const red = frame.data[i], blue = frame.data[i + 2];
    const [r, g, b] = red > blue || blue > 190 ? [157, 237, 255] :
      blue > 120 ? [83, 176, 210] : [39, 116, 149];
    frame.data[i] = r;
    frame.data[i + 1] = g;
    frame.data[i + 2] = b;
    if (Math.floor(i / (size * 4)) % 4 === 2) frame.data[i + 3] = 145;
  }
  pixels.putImageData(frame, 0, 0);

  return (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, tick: number, flash: number) => {
    const reach = size * scale / 2;
    ctx.save();
    ctx.globalAlpha = flash > 0 ? .9 : .72 + .06 * Math.sin(tick / 7);
    ctx.drawImage(sprite, Math.round(x - reach), Math.round(y - reach), reach * 2, reach * 2);
    ctx.restore();
  };
}

export function drawLunarEchoDispersal(ctx: CanvasRenderingContext2D, effect: Fx) {
  const remaining = effect.life / DISPERSAL_TICKS;
  const spread = 1 - remaining;
  ctx.save();
  ctx.globalAlpha = .8 * remaining;
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6 + (i % 3) * .1;
    const reach = effect.size * (.28 + .65 * spread + (i % 4) * .055);
    const x = Math.round(effect.x + Math.cos(angle) * reach);
    const y = Math.round(effect.y - 5 + Math.sin(angle) * reach * .75);
    ctx.fillStyle = i % 3 === 0 ? ECHO_LIGHT : '#5cafce';
    ctx.fillRect(x, y, spread < .5 && i % 2 === 0 ? 5 : 3, 2);
  }
  ctx.restore();
}
