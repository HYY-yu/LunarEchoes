type Vector = readonly [x: number, y: number, z: number];
type FaceColors = readonly [top: number, front: number, side: number];

const suitPalette = {
  shell: [0xfff8e5, 0xe4e4d5, 0xb1bebd],
  structure: [0x84949a, 0x50626c, 0x344550],
  visor: [0xb3eee4, 0x4396a1, 0x285464],
  trim: [0xf3bd7d, 0xbf804c, 0x895538],
  joint: [0xbdd1d1, 0x879b9f, 0x657882]
} satisfies Record<string, FaceColors>;

const FRAME_SIZE = { width: 32, height: 36 };
const DRAW_BOX = { offsetX: -19, offsetY: -24, width: 38, height: 43 };
const VISOR_FRAME_BOX = { x: 11, y: 10, width: 7, height: 4 };

export function astronautVisorBounds(x: number, y: number) {
  const scaleX = DRAW_BOX.width / FRAME_SIZE.width;
  const scaleY = DRAW_BOX.height / FRAME_SIZE.height;
  return {
    x: Math.round(x) + DRAW_BOX.offsetX + VISOR_FRAME_BOX.x * scaleX - 1,
    y: Math.round(y) + DRAW_BOX.offsetY + VISOR_FRAME_BOX.y * scaleY - 1,
    width: VISOR_FRAME_BOX.width * scaleX + 2,
    height: VISOR_FRAME_BOX.height * scaleY + 2
  };
}

export function astronautFrame(step: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const { width, height } = FRAME_SIZE;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Astronaut atlas unavailable');
  const image = ctx.createImageData(width, height);
  const depth = new Float32Array(width * height).fill(-Infinity);

  function rasterizeFace(
    [x, y, z]: Vector,
    [ux, uy, uz]: Vector,
    [vx, vy, vz]: Vector,
    color: number
  ) {
    const screenX = 16 + .94 * x - .342 * y;
    const screenY = 29 + .144 * x + .395 * y - .907 * z;
    const edgeUX = .94 * ux - .342 * uy;
    const edgeUY = .144 * ux + .395 * uy - .907 * uz;
    const edgeVX = .94 * vx - .342 * vy;
    const edgeVY = .144 * vx + .395 * vy - .907 * vz;
    const determinant = edgeUX * edgeVY - edgeVX * edgeUY;
    const left = Math.max(0, Math.floor(screenX + Math.min(0, edgeUX) + Math.min(0, edgeVX)));
    const right = Math.min(width, Math.ceil(screenX + Math.max(0, edgeUX) + Math.max(0, edgeVX)));
    const top = Math.max(0, Math.floor(screenY + Math.min(0, edgeUY) + Math.min(0, edgeVY)));
    const bottom = Math.min(height, Math.ceil(screenY + Math.max(0, edgeUY) + Math.max(0, edgeVY)));
    const pixel = [color >> 16, (color >> 8) & 255, color & 255, 255];

    for (let row = top; row < bottom; row++) {
      for (let column = left; column < right; column++) {
        const offsetX = column + .5 - screenX;
        const offsetY = row + .5 - screenY;
        const u = (edgeVY * offsetX - edgeVX * offsetY) / determinant;
        const v = (edgeUX * offsetY - edgeUY * offsetX) / determinant;
        if (u < 0 || u > 1 || v < 0 || v > 1) continue;

        const distance = .31 * (x + u * ux + v * vx)
          + .852 * (y + u * uy + v * vy)
          + .42 * (z + u * uz + v * vz);
        const index = row * width + column;
        if (distance < depth[index] - .0001) continue;
        depth[index] = distance;
        image.data.set(pixel, 4 * index);
      }
    }
  }

  function drawBlock(x: number, y: number, z: number, w: number, d: number, h: number, material: keyof typeof suitPalette) {
    const [top, front, side] = suitPalette[material];
    rasterizeFace([x, y, z + h], [w, 0, 0], [0, d, 0], top);
    rasterizeFace([x, y + d, z], [w, 0, 0], [0, 0, h], front);
    rasterizeFace([x + w, y, z], [0, d, 0], [0, 0, h], side);
  }

  drawBlock(-6, -6, 8, 12, 5, 12, 'structure');
  for (const side of [-1, 1]) {
    const legX = side < 0 ? -5 : 1;
    const strapX = side < 0 ? -7 : 4;
    const stride = step * side;
    drawBlock(legX, -2 + stride, 1, 4, 6, 7, 'joint');
    drawBlock(legX, -2 + stride, 5, 4, 5, 4, 'shell');
    drawBlock(legX - 1, stride, 0, 5, 6, 3, 'structure');
    drawBlock(legX, 2 + stride, 2, 4, 4, 2, 'shell');
    drawBlock(strapX, -6, 10, 3, 4, 11, 'shell');
    drawBlock(strapX, -6, 13, 3, 4, 2, 'trim');
  }

  drawBlock(-5, -2, 8, 10, 6, 8, 'shell');
  drawBlock(-5, 2, 8, 10, 2, 2, 'structure');
  drawBlock(-3, 4, 12, 6, 2, 3, 'joint');
  drawBlock(-2, 6, 13, 2, 1, 1, 'trim');

  for (const side of [-1, 1]) {
    const armX = side < 0 ? -8 : 5;
    const swing = -side * step;
    drawBlock(armX, -1, 12, 4, 5, 4, 'shell');
    drawBlock(armX, swing, 10, 3, 4, 2, 'trim');
    drawBlock(armX, swing, 8, 3, 4, 2, 'structure');
    drawBlock(armX, 1 + swing, 6, 4, 4, 3, 'shell');
  }

  drawBlock(-4, -2, 16, 8, 6, 2, 'structure');
  drawBlock(-5, -3, 18, 10, 8, 7, 'shell');
  drawBlock(-4, -3, 25, 8, 7, 2, 'shell');
  drawBlock(-2, -2, 27, 5, 5, 1, 'shell');
  drawBlock(-4, 4, 19, 9, 2, 5, 'structure');
  drawBlock(-3, 6, 20, 7, 1, 3, 'visor');
  drawBlock(-3, 7, 22, 3, 1, 1, 'shell');
  drawBlock(5, -1, 20, 2, 4, 4, 'joint');

  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function createAstronautArt() {
  const idle = astronautFrame(0);
  const left = astronautFrame(2);
  const right = astronautFrame(-2);
  const cycle = [idle, left, idle, right];
  return (ctx: CanvasRenderingContext2D, x: number, y: number, animationTick: number): void => {
    const frame = cycle[Math.floor(animationTick / 6) % cycle.length];
    ctx.drawImage(frame, Math.round(x) + DRAW_BOX.offsetX, Math.round(y) + DRAW_BOX.offsetY, DRAW_BOX.width, DRAW_BOX.height);
  };
}
