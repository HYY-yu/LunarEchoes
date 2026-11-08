export type DesertScene = 'opening' | 'victory' | 'defeat';
export const DESERT_SCENE_SIZE = Object.freeze({ width: 320, height: 180 });
const ink = '#101c29', steel = '#273c4b', pale = '#e8eee7', cyan = '#7de4db';
const themes = {
  opening: { sky: '#273c4b', haze: '#ac6955', sand: '#b77c58', ridge: '#d29b66', front: '#714f44', signal: '#f3b76b' },
  victory: { sky: '#273c4b', haze: '#84959d', sand: '#b77c58', ridge: '#e0b77b', front: '#714f44', signal: cyan },
  defeat: { sky: ink, haze: '#536974', sand: '#714f44', ridge: '#ac6955', front: '#3d3439', signal: '#ac6955' }
};
export function drawDesertScene(ctx: CanvasRenderingContext2D, scene: DesertScene): void {
  const colors = themes[scene];
  const rect = (x: number, y: number, w: number, h: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const polygon = (points: readonly (readonly [number, number])[], color: string) => {
    const low = Math.min(...points.map(point => point[1])), high = Math.max(...points.map(point => point[1]));
    for (let y = low; y < high; y++) {
      const hits: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) hits.push(Math.round(x1 + (y - y1) * (x2 - x1) / (y2 - y1)));
      }
      hits.sort((a, b) => a - b);
      for (let i = 0; i + 1 < hits.length; i += 2) rect(hits[i], y, hits[i + 1] - hits[i], 1, color);
    }
  };
  const disc = (x: number, y: number, radius: number, color: string) => {
    for (let row = -radius; row <= radius; row++) {
      const half = Math.floor(Math.sqrt(radius * radius - row * row));
      rect(x - half, y + row, half * 2 + 1, 1, color);
    }
  };
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  rect(0, 0, 320, 180, colors.sky);
  rect(0, 53, 320, 34, colors.haze);
  disc(51, 45, 16, scene === 'defeat' ? '#84959d' : '#f3b76b');
  rect(29, 43, 47, 3, colors.sky);
  rect(34, 53, 34, 2, colors.haze);
  polygon([[0, 83], [42, 65], [74, 78], [130, 66], [174, 84], [226, 65], [270, 77], [320, 62], [320, 112], [0, 112]], '#536974');
  polygon([[0, 91], [53, 81], [92, 95], [160, 80], [225, 96], [284, 83], [320, 88], [320, 180], [0, 180]], colors.sand);
  polygon([[0, 112], [50, 99], [104, 115], [156, 103], [214, 111], [272, 99], [320, 108], [320, 126], [0, 135]], colors.ridge);
  rect(83, 108, 86, 9, colors.front);
  polygon([[87, 98], [96, 78], [139, 78], [155, 90], [155, 112], [87, 112]], ink);
  polygon([[92, 96], [99, 83], [136, 83], [149, 93], [149, 108], [92, 108]], steel);
  rect(98, 91, 7, 17, '#536974');
  rect(111, 88, 24, 21, ink);
  rect(114, 92, 16, 16, '#3d3439');
  polygon([[129, 87], [143, 89], [146, 97], [138, 95], [136, 105], [131, 104]], colors.sand);
  rect(95, 84, 40, 2, '#84959d');
  rect(147, 103, 9, 5, '#84959d');
  rect(157, 107, 13, 3, steel);
  rect(76, 112, 89, 2, '#e0b77b');
  polygon([[209, 117], [222, 66], [228, 66], [241, 117]], ink);
  polygon([[216, 112], [224, 78], [226, 78], [234, 112]], '#84959d');
  polygon([[221, 99], [229, 99], [233, 112], [216, 112]], steel);
  rect(217, 103, 14, 2, ink);
  rect(220, 92, 10, 2, ink);
  rect(223, 60, 3, 20, pale);
  polygon([[198, 49], [226, 58], [246, 44], [240, 60], [227, 68], [212, 62]], ink);
  polygon([[202, 50], [226, 58], [243, 47], [237, 58], [226, 63], [214, 59]], scene === 'defeat' ? '#536974' : '#84959d');
  rect(224, 50, 2, 11, pale);
  rect(223, 49, 4, 3, colors.signal);
  rect(206, 116, 38, 4, steel);
  rect(213, 118, 25, 3, '#84959d');
  rect(243, 109, 17, 12, ink);
  rect(246, 112, 11, 6, steel);
  rect(247, 113, 3, 2, colors.signal);
  rect(252, 113, 3, 2, scene === 'victory' ? cyan : steel);
  polygon([[0, 146], [43, 126], [97, 140], [163, 130], [215, 145], [269, 133], [320, 143], [320, 180], [0, 180]], colors.front);
  polygon([[0, 146], [44, 126], [84, 137], [42, 133]], colors.ridge);
  polygon([[165, 130], [215, 145], [269, 133], [221, 151]], colors.sand);
  for (let i = 0; i < 34; i++) {
    const x = (i * 73 + 19) % 316, y = 124 + (i * 29) % 52;
    rect(x, y, 2 + i % 4, 1, i % 3 === 0 ? colors.ridge : colors.sand);
  }
  if (scene === 'opening') {
    for (let i = 0; i < 7; i++) { rect(35 + i * 6, 162 - i * 4, 3, 1, ink); rect(39 + i * 6, 164 - i * 4, 3, 1, ink); }
  }
  if (scene === 'victory') {
    for (let i = 0; i < 3; i++) {
      const x = 241 + i * 13, y = 37 - i * 7;
      rect(x, y, 2, 8, cyan); rect(x - 3, y - 3, 3, 2, cyan); rect(x - 3, y + 9, 3, 2, cyan);
    }
    polygon([[139, 153], [152, 139], [182, 140], [194, 151], [188, 158], [147, 158]], ink);
    polygon([[148, 151], [156, 143], [177, 144], [185, 151], [176, 155]], '#536974');
    rect(161, 143, 8, 3, colors.front);
    rect(172, 148, 4, 3, '#ac6955');
    polygon([[139, 152], [132, 160], [127, 159], [134, 150]], '#84959d');
    polygon([[185, 154], [199, 159], [207, 158], [201, 163], [190, 160]], '#84959d');
    rect(153, 158, 8, 2, steel);
  }
  if (scene === 'defeat') {
    polygon([[157, 76], [164, 61], [159, 48], [166, 37], [162, 21], [170, 6], [178, 6], [174, 28], [180, 40], [170, 54], [174, 68], [168, 79]], '#536974');
    rect(157, 98, 4, 6, '#ac6955');
    rect(174, 15, 15, 2, colors.sky);
    rect(166, 40, 18, 2, colors.sky);
    polygon([[252, 120], [263, 124], [278, 122], [290, 131], [288, 132], [277, 125], [263, 127], [251, 123]], ink);
  }
  const engineerX = scene === 'opening' ? 69 : scene === 'victory' ? 267 : 68;
  const engineerY = scene === 'victory' ? 120 : 133;
  rect(engineerX - 3, engineerY + 27, 21, 3, ink);
  rect(engineerX + 1, engineerY + 19, 5, 9, ink);
  rect(engineerX + 10, engineerY + 19, 5, 9, ink);
  rect(engineerX + 2, engineerY + 19, 3, 6, '#84959d');
  rect(engineerX + 11, engineerY + 19, 3, 6, '#84959d');
  rect(engineerX - 2, engineerY + 8, 7, 12, steel);
  rect(engineerX, engineerY + 8, 17, 13, ink);
  rect(engineerX + 2, engineerY + 9, 12, 10, pale);
  rect(engineerX + 5, engineerY + 11, 6, 3, '#398d98');
  rect(engineerX + 1, engineerY, 14, 10, ink);
  rect(engineerX + 3, engineerY + 1, 10, 8, pale);
  rect(engineerX + 5, engineerY + 3, 9, 4, cyan);
  rect(engineerX + 12, engineerY + 8, 5, 11, '#84959d');
  rect(engineerX + 16, engineerY + 14, 7, 3, ink);
  rect(0, 0, 320, 3, ink);
  rect(0, 177, 320, 3, ink);
  ctx.restore();
}
