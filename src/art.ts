const palette: Record<string, string> = { W: '#e8eee7', S: '#84959d', D: '#273c4b', B: '#101c29', C: '#7de4db', T: '#398d98', O: '#f3b76b', R: '#ac6955', G: '#536974' };
const sprites: Record<string, string[]> = {
  astronaut: ['.....DDDDD......','....DWWWWWD.....','...DWWWWWWWD....','...DCCCCCWWD....','..SDCCCCCDWDS...','..SDTTTTTDWDS...','..SDWWWWWWWDS...','..SDWWDWWDWDS...','...DWWWWWWWD....','..DWWWCCWWWWD...','..DWWWDDWWWWD...','...DWWDDWWWD....','...DWWDDWWD.....','...DSSDDSSD.....','..DBBBDDBBBD....','..DDDDDDDDDD....'],
  crawler: ['................','................','................','..D..........D..','..DS..DDDD..SD..','...DSDSSSSDSD...','..DDSSOOOO SSDD..'.replace(' ',''),'.DSSDDDDDDDDSSD.','..DDDSCSSCSDDD..','...DSSSSSSSSD...','..DSSDSSSSDSSD..','.DSSD.DDDD.DSSD.','.DDD........DDD.','................','................','................'],
  drone: ['................','......DDDD......','.....DSSSSD.....','..DDDDCCCCDDDD..','.DSSSDCCCCDSSSD.','DWWWWDTTTTDWWWWD','.DDDDDSSSSDDDDD.','.....DSSSSD.....','.....DCOOCD.....','......DDDD......','......O..O......','................','................','................','................','................'],
  sentry: ['................','......DDD.......','......DOD.......','......DOD.......','.....DDODD......','....DSSSSSD.....','...DSSCCCSSD....','...DSCCCCSSD....','...DSSCCCSSD....','...DSSSSSSSD....','....DDDDDDD.....','...DSSD.DSSD....','..DSSSD.DSSSD...','.DDDDD...DDDDD..','................','................'],
  boss: ['....DDDDDDDD....','...DSSSSSSSSD...','..DSSCCSSCCSSD..','.DSSSCCSSCCSSSD.','DSSDDDDDDDDDDSSD','DSSDCCCOOCCCDSSD','DSSDCCCOOCCCDSSD','DSSDDDDDDDDDDSSD','.DSSSSSSSSSSSSD.','..DSSDDDDDDSSD..','.DSSDSSSSSSDSSD.','DSSSDSSSSSSDSSSD','DSSSDDDDDDDDSSSD','DDDDD......DDDDD','..OO........OO..','................'],
  crystal: ['................','................','.......C........','......CCC.......','.....CCWCC......','....CCTWTCC.....','...CCTTWT TCC...'.replace(' ',''),'....CCTTTCC.....','.....CCTCC......','......CCC.......','.......T........','................','................','................','................','................']
};
export type Sprite = 'astronaut' | 'crawler' | 'drone' | 'sentry' | 'boss' | 'crystal';
const crawlerFrames = [sprites.crawler,
  [...sprites.crawler.slice(0, 11), '..DSD.DDDD.DSSD.', '...DDD......DDD.', ...sprites.crawler.slice(13)],
  [...sprites.crawler.slice(0, 11), '.DSSD.DDDD.DSD..', '.DDD......DDD...', ...sprites.crawler.slice(13)]];
export function createAtlas(): { canvas: HTMLCanvasElement; draw: (ctx: CanvasRenderingContext2D, name: Sprite, x: number, y: number, scale?: number, animationTick?: number) => void } {
  const canvas = document.createElement('canvas');
  const names = Object.keys(sprites);
  canvas.width = 16 * names.length; canvas.height = 48;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  for (let i = 0; i < names.length; i++) {
    const frames = names[i] === 'crawler' ? crawlerFrames : [sprites[names[i]]];
    for (const [frame, rows] of frames.entries()) for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
      const color = palette[rows[y][x]];
      if (color) { ctx.fillStyle = color; ctx.fillRect(i * 16 + x, frame * 16 + y, 1, 1); }
    }
  }
  return { canvas, draw(target, name, x, y, scale = 1, animationTick = 0) {
    const beat = Math.floor(animationTick / 6) % 4;
    const frame = name === 'crawler' ? beat === 1 ? 1 : beat === 3 ? 2 : 0 : 0;
    target.drawImage(canvas, names.indexOf(name) * 16, frame * 16, 16, 16, Math.round(x - 8 * scale), Math.round(y - 8 * scale), 16 * scale, 16 * scale);
  } };
}
