const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 36;
const WALK_FRAMES = [0, 1, 0, 2];

function bakeInfantryFrames(palette: ReadonlyMap<string, string>, frames: readonly (readonly string[])[]) {
  const atlas = document.createElement('canvas');
  atlas.width = FRAME_WIDTH;
  atlas.height = FRAME_HEIGHT * frames.length;
  const paint = atlas.getContext('2d');
  if (!paint) throw new Error('Infantry atlas canvas unavailable');
  for (const [frame, rows] of frames.entries()) {
    for (const [y, row] of rows.entries()) {
      for (let x = 0; x < row.length; x++) {
        const color = palette.get(row[x]);
        if (!color) continue;
        paint.fillStyle = color;
        paint.fillRect(x, frame * FRAME_HEIGHT + y, 1, 1);
      }
    }
  }
  return atlas;
}

export function createInfantryAtlas(
  palette: ReadonlyMap<string, string>, frames: readonly (readonly string[])[], layout: 'strip' | 'frames'
) {
  const atlases = layout === 'frames'
    ? frames.map(rows => bakeInfantryFrames(palette, [rows]))
    : [bakeInfantryFrames(palette, frames)];
  return (ctx: CanvasRenderingContext2D, x: number, y: number, tick: number, scale = 1.5) => {
    const frame = WALK_FRAMES[Math.floor(tick / 6) % WALK_FRAMES.length];
    const k = scale * .82;
    const left = Math.round(x - 16 * k), top = Math.round(y + 10 - 29 * k);
    if (layout === 'frames') ctx.drawImage(atlases[frame], left, top, FRAME_WIDTH * k, FRAME_HEIGHT * k);
    else ctx.drawImage(atlases[0], 0, frame * FRAME_HEIGHT, FRAME_WIDTH, FRAME_HEIGHT, left, top, FRAME_WIDTH * k, FRAME_HEIGHT * k);
  };
}
