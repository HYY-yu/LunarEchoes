import { astronautHandOffset } from './astronaut-art.js';
import { materialMotionDuration, type Material, type MaterialMotion } from './material-motion.js';

type Point = MaterialMotion['source'];
export type MaterialReleases = WeakMap<MaterialMotion, Point>;

export function drawMaterialMotion(
  ctx: CanvasRenderingContext2D, motion: MaterialMotion, tick: number, player: Point, facing: number, releases: MaterialReleases
): void {
  const age = tick - motion.tick;
  if (age < 0 || age >= materialMotionDuration(motion.kind)) return;

  function pixel(x: number, y: number, width: number, height: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), width, height);
  }

  function drawLoad(x: number, y: number, material: Material) {
    if (material === 'wood') {
      pixel(x - 4, y - 2, 8, 4, '#683f33');
      pixel(x - 3, y - 3, 7, 2, '#be865a');
      pixel(x + 2, y - 2, 3, 3, '#efbf87');
    } else {
      pixel(x - 3, y - 2, 6, 5, '#485667');
      pixel(x - 2, y - 4, 4, 3, '#b1c6cb');
      pixel(x - 4, y, 3, 2, '#859aa6');
    }
  }

  const { source } = motion;
  const direction = (motion.kind === 'pickup' ? source.x < player.x : motion.tower.x < source.x) ? -1 : 1;
  const offset = astronautHandOffset(facing, direction);
  const handX = Math.round(player.x) + offset.x;
  const handY = Math.round(player.y) + offset.y;

  function drawGlove(reach: number) {
    const x = handX + Math.sign(offset.x) * reach;
    pixel(Math.min(x, handX) - 1, handY - 1, Math.ceil(3 + reach), 3, '#687e87');
    pixel(x - 2, handY - 2, 4, 4, '#d4dcd6');
    pixel(x - 2, handY + 1, 4, 2, '#465b69');
  }

  ctx.save();
  if (motion.kind === 'pickup') {
    const progress = age / 17;
    const eased = progress * (2 - progress);
    drawGlove(4 * (1 - eased));
    if (age < 15) {
      const x = source.x + (handX - source.x) * eased + direction * 20 * progress * (1 - progress);
      const y = source.y + (handY - source.y) * eased - 28 * progress * (1 - progress);
      drawLoad(x, y, motion.material);
    } else {
      pixel(handX - 1, handY - 2, 3, 2, '#c9e1c3');
    }
  } else {
    const { tower } = motion;
    if (age < 17) drawGlove(4 * Math.sin(Math.PI * age / 17));
    let release = releases.get(motion);
    if (!release) {
      release = { x: Math.round(source.x) + offset.x, y: Math.round(source.y) + offset.y };
      releases.set(motion, release);
    }
    const { x: startX, y: startY } = release;
    for (let i = 0; i < 3; i++) {
      const progress = (age - i * 4) / 15;
      if (progress < 0 || progress > 1) continue;
      const endX = tower.x + (i - 1) * 4, endY = tower.y + 1;
      const x = startX + (endX - startX) * progress + direction * 42 * progress * (1 - progress);
      const y = startY + (endY - startY) * progress - 38 * progress * (1 - progress);
      drawLoad(x, y, i === 2 ? 'iron' : 'wood');
    }
    if (age >= 23) {
      const spread = age - 23;
      pixel(tower.x - 7 - spread, tower.y - 1 - spread, 2, 2, '#b3dfc4');
      pixel(tower.x + 6 + spread, tower.y - 1 - spread, 2, 2, '#b3dfc4');
    }
  }
  ctx.restore();
}
