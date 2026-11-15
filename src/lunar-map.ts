type View = Readonly<{ left: number; top: number; width: number; height: number }>;

export function createLunarMap() {
  const terrain = document.createElement('canvas'); terrain.width = 256; terrain.height = 256;
  const ground = terrain.getContext('2d');
  if (!ground) throw new Error('Terrain canvas is unavailable');
  ground.fillStyle = '#707c80'; ground.fillRect(0, 0, 256, 256);
  let rng = 529;
  function noise() { rng = Math.imul(rng, 1664525) + 1013904223; return (rng >>> 0) / 4294967296; }
  for (let i = 0; i < 1800; i++) { ground.fillStyle = noise() > .5 ? '#7c8687' : '#657277'; ground.fillRect(noise() * 256, noise() * 256, noise() * 3 + 1, 1); }
  for (let i = 0; i < 9; i++) {
    const x = noise() * 256, y = noise() * 256, r = 3 + noise() * 14;
    ground.fillStyle = '#8a9492'; ground.beginPath(); ground.ellipse(x, y + 1, r + 2, r * .53, 0, 0, Math.PI * 2); ground.fill();
    ground.fillStyle = '#536369'; ground.beginPath(); ground.ellipse(x, y - 1, r, r * .48, 0, 0, Math.PI * 2); ground.fill();
    ground.fillStyle = '#616e72'; ground.beginPath(); ground.ellipse(x + 2, y, r - 2, r * .3, 0, 0, Math.PI * 2); ground.fill();
  }
  function structure(ctx: CanvasRenderingContext2D, x: number, y: number, kind: number) {
    ctx.fillStyle = '#374b55'; ctx.fillRect(x - 43, y + 11, 100, 15);
    if (kind === 0) {
      ctx.fillStyle = '#314550'; ctx.fillRect(x - 35, y - 30, 74, 52);
      ctx.fillStyle = '#b0b9b1'; ctx.fillRect(x - 38, y - 35, 70, 45);
      ctx.fillStyle = '#d0d4c6'; ctx.fillRect(x - 32, y - 40, 58, 7);
      ctx.fillStyle = '#819395'; ctx.fillRect(x - 28, y - 28, 18, 31); ctx.fillRect(x + 3, y - 28, 19, 31);
      ctx.fillStyle = '#142d3b'; ctx.fillRect(x - 24, y - 23, 10, 9); ctx.fillRect(x + 7, y - 23, 11, 9);
      ctx.fillStyle = '#7de4db'; ctx.fillRect(x - 24, y - 21, 10, 2); ctx.fillRect(x + 7, y - 21, 11, 2);
      ctx.fillStyle = '#e9b778'; ctx.fillRect(x - 1, y - 48, 3, 8);
    } else {
      ctx.fillStyle = '#263e51'; ctx.fillRect(x - 38, y - 18, 75, 34);
      ctx.fillStyle = '#496d7e'; ctx.fillRect(x - 41, y - 22, 74, 29);
      ctx.strokeStyle = '#78b5c0'; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x - 37 + i * 12, y - 21); ctx.lineTo(x - 37 + i * 12, y + 7); ctx.stroke(); }
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - 40, y - 19 + i * 11); ctx.lineTo(x + 32, y - 19 + i * 11); ctx.stroke(); }
    }
  }
  return (ctx: CanvasRenderingContext2D, view: View, arena: number, time: number) => {
    const pattern = ctx.createPattern(terrain, 'repeat');
    ctx.fillStyle = pattern ?? '#707c80'; ctx.fillRect(Math.floor(view.left), Math.floor(view.top), Math.ceil(view.width) + 2, Math.ceil(view.height) + 2);
    ctx.strokeStyle = '#91a9a155'; ctx.lineWidth = 1;
    for (let x = 0; x < arena; x += 100) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, arena); ctx.stroke(); }
    for (let y = 0; y < arena; y += 100) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(arena, y); ctx.stroke(); }
    ctx.strokeStyle = '#a5c5b844'; ctx.setLineDash([5, 7]); ctx.strokeRect(36, 36, arena - 72, arena - 72); ctx.setLineDash([]);
    for (const [x, y] of [[500, 430], [930, 920], [300, 1030], [1170, 330]]) { structure(ctx, x, y, 0); structure(ctx, x + 105, y + 8, 1); }
    ctx.fillStyle = '#475e60'; ctx.fillRect(638, 617, 134, 106); ctx.fillStyle = '#9ea9a0'; ctx.fillRect(640, 610, 130, 100);
    ctx.strokeStyle = '#657d7c'; ctx.strokeRect(648, 618, 114, 84);
    ctx.fillStyle = '#3c6366'; ctx.fillRect(693, 639, 24, 43); ctx.fillStyle = '#8beddd'; ctx.fillRect(697, 633, 16, 33);
    ctx.fillStyle = '#d8ffef'; ctx.fillRect(701, 635, 4, 26);
    ctx.strokeStyle = '#83e5d655'; ctx.beginPath(); ctx.arc(705, 663, 45 + Math.sin(time * .002) * 2, 0, Math.PI * 2); ctx.stroke();
  };
}
