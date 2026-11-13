export const RAINFOREST_SCENE_SIZE = Object.freeze({ width: 320, height: 180 });

export function drawRainforestOpening(ctx: CanvasRenderingContext2D) {
  const { width, height } = RAINFOREST_SCENE_SIZE;
  const ink = '#101f26', shadow = '#163437', teal = '#23604f', jade = '#408069', moss = '#6b9556';
  const mist = '#94b584', stone = '#667c70', steel = '#31545a', lightSteel = '#60858a', root = '#503e3a';
  const dirt = '#8b6951', amber = '#ffc378', beacon = '#a4fff0';
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    const left = Math.max(x, 0), top = Math.max(y, 0);
    const right = Math.min(x + w, width), bottom = Math.min(y + h, height);
    if (right <= left || bottom <= top) return;
    ctx.fillStyle = color;
    ctx.fillRect(left, top, right - left, bottom - top);
  };
  const polygon = (points: readonly (readonly [number, number])[], color: string) => {
    const low = Math.min(...points.map(([, y]) => y));
    const high = Math.max(...points.map(([, y]) => y));
    for (let y = low; y < high; y++) {
      const hits = [];
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) hits.push(Math.round(x1 + (y - y1) * (x2 - x1) / (y2 - y1)));
      }
      hits.sort((a, b) => a - b);
      for (let i = 0; i + 1 < hits.length; i += 2) rect(hits[i], y, hits[i + 1] - hits[i], 1, color);
    }
  };
  const leaf = (x: number, y: number, w: number, h: number, color: string) => {
    polygon([[x, y], [x + w / 4, y - h], [x + w * 3 / 4, y - h], [x + w, y - 2], [x + w * 3 / 4, y + 2], [x + w / 4, y + 4]], color);
  };
  const fern = (x: number, y: number, s: number, color: string) => {
    polygon([[x, y], [x - 4 * s, y - 15 * s], [x - 14 * s, y - 21 * s], [x - 21 * s, y - 19 * s], [x - 13 * s, y - 16 * s], [x - 9 * s, y - 10 * s]], color);
    polygon([[x, y], [x - 2 * s, y - 21 * s], [x + 3 * s, y - 26 * s], [x + 5 * s, y - 21 * s], [x + 2 * s, y - 13 * s]], color);
    polygon([[x, y], [x + 7 * s, y - 16 * s], [x + 15 * s, y - 20 * s], [x + 21 * s, y - 19 * s], [x + 13 * s, y - 14 * s], [x + 8 * s, y - 7 * s]], color);
    polygon([[x, y], [x - 11 * s, y - 7 * s], [x - 20 * s, y - 6 * s], [x - 16 * s, y - 2 * s], [x - 7 * s, y - 3 * s]], color);
    polygon([[x, y], [x + 11 * s, y - 8 * s], [x + 19 * s, y - 6 * s], [x + 13 * s, y - 3 * s], [x + 7 * s, y - 3 * s]], color);
  };

  ctx.save();
  try {
    ctx.imageSmoothingEnabled = false;
    rect(0, 0, width, height, mist);
    polygon([[89, 0], [143, 0], [215, 132], [178, 135]], '#adc995');
    polygon([[130, 0], [145, 0], [244, 124], [230, 126]], '#bdd2a2');
    for (const [x, y, w] of [[14, 65, 70], [64, 46, 54], [129, 54, 62], [170, 34, 56], [219, 59, 74], [274, 43, 54]]) {
      polygon([[x + w * .46, y], [x + w * .57, y], [x + w * .61, 131], [x + w * .40, 131]], jade);
      leaf(x, y, w, 9, jade);
      leaf(x + 13, y - 8, w - 24, 8, jade);
    }
    polygon([[0, 107], [43, 99], [82, 109], [124, 100], [171, 113], [227, 98], [277, 103], [320, 94], [320, 180], [0, 180]], teal);
    for (const [x, y, w] of [[4, 91, 60], [43, 75, 55], [103, 96, 46], [264, 86, 57], [284, 58, 45]]) {
      polygon([[x + w * .55, y], [x + w * .69, y], [x + w * .70, 135], [x + w * .46, 135]], teal);
      leaf(x, y, w, 11, teal);
      leaf(x + 11, y - 8, w - 15, 10, teal);
    }
    polygon([[0, 130], [57, 119], [107, 125], [157, 117], [210, 124], [259, 119], [320, 127], [320, 180], [0, 180]], shadow);
    polygon([[190, 118], [218, 118], [224, 133], [193, 147], [175, 157], [191, 180], [88, 180], [117, 158], [161, 143], [183, 132]], dirt);
    polygon([[191, 122], [211, 121], [216, 131], [186, 145], [164, 154], [129, 158], [161, 144]], '#ad8661');
    for (const [x, y, w] of [[177, 138, 16], [169, 144, 11], [148, 149, 14], [122, 156, 17], [147, 161, 13], [108, 168, 15], [160, 172, 21], [125, 175, 7], [184, 134, 15]]) {
      rect(x, y, w, 2, root);
      rect(x + 2, y + 2, w - 3, 1, '#ad8661');
    }
    polygon([[46, 114], [51, 82], [57, 80], [66, 83], [63, 116]], shadow);
    polygon([[50, 110], [54, 85], [61, 85], [59, 112]], stone);
    polygon([[73, 116], [76, 87], [87, 86], [88, 116]], shadow);
    polygon([[75, 115], [79, 89], [84, 89], [84, 113]], stone);
    polygon([[50, 81], [52, 76], [72, 76], [91, 82], [89, 90], [66, 84], [51, 86]], stone);
    polygon([[52, 77], [66, 75], [82, 78], [90, 82], [77, 81], [66, 79], [57, 81]], moss);
    for (const [x, y, w, h] of [[48, 111, 15, 5], [70, 114, 19, 4], [95, 117, 12, 6], [42, 119, 18, 4], [59, 123, 9, 3]]) {
      rect(x, y, w, h, stone);
      rect(x + 2, y, w - 3, 2, moss);
    }
    polygon([[84, 115], [97, 96], [105, 101], [96, 117]], stone);
    polygon([[142, 121], [142, 90], [150, 81], [181, 79], [193, 70], [239, 70], [256, 83], [256, 119]], ink);
    polygon([[147, 118], [147, 92], [154, 85], [182, 84], [194, 74], [237, 74], [252, 86], [252, 117]], steel);
    polygon([[147, 92], [154, 85], [182, 84], [194, 74], [237, 74], [252, 86], [241, 88], [192, 87], [180, 95]], lightSteel);
    rect(151, 97, 23, 9, ink);
    rect(153, 99, 18, 3, amber);
    rect(160, 98, 2, 6, steel);
    rect(234, 92, 14, 19, ink);
    rect(236, 94, 10, 12, lightSteel);
    rect(237, 96, 8, 2, beacon);
    polygon([[180, 119], [180, 96], [191, 86], [219, 86], [229, 96], [229, 119]], ink);
    polygon([[183, 118], [183, 98], [192, 89], [218, 89], [226, 98], [226, 117]], lightSteel);
    polygon([[188, 119], [188, 99], [194, 93], [216, 93], [222, 99], [222, 119]], root);
    polygon([[191, 117], [191, 101], [196, 96], [215, 96], [218, 101], [218, 117]], '#a77449');
    rect(198, 97, 17, 3, amber);
    rect(197, 104, 2, 10, amber);
    rect(208, 105, 5, 10, dirt);
    rect(185, 119, 40, 3, steel);
    rect(182, 123, 46, 3, steel);
    rect(182, 122, 46, 1, amber);
    rect(180, 126, 49, 1, amber);
    rect(205, 50, 8, 24, steel);
    rect(208, 32, 3, 21, lightSteel);
    rect(206, 31, 7, 4, teal);
    rect(208, 29, 3, 6, beacon);
    rect(204, 53, 10, 3, beacon);
    for (const [x, y, w] of [[151, 85, 13], [164, 84, 12], [176, 84, 10], [189, 77, 13], [213, 75, 15], [227, 76, 10], [238, 79, 8]]) {
      rect(x, y, w, 2, moss);
      rect(x + 2, y + 2, 2, 5, teal);
    }
    polygon([[0, 0], [51, 0], [34, 34], [24, 64], [29, 117], [46, 139], [80, 149], [106, 168], [71, 156], [54, 155], [38, 166], [24, 180], [0, 180]], ink);
    polygon([[18, 0], [38, 0], [24, 39], [17, 70], [22, 117], [37, 142], [67, 151], [80, 157], [40, 150], [26, 139], [13, 115], [9, 69]], root);
    polygon([[320, 0], [286, 0], [294, 45], [285, 91], [283, 124], [272, 144], [245, 152], [224, 169], [242, 162], [259, 163], [278, 180], [320, 180]], ink);
    polygon([[309, 0], [298, 0], [304, 48], [295, 88], [294, 124], [283, 147], [260, 153], [250, 159], [276, 155], [294, 145], [304, 126], [306, 92], [315, 48]], root);
    polygon([[0, 0], [117, 0], [104, 12], [86, 19], [62, 21], [38, 32], [0, 45]], ink);
    polygon([[219, 0], [320, 0], [320, 52], [291, 28], [261, 19], [243, 15]], ink);
    for (const [x, y, w] of [[10, 26, 49], [41, 17, 52], [64, 9, 50], [219, 7, 40], [244, 17, 58], [273, 31, 46]]) leaf(x, y, w, 5, shadow);
    for (const [x, y, h] of [[66, 18, 23], [74, 17, 12], [89, 13, 17], [250, 13, 22], [269, 21, 17], [275, 23, 27]]) {
      rect(x, y, 2, h, shadow);
      rect(x - 2, y + h - 4, 2, 4, shadow);
    }
    for (const [x, y, s, color] of ([[12, 152, 1, teal], [33, 173, 1, jade], [71, 148, 1, moss], [99, 133, 1, jade], [130, 133, 1, teal], [254, 139, 1, moss], [286, 166, 1, jade], [312, 179, 1, teal]] satisfies [number, number, number, string][])) fern(x, y, s, color);
    for (const [x, y, w] of [[43, 158, 16], [82, 156, 8], [101, 143, 11], [119, 138, 10], [232, 139, 14], [249, 148, 12], [261, 167, 13], [29, 176, 18]]) {
      rect(x, y, w, 2, moss);
      rect(x + 2, y - 2, 2, 2, jade);
    }
  } finally {
    ctx.restore();
  }
}

export function drawRainforestVictory(ctx: CanvasRenderingContext2D) {
  drawRainforestOpening(ctx);
  const ink = '#101f26', steel = '#31545a', light = '#60858a', beacon = '#a4fff0';
  const visor = '#263f4a', suit = '#e8eee7', gold = '#ffc378';
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  ctx.save();
  try {
    for (const [x, y, w, h] of [[191, 43, 4, 3], [187, 38, 4, 5], [183, 30, 4, 8], [225, 43, 4, 3], [229, 38, 4, 5], [233, 30, 4, 8]]) {
      rect(x, y, w, h, '#408069');
      rect(x + 1, y, 2, h, beacon);
    }
    rect(153, 99, 7, 3, beacon);
    rect(162, 99, 9, 3, beacon);
    rect(193, 101, 23, 16, ink);
    rect(196, 103, 17, 10, steel);
    rect(199, 104, 11, 2, beacon);
    rect(200, 111, 11, 2, light);
    rect(192, 117, 25, 2, beacon);

    rect(106, 167, 60, 3, '#163437');
    rect(113, 170, 63, 2, '#163437');
    rect(121, 149, 9, 17, ink);
    rect(134, 151, 9, 16, ink);
    rect(123, 150, 5, 13, light);
    rect(136, 153, 5, 11, steel);
    rect(119, 163, 12, 5, ink);
    rect(134, 165, 13, 4, ink);

    rect(114, 129, 10, 20, ink);
    rect(116, 132, 7, 13, steel);
    rect(121, 127, 22, 26, ink);
    rect(124, 130, 16, 20, light);
    rect(126, 131, 11, 12, suit);
    rect(126, 144, 13, 4, steel);
    rect(129, 144, 2, 3, gold);
    rect(124, 112, 18, 17, ink);
    rect(127, 109, 11, 3, ink);
    rect(127, 112, 11, 3, suit);
    rect(126, 115, 14, 10, suit);
    rect(132, 115, 9, 6, visor);
    rect(136, 116, 5, 2, beacon);
    rect(129, 126, 9, 2, light);

    rect(140, 132, 11, 9, ink);
    rect(141, 133, 8, 5, suit);
    rect(146, 138, 7, 5, light);
    rect(150, 127, 26, 19, ink);
    rect(155, 123, 15, 4, ink);
    rect(158, 125, 9, 2, light);
    rect(153, 130, 20, 13, steel);
    rect(156, 132, 14, 7, visor);
    rect(158, 133, 8, 1, beacon);
    rect(158, 135, 11, 1, beacon);
    rect(158, 137, 5, 1, beacon);
    rect(153, 141, 20, 2, light);
    rect(170, 141, 3, 2, gold);
  } finally {
    ctx.restore();
  }
}

export function drawRainforestFailure(ctx: CanvasRenderingContext2D) {
  drawRainforestOpening(ctx);
  const { width, height } = RAINFOREST_SCENE_SIZE;
  const ink = '#101923', steel = '#344a57', pale = '#a8bac0';
  const warning = '#e6a370', dimWarning = '#a45f50';
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  ctx.save();
  try {
    rect(0, 0, width, height, '#14263866');
    rect(208, 29, 3, 6, steel);
    rect(204, 53, 10, 3, '#304751');
    rect(237, 96, 8, 2, '#506775');
    rect(153, 99, 18, 3, '#805c50');
    rect(160, 98, 2, 6, steel);
    rect(198, 97, 17, 3, dimWarning);
    rect(209, 28, 2, 2, warning);
    rect(194, 37, 5, 2, dimWarning);
    rect(186, 31, 3, 2, dimWarning);
    rect(219, 37, 5, 2, dimWarning);
    rect(229, 31, 3, 2, dimWarning);
    rect(201, 24, 4, 2, warning);
    rect(215, 24, 4, 2, warning);

    rect(102, 170, 43, 3, '#23343c');
    rect(111, 149, 8, 11, ink);
    rect(106, 157, 11, 10, ink);
    rect(103, 164, 12, 5, ink);
    rect(109, 157, 5, 7, steel);
    rect(122, 149, 8, 12, ink);
    rect(128, 157, 9, 12, ink);
    rect(128, 165, 12, 5, ink);
    rect(130, 158, 4, 7, steel);

    rect(125, 130, 14, 21, ink);
    rect(130, 133, 6, 15, steel);
    rect(133, 135, 2, 5, dimWarning);
    rect(108, 128, 22, 25, ink);
    rect(111, 131, 15, 17, steel);
    rect(112, 132, 10, 11, pale);
    rect(110, 143, 12, 5, steel);

    rect(104, 114, 19, 17, ink);
    rect(107, 111, 13, 3, ink);
    rect(108, 114, 11, 3, pale);
    rect(106, 117, 15, 9, pale);
    rect(105, 117, 10, 6, '#293f50');
    rect(106, 119, 6, 2, warning);
    rect(112, 126, 9, 3, steel);

    rect(101, 132, 11, 8, ink);
    rect(99, 138, 8, 8, ink);
    rect(103, 133, 7, 5, pale);
    rect(100, 140, 6, 4, steel);
    rect(124, 139, 8, 10, ink);
    rect(128, 146, 7, 5, ink);
    rect(126, 140, 4, 7, pale);
  } finally {
    ctx.restore();
  }
}
