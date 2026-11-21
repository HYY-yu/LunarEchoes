type Tower = Readonly<{ kind: 'damaged' | 'repaired'; x: number; y: number }>;

const GROUND_X = 14;
const palette = new Map([
  ['A', '#344b59'],
  ['B', '#515e66'],
  ['C', '#56717e'],
  ['D', '#5f4943'],
  ['E', '#737c7d'],
  ['F', '#838b89'],
  ['G', '#876147'],
  ['H', '#93adb1'],
  ['I', '#a5a28e'],
  ['J', '#b7b3a0'],
  ['K', '#bb8b60'],
  ['L', '#bd5b53'],
  ['M', '#cac4aa'],
  ['N', '#f29677']
]);

const frames = {
  damaged: {
    groundY: 28,
    pixels: [
      '........M...................',
      '.......MMMME................',
      '.......IIIEE................',
      '.......IIIEE................',
      '......JIIIEE.........MM.....',
      '......JIIIEJJJJJJJ..MMMME...',
      '.....FFFFFJJJJJJJJJJIIIEE...',
      '.....FFFFFFFFFFFJJJJIIIEJB..',
      '.....FFFFFFFFFFFFFFFFFFJBB..',
      '......IIIIE.FFFFFFFFFFFFBB..',
      '......IIIIE.......FFFFFFB...',
      '......IIIIE........IIIIEE...',
      '......IIIIE........IIIIEE...',
      '......IIIIE........IIIIEE...',
      '......IIIIE........IIIIEE...',
      '.....KKIIIEK.......IIIIEE...',
      '....KKKKKGKKKKKKKKMIIIIEE...',
      '....GGGGDGGGGGGGKMMMMIIEE...',
      '...MGGGGDKKKGGGGIIIIEGGDE...',
      '...IIIIGGKKDB...IIIIEGGDE...',
      '...IIIIGGGGDKKKMIIIIEIIEEJ..',
      '...IIIIEFFGKKKDMIIIIEIIEJB..',
      '...IIIIEJBGGGDDKIIIIEFJJBMM.',
      '..FJJJIJMMMMGDKKIIIIEFFFBMEJ',
      '.MFFFFFFIIIIEGGGIIIIEJBMMEJB',
      '.IIIFFFFIIIIMGGFJJJIJBBMEEJB',
      'JIIIIIIIIIMMMMMFFFFFFBMEEJBB',
      'FFJJJIIIIIIIIIIIIFFFFMEEJBB.',
      'FFFFFFFFFJJJIIIIIIIIIIEJBB..',
      'FFFFFFFFFFFFFFFJJJIIIIJBB...',
      '....FFFFFFFFFFFFFFFFFFBBB...',
      '...........FFFFFFFFFFFBB....',
      '.................FFFFFB.....'
    ]
  },
  repaired: {
    groundY: 37,
    pixels: [
      '........KNNN................',
      '........GGLLLLLL............',
      '........GGLLLLLL............',
      '........GGLLLLLL............',
      '........GG..LLLL............',
      '........GG..................',
      '......MMGG..................',
      '.....MMMGG.....M............',
      '.....IIIGG.HHHHHHME.........',
      '.....IIIIEHHHHHAHHH...MMMMM.',
      '.....IIIICHHHHAAHHA...IIMME.',
      '..MMMJJIIHHHHAACHAAJJJIIIIE.',
      '.MMMMEJJHHHHAAACCAAJJJIIIIEJ',
      '.IIIEEJHHHHAAACCCAAJJJIIIIJB',
      '.IIIEEJCCCCAAECCCAMMMMEJJJJB',
      'JIIIEEJCCCCAIECCCJIMMMEJJJBB',
      'FFIIEJJJCCCIIEJJJJIIIEEJJBB.',
      'FFFFFFFFJIIIIJJJJJIIIEEJBBD.',
      'FFFFFFFFFFFFFFFJJJIIIEJBBBD.',
      '.GGGFFFFFFFFFFFFFFFFFJBBBD..',
      '.GGGGGGGGGFFFFFFFFFFFFBBD...',
      '..GGGGGGGGGGGGGGGFFFFFBDE...',
      '...IIIIEGGGGGGGGGGGGGGDEE...',
      '...IIIIEIIE....GGGGGGGIEE...',
      '...IIIIEIIEK....IIIIEIIEE...',
      '...IIIIEGGKKKKKKIIIIEIIEE...',
      '...IIIIEGGGGGGGGIIIIEIIEE...',
      '...IIIIEIIEGGGGGIIIIEGGDE...',
      '...IIIIEIIEJB...IIIIEGGDE...',
      '...IIIIEFJJBMMMMIIIIEIIEEJ..',
      '...IIIIEFFFMMMMMIIIIEIIEJB..',
      '...IIIIEJBMMMMMMIIIIEFJJBMM.',
      '..FJJJIJBBMMMMMMIIIIEFFFBMEJ',
      '.MFFFFFFBMMMMMMMIIIIEJBMMEJB',
      '.IIIFFFFMMMMMMMFJJJIJBBMEEJB',
      'JIIIIIIIIIMMMMMFFFFFFBMEEJBB',
      'FFJJJIIIIIIIIIIIIFFFFMEEJBB.',
      'FFFFFFFFFJJJIIIIIIIIIIEJBB..',
      'FFFFFFFFFFFFFFFJJJIIIIJBB...',
      '....FFFFFFFFFFFFFFFFFFBBB...',
      '...........FFFFFFFFFFFBB....',
      '.................FFFFFB.....'
    ]
  }
};

function towerSprite(rows: readonly string[]): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = rows[0].length;
  sprite.height = rows.length;
  const ctx = sprite.getContext('2d');
  if (!ctx) throw new Error('Tower sprite canvas unavailable');
  for (const [y, row] of rows.entries()) {
    for (let x = 0; x < row.length; x++) {
      const color = palette.get(row[x]);
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return sprite;
}

export function createDesertTowerArt() {
  const sprites = {
    damaged: towerSprite(frames.damaged.pixels),
    repaired: towerSprite(frames.repaired.pixels)
  };
  return (ctx: CanvasRenderingContext2D, tower: Tower, flash: boolean) => {
    const x = Math.round(tower.x), y = Math.round(tower.y);
    ctx.drawImage(sprites[tower.kind], x - GROUND_X, y - frames[tower.kind].groundY);
    if (tower.kind !== 'repaired' || !flash) return;

    const muzzleX = x + 15, muzzleY = y - 24;
    ctx.fillStyle = '#d66b40';
    ctx.fillRect(muzzleX - 6, muzzleY, 12, 3);
    ctx.fillStyle = '#ffad54';
    ctx.fillRect(muzzleX - 3, muzzleY - 5, 7, 7);
    ctx.fillRect(muzzleX - 6, muzzleY - 2, 13, 3);
    ctx.fillStyle = '#fff0b5';
    ctx.fillRect(muzzleX - 1, muzzleY - 3, 3, 4);
  };
}
