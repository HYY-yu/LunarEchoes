import { DESERT_CONTEXT, stageRules, SimulationError } from './stage-rules.js';
import { createWorld, dispatch, finalChecksum, finishRecording, startRecording, prepareReplay, verifyReplay, VERSION, HZ, UPGRADE_ORDER, ARMOR_RULES, type World, type Action, type Recording, type ActionBuffer } from './core.js';
import { createRenderer } from './render.js';
import { Synth } from './audio.js';
import { dictionary, upgradeLabel, type Language } from './i18n.js';
import { log } from './logger.js';
import { DESERT_SCENE_SIZE, drawDesertScene } from './desert-scene.js';
type Screen = 'title' | 'opening' | 'game' | 'replay' | 'replay-end';
type RadioBeat = 'firstContact' | 'telemetry';
type RadioState = Readonly<{ kind: 'inactive' | 'waiting' | 'disabled' }> | Readonly<{ kind: 'active' | 'dismissed'; beat: RadioBeat }>;
type OpeningFinish = 'continue' | 'skip';
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
let world: World = createWorld({ ...DESERT_CONTEXT, seed: 208907 });
let screen: Screen = 'title';
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
const armorNode = element('armor-cells');
const armorSpans: HTMLSpanElement[] = [];
let lastArmorCurrent = -1, lastArmorMaximum = -1, lastArmorLanguage: Language | null = null;
const keys = new Set<string>();
let stickX = 0, stickY = 0, dashPressed = false;
let stickPointer: number | null = null;
const coarse = matchMedia('(pointer: coarse)').matches;
function text() { return dictionary(language); }
function clearNotice() { window.clearTimeout(noticeTimer); noticeTimer = 0; const node = element('notice'); node.classList.remove('visible'); node.classList.remove('boss-notice'); node.textContent = ''; }
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
function setRadio(next: RadioState, reason: string) {
  if (radioState.kind === next.kind && (!('beat' in radioState) || ('beat' in next && radioState.beat === next.beat))) return;
  if (radioState.kind === 'active') log('info', 'story.radio.ended', { id: desertContent?.[radioState.beat].id, seed: world.seed, tick: world.tick, reason });
  radioState = next;
  if (next.kind === 'active') log('info', 'story.radio.started', { id: desertContent?.[next.beat].id, seed: world.seed, tick: world.tick });
}
function updateRadio() {
  const visible = radioState.kind === 'active' && screen === 'game' && world.phase.kind === 'running' && !document.hidden;
  if (!visible && document.activeElement === radioClose) canvasNode.focus({ preventScroll: true });
  if (radio.hidden === visible) radio.hidden = !visible;
  const t = text(), entry = radioState.kind === 'active' ? desertContent?.[radioState.beat] : null, story = entry ? entry[language] : '';
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
  dispatch(world, action);
  if (action.kind !== 'tick') log('info', `session.${action.kind}`, { seed: world.seed, tick: world.tick, phase: world.phase.kind });
  if (screen === 'game') {
    if (world.phase.kind === 'won' || world.phase.kind === 'lost') setRadio({ kind: 'inactive' }, 'terminal');
    else if (radioState.kind === 'waiting' && world.events.includes('kill')) setRadio({ kind: 'active', beat: 'firstContact' }, 'first-kill');
    else if (radioState.kind === 'dismissed' && radioState.beat === 'firstContact' && world.phase.kind === 'running' && !document.hidden && world.tick >= stageRules(world.context).durationTicks / 2) setRadio({ kind: 'active', beat: 'telemetry' }, 'midpoint');
  }
  updateRadio();
  if (world.events.includes('boss')) {
    if (screen === 'game') {
      if (!desertContent) throw new Error('Desert content unavailable');
      notify(desertContent.boss[language], 'boss');
    } else notify(text().boss);
  }
  if (before !== world.phase.kind) {
    log('info', 'session.phase', { seed: world.seed, tick: world.tick, before, phase: world.phase.kind });
    if (screen === 'game' && (world.phase.kind === 'won' || world.phase.kind === 'lost')) {
      lastRecording = finishRecording(world, recording.actions);
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
function showOpening() {
  if (!desertContent) throw new Error('Desert content unavailable');
  screen = 'opening'; clearCombatInput(); updateUi(true); element('opening-continue').focus();
  log('info', 'story.opening.started', { id: desertContent.opening.id });
}
function finishOpening(reason: OpeningFinish) {
  if (screen !== 'opening' || !desertContent) return;
  log('info', 'story.opening.finished', { id: desertContent.opening.id, reason }); begin();
}
function begin() {
  if (!desertContent) throw new Error('Desert content unavailable');
  const seedArray = new Uint32Array(1); crypto.getRandomValues(seedArray);
  const nextWorld = createWorld({ ...DESERT_CONTEXT, seed: seedArray[0] });
  synth.reset(); world = nextWorld; recording = startRecording(world); playingRecording = null; screen = 'game'; setRadio({ kind: 'waiting' }, 'begin'); clearCombatInput(); clearNotice();
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
function startReplay() {
  if (!lastRecording) return;
  try {
    const next = prepareReplay(lastRecording);
    synth.reset(); world = next.world; playingRecording = next.recording; replayIndex = 0; replayVerified = false; screen = 'replay'; setRadio({ kind: 'inactive' }, 'replay'); clearCombatInput(); clearNotice();
    log('info', 'replay.started', { version: VERSION, ...world.context, seed: world.seed, actions: playingRecording.actions.length }); updateUi(true); void enableAudio();
  } catch (error) { replayFailure(error); }
}
function showTitle() { screen = 'title'; playingRecording = null; world = createWorld({ ...DESERT_CONTEXT, seed: 208907 }); clearCombatInput(); synth.reset(); setRadio({ kind: 'inactive' }, 'home'); clearNotice(); updateUi(true); void enableAudio(); }
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
function updateUi(force = false) {
  const t = text();
  document.body.dataset.screen = screen; document.body.dataset.phase = world.phase.kind;
  canvasNode.setAttribute('aria-label', t.battlefield);
  const signature = `${screen}|${world.phase.kind}|${language}|${synth.muted}`;
  element('footer-right').textContent = t.pendingContent;
  element('sound').textContent = synth.muted ? t.muted : t.sound;
  element('language').textContent = t.lang; element('pause').textContent = screen === 'replay' ? t.home : world.phase.kind === 'paused' ? t.resume : t.pause;
  element('pause').hidden = screen !== 'replay' && (screen !== 'game' || world.phase.kind !== 'running' && world.phase.kind !== 'paused');
  hud.hidden = screen === 'title' || screen === 'opening'; touch.hidden = !coarse || screen !== 'game' || world.phase.kind !== 'running';
  element('health-label').textContent = t.health; element('time-label').textContent = screen === 'replay' ? t.replaying : t.time;
  updateRadio();
  updateArmor();
  element('clock').textContent = formatTime(world.tick); element('sync-fill').style.width = `${Math.min(100, world.tick / stageRules(world.context).durationTicks * 100)}%`;
  element('level').textContent = `${t.level} ${world.level.toString().padStart(2, '0')}`; element('kills').textContent = `${world.kills} ${t.kills}`;
  element('xp-fill').style.width = `${Math.min(100, world.xp / world.threshold * 100)}%`;
  element('dash').textContent = world.player.dashCooldown > 0 ? (world.player.dashCooldown / HZ).toFixed(1) : t.dash;
  element('footer-left').textContent = screen === 'title' || screen === 'opening' ? t.prototype : `${t.prototype} · ${t.seed} ${world.seed} · ${screen === 'replay' ? t.replaying : t.objective}`;
  const equipment = element('equipment'); equipment.replaceChildren();
  for (const id of UPGRADE_ORDER) if (world.upgrades[id] > 0) { const node = document.createElement('span'); node.innerHTML = `<i class="module-icon icon-${id}" aria-hidden="true"></i><span>LV ${world.upgrades[id]}</span>`; node.title = upgradeLabel(id, language).title; node.setAttribute('aria-label', `${node.title} · LV ${world.upgrades[id]}`); equipment.append(node); }
  if (!force && signature === lastUi) return;
  lastUi = signature; synth.setSession(screen === 'title' || screen === 'opening' ? 'menu' : world.phase.kind === 'won' || world.phase.kind === 'lost' ? 'terminal' : world.phase.kind);
  if (screen === 'opening' && desertContent) {
    if (!document.getElementById('opening-panel')) {
      overlay.replaceChildren();
      const section = document.createElement('section'); section.id = 'opening-panel'; section.className = 'modal opening'; section.setAttribute('aria-labelledby', 'opening-heading');
      const art = document.createElement('canvas'); art.id = 'opening-art'; art.width = DESERT_SCENE_SIZE.width; art.height = DESERT_SCENE_SIZE.height; art.setAttribute('role', 'img');
      const context = art.getContext('2d'); if (!context) throw new Error('Opening canvas is unavailable'); drawDesertScene(context, 'opening');
      const heading = document.createElement('h2'); heading.id = 'opening-heading';
      const story = document.createElement('p'); story.id = 'opening-story'; story.dataset.storyId = desertContent.opening.id;
      const objectiveHeading = document.createElement('h3'); objectiveHeading.id = 'opening-objective-heading';
      const objective = document.createElement('p'); objective.id = 'opening-objective'; objective.dataset.storyId = desertContent.objective.id;
      const actions = document.createElement('div'); actions.className = 'actions';
      const deploy = button('', 'primary', () => finishOpening('continue')); deploy.id = 'opening-continue';
      const skip = button('', 'secondary', () => finishOpening('skip')); skip.id = 'opening-skip';
      actions.append(deploy, skip); section.append(art, heading, story, objectiveHeading, objective, actions); overlay.append(section);
    }
    element('opening-art').setAttribute('aria-label', t.openingArt); element('opening-heading').textContent = t.opening;
    element('opening-story').textContent = desertContent.opening[language]; element('opening-objective-heading').textContent = t.missionObjective;
    element('opening-objective').textContent = desertContent.objective[language]; element('opening-continue').textContent = t.deploy; element('opening-skip').textContent = t.skipOpening;
    return;
  }
  if (screen === 'game' && world.phase.kind === 'lost' && desertContent) {
    if (!document.getElementById('defeat-panel')) {
      const focusRetry = document.activeElement === canvasNode || document.activeElement === document.body;
      overlay.replaceChildren();
      const section = document.createElement('section'); section.id = 'defeat-panel'; section.className = 'modal result defeat'; section.setAttribute('aria-labelledby', 'defeat-heading');
      const art = document.createElement('canvas'); art.id = 'defeat-art'; art.width = DESERT_SCENE_SIZE.width; art.height = DESERT_SCENE_SIZE.height; art.setAttribute('role', 'img');
      const context = art.getContext('2d'); if (!context) throw new Error('Defeat canvas is unavailable'); drawDesertScene(context, 'defeat');
      const eyebrow = document.createElement('div'); eyebrow.id = 'defeat-report'; eyebrow.className = 'eyebrow';
      const heading = document.createElement('h2'); heading.id = 'defeat-heading';
      const story = document.createElement('p'); story.id = 'defeat-story'; story.dataset.storyId = desertContent.defeat.id;
      const description = document.createElement('p'); description.id = 'defeat-description';
      const stats = document.createElement('div'); stats.className = 'stats';
      for (const [id, value] of [['time', formatTime(world.tick)], ['kills', String(world.kills)], ['level', String(world.level)]]) {
        const stat = document.createElement('span'); const label = document.createElement('span'); label.id = `defeat-${id}`;
        const amount = document.createElement('strong'); amount.textContent = value; stat.append(label, amount); stats.append(stat);
      }
      const actions = document.createElement('div'); actions.className = 'actions';
      const retry = button('', 'primary', begin); retry.id = 'defeat-retry';
      const replay = button('', 'secondary', startReplay); replay.id = 'defeat-replay';
      actions.append(retry, replay); section.append(art, eyebrow, heading, story, description, stats, actions); overlay.append(section);
      if (focusRetry) retry.focus({ preventScroll: true });
    }
    element('defeat-art').setAttribute('aria-label', t.defeatArt); element('defeat-report').textContent = t.report; element('defeat-heading').textContent = t.lost;
    element('defeat-story').textContent = desertContent.defeat[language]; element('defeat-description').textContent = t.lostBody;
    element('defeat-time').textContent = t.time; element('defeat-kills').textContent = t.kills; element('defeat-level').textContent = t.level;
    element('defeat-retry').textContent = t.restart; element('defeat-replay').textContent = t.replay;
    return;
  }
  if (screen === 'game' && world.phase.kind === 'won' && desertContent) {
    if (!document.getElementById('victory-panel')) {
      const focusRetry = document.activeElement === canvasNode || document.activeElement === document.body;
      overlay.replaceChildren();
      const section = document.createElement('section'); section.id = 'victory-panel'; section.className = 'modal result victory'; section.setAttribute('aria-labelledby', 'victory-heading');
      const art = document.createElement('canvas'); art.id = 'victory-art'; art.width = DESERT_SCENE_SIZE.width; art.height = DESERT_SCENE_SIZE.height; art.setAttribute('role', 'img');
      const context = art.getContext('2d'); if (!context) throw new Error('Victory canvas is unavailable'); drawDesertScene(context, 'victory');
      const eyebrow = document.createElement('div'); eyebrow.id = 'victory-report'; eyebrow.className = 'eyebrow';
      const heading = document.createElement('h2'); heading.id = 'victory-heading';
      const story = document.createElement('p'); story.id = 'victory-story'; story.dataset.storyId = desertContent.victory.id;
      const nextClue = document.createElement('p'); nextClue.id = 'victory-next-clue'; nextClue.dataset.storyId = desertContent.nextClue.id;
      const description = document.createElement('p'); description.id = 'victory-description';
      const stats = document.createElement('div'); stats.className = 'stats';
      for (const [id, value] of [['time', formatTime(world.tick)], ['kills', String(world.kills)], ['level', String(world.level)]]) {
        const stat = document.createElement('span'); const label = document.createElement('span'); label.id = `victory-${id}`;
        const amount = document.createElement('strong'); amount.textContent = value; stat.append(label, amount); stats.append(stat);
      }
      const actions = document.createElement('div'); actions.className = 'actions';
      const retry = button('', 'primary', begin); retry.id = 'victory-retry';
      const replay = button('', 'secondary', startReplay); replay.id = 'victory-replay';
      actions.append(retry, replay); section.append(art, eyebrow, heading, story, nextClue, description, stats, actions); overlay.append(section);
      if (focusRetry) retry.focus({ preventScroll: true });
    }
    element('victory-art').setAttribute('aria-label', t.victoryArt); element('victory-report').textContent = t.report; element('victory-heading').textContent = t.won;
    element('victory-story').textContent = desertContent.victory[language]; element('victory-next-clue').textContent = desertContent.nextClue[language]; element('victory-description').textContent = t.wonBody;
    element('victory-time').textContent = t.time; element('victory-kills').textContent = t.kills; element('victory-level').textContent = t.level;
    element('victory-retry').textContent = t.restart; element('victory-replay').textContent = t.replay;
    return;
  }
  if (screen === 'game' && world.phase.kind === 'paused' && desertContent) {
    if (!document.getElementById('pause-panel')) {
      overlay.replaceChildren();
      const section = panel('', ''); section.id = 'pause-panel';
      const heading = document.createElement('h3'); heading.id = 'pause-objective-heading';
      const objective = document.createElement('p'); objective.id = 'pause-objective'; objective.dataset.storyId = desertContent.objective.id;
      const resume = button('', 'primary', pause); resume.id = 'pause-resume';
      const disable = document.createElement('button'); disable.id = 'radio-disable'; disable.type = 'button'; disable.className = 'secondary';
      disable.onclick = () => { try { if (radioState.kind !== 'disabled') { setRadio({ kind: 'disabled' }, 'disabled'); log('info', 'story.radio.disabled', { id: desertContent?.firstContact.id, seed: world.seed, tick: world.tick }); updateRadio(); } } catch (error) { fail(error); } };
      const reset = document.createElement('p'); reset.id = 'radio-reset';
      const actions = document.createElement('div'); actions.className = 'actions'; actions.append(resume, disable);
      section.append(heading, objective, actions, reset);
    }
    const section = element('pause-panel');
    section.children[0].textContent = t.mission; section.children[1].textContent = t.paused; section.children[2].textContent = t.pausedHint;
    element('pause-objective-heading').textContent = t.missionObjective; element('pause-objective').textContent = desertContent.objective[language]; element('pause-resume').textContent = t.resume;
    updateRadio(); return;
  }
  overlay.replaceChildren();
  if (screen === 'title') {
    const intro = document.createElement('section'); intro.className = 'intro';
    intro.innerHTML = `<div class="eyebrow">${t.mission}</div><h1>${t.name}<em>LUNAR RELAY</em></h1><p class="subtitle">${t.subtitle}</p><p class="brief">${t.brief}</p>`;
    const actions = document.createElement('div'); actions.className = 'actions'; actions.append(button(t.start, 'primary', showOpening));
    const replayButton = button(t.replay, 'secondary', startReplay); replayButton.disabled = !lastRecording; actions.append(replayButton); intro.append(actions);
    const controls = document.createElement('p'); controls.className = 'controls'; controls.innerHTML = `<span class="desktop">${t.controls}</span><span class="mobile">${t.touch}</span>`; intro.append(controls);
    const stamp = document.createElement('div'); stamp.className = 'mission-stamp'; stamp.innerHTML = `<strong>${formatTime(stageRules(world.context).durationTicks)}<small> MIN</small></strong>${t.mission}<br>${t.pendingContent}`;
    overlay.append(intro, stamp); return;
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
    const actions = document.createElement('div'); actions.className = 'actions'; actions.append(button(t.restart, 'primary', begin), button(t.replay, 'secondary', startReplay));
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
    render(world, now, screen === 'title');
    if (++uiCounter % 6 === 0) updateUi();
    frames++; if (now - metricTime > 5000) { log('debug', 'render.metrics', { frames, elapsedMs: now - metricTime, enemies: world.enemies.length, shots: world.shots.length, tick: world.tick }); frames = 0; metricTime = now; }
    requestAnimationFrame(frame);
  } catch (error) { fail(error); }
}
try { desertContent = parseDesertContent(JSON.parse(element('desert-content').textContent ?? '')); } catch (error) { fail(error); }
updateUi(true); requestAnimationFrame(frame);
