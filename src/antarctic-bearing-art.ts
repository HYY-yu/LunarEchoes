import { RELAY_CENTER, RELAY_CORNERS } from './relay-layout.js';

const receivers = [{ x: -82, y: -39 }, { x: 81, y: -39 }, { x: 0, y: 87 }];

export function createAntarcticBearingArt() {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 360;
  const pen = tile.getContext('2d');
  if (!pen) throw new Error('Polar array canvas unavailable');

  const rect = (x: number, y: number, width: number, height: number, color: string) => {
    pen.fillStyle = color;
    pen.fillRect(x, y, width, height);
  };
  const cable = (x: number, y: number, tx: number, ty: number, width: number, color: string) => {
    const steps = Math.max(Math.abs(tx - x), Math.abs(ty - y));
    for (let n = 0; n <= steps; n++) {
      rect(Math.round(x + (tx - x) * n / steps), Math.round(y + (ty - y) * n / steps), width, width, color);
    }
  };

  pen.translate(180, 180);
  for (let y = -154; y <= 154; y += 7) {
    const cut = Math.max(0, Math.abs(y) - 118);
    rect(-154 + cut, y, 308 - 2 * cut, 7, '#778d97');
    if ((y + 154) % 21 === 0) rect(-154 + cut, y, 308 - 2 * cut, 1, '#8398a1');
  }
  for (const sign of [-1, 1]) {
    for (const start of [-119, 25]) {
      rect(start, 150 * sign, 94, 3, '#435c6b');
      rect(150 * sign, start, 3, 94, '#435c6b');
    }
    for (let n = 28; n < 145; n += 16) {
      rect(sign * n, -1, 4, 2, '#cdc4a6');
      rect(-1, sign * n, 2, 4, '#cdc4a6');
    }
  }
  for (const { x, y } of RELAY_CORNERS) {
    cable(Math.sign(x) * 124, Math.sign(y) * 124, x, y, 4, '#567180');
    rect(x - 13, y - 9, 26, 18, '#415b6c');
    rect(x - 12, y - 10, 24, 16, '#b3c2c2');
  }
  for (const { x, y } of receivers) {
    cable(x, y, 0, -23, 3, '#4b6576');
    rect(x - 11, y - 4, 23, 9, '#506977');
    rect(x - 10, y - 6, 21, 7, '#bccccc');
    cable(x - 6, y - 5, x, y - 19, 3, '#465b68');
    cable(x + 6, y - 5, x, y - 19, 3, '#465b68');
    rect(x, y - 24, 3, 16, '#718b98');
    rect(x, y - 13, 3, 3, '#d7a161');
    for (let i = 0; i < 5; i++) {
      const px = x - 14 + i * 6, py = y - 20 - i * 2, radius = 6 - i;
      cable(px - radius, py - radius, px + radius, py + radius, 2, '#435e70');
      rect(px - radius, py - radius, 3, 1, '#c6d7d7');
    }
    cable(x - 16, y - 20, x + 16, y - 30, 2, '#c4d2d0');
  }
  rect(-25, -42, 50, 30, '#405765');
  rect(-25, -45, 50, 29, '#a9bbbd');
  rect(-21, -42, 42, 21, '#344f60');
  rect(-17, -38, 34, 14, '#527c85');
  for (let x = -14; x < 17; x += 6) rect(x, -37, 1, 11, '#658c90');
  cable(-12, -28, 0, -32, 1, '#a9d9d3');
  cable(0, -32, 11, -36, 1, '#a9d9d3');
  rect(10, -37, 3, 3, '#f1be70');
  rect(-19, -19, 13, 2, '#667e87');

  return (ctx: CanvasRenderingContext2D, tick: number): void => {
    ctx.save();
    ctx.translate(RELAY_CENTER.x, RELAY_CENTER.y);
    ctx.drawImage(tile, -180, -180);
    for (const [j, { x, y }] of receivers.entries()) {
      const phase = (Math.floor(tick / 2) + j * 13) % 64;
      for (let k = 0; k < 5; k++) {
        const t = Math.max(0, phase - k) / 64;
        const px = Math.round(x * (1 - t)), py = Math.round(y + (-23 - y) * t);
        if (py >= -45 && py <= -16 && Math.abs(px) <= 25) continue;
        ctx.fillStyle = k === 0 ? '#e3f4da' : '#87c6c1';
        ctx.fillRect(px, py + (k === 2 ? 1 : 0), 2, 2);
      }
      ctx.fillStyle = phase >= 46 && phase <= 53 ? '#ffdb88' : '#577780';
      ctx.fillRect(2 + j * 5, -19, 3, 2);
    }
    ctx.restore();
  };
}
