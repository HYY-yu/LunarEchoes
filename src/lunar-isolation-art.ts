import { RELAY_CENTER, RELAY_CORNERS } from './relay-layout.js';

export function createLunarIsolationArt() {
  const slab = document.createElement('canvas');
  slab.width = slab.height = 360;
  const slabContext = slab.getContext('2d');
  if (!slabContext) throw new Error('Isolation deck canvas unavailable');

  slabContext.translate(180, 180);
  const rect = (x: number, y: number, width: number, height: number, color: string) => {
    slabContext.fillStyle = color;
    slabContext.fillRect(x, y, width, height);
  };
  const clipped = (x: number, y: number, width: number, height: number, cut: number, color: string) => {
    for (let row = 0; row < height; row++) {
      const skip = Math.max(0, cut - row, cut - (height - 1 - row));
      rect(x + skip, y + row, width - 2 * skip, 1, color);
    }
  };

  for (const { x: cornerX, y: cornerY } of RELAY_CORNERS) {
    const sideX = Math.sign(cornerX), sideY = Math.sign(cornerY);
    const x = sideX < 0 ? -152 : 17, y = sideY < 0 ? -152 : 17;
    clipped(x, y, 135, 135, 21, '#3d424e');
    clipped(x + 2, y + 2, 131, 130, 20, '#777781');
    clipped(x + 6, y + 6, 123, 122, 17, '#62636f');
    for (let offset = 26; offset < 114; offset += 24) {
      rect(x + offset, y + 12, 2, 8, '#93909a');
      rect(x + offset, y + 111, 2, 7, '#464955');
    }
    for (let step = 0; step < 32; step++) {
      rect((130 + step) * sideX - 3, (130 + step) * sideY - 3, 6, 6, '#85828a');
    }
  }
  for (const { x, y } of RELAY_CORNERS) clipped(x - 14, y - 10, 28, 20, 4, '#918d91');
  clipped(-71, -67, 142, 78, 16, '#414653');
  clipped(-68, -66, 136, 71, 13, '#7a7885');
  for (const side of [-1, 1]) {
    const mirrored = (x: number, y: number, width: number, height: number, color: string) =>
      rect(side > 0 ? x : -x - width, y, width, height, color);
    mirrored(18, -48, 36, 20, '#373c4d');
    mirrored(20, -53, 32, 18, '#a3959e');
    mirrored(29, -65, 11, 16, '#50465c');
    mirrored(29, -68, 11, 5, '#c1a7b1');
    mirrored(12, -62, 23, 6, '#8a738b');
    mirrored(10, -64, 7, 9, '#e0adb7');
    mirrored(16, -34, 38, 3, '#595565');
    mirrored(17, -28, 142, 4, '#383d4c');
    mirrored(17, -28, 142, 1, '#888893');
    for (let index = 0; index < 5; index++) mirrored(19 + index * 7, -42, 4, 4, '#494054');
  }

  return (ctx: CanvasRenderingContext2D, tick: number): void => {
    ctx.save();
    ctx.translate(RELAY_CENTER.x, RELAY_CENTER.y);
    ctx.drawImage(slab, -180, -180);
    const phase = Math.floor(tick / 2) % 64;
    for (const side of [-1, 1]) {
      for (let tail = 0; tail < 6; tail++) {
        const travel = (phase + 64 - tail) % 64;
        const x = side * (153 - 2 * travel);
        ctx.fillStyle = tail === 0 ? '#f0d6d2' : tail < 3 ? '#ce91b0' : '#9f799b';
        ctx.fillRect(x, -27 + (tail === 3 ? -1 : 0), 2, 2);
      }
    }
    for (let index = 0; index < 5; index++) {
      ctx.fillStyle = (phase >> 3) === index ? '#ece3be' : '#b4a5a1';
      ctx.fillRect(-14 + index * 6, -16, 3, 2);
    }
    if (phase >= 54 && phase < 63) {
      ctx.fillStyle = '#deb4c8';
      for (const side of [-1, 1]) {
        for (let index = 0; index < 6; index++) {
          ctx.fillRect(side * (10 - index), -61 + (index === 2 ? 2 : 0), 2, 2);
        }
      }
    }
    ctx.restore();
  };
}
