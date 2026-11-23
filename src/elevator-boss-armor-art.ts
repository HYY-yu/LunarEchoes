import { ELEVATOR_BOSS_ARMOR, type ElevatorBossArmor } from './elevator-boss-armor.js';

const plateColors: Readonly<Record<string, string>> = {
  D: '#182a38', T: '#60b9c6', H: '#ffda82', G: '#e8a33d', S: '#a95a30', R: '#4a3740'
};
const HIT_GLEAM = '#fff3b7';
const CRACK = '#492938';
const HIT_TICKS = 8;
const BREAK_TICKS = 22;
const RETRACT_TICKS = 18;

const plates = [
  { y: 3, rows: ['.DDDD', 'DTHHD', 'THGS.', 'TGSR.', 'DRR..'], crack: [[3, 0], [2, 1], [2, 2], [1, 3]] },
  { y: 8, rows: ['DDDD.', 'THHSD', 'TGGSD', 'DSSR.', '.RR..'], crack: [[3, 0], [3, 1], [2, 2], [1, 3]] }
];

function pixelRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  const left = Math.round(x);
  const top = Math.round(y);
  ctx.fillRect(left, top, Math.round(x + width) - left, Math.round(y + height) - top);
}

export function drawElevatorBossArmor(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, armor: ElevatorBossArmor, tick: number): void {
  const age = armor.kind === 'spent' ? tick - armor.atTick : 0;
  const breaking = armor.kind === 'spent' && armor.reason === 'broken';
  const retracting = armor.kind === 'spent' && armor.reason === 'expired';
  if (age >= (breaking ? BREAK_TICKS : RETRACT_TICKS)) return;

  const hitAge = armor.kind === 'active' && armor.hitTick !== undefined ? tick - armor.hitTick : HIT_TICKS;
  const gleam = hitAge >= 0 && hitAge < HIT_TICKS;
  const retract = retracting ? age / RETRACT_TICKS : 0;
  const fracture = breaking ? age / BREAK_TICKS : 0;
  const { a: zoomX, d: zoomY, e: cameraX, f: cameraY } = ctx.getTransform();
  const left = Math.round(x - 8 * scale) * zoomX + cameraX;
  const top = Math.round(y - 8 * scale) * zoomY + cameraY;
  const pixelWidth = scale * zoomX;
  const pixelHeight = scale * zoomY;

  ctx.save();
  ctx.resetTransform();
  for (const side of [-1, 1]) {
    for (const plate of plates) {
      ctx.globalAlpha = breaking ? Math.max(0, 1 - fracture * 1.8) : 1 - retract;
      const contraction = 1 - retract * .8;
      const edge = side < 0 ? 4 : 12;
      for (const [row, pixels] of plate.rows.entries()) {
        for (let column = 0; column < pixels.length; column++) {
          const pixel = pixels[column];
          if (pixel === '.') continue;
          ctx.fillStyle = gleam && pixel === 'H' ? HIT_GLEAM : plateColors[pixel];
          const offset = side < 0 ? column - 4 : 3 - column;
          pixelRect(ctx, left + (edge + offset * contraction) * pixelWidth, top + (plate.y + row) * pixelHeight, pixelWidth * contraction, pixelHeight);
        }
      }
      if (breaking) {
        ctx.fillStyle = CRACK;
        for (const [column, row] of plate.crack) {
          pixelRect(ctx, left + (side < 0 ? column : 15 - column) * pixelWidth, top + (plate.y + row) * pixelHeight, pixelWidth, pixelHeight);
        }
        ctx.globalAlpha = 1 - fracture;
        const shardX = (x + side * (28 + age * .58)) * zoomX + cameraX;
        const shardY = top + (plate.y + 1) * pixelHeight + (plate.y < 8 ? -1 : 1) * age * .48 * zoomY;
        ctx.fillStyle = plateColors.G;
        pixelRect(ctx, shardX, shardY, 3 * zoomX, 3 * zoomY);
        ctx.fillStyle = plateColors.T;
        pixelRect(ctx, shardX + side * 4 * zoomX, shardY - 2 * zoomY, 2 * zoomX, 2 * zoomY);
      }
    }
  }
  if (armor.kind === 'active') {
    const meterX = Math.round(x - 17) * zoomX + cameraX;
    const meterY = Math.round(y - 34) * zoomY + cameraY;
    ctx.fillStyle = '#172c3d';
    pixelRect(ctx, meterX, meterY, 34 * zoomX, 4 * zoomY);
    const remaining = Math.min(1, Math.max(0, armor.remaining / ELEVATOR_BOSS_ARMOR.capacity)) * 28;
    ctx.fillStyle = gleam ? HIT_GLEAM : plateColors.H;
    for (let segment = 0; segment < 4; segment++) {
      const fill = Math.min(7, remaining - segment * 7);
      if (fill > 0) pixelRect(ctx, meterX + (1 + segment * 8) * zoomX, meterY + zoomY, fill * zoomX, 2 * zoomY);
    }
  }
  ctx.restore();
}
