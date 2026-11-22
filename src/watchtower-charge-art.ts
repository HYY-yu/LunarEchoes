import { RELAY_CENTER, RELAY_CORNERS } from './relay-layout.js';

function orbit(index: number) {
  return {
    x: Math.round(64 * Math.cos(index * Math.PI / 48)),
    y: Math.round(43 * Math.sin(index * Math.PI / 48)) - 9
  };
}

export function createWatchtowerChargeArt() {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 360;
  const tileContext = tile.getContext('2d');
  if (!tileContext) throw new Error('Watchtower charge canvas unavailable');

  tileContext.translate(180, 180);
  const rect = (x: number, y: number, width: number, height: number, color: string) => {
    tileContext.fillStyle = color;
    tileContext.fillRect(x, y, width, height);
  };
  const octagon = (x: number, y: number, width: number, height: number, cut: number, color: string) => {
    for (let row = 0; row < height; row++) {
      const gap = Math.max(0, cut - row, cut - (height - 1 - row));
      rect(x + gap, y + row, width - gap * 2, 1, color);
    }
  };

  octagon(-156, -156, 312, 312, 46, '#333448');
  octagon(-153, -153, 306, 306, 45, '#545263');
  octagon(-139, -139, 278, 278, 42, '#454457');
  for (const { x, y } of RELAY_CORNERS) {
    const sx = Math.sign(x), sy = Math.sign(y);
    for (let i = 0; i < 55; i++) {
      rect(x - i * sx - 4, y - i * sy - 4, 8, 8, '#686375');
    }
    rect(x - 14, y - 10, 28, 20, '#727381');
  }
  for (const side of [-1, 1]) {
    rect(-155, side * 18, 310, 2, '#676477');
    rect(side * 18, -155, 2, 310, '#676477');
    for (let offset = 36; offset <= 132; offset += 16) {
      rect(side * offset, -4, 3, 8, '#887a77');
      rect(-4, side * offset, 8, 3, '#887a77');
    }
  }
  for (let i = 0; i < 96; i++) {
    const { x, y } = orbit(i);
    rect(x - 2, y - 1, 6, 4, '#787788');
  }
  for (const index of [8, 40, 56, 88]) {
    const { x, y } = orbit(index);
    octagon(x - 12, y - 10, 24, 16, 4, '#303545');
    octagon(x - 12, y - 16, 24, 17, 4, '#9f8c78');
    for (let i = 0; i < 4; i++) {
      rect(x - 8 + i * 5, y - 14, 2, 10, '#5d5c69');
    }
  }
  octagon(-22, -39, 44, 25, 6, '#2c3243');
  octagon(-22, -44, 44, 23, 6, '#848698');
  rect(-9, -55, 18, 23, '#43495e');
  rect(-6, -64, 12, 27, '#77839a');
  for (let y = -58; y <= -40; y += 6) {
    rect(-9, y, 18, 3, '#c0b4bd');
    rect(-6, y + 3, 12, 2, '#4e5368');
  }
  octagon(-6, -69, 12, 11, 3, '#a2d5d9');
  return (ctx: CanvasRenderingContext2D, tick: number): void => {
    ctx.save();
    ctx.translate(RELAY_CENTER.x, RELAY_CENTER.y);
    ctx.drawImage(tile, -180, -180);
    const phase = Math.floor(tick / 2) % 96;
    for (let pulse = 0; pulse < 4; pulse++) {
      for (let segment = 0; segment < 4; segment++) {
        const { x, y } = orbit((phase + pulse * 24 - segment + 96) % 96);
        ctx.fillStyle = segment === 0 ? '#d5f3dd' : '#83b7c0';
        ctx.fillRect(x, y + (segment === 1 ? -1 : 0), 3, 2);
      }
    }
    const level = Math.floor(tick / 6) % 4;
    ctx.fillStyle = '#b8ece0';
    ctx.fillRect(-5, -40 - level * 6, 10, 2);
    ctx.restore();
  };
}
