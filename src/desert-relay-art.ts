import { RELAY_CENTER, RELAY_CORNERS } from './relay-layout.js';

const TILE_HALF_SIZE = 180;
const FLOOR_COLORS = ['#897d66', '#847a65', '#8b806b'];
const SIDES = [-1, 1];

export function createDesertRelayArt() {
  const tile = document.createElement('canvas');
  tile.width = TILE_HALF_SIZE * 2;
  tile.height = TILE_HALF_SIZE * 2;
  const context = tile.getContext('2d');
  if (!context) throw new Error('Relay base canvas unavailable');
  const pen = context;
  pen.translate(TILE_HALF_SIZE, TILE_HALF_SIZE);

  function rect(x: number, y: number, width: number, height: number, color: string) {
    pen.fillStyle = color;
    pen.fillRect(x, y, width, height);
  }
  function block(x: number, y: number, width: number, depth: number, height: number, top: string, side: string) {
    rect(x + 2, y + 3, width, depth, '#4d4b42');
    rect(x, y - height, width, depth + height, side);
    rect(x, y - height, width, depth, top);
    rect(x, y - height, width, 1, '#c4ae87');
  }

  rect(-160, -160, 320, 320, '#746c5c');
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const x = -160 + 32 * col;
      const y = -160 + 32 * row;
      rect(x + 1, y + 1, 31, 31, FLOOR_COLORS[(row * 3 + col * 7 + row * col) % 3]);
      rect(x + 3, y + 3, 2, 1, '#a49478');
    }
  }
  for (const side of SIDES) {
    const edge = side === 1 ? 153 : -160;
    for (const start of [-137, 25]) {
      block(start, edge, 112, 5, 2, '#a59879', '#555a55');
      block(edge, start, 5, 112, 2, '#a59879', '#555a55');
    }
    for (let i = 0; i < 4; i++) {
      rect(-13 + i * 7, edge + 2, 4, 2, '#ebbe7a');
      rect(edge + 2, -13 + i * 7, 2, 4, '#ebbe7a');
    }
    rect(-150, side * 19, 300, 3, '#535e5c');
    rect(side * 19, -150, 3, 300, '#535e5c');
    for (const y of [-86, 64]) {
      const x = side < 0 ? -90 : 58;
      block(x, y, 32, 20, 3, '#566876', '#384b56');
      for (let i = 0; i < 5; i++) rect(x + 3 + i * 6, y - 1, 3, 15, '#73848a');
      rect(x + 2, y + 7, 28, 1, '#b6a488');
    }
  }
  for (const { x, y } of RELAY_CORNERS) {
    block(x - 14, y - 9, 28, 18, 2, '#898a7d', '#545e5c');
  }
  block(-26, -43, 52, 27, 4, '#a7997d', '#585f60');
  block(-16, -42, 31, 17, 9, '#727e7f', '#414f58');
  block(-5, -46, 10, 10, 18, '#9ba6a0', '#56666b');
  for (let i = 0; i < 23; i++) {
    const t = (i - 11) / 11;
    const x = -26 + i * 2;
    const y = Math.round(-64 + 10 * (1 - t * t) - 7 * t);
    rect(x, y, 3, Math.round(3 + 6 * (1 - t * t)), '#50616b');
    rect(x, y - 3, 3, 4, '#d1c7a6');
    rect(x, y - 5, 3, 2, '#ebe0b9');
  }
  for (let i = 0; i < 13; i++) rect(-2 + i, -58 - i, 2, 2, '#839796');
  rect(9, -74, 5, 5, '#394b53');
  rect(10, -74, 3, 2, '#e9bd70');
  for (let i = 0; i < 4; i++) rect(-19 + i * 6, -22, 4, 2, '#7dbcb1');

  return function drawDesertRelay(ctx: CanvasRenderingContext2D, tick: number): void {
    ctx.save();
    ctx.translate(RELAY_CENTER.x, RELAY_CENTER.y);
    ctx.drawImage(tile, -TILE_HALF_SIZE, -TILE_HALF_SIZE);
    const phase = Math.floor(tick / 3) % 144;
    for (const side of SIDES) {
      for (const vertical of [false, true]) {
        for (let pulse = 0; pulse < 3; pulse++) {
          const start = 8 + (phase + pulse * 48) % 144;
          for (let i = 0; i < 6; i++) {
            const along = side * (start + i);
            const across = side * 19 + 1 + (i === 2 ? -1 : i === 3 ? 1 : 0);
            ctx.fillStyle = i === 5 ? '#c9ebe0' : i < 2 ? '#689391' : '#80c7bb';
            ctx.fillRect(vertical ? across : along, vertical ? along : across, 2, 2);
          }
        }
      }
    }
    ctx.restore();
  };
}
