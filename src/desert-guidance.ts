import type { TowerDirection } from './desert-repair.js';

const directions = {
  north: { zh: '北', en: 'North' }, east: { zh: '东', en: 'East' },
  south: { zh: '南', en: 'South' }, west: { zh: '西', en: 'West' }
} satisfies Record<TowerDirection, { zh: string; en: string }>;

const messages = {
  briefing: { zh: '守住基地。木铁补给到达后，修复四座炮塔。', en: 'Hold the base. Repair all four turrets once wood and iron arrive.' },
  raid: { zh: '炮塔已上线。击退短袭，继续修塔。', en: 'Turret online. Repel the raid and keep repairing.' },
  lateRepair: { zh: '集中修剩下的炮塔。最终敌潮还需要时间清场。', en: 'Finish the remaining repairs. Leave time to clear the final assault.' },
  repaired: { zh: '四座炮塔全部上线。击退短袭，准备迎接最终敌潮。', en: 'All four turrets are online. Repel the raid and prepare for the final assault.' },
  assault: { zh: '最终敌潮到了。清完六批，活下来。', en: 'The final assault has begun. Clear all six waves and survive.' }
};

export type AssaultRadioBeat = keyof typeof messages | TowerDirection;

export function assaultRadio(beat: AssaultRadioBeat) {
  const id = `desert-base.radio.${beat}`;
  if (beat === 'north' || beat === 'east' || beat === 'south' || beat === 'west') {
    const direction = directions[beat];
    return { id, zh: `${direction.zh}侧补给到了。带上木材和铁矿，修复一座炮塔。`,
      en: `${direction.en} supplies are in. Take the wood and iron to repair a turret.` };
  }
  return { id, ...messages[beat] };
}

export const assaultObjective = { id: 'desert-base.objective',
  zh: '修复四座炮塔，击退最终敌潮。保持移动，冲刺躲避攻击。',
  en: 'Repair all four turrets and clear the final assault. Keep moving and dash clear of attacks.' };

export const assaultLabels = {
  zh: { awaiting: '等待补给', supply: '最新补给', preparing: '准备迎接敌潮', waves: '敌潮批次', clear: '清剿剩余敌人', timeout: '未能在时限内完成防守。' },
  en: { awaiting: 'Awaiting supplies', supply: 'Latest supplies', preparing: 'Assault incoming', waves: 'Assault waves', clear: 'Clear remaining enemies', timeout: 'The defense was not completed in time.' }
};

export function supplyDirection(direction: TowerDirection, language: 'zh' | 'en') {
  return directions[direction][language];
}
