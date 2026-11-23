export const bossBodySize = 64;
export const bossBodyAnchor = 32;
export type BossBody = 'harvester' | 'matriarch';
export type BossPose = 'idle' | 'move' | 'attack';

export function createBossBodyArt(kind: BossBody) {
  const poses: readonly BossPose[] = ['idle', 'move', 'attack'];
  const frames = new Map<BossPose, HTMLCanvasElement[]>();
  for (const pose of poses) frames.set(pose, [0, 1, 2, 3].map(beat => {
    const tile = document.createElement('canvas');
    tile.width = tile.height = bossBodySize;
    const pen = tile.getContext('2d');
    if (!pen) throw new Error('Boss body canvas unavailable');
    const c = pen;
    function rect(x: number, y: number, w: number, h: number, tint: string) {
      c.fillStyle = tint;
      c.fillRect(x + bossBodyAnchor, y + bossBodyAnchor, w, h);
    }
    function bevel(x: number, y: number, w: number, h: number, cut: number, tint: string) {
      for (let row = 0; row < h; row++) {
        const skip = Math.max(0, cut - row, cut - (h - 1 - row));
        rect(x + skip, y + row, w - skip * 2, 1, tint);
      }
    }
    if (kind === 'harvester') {
      for (const x of [-28, 14]) {
        bevel(x, -14, 14, 37, 3, '#26313c');
        rect(x + 2, -12, 10, 33, '#4f5962');
        for (let i = pose === 'move' ? beat : 0; i < 31; i += 5) rect(x + 3, -11 + i, 8, 2, '#8b8376');
      }
      bevel(-19, -20, 38, 32, 6, '#394956');
      bevel(-18, -23, 36, 25, 6, '#ab7d50');
      bevel(-14, -22, 28, 17, 4, '#c8a478');
      rect(-11, -17, 22, 6, '#43515c');
      rect(-8, -16, 16, 3, pose === 'attack' ? '#ffce85' : '#f3a56c');
      rect(-11, -8, 22, 5, '#655342');
      for (let i = -8; i <= 6; i += 7) rect(i, -7, 3, 3, '#d8ad74');
      const drop = pose === 'attack' ? 3 + (beat % 2) : 0;
      bevel(-19, 7 + drop, 38, 14, 3, '#343d46');
      rect(-17, 8 + drop, 34, 5, '#8d8982');
      for (const x of [-13, -3, 7]) {
        rect(x, 14 + drop, 6, 10, '#655f5d');
        rect(x, 14 + drop, 3, 8, '#b8aaa0');
      }
    } else {
      const sway = pose === 'move' ? [0, 2, 0, -2][beat] : 0;
      const swell = pose === 'attack' ? beat % 2 * 2 + 2 : 0;
      for (const sign of [-1, 1]) for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 8; j++) {
          const x = sign * (8 + i * 8 + j) - 2;
          const y = 3 + (1 - i) * 9 + j + (i === 0 ? sign * sway : -sign * sway);
          rect(x, y, 5, 5, '#213d39');
          rect(x, y, 3, 2, '#598261');
        }
      }
      bevel(-12, -1, 24, 24, 6, '#29483e');
      bevel(-9, 0, 18, 19, 5, '#789366');
      for (const x of [-6, 4]) rect(x, 12, 3, 3, '#e4cd93');
      bevel(sway-24-swell, -21, 48+swell*2, 26, 10, '#283c36');
      bevel(sway-22-swell, -24, 44+swell*2, 21, 10, '#6c9266');
      bevel(sway-17, -27, 34, 13, 6, '#a9b783');
      bevel(sway-19, -7, 38, 9, 4, '#9e8d65');
      for (let i = -13; i <= 13; i += 7) rect(sway+i, -5, 3, 5, '#604d44');
      for (const [x,y] of [[-13,-16],[-3,-21],[8,-17],[14,-11]]) {
        rect(sway+x,y,4,3,pose === 'attack' ? '#efd3a1' : '#c5c699');
      }
    }
    return tile;
  }));
  return (ctx: CanvasRenderingContext2D, x: number, y: number, pose: BossPose, tick: number) => {
    const sprite = frames.get(pose)?.[Math.floor(tick / 7) % 4];
    if (sprite) ctx.drawImage(sprite, Math.round(x) - bossBodyAnchor, Math.round(y) - bossBodyAnchor);
  };
}
