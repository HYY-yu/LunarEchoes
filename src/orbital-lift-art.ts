import { RELAY_CENTER, RELAY_CORNERS } from './relay-layout.js';

export function createOrbitalLiftArt() {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 360;
  const tileContext = tile.getContext('2d');
  if (!tileContext) {
    throw new Error('Orbital lift canvas unavailable');
  }
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    tileContext.fillStyle = color;
    tileContext.fillRect(x, y, w, h);
  };
  tileContext.translate(180, 180);
  for (let y = -156; y < 156; y += 4) {
    const inset = Math.max(0, Math.abs(y) - 128);
    rect(-156 + inset, y, 312 - 2 * inset, 4, '#43535f');
  }
  for (const sign of [-1, 1]) {
    for (const offset of [-126, 24]) {
      rect(offset, sign * 150, 102, 4, '#819097');
      rect(sign * 150, offset, 4, 102, '#819097');
    }
    for (let n = 30; n < 144; n += 18) {
      rect(sign * n, -14, 6, 2, '#a58d65');
      rect(sign * n, 12, 6, 2, '#a58d65');
    }
    const x = sign * 72;
    rect(x - 9, -144, 18, 288, '#253541');
    rect(x - 8, -144, 2, 288, '#7c8f98');
    rect(x + 6, -144, 2, 288, '#657e87');
    for (let y = -140; y < 140; y += 12) {
      rect(x - 4, y, 8, 2, '#586c77');
    }
    for (const y of [-65, 55]) {
      rect(x - 16, y, 32, 17, '#253744');
      rect(x - 15, y - 4, 30, 14, '#aa7658');
      for (let j = 0; j < 5; j++) {
        rect(x - 12 + j * 5, y - 4, 2, 10, '#d09b67');
      }
      rect(x - 18, y - 6, 5, 16, '#82929b');
      rect(x + 13, y - 6, 5, 16, '#82929b');
    }
  }
  for (const { x, y } of RELAY_CORNERS) {
    rect(x - 14, y - 10, 28, 19, '#344650');
    rect(x - 12, y - 10, 24, 15, '#9d947e');
  }
  const cargo = (x: number, y: number, w: number, h: number) => {
    rect(x + 3, y + 4, w, h, '#2a3b45');
    rect(x, y, w, h, '#765642');
    rect(x, y - 8, w, h, '#b18762');
    rect(x + 2, y - 7, w - 4, 2, '#d1aa77');
    for (const dx of [6, w - 10]) {
      rect(x + dx, y - 8, 4, h + 8, '#41545d');
      rect(x + dx + 1, y + h - 6, 2, 3, '#c3b690');
    }
  };
  rect(-46, -75, 92, 58, '#354650');
  rect(-44, -76, 88, 54, '#67767b');
  cargo(-37, -62, 40, 24);
  cargo(8, -59, 27, 18);
  rect(-25, -28, 50, 6, '#33434e');
  for (let i = 0; i < 5; i++) {
    rect(-18 + i * 8, -26, 4, 2, '#81b8b6');
  }
  for (const y of [-104, 100]) {
    for (let i = 0; i < 5; i++) {
      rect(-10 + i * 2, y - i, 3, 2, '#9eacac');
      rect(8 - i * 2, y - i, 3, 2, '#9eacac');
    }
  }
  return (ctx: CanvasRenderingContext2D, tick: number): void => {
    ctx.save();
    ctx.translate(RELAY_CENTER.x, RELAY_CENTER.y);
    ctx.drawImage(tile, -180, -180);
    for (const x of [-72, 72]) {
      for (let i = 0; i < 4; i++) {
        const y = 142 - (Math.floor(tick / 2) + i * 72) % 288;
        if ((y < -49 && y > -79) || (y < 71 && y > 41)) continue;
        ctx.fillStyle = '#78bfbf';
        ctx.fillRect(x - 1, y, 2, 8);
        ctx.fillStyle = '#c4eee2';
        ctx.fillRect(x - 2, y, 3, 3);
        ctx.fillRect(x + 1, y + 3, 2, 2);
      }
    }
    ctx.restore();
  };
}
