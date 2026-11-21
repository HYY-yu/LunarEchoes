type TowerState = 'damaged' | 'repaired';
type Tower = Readonly<{ kind: TowerState; x: number; y: number }>;
type Metal = readonly [string, string, string];

const steel: Metal = ['#99aaa8', '#506375', '#344955'];
const dark: Metal = ['#586977', '#34414b', '#27313b'];
const chipped: Metal = ['#ae9480', '#675957', '#483f41'];

function towerSprite(kind: TowerState) {
  const sprite = document.createElement('canvas');
  sprite.width = 48;
  sprite.height = 44;
  const pen = sprite.getContext('2d');
  if (!pen) throw new Error('Tower sprite canvas unavailable');
  const ctx = pen;
  function rect(x: number, y: number, w: number, h: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(24 + x, 32 + y, w, h);
  }
  function slab(x: number, y: number, width: number, depth: number, height: number, face: Metal) {
    for (let i = depth; i >= 0; i--) {
      rect(x + i, y - i, width, 1, face[0]);
      rect(x + i + width, y - i, 1, height + 1, face[2]);
    }
    rect(x, y + 1, width, height, face[1]);
  }
  rect(-12, 3, 27, 4, '#30374077');
  for (const x of [-12, 7]) slab(x, -5, 5, 3, 3, dark);
  slab(-11, 0, 21, 5, 4, steel);
  for (const x of [-13, 7]) slab(x, 3, 6, 2, 3, dark);
  slab(-7, -4, 12, 4, 4, dark);
  if (kind === 'damaged') {
    slab(-8, -8, 5, 2, 4, chipped);
    slab(-9, -11, 3, 2, 3, steel);
    rect(-2, -7, 6, 2, '#232e38');
    rect(-2, -5, 3, 1, '#eeaa67');
    slab(4, -3, 5, 2, 3, chipped);
    slab(8, 0, 7, 2, 2, chipped);
  } else {
    slab(-5, -12, 9, 3, 8, steel);
    slab(-7, -16, 13, 3, 4, dark);
    slab(-9, -20, 4, 2, 5, steel);
    slab(4, -20, 4, 2, 5, steel);
    slab(-11, -23, 4, 2, 4, steel);
    slab(6, -23, 4, 2, 4, steel);
    slab(-2, -26, 4, 2, 11, steel);
    rect(-1, -24, 2, 6, '#b7e8df');
    rect(-3, -10, 6, 2, '#7ef5d1');
  }
  return sprite;
}

export function createDesertTowerArt() {
  const sprites = { damaged: towerSprite('damaged'), repaired: towerSprite('repaired') };
  return (ctx: CanvasRenderingContext2D, tower: Tower) =>
    ctx.drawImage(sprites[tower.kind], Math.round(tower.x) - 24, Math.round(tower.y) - 32);
}
