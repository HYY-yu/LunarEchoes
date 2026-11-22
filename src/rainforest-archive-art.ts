import { RELAY_CENTER, RELAY_CORNERS } from './relay-layout.js';

const PLATE_HALF_SIZE = 180;
const SIDES = [-1, 1];
const SPOKES = [[0, -5], [4, -2], [4, 2], [0, 5], [-4, 2], [-4, -2]];
const FAN_POSITIONS = [-18, 16];

export function createRainforestArchiveArt() {
  const plate = document.createElement('canvas');
  plate.width = plate.height = PLATE_HALF_SIZE * 2;
  const context = plate.getContext('2d');
  if (!context) throw new Error('Archive station canvas unavailable');
  const ink = context;
  ink.translate(PLATE_HALF_SIZE, PLATE_HALF_SIZE);

  function rect(x: number, y: number, width: number, height: number, color: string) {
    ink.fillStyle = color;
    ink.fillRect(x, y, width, height);
  }
  function deck(x: number, y: number, width: number, height: number) {
    rect(x + 2, y + 3, width, height, '#1b3332');
    rect(x, y, width, height, '#485b53');
    for (let row = 1; row < height - 1; row += 6) {
      rect(x + 1, y + row, width - 2, 4, row % 12 === 1 ? '#758477' : '#6e7c70');
      rect(x + 1, y + row, width - 2, 1, '#899285');
      for (let col = 14 + row % 3 * 6; col < width - 1; col += 28) {
        rect(x + col, y + row, 1, 4, '#596c62');
      }
    }
  }

  deck(-160, -20, 320, 40);
  deck(-20, -160, 40, 320);
  for (const side of SIDES) {
    deck(-160, side * 144 - 12, 320, 24);
    deck(side * 144 - 12, -134, 24, 268);
  }
  for (const { x, y } of RELAY_CORNERS) deck(x - 13, y - 10, 26, 20);
  deck(-51, -76, 102, 70);
  rect(-36, -61, 76, 38, '#203d3c');
  rect(-39, -72, 76, 45, '#485b59');
  rect(-39, -73, 76, 4, '#bfbc94');
  rect(-34, -67, 66, 27, '#2d4849');
  for (const x of FAN_POSITIONS) {
    rect(x - 9, -61, 19, 11, '#84988c');
    rect(x - 6, -64, 13, 17, '#84988c');
    rect(x - 5, -60, 11, 8, '#536f69');
    rect(x - 2, -57, 5, 3, '#d4ba82');
    rect(x - 6, -64, 11, 2, '#c7c5a2');
  }
  rect(-22, -44, 42, 2, '#c0a073');
  rect(-32, -36, 22, 5, '#192f33');
  for (let i = 0; i < 5; i++) rect(-30 + i * 4, -35, 2, 2, i === 4 ? '#e7b86c' : '#6a9b91');
  rect(9, -37, 18, 5, '#9aab99');
  for (const side of SIDES) {
    const x = side < 0 ? -113 : 69;
    deck(x, -61, 44, 26);
    rect(x + 3, -61, 39, 18, '#36514c');
    rect(x + 1, -67, 42, 11, '#718b76');
    rect(x + 1, -68, 42, 2, '#acb399');
    for (let i = 0; i < 5; i++) rect(x + 4 + i * 8, -55, 4, 9, '#4c6d62');
  }
  for (const side of SIDES) {
    rect(-150, side * 13, 300, 2, '#345753');
    rect(side * 13, -150, 2, 77, '#345753');
    rect(side * 13, -23, 2, 173, '#345753');
    for (let offset = 28; offset < 143; offset += 24) {
      const along = side * offset;
      rect(along, -3, 2, 6, '#c0aa78');
      if (along < -73 || along > -25) rect(-3, along, 6, 2, '#c0aa78');
    }
  }

  return function drawRainforestArchive(ctx: CanvasRenderingContext2D, tick: number): void {
    ctx.save();
    ctx.translate(RELAY_CENTER.x, RELAY_CENTER.y);
    ctx.drawImage(plate, -PLATE_HALF_SIZE, -PLATE_HALF_SIZE);
    const beat = Math.floor(tick / 3);
    for (const side of SIDES) {
      for (const vertical of [false, true]) {
        for (let pulse = 0; pulse < 3; pulse++) {
          for (let i = 0; i < 7; i++) {
            const along = side * (145 - (beat + pulse * 46 + i) % 138);
            const across = side * 13 + (i === 3 ? -1 : i === 4 ? 1 : 0);
            if (vertical && along >= -73 && along < -23) continue;
            ctx.fillStyle = i === 6 ? '#d6efda' : i > 2 ? '#81ccba' : '#639c91';
            ctx.fillRect(vertical ? across : along, vertical ? along : across, 2, 2);
          }
        }
      }
    }
    for (const x of FAN_POSITIONS) {
      for (let spoke = 0; spoke < 3; spoke++) {
        const [dx, dy] = SPOKES[(Math.floor(tick / 6) + spoke * 2) % 6];
        ctx.fillStyle = '#c3c8a9';
        ctx.fillRect(x + dx, -56 + dy, 2, 2);
      }
    }
    ctx.restore();
  };
}
