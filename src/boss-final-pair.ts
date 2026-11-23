export type FinalBoss = 'siege' | 'lunar';
export type FinalBossPose = 'idle' | 'move' | 'attack';
export const finalBossSize = 64;
export const finalBossAnchor = 32;

export function createFinalBossArt(kind: FinalBoss) {
  const poses = ['idle', 'move', 'attack'] as const;
  const sheet = document.createElement('canvas');
  sheet.width = 256; sheet.height = 192;
  const ink = sheet.getContext('2d');
  if (!ink) throw new Error('Final boss atlas unavailable');
  const c = ink;
  for (const [row, pose] of poses.entries()) for (let beat = 0; beat < 4; beat++) {
    function block(x: number, y: number, w: number, h: number, color: string) {
      c.fillStyle = color; c.fillRect(beat*64+32+x,row*64+32+y,w,h);
    }
    function polygon(points: readonly (readonly [number, number])[], color: string) {
      for (let y = -31; y <= 31; y++) {
        const cuts: number[] = [];
        for (let i=0;i<points.length;i++) {
          const [a,b]=points[i], [u,v]=points[(i+1)%points.length];
          if ((b<=y && v>y) || (v<=y && b>y)) cuts.push(Math.round(a+(u-a)*(y-b)/(v-b)));
        }
        cuts.sort((a,b)=>a-b);
        for(let i=0;i<cuts.length;i+=2) block(cuts[i],y,cuts[i+1]-cuts[i],1,color);
      }
    }
    const motion = pose==='move' ? [0,2,0,-2][beat] : 0;
    const charge = pose==='attack' ? beat%2+2 : 0;
    if (kind==='siege') {
      for (const s of [-1,1]) for (const t of [-1,1]) {
        const y=t*14+s*t*motion;
        polygon([[s*8,y-5],[s*23,y-9],[s*29,y-4],[s*29,y+6],[s*22,y+11],[s*14,y+7]],'#303642');
        polygon([[s*12,y-4],[s*22,y-7],[s*26,y-3],[s*25,y+5],[s*16,y+3]],'#937c6c');
        block(s<0?-27:24,y+1,3,5,'#c2a079');
      }
      polygon([[-19,0],[-12,-12],[12,-12],[20,0],[13,15],[-13,15]],'#484951');
      polygon([[-15,-2],[-9,-10],[10,-10],[15,-2],[10,6],[-9,6]],'#a69a8b');
      block(-8,-20,16,23,'#4f535e');
      block(-7,-22,14,6,'#c6ac8b');
      polygon([[-14,-23],[-7,-29],[7,-29],[14,-23],[9,-16],[-9,-16]],'#6f626a');
      block(-9,-24,18,4,'#9a8290');
      block(-4,-21,8,3,charge?'#f6c181':'#b89b78');
      block(-3,-12,6,13,'#776477');
      if(charge) block(-2,-10,4,6+charge,'#e6ad86');
    } else {
      for (const s of [-1,1]) {
        const shift=charge+s*motion;
        polygon([[s*(14+shift),-17],[s*(23+shift),-15],[s*(28+shift),-5],[s*(27+shift),12],[s*(21+shift),19],[s*(15+shift),15],[s*(20+shift),5],[s*(18+shift),-5]],'#474057');
        polygon([[s*(17+shift),-14],[s*(23+shift),-12],[s*(25+shift),-4],[s*(22+shift),6],[s*(18+shift),10],[s*(20+shift),-4]],'#b291a7');
        block(s<0?-(23+shift):20+shift,-8,3,5,'#e5b9bc');
      }
      polygon([[0,-30],[-12,-19],[-15,-7],[-10,10],[0,22],[10,10],[15,-7],[12,-19]],'#514459');
      polygon([[0,-27],[-11,-17],[-10,-4],[0,13],[8,-5],[9,-16]],'#bd9dad');
      polygon([[0,-22],[0,9],[9,-6],[8,-15]],'#886984');
      polygon([[0,-16],[-6,-10],[-6,-3],[0,3],[6,-3],[6,-10]],charge?'#f2dba8':'#e1b0b3');
      block(-2,24+motion,4,3,'#977a9a');
    }
  }
  return (ctx: CanvasRenderingContext2D, x: number, y: number, pose: FinalBossPose, tick: number):void => {
    ctx.drawImage(sheet,Math.floor(tick/7)%4*64,poses.indexOf(pose)*64,64,64,Math.round(x)-32,Math.round(y)-32,64,64);
  };
}
