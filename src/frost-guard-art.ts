const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 36;
const WALK_FRAMES = [0, 1, 0, 2];

const palette = new Map([
  ['A', '#9bbec5'],
  ['B', '#344d64'],
  ['C', '#557e90'],
  ['D', '#334150'],
  ['E', '#202d3a'],
  ['F', '#ffac69'],
  ['G', '#ffc881'],
  ['H', '#beb29b'],
  ['I', '#e9ddc2'],
  ['J', '#d2eff0'],
  ['K', '#93adb1'],
  ['L', '#344b59'],
  ['M', '#80b7d4'],
  ['N', '#477d9f'],
  ['O', '#56717e'],
  ['P', '#536371']
]);

const frames = [
  [
    '................................',
    '................................',
    '................................',
    '................................',
    '.............AAAAAA.............',
    '............AAAAAABA............',
    '...........AACCCCBAB............',
    '..........ACCCCAAABBA...........',
    '..........ACCCCCCCBAB...........',
    '.........CCCCAAACCABB...........',
    '.........CCCCCCCCCCB............',
    '...........DDDCCCCCE............',
    '...........DFFFGGDEE............',
    '.....HHIIIIDFFFFFDEE............',
    '.....HHHHHHDDDDDFDE..A..........',
    '.....JJJHHHKLDDDDDEAAAAAA.......',
    '.....MMMMMNOLCAAADAAAAAAB.......',
    '.....MMMMMNOLKKCCCCCCCCBB.......',
    '.....MMMMMNOOOLOKKLCCCCBB.......',
    '.....MMMMMNOOOLOOOLCCCCB........',
    '.....MMMMMNOOOLOOOLDCCCB........',
    '.....MMMMMNOLDDDDCCADDB.........',
    '.....MMMMMNOLDDDDDDCCCB.........',
    '.....MMMMMNOLCB.AAACCCE.........',
    '.....MMMMMNOCCB.CCCDDDE.........',
    '......MMMMDCCCE.CCCDDDE.........',
    '......MMMMDDDDE.DDCBED..........',
    '..........PPPPE.DDDDE...........',
    '.........DDDDEEPPPPEE...........',
    '.........DDDDEEDDDDEE...........',
    '.........DDDDE.DDDDE............',
    '...............DDDD.............',
    '................................',
    '................................',
    '................................',
    '................................'
  ],
  [
    '................................',
    '................................',
    '................................',
    '................................',
    '.............AAAAAA.............',
    '............AAAAAABA............',
    '...........AACCCCBAB............',
    '..........ACCCCAAABBA...........',
    '..........ACCCCCCCBAB...........',
    '.........CCCCAAACCABB...........',
    '.........CCCCCCCCCCB............',
    '...........DDDCCCCCE............',
    '...........DFFFGGDEE............',
    '.....HHIIIIDFFFFFDEE............',
    '.....HHHHHHDDDDDFDE..A..........',
    '.....JJJHHHKLDDDDDEAAAAAA.......',
    '.....MMMMMNOLCAAADAAAAAAB.......',
    '.....MMMMMNOLKKCCCCCCCCBB.......',
    '.....MMMMMNOOOLOKKLCCCCBB.......',
    '.....MMMMMNOOOLOOOLCCCCB........',
    '.....MMMMMNOOOLOOOLDCCCB........',
    '.....MMMMMNOLDDDDCCDDDBB........',
    '.....MMMMMNOLDDDDDDDCDBE........',
    '.....MMMMMNOLCBBAAADDDEE........',
    '.....MMMMMNOCCBCAAABDDEE........',
    '......MMMM.DDDDCCCCBDDE.........',
    '......MMMMPPPPPCCCCB............',
    '..........DDPPEDDDCE............',
    '..........DDDDEPDDDE............',
    '..........DDDDPPPPPE............',
    '..............DDDDEE............',
    '..............DDDDE.............',
    '...............DDD..............',
    '................................',
    '................................',
    '................................'
  ],
  [
    '................................',
    '................................',
    '................................',
    '................................',
    '.............AAAAAA.............',
    '............AAAAAABA............',
    '...........AACCCCBAB............',
    '..........ACCCCAAABBA...........',
    '..........ACCCCCCCBAB...........',
    '.........CCCCAAACCABB...........',
    '.........CCCCCCCCCCB............',
    '...........DDDCCCCCE............',
    '...........DFFFGGDEE............',
    '.....HHIIIIDFFFFFDEE............',
    '.....HHHHHHDDDDDFDE..A..........',
    '.....JJJHHHKLDDDDDEAAAAAA.......',
    '.....MMMMMNOLCAAADAAAAAAB.......',
    '.....MMMMMNOLKKCCCCCCCCBB.......',
    '.....MMMMMNOOOLOKKLCCCCBB.......',
    '.....MMMMMNOOOLOOOLCCCCB........',
    '.....MMMMMNOOOLOOOLDCCCB........',
    '.....MMMMMNOLDDDDCCADDE.........',
    '.....MMMMMNOLDDDDDAAAA..........',
    '.....MMMMMNOABE.CCCCCB..........',
    '.....MMMMMNOCBE.CCDCCE..........',
    '......MMMMCCCBE..CDDDE..........',
    '......MMMMDDCEE..DDDDE..........',
    '..........DDDEE.PPPPE...........',
    '.........PPPPE..DDDEE...........',
    '.........DDDEE..DDDEE...........',
    '.........DDDEE..DDDE............',
    '.........DDDE...................',
    '................................',
    '................................',
    '................................',
    '................................'
  ]
];

export function createFrostGuardArt() {
  const atlas = document.createElement('canvas');
  atlas.width = FRAME_WIDTH;
  atlas.height = FRAME_HEIGHT * frames.length;
  const paint = atlas.getContext('2d');
  if (!paint) throw new Error('Frost Guard atlas canvas unavailable');
  for (const [frame, rows] of frames.entries()) {
    for (const [y, row] of rows.entries()) {
      for (let x = 0; x < row.length; x++) {
        const color = palette.get(row[x]);
        if (!color) continue;
        paint.fillStyle = color;
        paint.fillRect(x, frame * FRAME_HEIGHT + y, 1, 1);
      }
    }
  }
  return (ctx: CanvasRenderingContext2D, x: number, y: number, tick: number, scale = 1.5) => {
    const frame = WALK_FRAMES[Math.floor(tick / 6) % WALK_FRAMES.length];
    const k = scale * .82;
    ctx.drawImage(atlas, 0, frame * FRAME_HEIGHT, FRAME_WIDTH, FRAME_HEIGHT,
      Math.round(x - 16 * k), Math.round(y + 10 - 29 * k), FRAME_WIDTH * k, FRAME_HEIGHT * k);
  };
}
