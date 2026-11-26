import type { DirectionalTower } from './desert-repair.js';

type Tower = Pick<DirectionalTower, 'x' | 'y' | 'kind'>;
type Tier = Tower['kind'] | 'reinforced';
type Vec3 = readonly [number, number, number];
type Ramp = readonly [top: number, lit: number, mid: number, dark: number];

const FRAME_SIZE = 64;
const ANCHOR_X = 32;
const ANCHOR_Y = 44;
const PITCH_Y = 0.56;
const PITCH_Z = 0.83;
const ANGLE_STEPS = 36;
const ANGLE_STEP = (Math.PI * 2) / ANGLE_STEPS;
const BORE_DEPTH = 1.2;
const BORE_HEIGHT = 2.6;
const MUZZLE_REACH = 24 + BORE_DEPTH / 2;
const MUZZLE_HEIGHT = 15.6;

const SUN_X = -0.52;
const SUN_Y = -0.44;
const SUN_Z = 0.73;

const INK_R = 0x1d;
const INK_G = 0x28;
const INK_B = 0x34;

const materials = {
  pedestal: [0x8b9ea6, 0x6f848d, 0x4c616c, 0x31414c],
  pedestalRim: [0xa6b7bc, 0x8598a0, 0x5c727d, 0x3d505b],
  collar: [0x3c4d58, 0x33434e, 0x26343e, 0x1a252e],
  armor: [0xf0ddb2, 0xd8c196, 0xb29a72, 0x7e6c52],
  armorTrim: [0xd3bf98, 0xb8a37c, 0x917e5e, 0x675944],
  gun: [0x88a5aa, 0x67838b, 0x475f69, 0x2f414b],
  muzzle: [0xa8bec1, 0x7e969c, 0x536973, 0x364852],
  bore: [0x1c2731, 0x1a242d, 0x161f28, 0x121921],
  bustle: [0x6e818a, 0x566872, 0x3d4e58, 0x283640],
  amber: [0xffdf96, 0xf2b263, 0xd48544, 0x99592e],
  spark: [0xfff4c2, 0xffc66e, 0xe88b48, 0xb35d32],
  ruin: [0x9e9585, 0x847c6e, 0x615d55, 0x424340]
} satisfies Record<string, Ramp>;

type MaterialKey = keyof typeof materials;

function clampByte(n: number) {
  return n < 0 ? 0 : n > 255 ? 255 : n | 0;
}

function shadeFace(material: MaterialKey, nx: number, ny: number, nz: number): number {
  const [top, lit, mid, dark] = materials[material];
  if (nz > 0.65) return top;
  const ndotl = nx * SUN_X + ny * SUN_Y + nz * SUN_Z;
  if (ndotl > 0.16) return lit;
  if (ndotl > -0.22) return mid;
  return dark;
}

function renderTurretFrame(tier: Tier, yaw: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_SIZE;
  canvas.height = FRAME_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tower sprite canvas unavailable');

  const image = ctx.createImageData(FRAME_SIZE, FRAME_SIZE);
  const data = image.data;
  const depth = new Float32Array(FRAME_SIZE * FRAME_SIZE).fill(-Infinity);
  const shadow = new Uint8Array(FRAME_SIZE * FRAME_SIZE);

  function markShadow(wx: number, wy: number) {
    const sx = Math.round(ANCHOR_X + wx + 3.5);
    const sy = Math.round(ANCHOR_Y + PITCH_Y * (wy + 2.5));
    if (sx < 1 || sx >= FRAME_SIZE - 1 || sy < 1 || sy >= FRAME_SIZE - 1) return;
    shadow[sy * FRAME_SIZE + sx] = 1;
  }

  function rasterizeQuad(
    p0: Vec3,
    u: Vec3,
    v: Vec3,
    normal: Vec3,
    material: MaterialKey,
    castShadow: boolean
  ) {
    const viewDot = normal[1] * PITCH_Z + normal[2] * PITCH_Y;
    if (viewDot < 1e-4) return;
    const color = shadeFace(material, normal[0], normal[1], normal[2]);
    const r = (color >> 16) & 255;
    const g = (color >> 8) & 255;
    const b = color & 255;

    const s0x = ANCHOR_X + p0[0];
    const s0y = ANCHOR_Y + PITCH_Y * p0[1] - PITCH_Z * p0[2];
    const eux = u[0];
    const euy = PITCH_Y * u[1] - PITCH_Z * u[2];
    const evx = v[0];
    const evy = PITCH_Y * v[1] - PITCH_Z * v[2];
    const det = eux * evy - evx * euy;
    if (Math.abs(det) < 1e-6) return;

    const minX = Math.max(1, Math.floor(s0x + Math.min(0, eux, evx, eux + evx)));
    const maxX = Math.min(FRAME_SIZE - 1, Math.ceil(s0x + Math.max(0, eux, evx, eux + evx)));
    const minY = Math.max(1, Math.floor(s0y + Math.min(0, euy, evy, euy + evy)));
    const maxY = Math.min(FRAME_SIZE - 1, Math.ceil(s0y + Math.max(0, euy, evy, euy + evy)));

    for (let row = minY; row < maxY; row++) {
      for (let col = minX; col < maxX; col++) {
        const ox = col + 0.5 - s0x;
        const oy = row + 0.5 - s0y;
        const tu = (evy * ox - evx * oy) / det;
        const tv = (eux * oy - euy * ox) / det;
        if (tu < -1e-4 || tu > 1.0001 || tv < -1e-4 || tv > 1.0001) continue;
        const wx = p0[0] + tu * u[0] + tv * v[0];
        const wy = p0[1] + tu * u[1] + tv * v[1];
        const wz = p0[2] + tu * u[2] + tv * v[2];
        const d = PITCH_Z * wy + PITCH_Y * wz;
        const idx = row * FRAME_SIZE + col;
        if (d < depth[idx] - 0.001) continue;
        depth[idx] = d;
        const off = idx * 4;
        data[off] = r;
        data[off + 1] = g;
        data[off + 2] = b;
        data[off + 3] = 255;
        if (castShadow && wz > 0.5) {
          markShadow(wx + wz * 0.28, wy + wz * 0.2);
        }
      }
    }
  }

  function addBox(
    cx: number,
    cy: number,
    z0: number,
    lx: number,
    ly: number,
    lz: number,
    rot: number,
    material: MaterialKey,
    castShadow = true
  ) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const hx = lx / 2;
    const hy = ly / 2;
    const toWorld = (x: number, y: number, z: number): Vec3 => [
      cx + x * c - y * s,
      cy + x * s + y * c,
      z
    ];
    const ax: Vec3 = [lx * c, lx * s, 0];
    const ay: Vec3 = [-ly * s, ly * c, 0];
    const az: Vec3 = [0, 0, lz];

    rasterizeQuad(toWorld(-hx, -hy, z0 + lz), ax, ay, [0, 0, 1], material, castShadow);
    rasterizeQuad(toWorld(hx, -hy, z0), ay, az, [c, s, 0], material, castShadow);
    rasterizeQuad(toWorld(-hx, hy, z0), [-ay[0], -ay[1], 0], az, [-c, -s, 0], material, castShadow);
    rasterizeQuad(toWorld(-hx, hy, z0), ax, az, [-s, c, 0], material, castShadow);
    rasterizeQuad(toWorld(hx, -hy, z0), [-ax[0], -ax[1], 0], az, [s, -c, 0], material, castShadow);
  }

  function addOctagon(radius: number, z0: number, height: number, material: MaterialKey) {
    const side = radius * 0.8284;
    addBox(0, 0, z0, radius * 2, side, height, 0, material);
    addBox(0, 0, z0, radius * 2, side, height, Math.PI / 4, material);
    addBox(0, 0, z0, radius * 2, side, height, Math.PI / 2, material);
    addBox(0, 0, z0, radius * 2, side, height, (Math.PI * 3) / 4, material);
  }

  addOctagon(14.5, 0, 2.5, 'collar');
  addOctagon(13.5, 2, 5.5, 'pedestal');
  addOctagon(12.2, 7.2, 1.5, 'pedestalRim');
  for (let i = 0; i < 4; i++) {
    const a = i * (Math.PI / 2) + Math.PI / 4;
    addBox(Math.cos(a) * 12.2, Math.sin(a) * 12.2, 1.5, 3.2, 4.2, 6, a, 'pedestalRim');
  }
  addBox(0, 12.6, 3.2, 4.6, 1.6, 2.2, 0, 'collar', false);
  addBox(0, 13.1, 3.7, 2.8, 1.1, 1.2, 0, tier === 'damaged' ? 'ruin' : 'amber', false);

  addOctagon(9.4, 8.5, 3.4, 'collar');
  addOctagon(8.0, 11.4, 1.2, 'bustle');

  if (tier === 'damaged') {
    addBox(0, 0, 9.8, 9.5, 9.5, 2.2, Math.PI / 4, 'bore', false);
    addBox(-5.6, -2.2, 11.5, 4.2, 8.8, 6.2, 0.14, 'armor');
    addBox(-5.2, -2.2, 17.4, 3.6, 6.6, 1.4, 0.14, 'ruin');
    addBox(4.8, 1.8, 11.5, 3.8, 6.4, 3.6, -0.22, 'armorTrim');
    addBox(0.8, -5.4, 11.5, 7.4, 3.4, 4.4, 0.08, 'ruin');
    addBox(-0.6, 5.2, 11.5, 6.2, 3.0, 2.6, -0.1, 'ruin');
    addBox(0.5, -0.4, 11.2, 4.4, 4.4, 4.0, 0.35, 'spark', false);
    addBox(2.2, 1.0, 13.6, 2.4, 2.4, 2.4, 0.5, 'amber', false);
    addBox(-2.2, 1.6, 12.2, 2.0, 5.4, 1.8, 0.65, 'gun');
  } else {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const part = (
      lx: number,
      ly: number,
      z0: number,
      w: number,
      d: number,
      h: number,
      material: MaterialKey,
      extraYaw = 0,
      cast = true
    ) => {
      addBox(lx * c - ly * s, lx * s + ly * c, z0, w, d, h, yaw + extraYaw, material, cast);
    };

    part(-1.5, 0, 12.2, 15.5, 13.4, 6.6, 'armor');
    part(-2.0, 0, 18.6, 12.8, 10.8, 2.0, 'armor');
    part(5.5, 0, 12.6, 5.2, 10.6, 5.4, 'armorTrim');
    part(7.2, 0, 13.2, 3.4, 8.2, 4.2, 'gun');

    part(-9.4, 0, 12.6, 4.8, 10.2, 6.2, 'bustle');
    part(-11.4, 0, 13.8, 1.6, 7.2, 1.4, 'collar', 0, false);
    part(-11.4, 0, 16.0, 1.6, 7.2, 1.4, 'collar', 0, false);

    part(-3.2, 0, 20.4, 5.6, 5.6, 2.4, 'bustle');
    part(-3.2, 0, 20.4, 5.6, 5.6, 2.4, 'bustle', Math.PI / 4);
    part(-3.2, 0, 22.6, 3.8, 3.8, 0.9, 'pedestalRim');

    if (tier === 'reinforced') {
      for (const side of [-1, 1]) {
        part(-1.0, side * 9.6, 12.0, 12.2, 5.4, 7.4, 'armor');
        part(-1.0, side * 9.4, 19.2, 10.2, 4.4, 1.5, 'armorTrim');
        part(-1.0, side * 12.2, 14.6, 9.2, 1.4, 2.2, 'amber', 0, false);
        part(4.9, side * 9.6, 14.2, 1.4, 3.0, 3.0, 'amber', 0, false);
        part(-6.9, side * 9.6, 14.2, 1.4, 3.0, 3.0, 'amber', 0, false);
      }
      part(4.4, 0, 18.4, 5.6, 10.6, 2.4, 'bustle');
      part(6.8, 0, 18.6, 2.0, 8.2, 1.4, 'amber', 0, false);
      part(10.6, 0, 12.8, 7.6, 7.4, 5.4, 'gun');
    }

    part(14.5, 0, 13.8, 13.6, 4.4, 3.8, 'gun');
    part(14.0, 0, 13.3, 3.2, 5.4, 4.8, 'muzzle');
    part(22.0, 0, 13.4, 4.4, 5.6, 4.6, 'muzzle');
    part(MUZZLE_REACH - BORE_DEPTH / 2, 0, MUZZLE_HEIGHT - BORE_HEIGHT / 2, BORE_DEPTH, 3, BORE_HEIGHT, 'bore', 0, false);
  }

  const alpha = new Uint8Array(FRAME_SIZE * FRAME_SIZE);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3] > 0 ? 1 : 0;

  for (let y = 1; y < FRAME_SIZE - 1; y++) {
    for (let x = 1; x < FRAME_SIZE - 1; x++) {
      const idx = y * FRAME_SIZE + x;
      const off = idx * 4;
      if (alpha[idx] === 1) {
        const myDepth = depth[idx];
        const maxDiff = Math.max(
          depth[idx - 1] - myDepth,
          depth[idx + 1] - myDepth,
          depth[idx - FRAME_SIZE] - myDepth,
          depth[idx + FRAME_SIZE] - myDepth
        );
        if (maxDiff > 4.2) {
          data[off] = clampByte(data[off] * 0.68 + INK_R * 0.32);
          data[off + 1] = clampByte(data[off + 1] * 0.68 + INK_G * 0.32);
          data[off + 2] = clampByte(data[off + 2] * 0.68 + INK_B * 0.32);
        }
      } else if (
        alpha[idx - 1] || alpha[idx + 1] || alpha[idx - FRAME_SIZE] || alpha[idx + FRAME_SIZE]
      ) {
        data[off] = INK_R;
        data[off + 1] = INK_G;
        data[off + 2] = INK_B;
        data[off + 3] = 255;
      } else if (shadow[idx]) {
        data[off] = 0x16;
        data[off + 1] = 0x22;
        data[off + 2] = 0x2d;
        data[off + 3] = 105;
      }
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

function angleStep(angle = 0): number {
  const step = Math.round((Number.isFinite(angle) ? angle : 0) / ANGLE_STEP);
  return ((step % ANGLE_STEPS) + ANGLE_STEPS) % ANGLE_STEPS;
}

export function towerMuzzle(tower: Pick<Tower, 'x' | 'y'>, angle: number | undefined) {
  const yaw = angleStep(angle) * ANGLE_STEP;
  const x = Math.cos(yaw);
  const y = Math.sin(yaw) * PITCH_Y;
  const length = Math.hypot(x, y);
  return {
    x: Math.round(tower.x) + x * MUZZLE_REACH,
    y: Math.round(tower.y) + y * MUZZLE_REACH - PITCH_Z * MUZZLE_HEIGHT,
    dx: x / length,
    dy: y / length
  };
}

function drawMuzzleFlash(ctx: CanvasRenderingContext2D, { x, y, dx, dy }: ReturnType<typeof towerMuzzle>) {
  const puff = (along: number, across: number, size: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(
      Math.round(x + dx * along - dy * across - size / 2),
      Math.round(y + dy * along + dx * across - size / 2),
      size,
      size
    );
  };

  puff(3, 0, 7, '#e37e49');
  puff(7, 0, 5, '#e37e49');
  puff(1, -3, 3, '#f2a55e');
  puff(1, 3, 3, '#f2a55e');
  puff(2, 0, 5, '#ffd784');
  puff(5, 0, 3, '#ffd784');
  puff(1, 0, 3, '#fff7d4');
}

export function createDesertTowerArt() {
  const damaged = renderTurretFrame('damaged', 0);
  const cache = new Map<number, HTMLCanvasElement>();

  return (
    ctx: CanvasRenderingContext2D,
    tower: Tower,
    angle: number | undefined,
    flash: boolean,
    reinforced = false
  ) => {
    const x = Math.round(tower.x);
    const y = Math.round(tower.y);
    if (tower.kind === 'damaged') {
      ctx.drawImage(damaged, x - ANCHOR_X, y - ANCHOR_Y);
      return;
    }

    const step = angleStep(angle);
    const key = (reinforced ? ANGLE_STEPS : 0) + step;
    let sprite = cache.get(key);
    if (!sprite) {
      sprite = renderTurretFrame(reinforced ? 'reinforced' : 'repaired', step * ANGLE_STEP);
      cache.set(key, sprite);
    }
    ctx.drawImage(sprite, x - ANCHOR_X, y - ANCHOR_Y);
    if (flash) drawMuzzleFlash(ctx, towerMuzzle(tower, angle));
  };
}
