import { createWorld, dispatch, checksum, VERSION, HZ, DURATION, type World, type Action, type Recording, type Upgrade } from './core.js';
import { createRenderer } from './render.js';
import { Synth } from './audio.js';
import { dictionary, upgradeLabel, type Language } from './i18n.js';
import { log } from './logger.js';
function element(id: string): HTMLElement { const node = document.getElementById(id); if (!node) throw new Error(`Missing element ${id}`); return node; }
const canvasNode = element('game');
if (!(canvasNode instanceof HTMLCanvasElement)) throw new Error('Game canvas is unavailable');
const render = createRenderer(canvasNode), synth = new Synth();
const overlay = element('overlay'), hud = element('hud'), touch = element('touch');
let language: Language = 'zh';
let world: World = createWorld(208907);
let screen: 'title' | 'game' | 'replay' | 'replay-end' = 'title';
let recording: Recording = { version: VERSION, seed: world.seed, actions: [] };
let lastRecording: Recording | null = null;
let lastChecksum = '';
let replayIndex = 0;
let accumulator = 0, lastFrame = 0, lastUi = '', noticeTimer = 0;
const keys = new Set<string>();
let stickX = 0, stickY = 0, dashPressed = false;
const coarse = matchMedia('(pointer: coarse)').matches;
function text() { return dictionary(language); }
function notify(message: string) { const node = element('notice'); node.textContent = message; node.classList.add('visible'); window.clearTimeout(noticeTimer); noticeTimer = window.setTimeout(() => node.classList.remove('visible'), 3500); }
function fail(error: unknown) { log('error', 'runtime.failure', { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : '', seed: world.seed, tick: world.tick }); notify(text().error); }
async function enableAudio() { try { await synth.start(); } catch (error) { log('error', 'audio.activation_failed', { error: String(error) }); notify(language === 'zh' ? '音频启动失败，游戏可继续。' : 'Audio unavailable. You can keep playing.'); } }
function act(action: Action, record = true) {
  if (record && screen === 'game') recording.actions.push(action);
  const before = world.phase.kind;
  dispatch(world, action);
  if (action.kind !== 'tick') log('info', `session.${action.kind}`, { seed: world.seed, tick: world.tick, phase: world.phase.kind });
  if (world.events.includes('boss')) notify(text().boss);
  if (before !== world.phase.kind) {
    log('info', 'session.phase', { seed: world.seed, tick: world.tick, before, phase: world.phase.kind });
    if (screen === 'game' && (world.phase.kind === 'won' || world.phase.kind === 'lost')) {
      lastRecording = { ...recording, actions: [...recording.actions] }; lastChecksum = checksum(world);
      log('info', 'session.finished', { seed: world.seed, tick: world.tick, outcome: world.phase.kind, checksum: lastChecksum, kills: world.kills });
    }
    updateUi(true);
  }
  synth.events(world.events);
}
function begin() {
  const seedArray = new Uint32Array(1); crypto.getRandomValues(seedArray);
  world = createWorld(seedArray[0]); recording = { version: VERSION, seed: world.seed, actions: [] }; screen = 'game'; keys.clear(); stickX = 0; stickY = 0; dashPressed = false; accumulator = 0;
  log('info', 'session.started', { seed: world.seed, version: VERSION }); void enableAudio(); updateUi(true);
}
function startReplay() {
  if (!lastRecording) return;
  world = createWorld(lastRecording.seed); replayIndex = 0; screen = 'replay'; accumulator = 0; keys.clear(); stickX = 0; stickY = 0; log('info', 'replay.started', { seed: world.seed, actions: lastRecording.actions.length }); void enableAudio(); updateUi(true);
}
function showTitle() { screen = 'title'; world = createWorld(208907); keys.clear(); synth.pause(true); updateUi(true); }
function pause() {
  if (screen !== 'game') return;
  if (world.phase.kind === 'running') act({ kind: 'pause' }); else if (world.phase.kind === 'paused') { act({ kind: 'resume' }); void enableAudio(); }
  keys.clear(); stickX = 0; stickY = 0;
}
function button(label: string, className: string, handler: () => void): HTMLButtonElement { const node = document.createElement('button'); node.textContent = label; node.className = className; node.onclick = handler; return node; }
function panel(title: string, subtitle: string): HTMLElement {
  const section = document.createElement('section'); section.className = 'modal result';
  const eyebrow = document.createElement('div'); eyebrow.className = 'eyebrow'; eyebrow.textContent = text().mission;
  const heading = document.createElement('h2'); heading.textContent = title;
  const description = document.createElement('p'); description.textContent = subtitle;
  section.append(eyebrow, heading, description); overlay.append(section); return section;
}
function formatTime(ticks: number) { const seconds = Math.floor(ticks / HZ); return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`; }
function updateUi(force = false) {
  const t = text();
  canvasNode.setAttribute('aria-label', language === 'zh' ? '月球战场' : 'Lunar battlefield');
  const signature = `${screen}|${world.phase.kind}|${language}|${synth.muted}`;
  element('sound').textContent = synth.muted ? t.muted : t.sound;
  element('language').textContent = t.lang; element('pause').textContent = screen === 'replay' ? t.home : world.phase.kind === 'paused' ? t.resume : t.pause;
  element('pause').hidden = screen !== 'replay' && (screen !== 'game' || world.phase.kind !== 'running' && world.phase.kind !== 'paused');
  hud.hidden = screen === 'title'; touch.hidden = !coarse || screen !== 'game' || world.phase.kind !== 'running';
  element('health-label').textContent = t.health; element('time-label').textContent = screen === 'replay' ? t.replaying : t.time;
  element('health-fill').style.width = `${world.player.hp / world.player.maxHp * 100}%`; element('health-value').textContent = `${Math.ceil(world.player.hp)} / ${world.player.maxHp}`;
  element('clock').textContent = formatTime(world.tick); element('sync-fill').style.width = `${Math.min(100, world.tick / DURATION * 100)}%`;
  element('level').textContent = `${t.level} ${world.level.toString().padStart(2, '0')}`; element('kills').textContent = `${world.kills} ${t.kills}`;
  element('xp-fill').style.width = `${Math.min(100, world.xp / world.threshold * 100)}%`;
  element('dash').textContent = world.player.dashCooldown > 0 ? (world.player.dashCooldown / HZ).toFixed(1) : t.dash;
  element('footer-left').textContent = screen === 'title' ? t.prototype : `${t.seed} ${world.seed} · ${screen === 'replay' ? t.replaying : t.objective}`;
  const equipment = element('equipment'); equipment.replaceChildren();
  for (const id of ['pulse', 'orbit', 'nova'] satisfies Upgrade[]) if (world.upgrades[id]) { const node = document.createElement('span'); node.textContent = `${upgradeLabel(id, language).icon} ${world.upgrades[id]}`; node.title = upgradeLabel(id, language).title; equipment.append(node); }
  if (!force && signature === lastUi) return;
  lastUi = signature; overlay.replaceChildren(); synth.pause(screen === 'title' || screen === 'replay-end' || world.phase.kind !== 'running');
  if (screen === 'title') {
    const intro = document.createElement('section'); intro.className = 'intro';
    intro.innerHTML = `<div class="eyebrow">${t.mission}</div><h1>${t.name}<em>LUNAR RELAY</em></h1><p class="subtitle">${t.subtitle}</p><p class="brief">${t.brief}</p>`;
    const actions = document.createElement('div'); actions.className = 'actions'; actions.append(button(`${t.start} ↗`, 'primary', begin));
    const replayButton = button(t.replay, 'secondary', startReplay); replayButton.disabled = !lastRecording; actions.append(replayButton); intro.append(actions);
    const controls = document.createElement('p'); controls.className = 'controls'; controls.innerHTML = `<span class="desktop">${t.controls}</span><span class="mobile">${t.touch}</span>`; intro.append(controls);
    const stamp = document.createElement('div'); stamp.className = 'mission-stamp'; stamp.innerHTML = `<strong>03<span>:</span>00<small> MIN</small></strong>MARE TRANQUILLITATIS<br>25°51′24″ N / 00°36′50″ E`;
    overlay.append(intro, stamp); return;
  }
  if (screen === 'replay-end') {
    const section = panel(t.replayDone, checksum(world) === lastChecksum ? t.replayVerified : t.replayFailed);
    const details = document.createElement('p'); details.className = 'checksum'; details.textContent = `${VERSION} · ${checksum(world)}`; section.append(details, button(t.home, 'primary', showTitle)); return;
  }
  if (screen === 'replay') return;
  if (world.phase.kind === 'upgrading') {
    const section = panel(t.upgrading, t.upgradeHint); section.classList.remove('result');
    const grid = document.createElement('div'); grid.className = 'upgrade-grid';
    for (const [index, id] of world.phase.offers.entries()) {
      const label = upgradeLabel(id, language); const node = button('', 'upgrade', () => act({ kind: 'choose', upgrade: id }));
      node.innerHTML = `<b>${label.icon}</b><strong>${label.title}</strong><p>${label.description}</p><small>0${index + 1} / ${t.select} · LV ${world.upgrades[id] + 1}</small>`; grid.append(node);
    }
    section.append(grid); return;
  }
  if (world.phase.kind === 'paused') { const section = panel(t.paused, t.pausedHint); section.append(button(t.resume, 'primary', pause)); return; }
  if (world.phase.kind === 'won' || world.phase.kind === 'lost') {
    const won = world.phase.kind === 'won'; const section = panel(won ? t.won : t.lost, won ? t.wonBody : t.lostBody);
    const stats = document.createElement('div'); stats.className = 'stats'; stats.innerHTML = `<span>${t.time}<strong>${formatTime(world.tick)}</strong></span><span>${t.kills}<strong>${world.kills}</strong></span><span>${t.level}<strong>${world.level}</strong></span>`;
    const actions = document.createElement('div'); actions.className = 'actions'; actions.append(button(t.restart, 'primary', begin), button(t.replay, 'secondary', startReplay));
    section.append(stats, actions); return;
  }
}
function handleKey(event: KeyboardEvent, down: boolean) {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  if (down) keys.add(event.code); else keys.delete(event.code);
  if (!down || event.repeat) return;
  if (event.code === 'KeyP' || event.code === 'Escape') pause();
  if (event.code === 'Space') dashPressed = true;
  if (screen === 'game' && world.phase.kind === 'upgrading') {
    const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(event.code); const id = world.phase.offers[index]; if (id) act({ kind: 'choose', upgrade: id });
  }
}
window.addEventListener('keydown', event => handleKey(event, true)); window.addEventListener('keyup', event => handleKey(event, false));
window.addEventListener('blur', () => { keys.clear(); stickX = 0; stickY = 0; dashPressed = false; if (screen === 'game' && world.phase.kind === 'running') act({ kind: 'pause' }); });
document.addEventListener('visibilitychange', () => { accumulator = 0; lastFrame = 0; if (document.hidden) { keys.clear(); stickX = 0; stickY = 0; dashPressed = false; if (screen === 'game' && world.phase.kind === 'running') act({ kind: 'pause' }); synth.pause(true); } else updateUi(true); });
element('language').onclick = () => { language = language === 'zh' ? 'en' : 'zh'; document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'; updateUi(true); };
element('sound').onclick = () => { synth.mute(!synth.muted); if (!synth.muted) void enableAudio(); updateUi(true); };
element('pause').onclick = () => { if (screen === 'replay') showTitle(); else pause(); };
const joystick = element('joystick'), stick = element('stick');
function moveStick(event: PointerEvent) {
  const bounds = joystick.getBoundingClientRect(); const x = event.clientX - bounds.left - bounds.width / 2, y = event.clientY - bounds.top - bounds.height / 2;
  const length = Math.max(40, Math.hypot(x, y)); stickX = x / length; stickY = y / length; stick.style.transform = `translate(${stickX * 35}px, ${stickY * 35}px)`;
}
joystick.addEventListener('pointerdown', event => { joystick.setPointerCapture(event.pointerId); moveStick(event); });
joystick.addEventListener('pointermove', event => { if (joystick.hasPointerCapture(event.pointerId)) moveStick(event); });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(name, () => { stickX = 0; stickY = 0; stick.style.transform = ''; });
element('dash').addEventListener('pointerdown', event => { event.preventDefault(); dashPressed = true; });
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
        if (screen === 'replay' && lastRecording) {
          let action = lastRecording.actions[replayIndex++];
          while (action && action.kind !== 'tick') { act(action, false); action = lastRecording.actions[replayIndex++]; }
          if (action) act(action, false);
          else {
            screen = 'replay-end'; const actual = checksum(world); log(actual === lastChecksum ? 'info' : 'error', 'replay.finished', { seed: world.seed, expected: lastChecksum, actual }); updateUi(true); break;
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
updateUi(true); requestAnimationFrame(frame);
