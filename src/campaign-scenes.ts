import { createAtlas } from './art.js';
import { drawCampaignTerrain, type CampaignTerrainStage } from './campaign-maps.js';
import { STAGE_ORDER } from './stage-contract.js';

const sceneSize = { width: 320, height: 180 };
const sceneView = {
  antarctica: { x: 750, y: 655, width: 520 },
  'space-elevator': { x: 750, y: 740, width: 526 },
  watchtower: { x: 750, y: 750, width: 750 },
  'lunar-echoes': { x: 780, y: 705, width: 680 }
} satisfies Record<CampaignTerrainStage, { x: number; y: number; width: number }>;

function scene(stageId: CampaignTerrainStage, outcome: 'opening' | 'defeat' | 'victory') {
  return {
    size: sceneSize,
    draw(ctx: CanvasRenderingContext2D) {
      const { x, y, width } = sceneView[stageId];
      const scale = sceneSize.width / width, height = sceneSize.height / scale;
      const left = x - width / 2, top = y - height / 2;
      ctx.save();
      ctx.scale(scale, scale);
      ctx.translate(-left, -top);
      drawCampaignTerrain(ctx, { left, top, width, height }, stageId, 1500, 0);
      ctx.restore();

      ctx.fillStyle = outcome === 'defeat' ? '#22172580' : '#0b142633';
      ctx.fillRect(0, 0, sceneSize.width, sceneSize.height);
      const atlas = createAtlas();
      atlas.draw(ctx, 'astronaut', outcome === 'defeat' ? 72 : 154, 125, 2.1);
      ctx.fillStyle = outcome === 'defeat' ? '#ec8f7c' : '#a4f8e3';
      const signals = outcome === 'victory' ? 3 : 1;
      for (let light = 0; light < signals; light++) {
        ctx.fillRect(236, 51 - light * 8, 12, 2);
        ctx.fillRect(239, 54 - light * 8, 6, 2);
      }
    }
  };
}

export async function loadLaterOpening(stageId: CampaignTerrainStage) {
  const response = await fetch('./campaign-later.story.json');
  if (!response.ok) throw new Error(`Mission story request failed: ${response.status}`);
  const input: unknown = await response.json();
  if (!Array.isArray(input)) throw new Error('Invalid mission story');
  const entries: unknown[] = input;
  const nextStageId = STAGE_ORDER[STAGE_ORDER.indexOf(stageId) + 1];

  function entry(beat: 'opening' | 'objective' | 'defeat' | 'victory' | 'next-clue') {
    const id = `${stageId}.${beat}`;
    const outcome = beat === 'defeat' ? 'lost' : beat === 'victory' || beat === 'next-clue' ? 'won' : 'any';
    const matches = entries.filter(value => value !== null && typeof value === 'object' && 'id' in value && value.id === id);
    const value = matches[0];
    if (matches.length !== 1 || !value || typeof value !== 'object' || !('stageId' in value) || value.stageId !== stageId || !('beat' in value) || value.beat !== beat || !('outcome' in value) || value.outcome !== outcome || !('zh' in value) || typeof value.zh !== 'string' || !value.zh.trim() || !('en' in value) || typeof value.en !== 'string' || !value.en.trim()) throw new Error(`Invalid mission story entry ${id}`);
    if (beat === 'next-clue' && (!('nextStageId' in value) || value.nextStageId !== nextStageId)) throw new Error(`Invalid mission handoff ${id}`);
    return { id, zh: value.zh, en: value.en };
  }

  const opening = entry('opening'), objective = entry('objective');
  const defeat = { story: entry('defeat'), art: scene(stageId, 'defeat') };
  const victory = { story: entry('victory'), nextClue: nextStageId ? entry('next-clue') : null, art: scene(stageId, 'victory') };
  return { opening, objective, ...scene(stageId, 'opening'), fieldMission: { objective, defeat, victory } };
}
