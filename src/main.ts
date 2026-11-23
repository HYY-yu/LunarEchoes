import { DESERT_CONTINUOUS_CONTEXT, hasDesertAssault, hasRelayBase, stageContext, stageRules, SimulationError, type StageContext } from './stage-rules.js';
import { createWorld, dispatch, finalChecksum, finishRecording, startRecording, prepareReplay, verifyReplay, VERSION, HZ, UPGRADE_ORDER, ARMOR_RULES, type World, type Action, type Recording, type ActionBuffer } from './core.js';
import { createRenderer } from './render.js';
import { Synth } from './audio.js';
import { dictionary, upgradeLabel, type Language } from './i18n.js';
import { log } from './logger.js';
import { STAGE_ORDER } from './stage-contract.js';
import { applyStageResult, isStageUnlocked } from './progress.js';
import { openProgressStorage, type ProgressStorageResult } from './progress-storage.js';
import { DESERT_SCENE_SIZE, drawDesertScene } from './desert-scene.js';
import { loadLaterOpening } from './campaign-scenes.js';
import { DESERT_SUPPLY_DIRECTIONS, REPAIR_COST, REPAIR_RADIUS, SUPPLY_CAPACITY, relayObjective } from './desert-repair.js';
import { DESERT_LATE_REPAIR_TICK, FINAL_BATCH_COUNT } from './desert-assault.js';
import { assaultLabels, assaultObjective, assaultRadio, supplyDirection, type AssaultRadioBeat } from './desert-guidance.js';
type Screen = 'title' | 'stages' | 'opening' | 'game' | 'replay' | 'replay-end';
type RadioBeat = 'firstContact' | 'telemetry' | AssaultRadioBeat;
type RadioState = Readonly<{ kind: 'inactive' | 'waiting' | 'disabled' }> | Readonly<{ kind: 'active' | 'dismissed'; beat: RadioBeat }>;
import { ANTARCTIC_BARRAGE, antarcticBarrageVolleyIndex } from './antarctic-barrage.js';
const DESERT_CONTEXT = stageContext('desert-base');
type DesertContent = Readonly<{
  opening: Readonly<{ id: 'desert-base.opening'; zh: string; en: string }>;
  objective: Readonly<{ id: 'desert-base.objective'; zh: string; en: string }>;
  defeat: Readonly<{ id: 'desert-base.defeat'; zh: string; en: string }>;
  victory: Readonly<{ id: 'desert-base.victory'; zh: string; en: string }>;
  firstContact: Readonly<{ id: 'desert-base.radio.first-contact'; zh: string; en: string }>;
  telemetry: Readonly<{ id: 'desert-base.radio.telemetry'; zh: string; en: string }>;
  boss: Readonly<{ id: 'desert-base.boss'; zh: string; en: string }>;
  nextClue: Readonly<{ id: 'desert-base.next-clue'; zh: string; en: string }>;
}>;
function parseDesertContent(input: unknown): DesertContent {
  function entry<Id extends string>(value: unknown, id: Id): Readonly<{ id: Id; zh: string; en: string }> {
    if (!value || typeof value !== 'object' || !('id' in value) || value.id !== id || !('zh' in value) || typeof value.zh !== 'string' || !value.zh.trim() || Object.keys(value).length !== 3 || !('en' in value) || typeof value.en !== 'string' || !value.en.trim()) throw new Error(`Invalid desert content entry ${id}`);
    return Object.freeze({ id, zh: value.zh, en: value.en });
  }
  if (!input || typeof input !== 'object' || !('opening' in input) || !('objective' in input) || !('defeat' in input) || !('victory' in input) || !('nextClue' in input) || !('firstContact' in input) || !('telemetry' in input) || !('boss' in input) || Object.keys(input).length !== 8) throw new Error('Invalid desert content');
  return Object.freeze({ opening: entry(input.opening, 'desert-base.opening'), objective: entry(input.objective, 'desert-base.objective'), defeat: entry(input.defeat, 'desert-base.defeat'), victory: entry(input.victory, 'desert-base.victory'), nextClue: entry(input.nextClue, 'desert-base.next-clue'), firstContact: entry(input.firstContact, 'desert-base.radio.first-contact'), telemetry: entry(input.telemetry, 'desert-base.radio.telemetry'), boss: entry(input.boss, 'desert-base.boss') });
}
function element(id: string): HTMLElement { const node = document.getElementById(id); if (!node) throw new Error(`Missing element ${id}`); return node; }
const canvasNode = element('game');
if (!(canvasNode instanceof HTMLCanvasElement)) throw new Error('Game canvas is unavailable');
const render = createRenderer(canvasNode), synth = new Synth();
const overlay = element('overlay'), hud = element('hud'), touch = element('touch');
let language: Language = 'zh';
const progressStorage = openProgressStorage({
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value)
});
let resetRequested = false;
let world: World = createWorld({ ...DESERT_CONTEXT, seed: 208907 });
let screen: Screen = 'title';
type OpeningSource = 'title' | 'stages' | 'victory';
type StoryEntry = Readonly<{ id: string; zh: string; en: string }>;
type StoryArt = Readonly<{
  size: Readonly<{ width: number; height: number }>;
  draw: (context: CanvasRenderingContext2D) => void;
}>;
type ResultContent = Readonly<{ story: StoryEntry | null; art: StoryArt }>;
type VictoryContent = ResultContent & Readonly<{ nextClue: StoryEntry | null }>;
type FieldMission = Readonly<{ objective: StoryEntry; defeat: ResultContent; victory: VictoryContent }>;
type OpeningContent = StoryArt & Readonly<{
  opening: StoryEntry;
  objective: StoryEntry;
  fieldMission?: FieldMission;
}>;
let opening: { context: StageContext; source: OpeningSource; content: OpeningContent } | null = null;
let openingRequest: symbol | null = null;
let fieldMission: FieldMission | null = null;
let desertContent: DesertContent | null = null;
let radioState: RadioState = { kind: 'inactive' };
const radio = document.createElement('aside'); radio.id = 'radio'; radio.hidden = true;
const radioMessage = document.createElement('div'); radioMessage.setAttribute('role', 'status'); radioMessage.setAttribute('aria-live', 'polite');
const radioLabel = document.createElement('span'); radioLabel.id = 'radio-label';
const radioStory = document.createElement('p'); radioStory.id = 'radio-story';
const radioClose = document.createElement('button'); radioClose.id = 'radio-close'; radioClose.type = 'button';
radioMessage.append(radioLabel, radioStory); radio.append(radioMessage, radioClose); document.body.append(radio);
let recording: ActionBuffer = startRecording(world);
let lastRecording: Recording | null = null;
let playingRecording: Recording | null = null;
let replayVerified = false;
let replayIndex = 0;
let accumulator = 0, lastFrame = 0, lastUi = '', noticeTimer = 0;
let noticeEndsWithBoss = false;
const armorNode = element('armor-cells');
const armorSpans: HTMLSpanElement[] = [];
let lastArmorCurrent = -1, lastArmorMaximum = -1, lastArmorLanguage: Language | null = null;
const keys = new Set<string>();
let stickX = 0, stickY = 0, dashPressed = false;
let stickPointer: number | null = null;
const coarse = matchMedia('(pointer: coarse)').matches;
function text() { return dictionary(language); }
function logProgressResult(result: ProgressStorageResult) {
  if (result.kind === 'recovery_required') log('warn', 'progress.recovery_required', { phase: result.phase, reason: result.reason });
  if (result.kind === 'not_saved' || result.kind === 'uncertain') {
    log('error', 'progress.storage_failed', { phase: result.phase, reason: result.kind === 'uncertain' ? result.reason : 'storage_error' });
  }
  if (result.kind === 'saved' || result.kind === 'reset') log('info', `progress.${result.kind}`, { stageId: progressStorage.snapshot().progress.highestUnlockedStageId });
}
function saveVictory() {
  const transition = applyStageResult({ progress: progressStorage.snapshot().progress, stageId: world.context.stageId, source: 'live', outcome: 'won' });
  if (transition.kind !== 'advanced') return;
  log('info', 'progress.unlocked', { stageId: transition.progress.highestUnlockedStageId });
  const { result } = progressStorage.saveAdvanced(transition);
  logProgressResult(result);
}
function progressFeedback() {
  const t = text(), { result, protection } = progressStorage.snapshot();
  const temporary = protection.kind === 'protected' ? t.progressTemporary : '';
  const withProtection = (message: string) => temporary ? `${message} ${temporary}` : message;
  switch (result.kind) {
    case 'saved': return t.progressSaved;
    case 'reset': return t.progressResetDone;
    case 'not_saved':
      if (result.phase === 'reset_read' || result.phase === 'reset_write') return withProtection(t.progressResetFailed);
      return result.phase === 'load' ? temporary : withProtection(t.progressNotSaved);
    case 'uncertain': return withProtection(result.phase === 'reset_verify' ? t.progressResetUncertain : t.progressUncertain);
    default: return temporary;
  }
}
function renderProgress(elementId: string) {
  const t = text(), { progress } = progressStorage.snapshot();
  const stage = t.stageNames[progress.highestUnlockedStageId];
  element(elementId).textContent = [`${t.progressHeading} · ${stage} · ${t.progressPlayable}`, progressFeedback()].filter(Boolean).join(' ');
}
function resolveProgressReset(decision: 'confirmed' | 'cancelled') {
  const { result } = progressStorage.reset(decision);
  resetRequested = false;
  logProgressResult(result);
  updateUi(true);
  document.getElementById(screen === 'title' ? 'mission-start' : 'victory-retry')?.focus({ preventScroll: true });
}
function renderProgressReset() {
  const t = text(), { result } = progressStorage.snapshot();
  const reason = result.kind === 'recovery_required' ? result.reason === 'unknown_version' ? t.progressUnknown : t.progressInvalid : '';
  if (!document.getElementById('progress-reset-panel')) {
    overlay.replaceChildren();
    const section = panel('', ''); section.id = 'progress-reset-panel';
    section.setAttribute('role', 'dialog'); section.setAttribute('aria-labelledby', 'progress-reset-heading');
    section.children[1].id = 'progress-reset-heading';
    const actions = document.createElement('div'); actions.className = 'actions';
    const cancel = button('', 'secondary', () => resolveProgressReset('cancelled')); cancel.id = 'progress-reset-cancel';
    const confirm = button('', 'primary', () => resolveProgressReset('confirmed')); confirm.id = 'progress-reset-confirm';
    actions.append(cancel, confirm); section.append(actions); cancel.focus({ preventScroll: true });
  }
  const section = element('progress-reset-panel');
  section.children[0].textContent = t.progressHeading;
  section.children[1].textContent = t.progressReset;
  section.children[2].textContent = [reason, t.progressResetWarning, reason ? t.progressCancelWarning : ''].filter(Boolean).join(' ');
  element('progress-reset-cancel').textContent = reason ? t.progressPlayTemporary : t.progressCancel;
  element('progress-reset-confirm').textContent = t.progressResetConfirm;
}
function clearNotice() {
  window.clearTimeout(noticeTimer);
  noticeTimer = 0;
  noticeEndsWithBoss = false;
  const node = element('notice');
  node.classList.remove('visible');
  node.classList.remove('boss-notice');
  node.textContent = '';
}
function notify(message: string, kind: 'general' | 'boss' = 'general') {
  clearNotice();
  const node = element('notice');
  node.textContent = message;
  node.classList.toggle('boss-notice', kind === 'boss');
  node.classList.add('visible');
  noticeTimer = window.setTimeout(clearNotice, 3500);
}
function fail(error: unknown) { log('error', 'runtime.failure', { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : '', seed: world.seed, tick: world.tick }); notify(text().error); }
async function enableAudio(confirm = false) { try { return await synth.activate(confirm ? 'ui-confirm' : undefined); } catch (error) { log('error', 'audio.activation_failed', { error: String(error) }); notify(language === 'zh' ? '音频启动失败，游戏可继续。' : 'Audio unavailable. You can keep playing.'); return false; } }
function radioEntry(beat: RadioBeat) {
  return beat === 'firstContact' || beat === 'telemetry' ? desertContent?.[beat] : assaultRadio(beat);
}
function setRadio(next: RadioState, reason: string) {
  if (radioState.kind === next.kind && (!('beat' in radioState) || ('beat' in next && radioState.beat === next.beat))) return;
  if (radioState.kind === 'active') log('info', 'story.radio.ended', { id: radioEntry(radioState.beat)?.id, seed: world.seed, tick: world.tick, reason });
  radioState = next;
  if (next.kind === 'active') log('info', 'story.radio.started', { id: radioEntry(next.beat)?.id, seed: world.seed, tick: world.tick });
}
function updateRadio() {
  const visible = radioState.kind === 'active' && screen === 'game' && world.phase.kind === 'running' && !document.hidden;
  if (!visible && document.activeElement === radioClose) canvasNode.focus({ preventScroll: true });
  if (radio.hidden === visible) radio.hidden = !visible;
  radio.classList.toggle('assault-radio', !!world.desertAssault);
  const t = text(), entry = radioState.kind === 'active' ? radioEntry(radioState.beat) : null, story = entry ? entry[language] : '';
  if (radioStory.textContent !== story) radioStory.textContent = story;
  if (entry && radioStory.dataset.storyId !== entry.id) radioStory.dataset.storyId = entry.id;
  if (radioLabel.textContent !== t.radio) radioLabel.textContent = t.radio;
  if (radioClose.textContent !== t.closeRadio) radioClose.textContent = t.closeRadio;
  if (radioClose.getAttribute('aria-label') !== t.closeRadioLabel) radioClose.setAttribute('aria-label', t.closeRadioLabel);
  const disable = document.getElementById('radio-disable');
  if (disable instanceof HTMLButtonElement) {
    const label = radioState.kind === 'disabled' ? t.radioDisabled : t.disableRadio;
    if (disable.textContent !== label) disable.textContent = label;
    if (disable.disabled !== (radioState.kind === 'disabled')) disable.disabled = radioState.kind === 'disabled';
  }
  const reset = document.getElementById('radio-reset'); if (reset && reset.textContent !== t.radioReset) reset.textContent = t.radioReset;
}
radioClose.onclick = () => { try { if (radioState.kind === 'active') { setRadio({ kind: 'dismissed', beat: radioState.beat }, 'dismissed'); updateRadio(); } } catch (error) { fail(error); } };
function act(action: Action, record = true) {
  if (record && screen === 'game') recording.actions.push(action);
  const before = world.phase.kind;
  const tickBefore = world.tick;
  const nextEnemyId = world.nextId;
  const deliveriesBefore = (world.desertAssault ?? world.campaignRelay)?.deliveries;
  const finalBefore = world.desertAssault?.final.kind;
  const bossKilledBefore = world.bossKilled;
  const armoredBoss = screen === 'game' && world.context.stageId === 'space-elevator' && world.bossSpawned && !world.bossKilled
    ? world.enemies.find(enemy => enemy.armor?.kind === 'active')
    : undefined;
  const repair = world.desertRepair;
  const towersBefore = repair && 'towers' in repair ? repair.towers : undefined;
  const towerBefore = repair && 'tower' in repair ? repair.tower : undefined;
  dispatch(world, action);
  if (action.kind !== 'tick') log('info', `session.${action.kind}`, { seed: world.seed, tick: world.tick, phase: world.phase.kind });
  if (screen === 'game') {
    const armor = armoredBoss?.armor;
    if (armoredBoss && armor?.kind === 'spent' && armor.atTick === world.tick && world.tick !== tickBefore) {
      log('info', 'session.boss_armor_ended', { ...world.context, seed: world.seed, tick: world.tick, bossId: armoredBoss.id, reason: armor.reason });
    }
    const brood = world.rainforestBrood;
    if (world.tick !== tickBefore && brood?.tick === world.tick) {
      log('info', 'session.brood_released', { ...world.context, seed: world.seed, ...brood });
    }
    const barrage = world.antarcticBarrage;
    if (barrage && world.tick !== tickBefore && world.phase.kind !== 'lost') {
      const fields = { ...world.context, seed: world.seed, tick: world.tick, ...barrage };
      if (world.tick === barrage.firstVolleyTick - ANTARCTIC_BARRAGE.warningTicks) log('info', 'session.barrage_started', fields);
      const volley = antarcticBarrageVolleyIndex(barrage, world.tick);
      if (volley >= 0) log('info', 'session.barrage_volley', { ...fields, volley, shots: ANTARCTIC_BARRAGE.count });
    }
    if (world.nextId !== nextEnemyId) {
      const rules = stageRules(world.context);
      const reinforcement = rules.kind === 'campaign' ? rules.reinforcement : undefined;
      if (reinforcement) {
        const enemy = world.enemies.find(enemy => enemy.kind === reinforcement.kind && enemy.id >= nextEnemyId);
        if (enemy) log('debug', `session.${enemy.kind.replaceAll('-', '_')}_spawned`, { ...world.context, seed: world.seed, tick: world.tick, enemyId: enemy.id });
      }
    }
    if (world.tick !== tickBefore) {
      for (const motion of world.materialMotions ?? []) {
        if (motion.kind !== 'pickup' || motion.tick !== world.tick) continue;
        log('debug', 'session.material_picked_up', { ...world.context, seed: world.seed, tick: motion.tick,
          material: motion.material, ...motion.source });
      }
    }
    const assault = world.desertAssault;
    if (repair && 'towers' in repair && towersBefore !== repair.towers) {
      for (const [index, tower] of repair.towers.entries()) {
        if (towersBefore?.[index]?.kind === 'damaged' && tower.kind === 'repaired') {
          log('info', 'session.turret_repaired', { ...world.context, seed: world.seed, tick: world.tick, direction: tower.direction, ...repair.inventory });
        }
      }
    } else if (towerBefore?.kind === 'damaged' && repair && 'tower' in repair && repair.tower.kind === 'repaired') {
      log('info', 'session.turret_repaired', { ...world.context, seed: world.seed, tick: world.tick, ...repair.inventory });
    }
    const deliveries = (assault ?? world.campaignRelay)?.deliveries;
    if (deliveries !== undefined && deliveries !== deliveriesBefore) {
      const drop = hasRelayBase(world.context) ? repair?.supplies.slice(-SUPPLY_CAPACITY) : undefined;
      log('info', 'session.supplies_delivered', { ...world.context, seed: world.seed, tick: world.tick,
        direction: DESERT_SUPPLY_DIRECTIONS[deliveries - 1], ...(drop && { drop, playerX: world.player.x, playerY: world.player.y }) });
    }
    const continuousFinal = assault && 'mode' in assault && assault.final.kind === 'active' ? assault.final : undefined;
    const reinforcementsStopped = continuousFinal && tickBefore < continuousFinal.reinforcementEnd && world.tick >= continuousFinal.reinforcementEnd;
    if (reinforcementsStopped) log('info', 'session.assault_reinforcements_stopped', { ...world.context, seed: world.seed, tick: world.tick });
    if (world.phase.kind === 'won' || world.phase.kind === 'lost') setRadio({ kind: 'inactive' }, 'terminal');
    else if (assault) {
      const { deliveries, final } = assault;
      const repairedTower = repair && 'towers' in repair && towersBefore !== repair.towers;
      const finalStarted = final.kind === 'active' && finalBefore !== 'active';
      const clearing = continuousFinal && world.bossKilled && world.tick >= continuousFinal.reinforcementEnd
        && (!bossKilledBefore || reinforcementsStopped);
      const beat = finalStarted ? ('mode' in assault ? 'surge' : 'assault')
        : clearing ? 'clearAssault'
        : repairedTower && final.kind === 'scheduled' ? 'repaired'
        : final.kind === 'waiting' && world.tick !== tickBefore && world.tick === DESERT_LATE_REPAIR_TICK ? 'lateRepair'
        : repairedTower ? 'raid'
        : deliveries !== deliveriesBefore ? DESERT_SUPPLY_DIRECTIONS[deliveries - 1] : undefined;
      if (finalStarted) log('info', 'session.final_assault_started', { ...world.context, seed: world.seed, tick: world.tick });
      if (beat && radioState.kind !== 'disabled') setRadio({ kind: 'active', beat }, beat);
    } else if (radioState.kind === 'waiting' && world.events.includes('kill')) setRadio({ kind: 'active', beat: 'firstContact' }, 'first-kill');
    else if (radioState.kind === 'dismissed' && radioState.beat === 'firstContact' && world.phase.kind === 'running' && !document.hidden && world.tick >= stageRules(world.context).durationTicks / 2) setRadio({ kind: 'active', beat: 'telemetry' }, 'midpoint');
  }
  updateRadio();
  if (world.events.includes('boss')) {
    const boss = screen === 'game' ? world.enemies.find(enemy => enemy.armor) : undefined;
    if (boss?.armor?.kind === 'active') {
      log('info', 'session.boss_armor_started', { ...world.context, seed: world.seed, tick: world.tick,
        bossId: boss.id, capacity: boss.armor.remaining, expiresAt: boss.armor.expiresAt });
    }
    if (world.context.stageId === 'rainforest') notify(text().rainforestBoss, 'boss');
    else if (world.context.stageId !== 'desert-base') notify(text().campaignBoss[world.context.stageId], 'boss');
    else if (screen === 'game') {
      if (!desertContent) throw new Error('Desert content unavailable');
      notify(desertContent.boss[language], 'boss');
    } else notify(text().boss);
    noticeEndsWithBoss = world.context === DESERT_CONTINUOUS_CONTEXT;
  }
  if (noticeEndsWithBoss && !bossKilledBefore && world.bossKilled) clearNotice();
  if (before !== world.phase.kind) {
    log('info', 'session.phase', { seed: world.seed, tick: world.tick, before, phase: world.phase.kind });
    if (screen === 'game' && (world.phase.kind === 'won' || world.phase.kind === 'lost')) {
      lastRecording = finishRecording(world, recording.actions);
      if (world.phase.kind === 'won') saveVictory();
      log('info', 'session.finished', { seed: world.seed, tick: world.tick, outcome: world.phase.kind, checksum: lastRecording.finalChecksum, ...world.context, kills: world.kills });
    }
    updateUi(true);
  }
  synth.events(world.events);
  if (action.kind === 'choose' && before === 'upgrading') synth.play(world.events.includes('upgrade') ? 'ui-confirm' : 'ui-reject');
}
function clearCombatInput() {
  keys.clear(); stickX = 0; stickY = 0; dashPressed = false; accumulator = 0; lastFrame = 0;
  if (stickPointer !== null && joystick.hasPointerCapture(stickPointer)) joystick.releasePointerCapture(stickPointer);
  stickPointer = null; stick.style.transform = '';
}
function showStages() {
  openingRequest = null; opening = null; screen = 'stages'; updateUi(true); element('stages-heading').focus({ preventScroll: true });
}
function closeStages() {
  openingRequest = null; showTitle(); element('mission-select').focus({ preventScroll: true });
}
async function loadRainforestOpening(): Promise<OpeningContent> {
  const [response, art] = await Promise.all([fetch('./rainforest.story.json'), import('./rainforest-story-art.js')]);
  if (!response.ok) throw new Error(`Rainforest story request failed: ${response.status}`);
  const input: unknown = await response.json();
  if (!Array.isArray(input)) throw new Error('Invalid rainforest story');
  const entries: unknown[] = input;
  function entry(beat: 'opening' | 'objective' | 'defeat' | 'victory' | 'next-clue'): StoryEntry {
    const outcome = beat === 'defeat' ? 'lost' : beat === 'victory' || beat === 'next-clue' ? 'won' : 'any';
    const id = `rainforest.${beat}`;
    const matches = entries.filter(value => value !== null && typeof value === 'object' && 'id' in value && value.id === id);
    const value = matches[0];
    if (matches.length !== 1 || !value || typeof value !== 'object' || !('stageId' in value) || value.stageId !== 'rainforest' || !('beat' in value) || value.beat !== beat || !('outcome' in value) || value.outcome !== outcome || !('zh' in value) || typeof value.zh !== 'string' || !value.zh.trim() || !('en' in value) || typeof value.en !== 'string' || !value.en.trim()) throw new Error(`Invalid rainforest story entry ${id}`);
    if (beat === 'next-clue' && (!('nextStageId' in value) || value.nextStageId !== 'antarctica')) throw new Error(`Invalid rainforest handoff ${id}`);
    return { id, zh: value.zh, en: value.en };
  }
  function optionalResultEntry(beat: 'defeat' | 'victory' | 'next-clue') {
    try { return entry(beat); }
    catch (error) {
      log('warn', beat === 'defeat' ? 'story.defeat.content_unavailable' : 'story.victory.content_unavailable', { stageId: 'rainforest', beat, error: String(error) });
      return null;
    }
  }
  const opening = entry('opening'), objective = entry('objective');
  const size = art.RAINFOREST_SCENE_SIZE;
  const defeat = { story: optionalResultEntry('defeat'), art: { size, draw: art.drawRainforestFailure } };
  const victory = { story: optionalResultEntry('victory'), nextClue: optionalResultEntry('next-clue'), art: { size, draw: art.drawRainforestVictory } };
  return { opening, objective, size, draw: art.drawRainforestOpening, fieldMission: { objective, defeat, victory } };
}
function showOpening(context: StageContext, source: OpeningSource = 'title') {
  openingRequest = null;
  if (context.stageId === 'desert-base') {
    if (!desertContent) throw new Error('Desert content unavailable');
    presentOpening(context, source, { opening: desertContent.opening, objective: hasDesertAssault(context) ? assaultObjective : desertContent.objective, size: DESERT_SCENE_SIZE, draw: canvas => drawDesertScene(canvas, 'opening') });
    return;
  }
  const request = Symbol(), previousScreen = screen;
  openingRequest = request;
  const contentRequest = context.stageId === 'rainforest' ? loadRainforestOpening() : loadLaterOpening(context.stageId);
  return contentRequest.then(content => {
    if (openingRequest === request && screen === previousScreen) presentOpening(context, source, content);
  }).catch(error => {
    if (openingRequest !== request || screen !== previousScreen) return;
    log('error', 'story.opening.load_failed', { stageId: context.stageId, error: String(error) });
    notify(context.stageId === 'rainforest' ? text().rainforestOpeningUnavailable : text().campaignOpeningUnavailable);
  }).finally(() => {
    if (openingRequest === request) openingRequest = null;
  });
}
function presentOpening(context: StageContext, source: OpeningSource, content: OpeningContent) {
  if (screen === 'opening') overlay.replaceChildren();
  opening = { context, source, content }; screen = 'opening'; clearCombatInput(); updateUi(true); element('opening-continue').focus();
  log('info', 'story.opening.started', { id: content.opening.id });
}
function finishOpening() {
  if (screen !== 'opening' || !opening) return;
  log('info', 'story.opening.finished', { id: opening.content.opening.id, reason: 'continue' }); begin(opening.context, opening.content.fieldMission ?? null);
}
function begin(context: StageContext, mission = context.stageId === world.context.stageId ? fieldMission : null) {
  if (!desertContent) throw new Error('Desert content unavailable');
  const seedArray = new Uint32Array(1); crypto.getRandomValues(seedArray);
  const nextWorld = createWorld({ ...context, seed: seedArray[0] });
  synth.reset(); world = nextWorld; opening = null; fieldMission = mission; recording = startRecording(world); playingRecording = null; screen = 'game'; setRadio(nextWorld.desertAssault ? { kind: 'active', beat: 'briefing' } : { kind: context.stageId === DESERT_CONTEXT.stageId ? 'waiting' : 'inactive' }, 'begin'); clearCombatInput(); clearNotice();
  log('info', 'session.started', { seed: world.seed, version: VERSION, ...world.context }); updateUi(true); void enableAudio();
  canvasNode.focus();
}
function replayFailure(error: unknown) {
  if (!(error instanceof SimulationError)) { fail(error); return; }
  const code = error.code;
  const terminal = code === 'checksum-mismatch' || code === 'nonterminal-replay' || code === 'incomplete-replay';
  log(terminal ? 'error' : 'warn', 'replay.rejected', { code, version: VERSION, ...world.context, seed: world.seed, actions: playingRecording?.actions.length ?? lastRecording?.actions.length ?? 0, expected: playingRecording?.finalChecksum, actual: terminal ? finalChecksum(world) : undefined });
  const t = text();
  notify(code === 'incompatible-version' ? t.replayVersion : code === 'unavailable-stage' ? t.replayStage : code === 'incompatible-rules' ? t.replayRules : terminal ? t.replayFailed : t.replayInvalid);
}
export function startReplay() {
  if (!lastRecording) return;
  try {
    const next = prepareReplay(lastRecording);
    synth.reset(); world = next.world; playingRecording = next.recording; replayIndex = 0; replayVerified = false; screen = 'replay'; setRadio({ kind: 'inactive' }, 'replay'); clearCombatInput(); clearNotice();
    log('info', 'replay.started', { version: VERSION, ...world.context, seed: world.seed, actions: playingRecording.actions.length }); updateUi(true); void enableAudio();
  } catch (error) { replayFailure(error); }
}
function showTitle() { openingRequest = null; opening = null; screen = 'title'; playingRecording = null; fieldMission = null; world = createWorld({ ...DESERT_CONTEXT, seed: 208907 }); clearCombatInput(); synth.reset(); setRadio({ kind: 'inactive' }, 'home'); clearNotice(); updateUi(true); void enableAudio(); }
function pause() {
  if (screen !== 'game') return;
  if (world.phase.kind === 'running') act({ kind: 'pause' }); else if (world.phase.kind === 'paused') { act({ kind: 'resume' }); void enableAudio(); }
  clearCombatInput();
}
function button(label: string, className: string, handler: () => void): HTMLButtonElement { const node = document.createElement('button'); node.textContent = label; node.className = className; node.onclick = () => { try { handler(); void enableAudio(true); } catch (error) { fail(error); } }; return node; }
function panel(title: string, subtitle: string): HTMLElement {
  const section = document.createElement('section'); section.className = 'modal result';
  const eyebrow = document.createElement('div'); eyebrow.className = 'eyebrow'; eyebrow.textContent = world.phase.kind === 'won' || world.phase.kind === 'lost' ? text().report : text().mission;
  const heading = document.createElement('h2'); heading.textContent = title;
  const description = document.createElement('p'); description.textContent = subtitle;
  section.append(eyebrow, heading, description); overlay.append(section); return section;
}
function formatTime(ticks: number) { const seconds = Math.floor(ticks / HZ); return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`; }
function updateArmor() {
  const current = world.player.hp / ARMOR_RULES.hpPerCell, maximum = world.player.maxHp / ARMOR_RULES.hpPerCell;
  if (current === lastArmorCurrent && maximum === lastArmorMaximum && language === lastArmorLanguage) return;
  while (armorSpans.length > maximum) armorSpans.pop()?.remove();
  while (armorSpans.length < maximum) {
    const cell = document.createElement('span'); cell.className = 'armor-cell'; cell.setAttribute('aria-hidden', 'true');
    armorSpans.push(cell); armorNode.append(cell);
  }
  for (const [index, cell] of armorSpans.entries()) cell.classList.toggle('filled', index < current);
  armorNode.setAttribute('aria-valuenow', String(current)); armorNode.setAttribute('aria-valuemax', String(maximum));
  armorNode.setAttribute('aria-valuetext', language === 'zh' ? `剩余 ${current} 格，共 ${maximum} 格` : `${current} of ${maximum} armor cells remaining`);
  lastArmorCurrent = current; lastArmorMaximum = maximum; lastArmorLanguage = language;
}
function renderStages() {
  const t = text(), { progress } = progressStorage.snapshot();
  if (!document.getElementById('stages-panel')) {
    overlay.replaceChildren();
    const section = document.createElement('section');
    section.id = 'stages-panel'; section.className = 'modal stages'; section.setAttribute('aria-labelledby', 'stages-heading');
    const heading = document.createElement('h2'); heading.id = 'stages-heading'; heading.setAttribute('tabindex', '-1');
    const list = document.createElement('ol'); list.id = 'stage-list';
    for (const stageId of STAGE_ORDER) {
      const row = document.createElement('li'); row.dataset.stageId = stageId;
      const name = document.createElement('strong');
      const context = stageContext(stageId);
      const status = stageId !== DESERT_CONTEXT.stageId || desertContent
        ? button('', 'primary', () => {
          if (isStageUnlocked({ progress: progressStorage.snapshot().progress, stageId })) void showOpening(context, 'stages');
        })
        : document.createElement('span');
      row.append(name, status); list.append(row);
    }
    const back = button('', 'secondary', closeStages); back.id = 'stages-back';
    section.append(heading, list, back); overlay.append(section);
  }
  element('stages-heading').textContent = t.campaignStages;
  element('stages-back').textContent = t.backToTitle;
  STAGE_ORDER.forEach((stageId, index) => {
    const row = element('stage-list').children[index];
    const unlocked = isStageUnlocked({ progress, stageId });
    const name = t.stageNames[stageId];
    row.children[0].textContent = name;
    const status = row.children[1];
    if (status instanceof HTMLButtonElement) {
      status.textContent = unlocked ? t.deploy : t.stageLocked;
      status.disabled = !unlocked;
      status.setAttribute('aria-label', `${status.textContent} · ${name}`);
    } else {
      status.textContent = unlocked ? t.progressUnavailable : t.stageLocked;
      status.classList.toggle('stage-unavailable', unlocked);
    }
  });
}
function updateRepairHud() {
  const panel = element('repair-hud');
  const repair = world.desertRepair;
  panel.hidden = !repair || (screen !== 'game' && screen !== 'replay') || world.phase.kind !== 'running';
  if (panel.hidden || !repair) return;
  const t = text();
  const { inventory } = repair;
  const fourTowers = 'towers' in repair;
  const towers = fourTowers ? repair.towers : [repair.tower];
  const repaired = towers.filter(tower => tower.kind === 'repaired').length;
  const supplies = `${t.wood} ${inventory.wood}/${SUPPLY_CAPACITY} · ${t.iron} ${inventory.iron}/${SUPPLY_CAPACITY}`;
  const missing = (['wood', 'iron'] as const).flatMap(material => {
    const count = REPAIR_COST[material] - inventory[material];
    return count > 0 ? [`${t[material]} ×${count}`] : [];
  });
  const nearby = towers.some(tower => tower.kind === 'damaged' && Math.hypot(world.player.x - tower.x, world.player.y - tower.y) <= REPAIR_RADIUS);
  const detail = repaired === towers.length ? (fourTowers ? t.repairFourDone : t.repairDone)
    : nearby && missing.length ? `${t.repairMissing} · ${missing.join(' · ')}` : (fourTowers ? t.repairFourGuide : t.repairGuide);
  let status = fourTowers ? `${t.repairProgress} ${repaired}/${towers.length} · ${detail}` : detail;
  const assault = world.desertAssault;
  const labels = assaultLabels[language];
  const progress = `${t.repairProgress} ${repaired}/${towers.length}`;
  if (hasRelayBase(world.context) && fourTowers && repaired < towers.length && (!assault || assault.final.kind === 'waiting')) {
    const objective = relayObjective(repair, world.player);
    status = `${progress} · ${objective?.kind === 'repair' ? labels.repair
      : objective?.kind === 'supply' ? `${labels.find}${t[objective.target.material]}` : labels.awaiting}`;
    if (nearby && missing.length) status += ` · ${t.repairMissing} ${missing.join(' · ')}`;
  } else if (assault) {
    if (assault.final.kind === 'active') {
      if ('mode' in assault) {
        const order = world.bossSpawned && !world.bossKilled ? labels.defeatBoss
          : world.bossKilled && world.tick >= assault.final.reinforcementEnd ? labels.clearAssault
          : labels.hold;
        status = `${progress} · ${order}`;
      } else {
        const { batches } = assault.final;
        status = `${progress} · ${labels.waves} ${batches}/${FINAL_BATCH_COUNT}`;
        if (batches === FINAL_BATCH_COUNT) status += ` · ${labels.clear}`;
      }
    } else if (assault.final.kind === 'scheduled') status = `${progress} · ${labels.preparing}`;
    else if (assault.deliveries === 0) status = `${progress} · ${labels.awaiting}`;
    else {
      const direction = supplyDirection(DESERT_SUPPLY_DIRECTIONS[assault.deliveries - 1], language);
      status = `${progress} · ${labels.supply} ${direction}`;
      if (nearby && missing.length) status += ` · ${t.repairMissing} ${missing.join(' · ')}`;
    }
  }
  const inventoryNode = element('repair-inventory'), statusNode = element('repair-status');
  if (inventoryNode.textContent !== supplies) inventoryNode.textContent = supplies;
  if (statusNode.textContent !== status) statusNode.textContent = status;
}
function updateUi(force = false) {
  const t = text(), menu = screen === 'title' || screen === 'stages' || screen === 'opening';
  document.body.dataset.screen = screen; document.body.dataset.phase = world.phase.kind;
  canvasNode.setAttribute('aria-label', t.battlefield);
  const signature = `${screen}|${world.phase.kind}|${language}|${synth.muted}`;
  const stageId = world.context.stageId;
  const fieldBattle = !menu && stageId !== 'desert-base';
  const activeStage = !menu ? stageId : opening?.context.stageId;
  if (activeStage && activeStage !== 'desert-base') canvasNode.setAttribute('aria-label', t.stageNames[activeStage]);
  element('footer-right').textContent = '';
  element('sound').textContent = synth.muted ? t.muted : t.sound;
  element('language').textContent = t.lang; element('pause').textContent = screen === 'replay' ? t.home : world.phase.kind === 'paused' ? t.resume : t.pause;
  element('pause').hidden = screen !== 'replay' && (screen !== 'game' || world.phase.kind !== 'running' && world.phase.kind !== 'paused');
  hud.hidden = menu; touch.hidden = !coarse || screen !== 'game' || world.phase.kind !== 'running';
  element('health-label').textContent = t.health; element('time-label').textContent = screen === 'replay' ? t.replaying : t.countdown;
  updateRadio();
  updateArmor();
  updateRepairHud();
  const duration = stageRules(world.context).durationTicks;
  const remaining = Math.max(0, duration - world.tick);
  element('clock').textContent = formatTime(Math.ceil(remaining / HZ) * HZ); element('sync-fill').style.width = `${remaining / duration * 100}%`;
  element('level').textContent = `${t.level} ${world.level.toString().padStart(2, '0')}`; element('kills').textContent = `${world.kills} ${t.kills}`;
  element('xp-fill').style.width = `${Math.min(100, world.xp / world.threshold * 100)}%`;
  element('dash').textContent = world.player.dashCooldown > 0 ? (world.player.dashCooldown / HZ).toFixed(1) : t.dash;
  const menuLabel = activeStage ? t.stageNames[activeStage] : t.campaignStages;
  const battleLabel = fieldBattle ? t.stageNames[stageId] : t.prototype;
  let battleObjective = stageId === 'rainforest' ? t.rainforestFooterObjective : fieldBattle ? fieldMission?.objective[language] ?? t.missionObjective : t.objective;
  if (world.desertAssault) battleObjective = assaultObjective[language];
  if (screen === 'replay') battleObjective = t.replaying;
  if (fieldBattle && screen === 'replay-end') battleObjective = t.replayDone;
  element('footer-left').textContent = menu ? menuLabel : `${battleLabel} · ${t.seed} ${world.seed} · ${battleObjective}`;
  const equipment = element('equipment'); equipment.replaceChildren();
  for (const id of UPGRADE_ORDER) if (world.upgrades[id] > 0) { const node = document.createElement('span'); node.innerHTML = `<i class="module-icon icon-${id}" aria-hidden="true"></i><span>LV ${world.upgrades[id]}</span>`; node.title = upgradeLabel(id, language).title; node.setAttribute('aria-label', `${node.title} · LV ${world.upgrades[id]}`); equipment.append(node); }
  if (!force && signature === lastUi) return;
  lastUi = signature; synth.setSession(menu ? 'menu' : world.phase.kind === 'won' || world.phase.kind === 'lost' ? 'terminal' : world.phase.kind);
  if (resetRequested || progressStorage.snapshot().result.kind === 'recovery_required') {
    renderProgressReset();
    return;
  }
  if (screen === 'stages') { renderStages(); return; }
  if (screen === 'opening' && opening) {
    const { content, context: { stageId }, source } = opening;
    if (!document.getElementById('opening-panel')) {
      overlay.replaceChildren();
      const section = document.createElement('section'); section.id = 'opening-panel'; section.className = 'modal opening'; section.setAttribute('aria-labelledby', 'opening-heading');
      const art = document.createElement('canvas'); art.id = 'opening-art'; art.width = content.size.width; art.height = content.size.height; art.setAttribute('role', 'img');
      const context = art.getContext('2d'); if (!context) throw new Error('Opening canvas is unavailable'); content.draw(context);
      const heading = document.createElement('h2'); heading.id = 'opening-heading';
      const story = document.createElement('p'); story.id = 'opening-story'; story.dataset.storyId = content.opening.id;
      const objectiveHeading = document.createElement('h3'); objectiveHeading.id = 'opening-objective-heading';
      const objective = document.createElement('p'); objective.id = 'opening-objective'; objective.dataset.storyId = content.objective.id;
      const actions = document.createElement('div'); actions.className = 'actions';
      const deploy = button('', 'primary', finishOpening); deploy.id = 'opening-continue';
      actions.append(deploy);
      if (source !== 'title') {
        const back = button('', 'secondary', () => {
          if (source === 'stages') showStages();
          else {
            opening = null; screen = 'game'; updateUi(true);
            element('victory-next').focus({ preventScroll: true });
          }
        }); back.id = 'opening-back'; actions.append(back);
      }
      if (stageId === 'rainforest') {
        section.classList.add('opening-rainforest');
        const body = document.createElement('div'); body.className = 'opening-body';
        body.setAttribute('tabindex', '0'); body.setAttribute('role', 'region'); body.setAttribute('aria-labelledby', heading.id);
        body.append(art, heading, story, objectiveHeading, objective);
        section.append(body, actions);
      } else section.append(art, heading, story, objectiveHeading, objective, actions);
      overlay.append(section);
    }
    element('opening-art').setAttribute('aria-label', stageId === 'rainforest' ? t.rainforestOpeningArt : stageId === 'desert-base' ? t.openingArt : t.stageNames[stageId]);
    element('opening-heading').textContent = stageId === 'desert-base' ? t.opening : t.stageNames[stageId];
    element('opening-story').textContent = content.opening[language]; element('opening-objective-heading').textContent = t.missionObjective;
    const back = document.getElementById('opening-back'); if (back) back.textContent = source === 'victory' ? t.backToReport : t.backToStages;
    element('opening-objective').textContent = content.objective[language]; element('opening-continue').textContent = t.deploy;
    return;
  }
  const defeatStage = screen === 'game' && world.phase.kind === 'lost' ? world.context.stageId : null;
  const defeat = defeatStage && defeatStage !== 'desert-base' ? fieldMission?.defeat : defeatStage === 'desert-base' && desertContent ? {
    story: desertContent.defeat,
    art: { size: DESERT_SCENE_SIZE, draw: (canvas: CanvasRenderingContext2D) => drawDesertScene(canvas, 'defeat') }
  } : null;
  if (defeat) {
    if (!document.getElementById('defeat-panel')) {
      const focusRetry = document.activeElement === canvasNode || document.activeElement === document.body;
      overlay.replaceChildren();
      const section = document.createElement('section'); section.id = 'defeat-panel'; section.className = 'modal result defeat'; section.setAttribute('aria-labelledby', 'defeat-heading');
      const art = document.createElement('canvas'); art.id = 'defeat-art'; art.width = defeat.art.size.width; art.height = defeat.art.size.height; art.setAttribute('role', 'img');
      const context = art.getContext('2d'); if (!context) throw new Error('Defeat canvas is unavailable'); defeat.art.draw(context);
      const eyebrow = document.createElement('div'); eyebrow.id = 'defeat-report'; eyebrow.className = 'eyebrow';
      const heading = document.createElement('h2'); heading.id = 'defeat-heading';
      const story = document.createElement('p'); story.id = 'defeat-story'; if (defeat.story) story.dataset.storyId = defeat.story.id;
      const description = document.createElement('p'); description.id = 'defeat-description';
      const stats = document.createElement('div'); stats.className = 'stats';
      for (const [id, value] of [['time', formatTime(world.tick)], ['kills', String(world.kills)], ['level', String(world.level)]]) {
        const stat = document.createElement('span'); const label = document.createElement('span'); label.id = `defeat-${id}`;
        const amount = document.createElement('strong'); amount.textContent = value; stat.append(label, amount); stats.append(stat);
      }
      const actions = document.createElement('div'); actions.className = 'actions';
      const retry = button('', 'primary', () => begin(world.context)); retry.id = 'defeat-retry';
      const missions = button('', 'secondary', showStages); missions.id = 'defeat-missions';
      actions.append(retry, missions); section.append(art, eyebrow, heading, story, description, stats, actions); overlay.append(section);
      if (focusRetry) retry.focus({ preventScroll: true });
    }
    element('defeat-art').setAttribute('aria-label', defeatStage === 'rainforest' ? t.rainforestDefeatArt : defeatStage && defeatStage !== 'desert-base' ? t.stageNames[defeatStage] : t.defeatArt);
    element('defeat-report').textContent = t.report;
    element('defeat-heading').textContent = defeatStage && defeatStage !== 'desert-base' ? `${t.stageNames[defeatStage]} · ${t.lost}` : t.lost;
    element('defeat-story').textContent = defeat.story?.[language] ?? ''; element('defeat-description').textContent = world.desertAssault && world.player.hp > 0 ? assaultLabels[language].timeout : t.lostBody;
    element('defeat-time').textContent = t.time; element('defeat-kills').textContent = t.kills; element('defeat-level').textContent = t.level;
    element('defeat-retry').textContent = t.restart; element('defeat-missions').textContent = t.backToStages;
    return;
  }
  const victoryStage = screen === 'game' && world.phase.kind === 'won' ? world.context.stageId : null;
  const victory = victoryStage && victoryStage !== 'desert-base' ? fieldMission?.victory : victoryStage === 'desert-base' && desertContent ? {
    story: desertContent.victory,
    nextClue: desertContent.nextClue,
    art: { size: DESERT_SCENE_SIZE, draw: (canvas: CanvasRenderingContext2D) => drawDesertScene(canvas, 'victory') }
  } : null;
  if (victory && victoryStage) {
    const nextStageId = STAGE_ORDER[STAGE_ORDER.indexOf(victoryStage) + 1];
    const next = nextStageId && isStageUnlocked({ stageId: nextStageId, progress: progressStorage.snapshot().progress })
      ? stageContext(nextStageId) : null;
    if (!document.getElementById('victory-panel')) {
      const focusRetry = document.activeElement === canvasNode || document.activeElement === document.body;
      overlay.replaceChildren();
      const section = document.createElement('section'); section.id = 'victory-panel'; section.className = 'modal result victory'; section.setAttribute('aria-labelledby', 'victory-heading');
      const art = document.createElement('canvas'); art.id = 'victory-art'; art.width = victory.art.size.width; art.height = victory.art.size.height; art.setAttribute('role', 'img');
      const context = art.getContext('2d'); if (!context) throw new Error('Victory canvas is unavailable'); victory.art.draw(context);
      const eyebrow = document.createElement('div'); eyebrow.id = 'victory-report'; eyebrow.className = 'eyebrow';
      const heading = document.createElement('h2'); heading.id = 'victory-heading';
      const story = document.createElement('p'); story.id = 'victory-story'; story.hidden = !victory.story; if (victory.story) story.dataset.storyId = victory.story.id;
      const nextClue = document.createElement('p'); nextClue.id = 'victory-next-clue'; nextClue.hidden = !victory.nextClue; if (victory.nextClue) nextClue.dataset.storyId = victory.nextClue.id;
      const stats = document.createElement('div'); stats.className = 'stats';
      for (const [id, value] of [['time', formatTime(world.tick)], ['kills', String(world.kills)], ['level', String(world.level)]]) {
        const stat = document.createElement('span'); const label = document.createElement('span'); label.id = `victory-${id}`;
        const amount = document.createElement('strong'); amount.textContent = value; stat.append(label, amount); stats.append(stat);
      }
      const actions = document.createElement('div'); actions.className = 'actions';
      const onward = next ? button('', 'primary', () => { void showOpening(next, 'victory'); }) : null;
      if (onward) { onward.id = 'victory-next'; actions.append(onward); }
      const retry = button('', onward ? 'secondary' : 'primary', () => begin(world.context)); retry.id = 'victory-retry';
      const progress = document.createElement('p'); progress.id = 'victory-progress'; progress.setAttribute('role', 'status');
      const missions = button('', 'secondary', showStages); missions.id = 'victory-missions';
      actions.append(retry, missions);
      if (victoryStage === 'desert-base') {
        section.classList.add('victory-desert');
        const body = document.createElement('div'); body.className = 'victory-body';
        body.tabIndex = 0;
        body.append(art, eyebrow, heading, story, nextClue, progress, stats);
        section.append(body, actions);
      } else {
        section.append(art, eyebrow, heading, story, nextClue, progress, stats, actions);
      }
      overlay.append(section);
      if (focusRetry) (onward ?? retry).focus({ preventScroll: true });
    }
    element('victory-art').setAttribute('aria-label', victoryStage === 'rainforest' ? t.rainforestVictoryArt : victoryStage && victoryStage !== 'desert-base' ? t.stageNames[victoryStage] : t.victoryArt);
    element('victory-report').textContent = t.report;
    element('victory-heading').textContent = victoryStage && victoryStage !== 'desert-base' ? `${t.stageNames[victoryStage]} · ${t.won}` : t.won;
    element('victory-story').textContent = victory.story?.[language] ?? ''; element('victory-next-clue').textContent = victory.nextClue?.[language] ?? '';
    renderProgress('victory-progress');
    element('victory-time').textContent = t.time; element('victory-kills').textContent = t.kills; element('victory-level').textContent = t.level;
    if (next) element('victory-next').textContent = `${t.nextMission} · ${t.stageNames[next.stageId]}`;
    element('victory-retry').textContent = t.restart; element('victory-missions').textContent = t.backToStages;
    return;
  }
  const pauseObjective = fieldBattle ? fieldMission?.objective : world.desertAssault ? assaultObjective : desertContent?.objective;
  if (screen === 'game' && world.phase.kind === 'paused' && pauseObjective) {
    if (!document.getElementById('pause-panel')) {
      overlay.replaceChildren();
      const section = panel('', ''); section.id = 'pause-panel';
      const heading = document.createElement('h3'); heading.id = 'pause-objective-heading';
      const objective = document.createElement('p'); objective.id = 'pause-objective'; objective.dataset.storyId = pauseObjective.id;
      const resume = button('', 'primary', pause); resume.id = 'pause-resume';
      const home = button('', 'secondary', () => { showTitle(); element('mission-start').focus({ preventScroll: true }); }); home.id = 'pause-home';
      const actions = document.createElement('div'); actions.className = 'actions'; actions.append(resume, home);
      section.append(heading, objective, actions);
      if (radioState.kind !== 'inactive') {
        const disable = document.createElement('button'); disable.id = 'radio-disable'; disable.type = 'button'; disable.className = 'secondary';
        disable.onclick = () => { try { if (radioState.kind !== 'disabled') { setRadio({ kind: 'disabled' }, 'disabled'); log('info', 'story.radio.disabled', { id: radioEntry(world.desertAssault ? 'briefing' : 'firstContact')?.id, seed: world.seed, tick: world.tick }); updateRadio(); } } catch (error) { fail(error); } };
        const reset = document.createElement('p'); reset.id = 'radio-reset';
        actions.append(disable); section.append(reset);
      }
    }
    const section = element('pause-panel');
    section.children[0].textContent = fieldBattle ? t.stageNames[stageId] : t.mission; section.children[1].textContent = t.paused; section.children[2].textContent = t.pausedHint;
    element('pause-objective-heading').textContent = t.missionObjective; element('pause-objective').textContent = pauseObjective[language]; element('pause-resume').textContent = t.resume; element('pause-home').textContent = t.backToTitle;
    updateRadio(); return;
  }
  overlay.replaceChildren();
  if (screen === 'title') {
    const intro = document.createElement('section'); intro.className = 'intro';
    intro.innerHTML = `<h1>${t.name}<em>LUNAR RELAY</em></h1><p class="subtitle">${t.subtitle}</p><p class="brief">${hasDesertAssault(DESERT_CONTEXT) ? assaultObjective[language] : t.brief}</p>`;
    const progress = document.createElement('p'); progress.id = 'title-progress'; progress.setAttribute('role', 'status'); intro.append(progress);
    const start = button(t.start, 'primary', () => showOpening(DESERT_CONTEXT)); start.id = 'mission-start';
    const stages = button(t.campaignStages, 'secondary', showStages); stages.id = 'mission-select';
    const actions = document.createElement('div'); actions.className = 'actions'; actions.append(start, stages);
    actions.append(button(t.progressReset, 'secondary', () => { resetRequested = true; updateUi(true); })); intro.append(actions);
    const controls = document.createElement('p'); controls.className = 'controls'; controls.innerHTML = `<span class="desktop">${t.controls}</span><span class="mobile">${t.touch}</span>`; intro.append(controls);
    const stamp = document.createElement('div'); stamp.className = 'mission-stamp'; stamp.innerHTML = `<strong>${formatTime(stageRules(DESERT_CONTEXT).durationTicks)}<small> MIN</small></strong>${t.stageNames['desert-base']}`;
    overlay.append(intro, stamp); renderProgress('title-progress'); return;
  }
  if (screen === 'replay-end') {
    const section = panel(t.replayDone, replayVerified ? t.replayVerified : t.replayFailed);
    const details = document.createElement('p'); details.className = 'checksum'; details.textContent = `${VERSION} · ${finalChecksum(world)}`; section.append(details, button(t.home, 'primary', showTitle)); return;
  }
  if (screen === 'replay') return;
  if (world.phase.kind === 'upgrading') {
    const section = panel(t.upgrading, t.upgradeHint); section.classList.remove('result');
    const grid = document.createElement('div'); grid.className = 'upgrade-grid';
    for (const [index, id] of world.phase.offers.entries()) {
      const label = upgradeLabel(id, language); const node = button('', 'upgrade', () => act({ kind: 'choose', upgrade: id }));
      node.innerHTML = `<b class="module-icon icon-${id}" aria-hidden="true"></b><strong>${label.title}</strong><p>${label.description}</p><small><span class="option-key">0${index + 1} / ${t.select}</span><span class="upgrade-level">LV ${world.upgrades[id]} → <em>LV ${world.upgrades[id] + 1}</em></span></small>`; grid.append(node);
    }
    section.append(grid); return;
  }
  if (world.phase.kind === 'won' || world.phase.kind === 'lost') {
    const won = world.phase.kind === 'won'; const section = panel(won ? t.won : t.lost, won ? t.wonBody : t.lostBody);
    const stats = document.createElement('div'); stats.className = 'stats'; stats.innerHTML = `<span>${t.time}<strong>${formatTime(world.tick)}</strong></span><span>${t.kills}<strong>${world.kills}</strong></span><span>${t.level}<strong>${world.level}</strong></span>`;
    const actions = document.createElement('div'); actions.className = 'actions'; actions.append(button(t.restart, 'primary', () => begin(world.context)));
    section.append(stats, actions); return;
  }
}
function handleKey(event: KeyboardEvent, down: boolean) {
  if (!down) { keys.delete(event.code); return; }
  if (event.target instanceof HTMLElement && (event.target.closest('input, textarea, select') || ['Enter', 'Space'].includes(event.code) && event.target.closest('button, a'))) return;
  if (screen !== 'game' || event.repeat && !keys.has(event.code)) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.repeat) return;
  if (event.code === 'KeyP' || event.code === 'Escape') pause();
  if (event.code === 'Space' && world.phase.kind === 'running') { dashPressed = true; if (world.player.dashCooldown > 0) synth.play('ui-reject'); }
  if (screen === 'game' && world.phase.kind === 'upgrading') {
    const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(event.code); const id = world.phase.offers[index]; if (id) act({ kind: 'choose', upgrade: id }); else if (/^Digit[0-9]$/.test(event.code)) synth.play('ui-reject');
  }
}
window.addEventListener('keydown', event => handleKey(event, true)); window.addEventListener('keyup', event => handleKey(event, false));
window.addEventListener('blur', () => { clearCombatInput(); if (screen === 'game' && world.phase.kind === 'running') act({ kind: 'pause' }); });
document.addEventListener('visibilitychange', () => { clearCombatInput(); synth.setHidden(document.hidden); if (document.hidden) { if (screen === 'game' && world.phase.kind === 'running') act({ kind: 'pause' }); } else { updateUi(true); void enableAudio(); } });
element('language').onclick = () => { language = language === 'zh' ? 'en' : 'zh'; document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'; updateUi(true); void enableAudio(true); };
element('sound').onclick = () => { synth.setMuted(!synth.muted); updateUi(true); if (!synth.muted) void enableAudio(true); };
element('pause').onclick = () => { if (screen === 'replay') showTitle(); else pause(); void enableAudio(true); };
const joystick = element('joystick'), stick = element('stick');
function moveStick(event: PointerEvent) {
  if (screen !== 'game' || world.phase.kind !== 'running') return;
  const bounds = joystick.getBoundingClientRect(); const x = event.clientX - bounds.left - bounds.width / 2, y = event.clientY - bounds.top - bounds.height / 2;
  const length = Math.max(40, Math.hypot(x, y)); stickX = x / length; stickY = y / length; stick.style.transform = `translate(${stickX * 35}px, ${stickY * 35}px)`;
}
joystick.addEventListener('pointerdown', event => { if (screen !== 'game' || world.phase.kind !== 'running' || stickPointer !== null) return; stickPointer = event.pointerId; joystick.setPointerCapture(event.pointerId); moveStick(event); });
joystick.addEventListener('pointermove', event => { if (joystick.hasPointerCapture(event.pointerId)) moveStick(event); });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] satisfies (keyof HTMLElementEventMap)[]) joystick.addEventListener(name, event => { if (event.pointerId !== stickPointer) return; if (joystick.hasPointerCapture(event.pointerId)) joystick.releasePointerCapture(event.pointerId); stickPointer = null; stickX = 0; stickY = 0; stick.style.transform = ''; });
element('dash').addEventListener('pointerdown', event => { if (screen !== 'game' || world.phase.kind !== 'running') return; event.preventDefault(); dashPressed = true; if (world.player.dashCooldown > 0) synth.play('ui-reject'); });
window.addEventListener('error', event => fail(event.error ?? event.message)); window.addEventListener('unhandledrejection', event => fail(event.reason));
let uiCounter = 0, frames = 0, metricTime = 0;
function frame(now: number) {
  try {
    const delta = lastFrame === 0 ? 0 : Math.min(.1, (now - lastFrame) / 1000); lastFrame = now;
    if (!document.hidden && (screen === 'game' || screen === 'replay')) {
      accumulator += delta;
      let steps = 0;
      while (accumulator >= 1 / HZ && steps++ < 8) {
        accumulator -= 1 / HZ;
        if (screen === 'replay' && playingRecording) {
          while (replayIndex < playingRecording.actions.length) {
            const action = playingRecording.actions[replayIndex++]; act(action, false);
            if (action.kind === 'tick') break;
          }
          if (replayIndex === playingRecording.actions.length) {
            screen = 'replay-end';
            try {
              verifyReplay(world, playingRecording, replayIndex); replayVerified = true;
              log('info', 'replay.finished', { version: VERSION, ...world.context, seed: world.seed, actions: replayIndex, expected: playingRecording.finalChecksum, actual: finalChecksum(world) });
            } catch (error) { replayVerified = false; replayFailure(error); }
            updateUi(true); break;
          }
        } else if (screen === 'game' && world.phase.kind === 'running') {
          const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + stickX;
          const y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + stickY;
          act({ kind: 'tick', input: { x, y, dash: dashPressed } }); dashPressed = false;
        }
      }
    } else accumulator = 0;
    render(world, now, screen === 'title' || screen === 'stages');
    if (++uiCounter % 6 === 0) updateUi();
    frames++; if (now - metricTime > 5000) { log('debug', 'render.metrics', { frames, elapsedMs: now - metricTime, enemies: world.enemies.length, shots: world.shots.length, tick: world.tick }); frames = 0; metricTime = now; }
    requestAnimationFrame(frame);
  } catch (error) { fail(error); }
}
try { desertContent = parseDesertContent(JSON.parse(element('desert-content').textContent ?? '')); } catch (error) { fail(error); }
logProgressResult(progressStorage.snapshot().result);
updateUi(true); requestAnimationFrame(frame);
