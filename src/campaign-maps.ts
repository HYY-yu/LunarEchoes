import { createLunarMap } from './lunar-map.js';
import { drawAntarcticaTerrain } from './antarctica-map.js';
import { drawSpaceElevatorTerrain } from './space-elevator-map.js';
import { drawWatchtowerTerrain } from './watchtower-map.js';

export type CampaignTerrainStage = 'antarctica' | 'space-elevator' | 'watchtower' | 'lunar-echoes';

type View = Readonly<{ left: number; top: number; width: number; height: number }>;

const designSize = 1500;

let drawLunarMap: ReturnType<typeof createLunarMap> | undefined;

export function drawCampaignTerrain(ctx: CanvasRenderingContext2D, view: View, stageId: CampaignTerrainStage, arenaSize: number, tick: number, time = 0): void {
  if (stageId === 'lunar-echoes') {
    drawLunarMap ??= createLunarMap();
    ctx.save();
    drawLunarMap(ctx, view, arenaSize, time);
    ctx.restore();
    return;
  }
  const scale = arenaSize / designSize;
  const mapView = { left: view.left / scale, top: view.top / scale, width: view.width / scale, height: view.height / scale };
  ctx.save();
  ctx.scale(scale, scale);
  switch (stageId) {
    case 'antarctica': drawAntarcticaTerrain(ctx, mapView); break;
    case 'space-elevator': drawSpaceElevatorTerrain(ctx, mapView, tick); break;
    case 'watchtower': drawWatchtowerTerrain(ctx, mapView); break;
  }
  ctx.restore();
}
