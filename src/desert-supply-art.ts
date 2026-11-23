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
    const orePalette: Readonly<Partial<Record<string, string>>> = {
      '#': '#413c37',
      t: '#57534e',
      s: '#74716a',
      m: '#a19e96',
      l: '#c6c3bc',
      h: '#e4e2dc',
    };
    const oreRows = [
      '..........##',
      '.........#l##',
      '........#lls##',
      '........#llhs##..###',
      '.......#mllhms#.#lls#',
      '.....##.#mllhmss##lms#',
      '....#lm##mllhms#mlmss#',
      '...#lms##mlhms#mlmsss#',
      '...#llms#mmhms#mlmsst#',
      '...#lmms#mmms#mmmsst#',
      '...#mmss#mmms##mmsst#',
      '...#msst##mmss#msst##',
      '...##sstt#msstt#st##',
      '....################',
    ];
    oreRows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const color = orePalette[row.charAt(x)];
        if (color === undefined) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y + 2, 1, 1);
      }
    });
  }
  return sprite;
}

export function createDesertSupplyArt() {
  const sprites = { wood: makeSprite('wood'), iron: makeSprite('iron') };
  return (ctx: CanvasRenderingContext2D, supply: Supply): void => {
    ctx.drawImage(sprites[supply.material], Math.round(supply.x) - 12, Math.round(supply.y) - 10);
  };
}
