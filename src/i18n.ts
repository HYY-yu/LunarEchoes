import { ARMOR_RULES, type Upgrade } from './core.js';
export type Language = 'zh' | 'en';
const zh = {
  stageNames: { 'desert-base': '沙漠基地', rainforest: '雨林深处', antarctica: '寒冻南极', 'space-elevator': '太空电梯', watchtower: '保卫哨塔', 'lunar-echoes': '月面回响' },
  campaignStages: '选择任务', backToTitle: '返回标题', backToStages: '返回选关', stageLocked: '未解锁',
  progressHeading: '本机解锁进度', progressPlayable: '已解锁', progressUnavailable: '已解锁，暂不可游玩',
  progressSaved: '进度已保存。', progressTemporary: '本次仅临时游玩，无法保存进度。', progressNotSaved: '本次进度未保存，刷新后可能丢失。',
  progressUncertain: '无法确认本次进度是否保存，刷新后可能丢失。', progressResetDone: '本机进度已重置。',
  progressResetFailed: '未能重置本机进度。本次进度仍保留。', progressResetUncertain: '无法确认重置结果。本次进度仍保留，本机存档可能已改变。',
  progressInvalid: '本机存档无效，原始内容已保留。', progressUnknown: '无法识别本机存档的版本，原始内容已保留。',
  progressReset: '重置本机进度', progressResetWarning: '重置后将从沙漠基地开始，原有解锁会被清除。', progressCancelWarning: '也可以临时游玩，本次无法保存进度。',
  progressResetConfirm: '确认重置', progressCancel: '取消', progressPlayTemporary: '临时游玩',
  radio: '无线电', closeRadio: '关闭', closeRadioLabel: '关闭无线电', disableRadio: '关闭本局无线电', radioDisabled: '本局无线电已关闭', radioReset: '新任务恢复无线电。',
  opening: '失联的基地', missionObjective: '任务目标', deploy: '部署出发', skipOpening: '跳过开场', openingArt: '沙丘中的破损机库与雷达阵列', defeatArt: '夜色中的沙漠基地，雷达旁的信号已中断', victoryArt: '沙漠基地的雷达向夜空发出信号，收割者已被击败', battlefield: '沙漠基地战斗', pendingContent: '后续剧情与战役待接入', replayVersion: '无法播放，回放版本不兼容。进度未改变。', replayStage: '无法播放，回放关卡不可用。进度未改变。', replayRules: '无法播放，关卡规则版本不兼容。进度未改变。', replayInvalid: '无法播放，回放数据无效。进度未改变。',
  report: '任务报告 / MISSION REPORT', name: '月面回响', subtitle: '沙漠基地开场与战斗测试。后续剧情与战役待接入。', mission: '沙漠基地 · 战斗测试', start: '启动任务', replay: '回放上一局', replaying: '回放中', pause: '暂停', resume: '继续任务', restart: '重新部署', home: '返回基地', muted: '声音关', sound: '声音开', lang: 'EN', time: '信号同步', health: '装甲', level: '等级', kills: '击破', dash: '冲刺', ready: '就绪', upgrading: '选择技术升级', upgradeHint: '战斗已暂停。选择一个模块继续任务。', won: '信号已送达', lost: '信号中断', wonBody: '战斗测试完成。后续剧情与战役待接入。', lostBody: '本局录制保留在内存中，可回放或重新部署。', paused: '任务已暂停', controls: 'WASD / 方向键移动 · 空格冲刺 · P 暂停', touch: '左侧拖动移动 · 右侧冲刺', brief: '自动开火。收集能源，升级装备。坚持 3 分钟并击败收割者。', seed: '任务种子', boss: '收割者抵达', error: '系统异常，请刷新重试。', replayDone: '回放结束', replayVerified: '回放校验一致', replayFailed: '回放校验失败。进度未改变。', noReplay: '完成一次任务即可回放', select: '装配模块', warning: '最终信号窗口开启', brand: 'LUNAR / RELAY', prototype: '沙漠开场与战斗测试', objective: '生存 03:00 · 击败收割者', recovered: '采集能源', replayEnd: '已到达录制终点', pausedHint: '战斗已暂停。准备好后继续。'
};
const en: typeof zh = {
  stageNames: { 'desert-base': 'Desert Base', rainforest: 'Deep Rainforest', antarctica: 'Frozen Antarctica', 'space-elevator': 'Space Elevator', watchtower: 'Watchtower Defense', 'lunar-echoes': 'Lunar Echoes' },
  campaignStages: 'Select mission', backToTitle: 'Back to title', backToStages: 'Back to missions', stageLocked: 'Locked',
  progressHeading: 'Local unlock progress', progressPlayable: 'Unlocked', progressUnavailable: 'Unlocked, not yet playable',
  progressSaved: 'Progress saved.', progressTemporary: 'You can play this session. Progress cannot be saved.', progressNotSaved: 'Progress was not saved and may be lost on reload.',
  progressUncertain: 'Saving could not be confirmed. Progress may be lost on reload.', progressResetDone: 'Local progress reset.',
  progressResetFailed: 'Could not reset local progress. Your progress for this session was kept.', progressResetUncertain: 'Reset could not be confirmed. Your progress for this session was kept. The local save may have changed.',
  progressInvalid: 'The local save is invalid. Its original contents are intact.', progressUnknown: 'The local save uses an unknown version. Its original contents are intact.',
  progressReset: 'Reset local progress', progressResetWarning: 'Resetting clears unlocks and returns progress to Desert Base.', progressCancelWarning: 'You can also play without saving progress this session.',
  progressResetConfirm: 'Confirm reset', progressCancel: 'Cancel', progressPlayTemporary: 'Play without saving',
  radio: 'Radio', closeRadio: 'Close', closeRadioLabel: 'Close radio', disableRadio: 'Disable radio this run', radioDisabled: 'Radio disabled this run', radioReset: 'Radio resets on a new run.',
  opening: 'A silent base', missionObjective: 'Mission objective', deploy: 'Deploy', skipOpening: 'Skip opening', openingArt: 'A damaged hangar and radar array among desert dunes', defeatArt: 'The desert base at night with the radar signal lost', victoryArt: 'The desert base radar sends a signal into the night after the Harvester is defeated', battlefield: 'Desert base combat', pendingContent: 'Later story and campaign pending', replayVersion: 'Cannot play this replay. Its version is incompatible. Progress is unchanged.', replayStage: 'Cannot play this replay. Its stage is unavailable. Progress is unchanged.', replayRules: 'Cannot play this replay. Its stage rules are incompatible. Progress is unchanged.', replayInvalid: 'Cannot play this replay. Its data is invalid. Progress is unchanged.',
  report: 'MISSION REPORT', name: 'Lunar Relay', subtitle: 'Desert opening and combat test. Later story and campaign are pending.', mission: 'DESERT BASE · COMBAT TEST', start: 'Begin mission', replay: 'Replay last run', replaying: 'Replay', pause: 'Pause', resume: 'Resume mission', restart: 'Redeploy', home: 'Return to base', muted: 'Sound off', sound: 'Sound on', lang: '中文', time: 'Signal sync', health: 'Armor', level: 'Level', kills: 'Kills', dash: 'Dash', ready: 'Ready', upgrading: 'Choose an upgrade', upgradeHint: 'Combat paused. Equip one module to continue.', won: 'Signal delivered', lost: 'Signal lost', wonBody: 'Combat test complete. Later story and campaign are pending.', lostBody: 'This run stays in memory. Replay it or redeploy.', paused: 'Mission paused', controls: 'WASD / Arrows to move · Space to dash · P to pause', touch: 'Drag left to move · Tap right to dash', brief: 'Weapons fire automatically. Collect energy and upgrade. Survive 3 minutes and defeat the Harvester.', seed: 'Mission seed', boss: 'Harvester incoming', error: 'System error. Refresh to retry.', replayDone: 'Replay complete', replayVerified: 'Replay checksum matched', replayFailed: 'Replay verification failed. Progress is unchanged.', noReplay: 'Finish a mission to unlock replay', select: 'Equip module', warning: 'Final signal window open', brand: 'LUNAR / RELAY', prototype: 'DESERT OPENING AND COMBAT TEST', objective: 'SURVIVE 03:00 · DEFEAT THE HARVESTER', recovered: 'Energy recovered', replayEnd: 'End of recording reached', pausedHint: 'Combat is paused. Resume when ready.'
};
export function dictionary(lang: Language) { return lang === 'zh' ? zh : en; }
const upgradeText: Record<Upgrade, { zh: [string, string]; en: [string, string]; icon: string }> = {
  pulse: { zh: ['脉冲步枪', '伤害与射速提升。高等级追加弹道。'], en: ['Pulse rifle', 'More damage and faster fire. Extra bolts at higher tiers.'], icon: '↗' },
  orbit: { zh: ['轨道无人机', '环绕机体，持续切割靠近的敌人。'], en: ['Orbital drone', 'An orbiting drone cuts through nearby enemies.'], icon: '◎' },
  nova: { zh: ['电磁新星', '周期性释放范围冲击，清除近身威胁。'], en: ['EMP nova', 'A periodic shockwave clears nearby threats.'], icon: '✳' },
  boots: { zh: ['矢量推进器', '移动速度提升，更轻松穿过敌群。'], en: ['Vector thrusters', 'Move faster and slip between enemy formations.'], icon: '»' },
  hull: { zh: ['复合装甲', `装甲上限增加 ${ARMOR_RULES.hullCapacityCells} 格，立即修复最多 ${ARMOR_RULES.hullRepairCells} 格。`], en: ['Composite armor', `Add ${ARMOR_RULES.hullCapacityCells} armor cells to capacity. Repair up to ${ARMOR_RULES.hullRepairCells} cells immediately.`], icon: '◇' },
  magnet: { zh: ['引力采集器', '扩大能源吸引范围，减少回头拾取。'], en: ['Gravity collector', 'Attract energy from a greater distance.'], icon: '⊕' }
};
export function upgradeLabel(id: Upgrade, lang: Language) { return { title: upgradeText[id][lang][0], description: upgradeText[id][lang][1], icon: upgradeText[id].icon }; }
