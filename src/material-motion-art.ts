import { materialMotionDuration, type Material, type MaterialMotion } from './material-motion.js';

export function drawMaterialMotion(
  ctx: CanvasRenderingContext2D, motion: MaterialMotion, tick: number, player: MaterialMotion['source']
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

  function drawGlove(direction: number, reach: number) {
    const x = player.x + direction * (8 + reach);
    pixel(Math.min(x, player.x + direction * 6), player.y + 2, Math.ceil(3 + reach), 3, '#687e87');
    pixel(x - 2, player.y + 1, 4, 4, '#d4dcd6');
    pixel(x - 2, player.y + 4, 4, 2, '#465b69');
  }

  ctx.save();
  const { source } = motion;
  if (motion.kind === 'pickup') {
    const direction = source.x < player.x ? -1 : 1;
    const progress = age / 17;
    const eased = progress * (2 - progress);
    drawGlove(direction, 4 * (1 - eased));
    if (age < 15) {
      const x = source.x + (player.x + direction * 9 - source.x) * eased + direction * 20 * progress * (1 - progress);
      const y = source.y + (player.y + 3 - source.y) * eased - 28 * progress * (1 - progress);
      drawLoad(x, y, motion.material);
    } else {
      pixel(player.x + direction * 9 - 1, player.y + 1, 3, 2, '#c9e1c3');
    }
  } else {
    const { tower } = motion;
    const direction = tower.x < source.x ? -1 : 1;
    if (age < 17) drawGlove(direction, 4 * Math.sin(Math.PI * age / 17));
    const startX = source.x + direction * 9, startY = source.y + 3;
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
