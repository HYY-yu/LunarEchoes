export type SecondBoss = 'glacier' | 'orbital';
export type SecondBossPose = 'idle' | 'move' | 'attack';
export const secondBossFrameSize = 64;
export const secondBossAnchor = 32;

export function createSecondBossArt(kind: SecondBoss) {
  const poses = ['idle', 'move', 'attack'] as const;
  const atlas = document.createElement('canvas');
  atlas.width = 4 * secondBossFrameSize;
  atlas.height = 3 * secondBossFrameSize;
  const pen = atlas.getContext('2d');
  if (!pen) throw new Error('Second boss atlas unavailable');
  const c = pen;
  for (const [row, pose] of poses.entries()) for (let beat = 0; beat < 4; beat++) {
    const draw = (x: number, y: number, w: number, h: number, ink: string) => {
      c.fillStyle = ink;
      c.fillRect(beat * 64 + 32 + x, row * 64 + 32 + y, w, h);
    };
    function poly(points: readonly (readonly [number, number])[], ink: string) {
      for (let y = -31; y <= 31; y++) {
        const cuts: number[] = [];
        for (let j = 0; j < points.length; j++) {
          const [x1,y1] = points[j], [x2,y2] = points[(j+1)%points.length];
          if (y1 <= y && y2 > y || y2 <= y && y1 > y) cuts.push(Math.round(x1 + (x2-x1)*(y-y1)/(y2-y1)));
        }
        cuts.sort((a,b) => a-b);
        for (let j = 0; j < cuts.length; j += 2) draw(cuts[j],y,cuts[j+1]-cuts[j],1,ink);
      }
    }
    if (kind === 'glacier') {
      const stride = pose === 'move' ? [0, 3, 0, -3][beat] : 0;
      for (const s of [-1,1]) {
        const x = s < 0 ? -27 : 11, y = 6 + s*stride;
        poly([[x,y],[x+15,y-3],[x+18,y+11],[x+11,y+22],[x,y+20],[x-2,y+13]],'#3d5668');
        poly([[x+2,y+1],[x+12,y-1],[x+15,y+11],[x+10,y+17],[x+1,y+16]],'#9bbbc5');
        for (let j=0;j<3;j++) draw(x+2+j*4,y+15-(j%2),2,4,'#d6e3df');
      }
      poly([[-21,6],[-23,-12],[-11,-21],[-7,-28],[-2,-22],[4,-27],[8,-21],[16,-20],[23,-9],[22,10],[13,16],[-13,16]],'#344f64');
      poly([[-19,3],[-19,-11],[-10,-18],[-7,-25],[-2,-17],[4,-24],[9,-16],[16,-17],[20,-9],[18,3],[6,10],[-12,10]],'#91b6c9');
      poly([[-16,-9],[-6,-20],[-2,-12],[4,-20],[11,-12],[16,-8],[6,-2],[-8,-2]],'#d3e2db');
      poly([[-12,8],[-10,1],[8,0],[14,8],[11,18],[-11,18]],'#567083');
      draw(-8,10,16,3,'#263e4e');
      draw(-6,10,3,2,'#fac488'); draw(4,10,3,2,'#fac488');
      if (pose === 'attack') {
        draw(-5,14,10,3,beat % 2 ? '#ead4b2' : '#a7cad1');
        draw(-9,17,18,3,'#324d61');
      }
    } else {
      const roll = pose === 'move' ? [0, 2, 0, -2][beat] : 0;
      const shift = pose === 'attack' ? 3 + beat % 2 : 0;
      for (const s of [-1,1]) {
        const wing = (pts: readonly (readonly [number,number])[], ink: string) =>
          poly(pts.map(([x,y]) => [s*x,y+s*roll] as const),ink);
        wing([[6,-7],[21,-20-shift],[31,-11-shift],[28,10],[21,16],[18,8],[9,19]],'#293541');
        wing([[8,-7],[21,-17-shift],[28,-11-shift],[25,8],[21,11],[16,3],[9,14]],'#7c7283');
        wing([[14,-8],[21,-16-shift],[26,-12-shift],[20,-3],[14,-1]],'#b0a5af');
        wing([[18,5],[25,5],[21,14],[19,14]],pose === 'attack' ? '#f0c2a2' : '#b8868a');
      }
      poly([[-10,-15],[0,-25],[10,-15],[8,-3],[13,7],[10,19],[5,23],[0,18],[-5,23],[-10,19],[-13,7],[-8,-3]],'#33434e');
      poly([[-7,-15],[0,-21],[7,-15],[4,0],[9,8],[5,17],[-5,17],[-8,8],[-4,0]],'#a2aeb5');
      poly([[-4,-12],[0,-17],[4,-12],[3,-4],[-3,-4]],'#49526b');
      draw(-4,3,8,2,pose === 'attack' ? '#e6ad9e' : '#b28390');
      draw(-4,10,8,5,'#5a566f');
    }
  }
  return (ctx: CanvasRenderingContext2D, x: number, y: number, pose: SecondBossPose, tick: number) => {
    const column = Math.floor(tick / 7) % 4;
    ctx.drawImage(atlas, column*64, poses.indexOf(pose)*64, 64, 64,
      Math.round(x)-32, Math.round(y)-32, 64, 64);
  };
}
