import type { DirectionalTower } from './desert-repair.js';

type Tower = Pick<DirectionalTower, 'x' | 'y' | 'kind'>;
type Tier = Tower['kind'] | 'reinforced';

const palette = {
  ink: '#283844',
  side: '#455965',
  top: '#76878b',
  shell: '#d3bd96',
  light: '#eed9ac',
  amber: '#e2a05d'
};

function createPlate(tier: Tier) {
  const tile = document.createElement('canvas');
  tile.width = 48;
  tile.height = 48;
  const ctx = tile.getContext('2d');
  if (!ctx) throw new Error('Tower plate canvas unavailable');
  const plate = ctx;
  plate.translate(24, 34);

  function fill(x: number, y: number, width: number, height: number, color: string) {
    plate.fillStyle = color;
    plate.fillRect(x, y, width, height);
  }

  function bevel(x: number, y: number, width: number, height: number, cut: number, color: string) {
    for (let row = 0; row < height; row++) {
      const inset = Math.max(0, cut - row, cut - (height - 1 - row));
      fill(x + inset, y + row, width - inset * 2, 1, color);
    }
  }

  bevel(-17, -8, 34, 18, 5, palette.ink);
  bevel(-17, -11, 34, 15, 5, palette.side);
  bevel(-14, -10, 28, 9, 4, palette.top);
  fill(-4, 4, 8, 3, '#1f2b37');
  fill(-2, 4, 4, 2, tier === 'damaged' ? '#8c634b' : palette.amber);
  bevel(-10, -19, 20, 16, 4, palette.ink);
  bevel(-9, -21, 18, 13, 4, palette.side);

  if (tier === 'damaged') {
    fill(-10, -23, 5, 12, palette.shell);
    fill(-9, -23, 3, 2, palette.light);
    fill(4, -20, 4, 8, palette.shell);
    for (let i = 0; i < 7; i++) fill(2 + i, -20 + i, 4, 3, palette.amber);
    return tile;
  }

  bevel(-12, -28, 25, 21, 4, palette.ink);
  bevel(-11, -29, 22, 19, 3, palette.shell);
  bevel(-10, -30, 20, 6, 2, palette.light);
  fill(-8, -16, 16, 3, '#8e7e66');
  if (tier === 'reinforced') {
    for (const x of [-16, 9]) {
      fill(x, -30, 7, 19, palette.ink);
      fill(x + 1, -31, 5, 16, palette.shell);
      fill(x + 1, -26, 5, 4, palette.amber);
      fill(x + 2, -29, 3, 1, palette.light);
    }
  }
  return tile;
}

export function createDesertTowerArt() {
  const frames = {
    damaged: createPlate('damaged'),
    repaired: createPlate('repaired'),
    reinforced: createPlate('reinforced')
  };

  return (ctx: CanvasRenderingContext2D, tower: Tower, angle: number | undefined, flash: boolean, reinforced = false) => {
    const x = Math.round(tower.x), y = Math.round(tower.y);
    const tier = tower.kind === 'repaired' && reinforced ? 'reinforced' : tower.kind;
    ctx.drawImage(frames[tier], x - 24, y - 34);
    if (tower.kind === 'damaged') return;

    ctx.save();
    ctx.translate(x + 1, y - 22);
    ctx.rotate(angle ?? 0);
    ctx.fillStyle = palette.ink;
    ctx.fillRect(-4, -5, 25, 10);
    ctx.fillStyle = '#476570';
    ctx.fillRect(-3, -4, 22, 6);
    ctx.fillStyle = '#81a1a6';
    ctx.fillRect(-2, -4, 19, 2);
    ctx.fillStyle = palette.light;
    ctx.fillRect(17, -5, 4, 9);
    ctx.fillStyle = '#354651';
    ctx.fillRect(19, -3, 2, 5);
    if (flash) {
      ctx.fillStyle = '#e38455';
      ctx.fillRect(21, -2, 8, 4);
      ctx.fillStyle = '#ffe2a0';
      ctx.fillRect(21, -1, 5, 2);
    }
    ctx.restore();
  };
}
