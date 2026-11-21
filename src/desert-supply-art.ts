type Material = 'wood' | 'iron';
type Supply = Readonly<{ material: Material; x: number; y: number }>;
type Faces = readonly [top: string, front: string, end: string];

function makeSprite(material: Material) {
  const sprite = document.createElement('canvas');
  sprite.width = 24;
  sprite.height = 20;
  const context = sprite.getContext('2d');
  if (!context) throw new Error('Supply sprite canvas is unavailable');
  const ctx = context;
  function block(x: number, y: number, w: number, d: number, h: number, faces: Faces) {
    for (let z = d; z >= 0; z--) {
      ctx.fillStyle = faces[0];
      ctx.fillRect(x + z * 2, y - z, w, 1);
      ctx.fillStyle = faces[2];
      ctx.fillRect(x + w + z * 2, y - z, 2, h);
    }
    ctx.fillStyle = faces[1];
    ctx.fillRect(x, y + 1, w, h);
  }
  ctx.fillStyle = '#433c3999';
  ctx.fillRect(3, 14, 18, 2);
  ctx.fillRect(5, 16, 13, 1);
  if (material === 'wood') {
    const timber = ['#d69a64', '#774533', '#ffcd87'] as const;
    block(4, 10, 12, 2, 3, timber);
    block(2, 12, 12, 2, 3, timber);
    block(3, 8, 12, 2, 3, timber);
    ctx.fillStyle = '#50362e';
    ctx.fillRect(6, 10, 5, 1);
    ctx.fillRect(5, 14, 7, 1);
    ctx.fillRect(17, 9, 2, 1);
  } else {
    const ore = ['#b7c9cf', '#526a79', '#32424e'] as const;
    block(13, 8, 4, 2, 5, ore);
    block(7, 5, 5, 2, 8, ore);
    block(3, 11, 4, 2, 4, ore);
    block(11, 12, 4, 1, 3, ore);
    ctx.fillStyle = '#d4dfe2';
    ctx.fillRect(8, 7, 2, 2);
    ctx.fillRect(4, 12, 2, 1);
  }
  return sprite;
}

export function createDesertSupplyArt() {
  const sprites = { wood: makeSprite('wood'), iron: makeSprite('iron') };
  return (ctx: CanvasRenderingContext2D, supply: Supply): void => {
    ctx.drawImage(sprites[supply.material], Math.round(supply.x) - 12, Math.round(supply.y) - 10);
  };
}
