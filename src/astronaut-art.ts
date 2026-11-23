type Vector = readonly [x: number, y: number, z: number];
type FaceColors = readonly [top: number, front: number, side: number];

const suitPalette = {
  shell: [0xfff8e5, 0xe4e4d5, 0xafbec0],
  structure: [0x899da6, 0x526772, 0x344550],
  visor: [0xb3eee4, 0x4396a1, 0x285464],
  trim: [0xf3bd7d, 0xbf804c, 0x895538],
  joint: [0xbdd1d1, 0x879b9f, 0x657882]
} satisfies Record<string, FaceColors>;

const FRAME_SIZE = { width: 32, height: 36 };
const DRAW_BOX = { offsetX: -19, offsetY: -24, width: 38, height: 43 };
const DIRECTION_COUNT = 8;
const DIRECTION_STEP = Math.PI / 4;
const STRIDES = [0, 2, -2];
const WALK_CYCLE = [0, 1, 0, 2];

type PilotPose = { world: object; tick: number; x: number; y: number; direction: number; stride: number };

export function directionalVisorBounds(x: number, y: number, direction: number) {
  if (direction >= 3 && direction <= 5) return undefined;
  const yaw = direction * DIRECTION_STEP;
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  const corners = [-4, 5].flatMap(across => [4, 7].map(forward => ({
    x: cos * across - sin * forward,
    y: sin * across + cos * forward
  })));
  const scaleX = DRAW_BOX.width / FRAME_SIZE.width;
  const scaleY = DRAW_BOX.height / FRAME_SIZE.height;
  const left = Math.floor(Math.min(...corners.map(point => point.x)) * scaleX) - 1;
  const right = Math.ceil(Math.max(...corners.map(point => point.x)) * scaleX) + 1;
  const top = Math.floor((29 + .42 * Math.min(...corners.map(point => point.y)) - .907 * 24) * scaleY) + DRAW_BOX.offsetY - 1;
  const bottom = Math.ceil((29 + .42 * Math.max(...corners.map(point => point.y)) - .907 * 19) * scaleY) + DRAW_BOX.offsetY + 1;
  return { x: Math.round(x) + left, y: Math.round(y) + top, width: right - left, height: bottom - top };
}

function drawFrame(ctx: CanvasRenderingContext2D, facing: number, column: number, step: number) {
  const { width, height } = FRAME_SIZE;
  const yaw = facing * DIRECTION_STEP;
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  const image = ctx.createImageData(width, height);
  const depth = new Float32Array(width * height).fill(-Infinity);

  const rotateX = (x: number, y: number) => cos * x - sin * y;
  const rotateY = (x: number, y: number) => sin * x + cos * y;

  function rasterizeFace(
    [x, y, z]: Vector,
    [ux, uy, uz]: Vector,
    [vx, vy, vz]: Vector,
    color: number,
    visibility: number
  ) {
    if (visibility < 1e-6) return;
    const screenX = 16 + rotateX(x, y);
    const screenY = 29 + .42 * rotateY(x, y) - .907 * z;
    const edgeUX = rotateX(ux, uy);
    const edgeUY = .42 * rotateY(ux, uy) - .907 * uz;
    const edgeVX = rotateX(vx, vy);
    const edgeVY = .42 * rotateY(vx, vy) - .907 * vz;
    const determinant = edgeUX * edgeVY - edgeVX * edgeUY;
    if (Math.abs(determinant) < 1e-6) return;
    const left = Math.max(0, Math.floor(screenX + Math.min(0, edgeUX) + Math.min(0, edgeVX)));
    const right = Math.min(width, Math.ceil(screenX + Math.max(0, edgeUX) + Math.max(0, edgeVX)));
    const top = Math.max(0, Math.floor(screenY + Math.min(0, edgeUY) + Math.min(0, edgeVY)));
    const bottom = Math.min(height, Math.ceil(screenY + Math.max(0, edgeUY) + Math.max(0, edgeVY)));
    const pixel = [color >> 16, (color >> 8) & 255, color & 255, 255];

    for (let row = top; row < bottom; row++) {
      for (let col = left; col < right; col++) {
        const offsetX = col + .5 - screenX;
        const offsetY = row + .5 - screenY;
        const u = (edgeVY * offsetX - edgeVX * offsetY) / determinant;
        const v = (edgeUX * offsetY - edgeUY * offsetX) / determinant;
        if (u < 0 || u > 1 || v < 0 || v > 1) continue;
        const distance = .907 * rotateY(x + u * ux + v * vx, y + u * uy + v * vy) + .42 * (z + u * uz + v * vz);
        const index = row * width + col;
        if (distance < depth[index] - .0001) continue;
        depth[index] = distance;
        image.data.set(pixel, 4 * index);
      }
    }
  }

  function drawBlock(x: number, y: number, z: number, w: number, d: number, h: number, material: keyof typeof suitPalette) {
    const [top, front, side] = suitPalette[material];
    rasterizeFace([x, y, z + h], [w, 0, 0], [0, d, 0], top, 1);
    rasterizeFace([x, y + d, z], [w, 0, 0], [0, 0, h], sin < 0 ? side : front, cos);
    rasterizeFace([x, y, z], [w, 0, 0], [0, 0, h], sin > 0 ? side : front, -cos);
    rasterizeFace([x + w, y, z], [0, d, 0], [0, 0, h], cos >= 0 ? side : front, sin);
    rasterizeFace([x, y, z], [0, d, 0], [0, 0, h], cos <= 0 ? side : front, -sin);
  }

  drawBlock(-6, -7, 8, 12, 5, 12, 'structure');
  for (const side of [-1, 1]) {
    const legX = side < 0 ? -5 : 1;
    const strapX = side < 0 ? -7 : 4;
    const armX = side < 0 ? -8 : 5;
    const stride = side * step;
    drawBlock(legX, -2 + stride, 1, 4, 6, 7, 'joint');
    drawBlock(legX, -2 + stride, 5, 4, 5, 4, 'shell');
    drawBlock(legX - 1, stride, 0, 5, 6, 3, 'structure');
    drawBlock(legX, 2 + stride, 2, 4, 4, 2, 'shell');
    drawBlock(strapX, -8, 10, 3, 5, 11, 'shell');
    drawBlock(strapX, -9, 13, 3, 3, 2, 'trim');
    drawBlock(armX, -1, 12, 4, 5, 4, 'shell');
    drawBlock(armX, -stride, 9, 3, 4, 3, 'trim');
    drawBlock(armX, 1 - stride, 6, 4, 4, 3, 'shell');
  }
  drawBlock(-5, -2, 8, 10, 6, 8, 'shell');
  drawBlock(-5, -2, 8, 10, 6, 2, 'structure');
  drawBlock(-3, 4, 12, 6, 2, 3, 'joint');
  drawBlock(-4, -2, 16, 8, 6, 2, 'structure');
  drawBlock(-5, -3, 18, 10, 8, 7, 'shell');
  drawBlock(-4, -3, 25, 8, 7, 2, 'shell');
  drawBlock(-2, -2, 27, 5, 5, 1, 'shell');
  drawBlock(-4, 4, 19, 9, 2, 5, 'structure');
  drawBlock(-3, 6, 20, 7, 1, 3, 'visor');
  drawBlock(-3, 7, 22, 3, 1, 1, 'shell');
  ctx.putImageData(image, column * width, facing * height);
}

export function createAstronautFacingArt() {
  const atlas = document.createElement('canvas');
  const { width, height } = FRAME_SIZE;
  atlas.width = STRIDES.length * width;
  atlas.height = DIRECTION_COUNT * height;
  const ctx = atlas.getContext('2d');
  if (!ctx) throw new Error('Directional astronaut atlas unavailable');
  for (let facing = 0; facing < DIRECTION_COUNT; facing++) {
    for (const [column, step] of STRIDES.entries()) drawFrame(ctx, facing, column, step);
  }

  let pose: PilotPose | undefined;
  return (target: CanvasRenderingContext2D, world: object, x: number, y: number, tick: number, running: boolean) => {
    if (!pose || pose.world !== world || tick < pose.tick) {
      pose = { world, x, y, tick, direction: 0, stride: 0 };
    } else if (tick > pose.tick) {
      const dx = x - pose.x, dy = y - pose.y;
      if (running && (dx !== 0 || dy !== 0)) {
        pose.direction = (Math.round(Math.atan2(-dx, dy) / DIRECTION_STEP) + DIRECTION_COUNT) % DIRECTION_COUNT;
        pose.stride += tick - pose.tick;
      } else if (running) {
        pose.stride = 0;
      }
      pose.x = x;
      pose.y = y;
      pose.tick = tick;
    }
    const column = WALK_CYCLE[Math.floor(pose.stride / 6) % WALK_CYCLE.length];
    target.drawImage(atlas, column * width, pose.direction * height, width, height,
      Math.round(x) + DRAW_BOX.offsetX, Math.round(y) + DRAW_BOX.offsetY, DRAW_BOX.width, DRAW_BOX.height);
    return pose.direction;
  };
}
