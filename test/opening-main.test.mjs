import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { drawDesertScene } from '../dist/desert-scene.js';
import { drawRainforestFailure, drawRainforestVictory } from '../dist/rainforest-story-art.js';
import * as core from '../dist/core.js';
import { createWorld, normalizeInput, replay, finalChecksum, startRecording } from '../dist/core.js';
import { RAINFOREST_CONTEXT } from '../dist/stage-rules.js';
import { playArmorCase } from '../scripts/armor-balance.mjs';
import { play } from '../scripts/simulate.mjs';
import ts from 'typescript';
import { embedDesertContent } from '../scripts/desert-content.mjs';
const catalog = JSON.parse(readFileSync('content/desert-base.story.json', 'utf8'));
const html = readFileSync('dist/index.html', 'utf8');
const contentBeats = ['opening', 'objective', 'defeat', 'victory', 'next-clue', 'radio.first-contact', 'radio.telemetry', 'boss'];
const contentKey = beat => beat === 'next-clue' ? 'nextClue' : beat === 'radio.first-contact' ? 'firstContact' : beat === 'radio.telemetry' ? 'telemetry' : beat;
const embedded = html.match(/<script id="desert-content" type="application\/json">([^]*?)<\/script>/)[1];
const progressKey = 'lunar-relay.campaign-progress';
const savedProgress = stageId => JSON.stringify({ version: 1, highestUnlockedStageId: stageId });
function memoryStorage(raw = null) {
  return {
    raw, reads: [], writes: [],
    getItem(key) { this.reads.push(key); return this.raw; },
    setItem(key, value) { this.writes.push([key, value]); this.raw = value; }
  };
}
function harness(content = embedded, localStorage = memoryStorage(), fetchStory = async () => ({ ok: true, json: async () => JSON.parse(readFileSync('dist/rainforest.story.json', 'utf8')) })) {
  const listeners = new Map(), logs = [], sessions = [], timers = new Map(), cancelledTimers = [];
  let active, raf, seedCalls = 0, now = 1000, timerNow = 0, nextTimer = 1, audioFailure = false, seedFailure = false, audioActivations = 0;
  const setTimeout = (callback, delay) => { const id = nextTimer++; timers.set(id, { callback, at: timerNow + delay }); return id; };
  const clearTimeout = id => { if (timers.delete(id)) cancelledTimers.push(id); };
  function advanceTimers(ms) {
    const until = timerNow + ms;
    for (;;) {
      const next = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      const [id, timer] = next; timers.delete(id); timerNow = timer.at; timer.callback();
    }
    timerNow = until;
  }
  class Element {
    constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.style = {}; this.dataset = {}; this.attributes = {}; this.hidden = false; this._textContent = ''; this.textWrites = 0; this.id = ''; this.scrollTop = 0; this.captures = new Set(); this.events = new Map(); const classes = new Set(); this.classList = { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name), toggle(name, force = !classes.has(name)) { if (force) classes.add(name); else classes.delete(name); return force; } }; }
    append(...nodes) { this.children.push(...nodes); for (const node of nodes) node.parentElement = this; }
    replaceChildren(...nodes) { for (const node of this.children) node.parentElement = null; this.children = []; this.append(...nodes); }
    remove() { this.parentElement.children = this.parentElement.children.filter(node => node !== this); }
    get textContent() { return this._textContent; }
    set textContent(value) { this.textWrites++; this._textContent = value; }
    getAttribute(key) { return this.attributes[key] ?? null; }
    setAttribute(key, value) { this.attributes[key] = value; }
    focus(options) { active = this; this.focusOptions = options; this.focusCalls = (this.focusCalls ?? 0) + 1; }
    closest(selector) { return selector.split(', ').includes(this.tagName.toLowerCase()) ? this : this.parentElement?.closest(selector) ?? null; }
    addEventListener(name, handler) { this.events.set(name, handler); }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); }
    getBoundingClientRect() { return { left: 0, top: 0, width: 110, height: 110 }; }
  }
  class Button extends Element { constructor() { super('button'); } }
  class Canvas extends Element { constructor() { super('canvas'); this.commands = []; } getContext() { const commands = this.commands; return { fillRect(...rect) { commands.push([this.fillStyle, ...rect]); }, save() {}, restore() {} }; } }
  const body = new Element('body');
  for (const id of ['game', 'overlay', 'hud', 'touch', 'armor-cells', 'notice', 'footer-right', 'sound', 'language', 'pause', 'health-label', 'time-label', 'clock', 'sync-fill', 'level', 'kills', 'xp-fill', 'dash', 'footer-left', 'equipment', 'joystick', 'stick', 'desert-content']) {
    const node = id === 'game' ? new Canvas() : ['sound', 'language', 'pause', 'dash'].includes(id) ? new Button() : new Element('div'); node.id = id; if (id === 'desert-content') node.textContent = content; body.append(node);
  }
  const all = (node = body) => [node, ...node.children.flatMap(child => all(child))];
  const get = id => all().find(node => node.id === id) ?? null;
  const document = { body, documentElement: {}, hidden: false, get activeElement() { return active; }, getElementById: get, createElement: tag => tag === 'canvas' ? new Canvas() : tag === 'button' ? new Button() : new Element(tag), addEventListener: (name, handler) => listeners.set(name, handler) };
  class Synth {
    muted = false;
    async activate() { audioActivations++; if (audioFailure) { audioFailure = false; throw new Error('test audio unavailable'); } return true; }
    setMuted(value) { this.muted = value; }
    setSession(value) { sessions.push(value); }
    setHidden() {}
    reset() {}
    play() {}
    events() {}
  }
  const context = vm.createContext({ document, localStorage, fetch: fetchStory, HTMLElement: Element, HTMLCanvasElement: Canvas, HTMLButtonElement: Button, matchMedia: () => ({ matches: true }), crypto: { getRandomValues(array) { if (seedFailure) { seedFailure = false; throw new Error('test seed unavailable'); } seedCalls++; array[0] = 41 + seedCalls; } }, requestAnimationFrame: callback => { raf = callback; }, console, location: { search: '' }, URLSearchParams, setTimeout, clearTimeout, addEventListener: (name, handler) => listeners.set(name, handler) });
  context.window = context;
  const cache = new Map();
  function load(name) {
    if (cache.has(name)) return cache.get(name).exports;
    const module = { exports: {} }; cache.set(name, module);
    let source = readFileSync(`dist/${name}`, 'utf8');
    if (name === 'main.js') source += '\nglobalThis.inspectMain = (complete = false) => JSON.stringify({ world, actions: recording.actions, screen, checksum: finalChecksum(world), replayVerified, lastRecording, ...(complete ? { recording, playingRecording } : {}) }); globalThis.inspectContentFrozen = () => Object.isFrozen(desertContent) && Object.values(desertContent).every(value => Object.isFrozen(value)); globalThis.inspectNoticeTimer = () => noticeTimer; globalThis.inspectProgress = () => JSON.stringify({ screen, tick: world.tick }); globalThis.invokeReplay = () => startReplay(); globalThis.invokeBegin = () => { try { begin(world.context); } catch (error) { fail(error); } }; globalThis.openStage = value => showOpening(JSON.parse(value)); globalThis.inspectRadio = () => radioState.kind; globalThis.inspectRadioBeat = () => "beat" in radioState ? radioState.beat : null; globalThis.fixtureWorld = value => { const { seed, context, ...mutable } = JSON.parse(value); Object.assign(world, mutable); }; globalThis.replaceRecording = value => { lastRecording = JSON.parse(value); };';
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const require = path => path === './render.js' ? { createRenderer: () => () => {} } : path === './audio.js' ? { Synth } : path === './logger.js' ? { log: (...entry) => logs.push(entry) } : load(path.slice(2));
    vm.runInContext(`(function(require,module,exports){${compiled}\n})`, context, { filename: name })(require, module, module.exports);
    return module.exports;
  }
  load('main.js');
  const snapshot = (complete = false) => JSON.parse(context.inspectMain(complete));
  const event = (name, props = {}) => { const value = { target: active ?? get('game'), repeat: false, preventDefault() { this.defaultPrevented = true; }, ...props }; listeners.get(name)?.(value); return value; };
  const click = label => { const node = all().find(node => node.tagName === 'BUTTON' && node.textContent === label); assert.ok(node, `button ${label}`); node.onclick(); return node; };
  return { get, click, event, logs, sessions, snapshot, session: () => snapshot(true), progress: () => JSON.parse(context.inspectProgress()), document, advanceTimers, cancelledTimers, get noticeTimer() { return context.inspectNoticeTimer(); }, get pendingTimers() { return [...timers.keys()]; }, rejectAudio() { audioFailure = true; }, failNextSeed() { seedFailure = true; }, invokeBegin() { context.invokeBegin(); }, openStage(value) { return context.openStage(JSON.stringify(value)); }, replaceRecording(value) { context.replaceRecording(JSON.stringify(value)); }, invokeReplay() { context.invokeReplay(); }, get radioState() { return context.inspectRadio(); }, get radioBeat() { return context.inspectRadioBeat(); }, fixtureWorld(value) { context.fixtureWorld(JSON.stringify(value)); }, get audioActivations() { return audioActivations; }, get active() { return active; }, get seedCalls() { return seedCalls; }, get contentFrozen() { return context.inspectContentFrozen(); }, frame(delta = 100) { now += delta; raf(now); }, key(code, repeat = false, target = get('game')) { return event('keydown', { code, repeat, target }); }, release(code) { event('keyup', { code }); }, pointer(id, name, pointerId = 9, x = 45, y = 0) { get(id).events.get(name)?.({ pointerId, clientX: 55 + x, clientY: 55 + y, preventDefault() {} }); }, activate(id, code) { const node = get(id); node.focus(); const down = event('keydown', { code, target: node }); event('keyup', { code, target: node }); if (!down.defaultPrevented) node.onclick(); return down; } };
}
test('actual main expires notice text and visibility at 3500 ms without changing the complete session', () => {
  const app = harness('{'), before = app.session(), notice = app.get('notice');
  assert.ok(app.logs.some(([level, name]) => level === 'error' && name === 'runtime.failure'));
  assert.equal(notice.textContent, '系统异常，请刷新重试。'); assert.equal(notice.classList.contains('visible'), true);
  app.advanceTimers(3499); assert.equal(notice.textContent, '系统异常，请刷新重试。'); assert.equal(notice.classList.contains('visible'), true); assert.equal(app.pendingTimers.length, 1);
  app.advanceTimers(1); assert.equal(notice.textContent, ''); assert.equal(notice.classList.contains('visible'), false); assert.equal(app.noticeTimer, 0); assert.deepEqual(app.pendingTimers, []); assert.deepEqual(app.session(), before);
});
function assertNotice(app, message) {
  assert.equal(app.get('notice').textContent, message); assert.equal(app.get('notice').classList.contains('visible'), Boolean(message));
  assert.equal(app.pendingTimers.length, message ? 1 : 0); assert.equal(Boolean(app.noticeTimer), Boolean(message));
}
test('replacement notice keeps its own deadline after the cancelled notice deadline', () => {
  const app = harness(), before = app.session(); app.event('error', { message: 'first runtime error' }); const first = app.noticeTimer;
  app.advanceTimers(1000); app.get('language').onclick(); app.event('unhandledrejection', { reason: 'second runtime error' }); const second = app.noticeTimer;
  assert.notEqual(first, second); assert.ok(app.cancelledTimers.includes(first)); assert.deepEqual(app.pendingTimers, [second]);
  app.advanceTimers(2500); assertNotice(app, 'System error. Refresh to retry.'); assert.equal(app.noticeTimer, second);
  app.advanceTimers(999); assertNotice(app, 'System error. Refresh to retry.'); app.advanceTimers(1); assertNotice(app, '');
  assert.deepEqual(app.session(), before);
  assert.deepEqual(app.logs.filter(([, name]) => name === 'runtime.failure').map(([level, , data]) => [level, data.message]), [['error', 'first runtime error'], ['error', 'second runtime error']]);
});
test('pause blur visibility language and mute retain the notice and its original deadline', () => {
  const app = harness(); app.click('启动任务'); app.click('部署出发'); app.event('error', { message: 'retained error' }); const timer = app.noticeTimer;
  app.advanceTimers(1000); app.key('KeyP'); assert.equal(app.session().screen, 'game'); assert.equal(app.session().world.phase.kind, 'paused');
  app.release('KeyP'); app.key('KeyP'); assert.equal(app.session().world.phase.kind, 'running'); app.event('blur'); assert.equal(app.session().world.phase.kind, 'paused');
  app.document.hidden = true; app.event('visibilitychange'); app.document.hidden = false; app.event('visibilitychange'); app.get('language').onclick(); app.get('sound').onclick();
  assertNotice(app, '系统异常，请刷新重试。'); assert.equal(app.noticeTimer, timer); assert.deepEqual(app.cancelledTimers, []);
  const paused = app.session(); assert.equal(paused.screen, 'game'); assert.equal(paused.world.phase.kind, 'paused');
  app.advanceTimers(2499); assertNotice(app, '系统异常，请刷新重试。'); app.advanceTimers(1); assertNotice(app, ''); assert.deepEqual(app.session(), paused);
});
test('Replay without a recording keeps the existing notice unchanged', () => {
  const app = harness(), before = app.session(); app.event('error', { message: 'no recording' }); const timer = app.noticeTimer;
  app.advanceTimers(1000); app.click('回放上一局'); assert.deepEqual(app.session(), before); assertNotice(app, '系统异常，请刷新重试。'); assert.equal(app.noticeTimer, timer); assert.deepEqual(app.cancelledTimers, []);
  app.advanceTimers(2499); assertNotice(app, '系统异常，请刷新重试。'); app.advanceTimers(1); assertNotice(app, '');
});
test('successful deployment cancels the old notice before a fresh bilingual audio error', async () => {
  for (const language of ['zh', 'en']) {
    const app = harness(); app.click('启动任务'); app.event('error', { message: 'opening error' }); const timer = app.noticeTimer;
    if (language === 'en') app.get('language').onclick();
    app.advanceTimers(1000); app.rejectAudio(); app.get('opening-continue').onclick(); assertNotice(app, ''); assert.ok(app.cancelledTimers.includes(timer));
    const begun = app.session(); assert.deepEqual(begun.world, createWorld({ ...begun.world.context, seed: begun.world.seed })); assert.deepEqual(begun.recording, startRecording(begun.world)); assert.deepEqual(begun.actions, []);
    await new Promise(resolve => setImmediate(resolve));
    const message = language === 'zh' ? '音频启动失败，游戏可继续。' : 'Audio unavailable. You can keep playing.';
    assertNotice(app, message); assert.ok(app.logs.some(([level, name, data]) => level === 'error' && name === 'audio.activation_failed' && data.error.includes('test audio unavailable')));
    app.advanceTimers(2500); assertNotice(app, message); app.advanceTimers(999); assertNotice(app, message); app.advanceTimers(1); assertNotice(app, ''); assert.deepEqual(app.session(), begun);
  }
});
test('a synchronous UI failure after deployment publishes a fresh bilingual error with its own deadline', () => {
  for (const language of ['zh', 'en']) {
    const app = harness(); app.click('启动任务'); if (language === 'en') app.get('language').onclick();
    app.event('error', { message: 'old opening error' }); const oldTimer = app.noticeTimer; app.advanceTimers(1000);
    const game = app.get('game'), setAttribute = game.setAttribute.bind(game);
    game.setAttribute = (...args) => { game.setAttribute = setAttribute; throw new Error(`test UI update unavailable: ${args[0]}`); };
    app.get('opening-continue').onclick(); const begun = app.session();
    assert.equal(begun.screen, 'game'); assert.deepEqual(begun.world, createWorld({ ...begun.world.context, seed: begun.world.seed })); assert.deepEqual(begun.recording, startRecording(begun.world)); assert.deepEqual(begun.actions, []);
    const message = language === 'zh' ? '系统异常，请刷新重试。' : 'System error. Refresh to retry.';
    assertNotice(app, message); assert.notEqual(app.noticeTimer, oldTimer); assert.ok(app.cancelledTimers.includes(oldTimer));
    assert.ok(app.logs.some(([level, name, data]) => level === 'error' && name === 'runtime.failure' && data.message.includes('test UI update unavailable')));
    app.advanceTimers(2500); assertNotice(app, message); app.advanceTimers(999); assertNotice(app, message); app.advanceTimers(1); assertNotice(app, ''); assert.deepEqual(app.session(), begun);
  }
});
test('built content contains exactly eight canonical entries and escapes every locale without changing text', () => {
  const expected = Object.fromEntries(catalog.filter(entry => contentBeats.includes(entry.beat)).map(({ beat, id, zh, en }) => [contentKey(beat), { id, zh, en }]));
  assert.deepEqual(JSON.parse(embedded), expected); assert.equal(harness().contentFrozen, true);
  for (const beat of contentBeats) for (const language of ['zh', 'en']) {
    const changed = structuredClone(catalog); changed.find(entry => entry.beat === beat)[language] = '</script><strong>" & \u2028\u2029 text';
    const output = embedDesertContent('<script id="desert-content" type="application/json"></script>', changed);
    assert.equal(JSON.parse(output.match(/json">([^]*?)<\/script>/)[1])[contentKey(beat)][language], changed.find(entry => entry.beat === beat)[language]);
    assert.equal(output.match(/<\/script>/g).length, 1);
  }
  for (const invalid of [null, catalog.slice(1), catalog.map((entry, i) => i ? entry : { ...entry, en: '' })]) assert.throws(() => embedDesertContent('', invalid));
  for (const invalid of [catalog.filter(entry => entry.beat !== 'defeat'), catalog.map(entry => entry.beat === 'defeat' ? { ...entry, id: 'desert-base.victory' } : entry), catalog.map(entry => entry.beat === 'defeat' ? { ...entry, zh: '' } : entry)]) assert.throws(() => embedDesertContent('<script id="desert-content" type="application/json"></script>', invalid));
  for (const beat of contentBeats) for (const transform of [entries => entries.filter(entry => entry.beat !== beat), entries => entries.map(entry => entry.beat === beat ? { ...entry, id: 'desert-base.invalid' } : entry), entries => entries.map(entry => entry.beat === beat ? { ...entry, en: ' ' } : entry), entries => entries.map(entry => entry.beat === beat ? { ...entry, zh: 7 } : entry), entries => entries.map(entry => entry.beat === beat ? { ...entry, extra: true } : entry)]) assert.throws(() => embedDesertContent('<script id="desert-content" type="application/json"></script>', transform(structuredClone(catalog))));
  assert.throws(() => embedDesertContent('', catalog), /anchor/);
});
test('embedded content preserves replacement tokens in all eight bilingual entries', () => {
  const anchor = '<script id="desert-content" type="application/json"></script>';
  for (const token of ['$$', '$&', '$`', "$'", '$1', '$<name>']) {
    const changed = structuredClone(catalog);
    for (const entry of changed) for (const language of ['zh', 'en']) entry[language] = `Signal ${token} received`;
    const output = embedDesertContent(`before${anchor}after`, changed);
    const content = JSON.parse(output.match(/json">([^]*?)<\/script>/)[1]);
    for (const beat of contentBeats) for (const language of ['zh', 'en']) assert.equal(content[contentKey(beat)][language], changed.find(entry => entry.beat === beat)[language]);
    assert.ok(output.startsWith('before<script'));
    assert.ok(output.endsWith('</script>after'));
  }
});
test('actual main keeps World, RNG and recording frozen through opening and preserves text, scroll and focus', () => {
  const app = harness(); const preview = app.snapshot(); app.click('启动任务');
  assert.equal(app.snapshot().screen, 'opening'); assert.equal(app.seedCalls, 0);
  app.get('opening-panel').scrollTop = 72; const primary = app.active;
  for (let i = 0; i < 20; i++) { app.frame(60000); app.key('KeyD'); app.key('Space'); }
  app.get('language').focus(); app.get('language').onclick();
  assert.equal(app.active, app.get('language')); assert.equal(app.get('opening-panel').scrollTop, 72); assert.equal(app.get('opening-continue'), primary);
  assert.equal(app.get('opening-story').textContent, catalog[0].en); assert.equal(app.get('opening-objective').textContent, catalog[1].en);
  app.get('sound').onclick(); app.event('blur'); app.document.hidden = true; app.event('visibilitychange'); app.frame(600000); app.document.hidden = false; app.event('visibilitychange');
  app.pointer('joystick', 'pointerdown'); app.pointer('dash', 'pointerdown');
  const opening = app.snapshot(); assert.deepEqual(opening.world, preview.world); assert.deepEqual(opening.actions, preview.actions); assert.equal(app.seedCalls, 0); assert.equal(opening.screen, 'opening'); assert.equal(app.sessions.at(-1), 'menu');
  app.activate('opening-skip', 'Space'); assert.equal(app.seedCalls, 1); assert.equal(app.snapshot().world.tick, 0); assert.deepEqual(app.snapshot().actions, []); assert.equal(app.active, app.get('game'));
  primary.onclick(); assert.equal(app.seedCalls, 1);
  app.key('KeyD', true); app.key('Space', true); app.frame(); app.frame();
  assert.ok(app.snapshot().actions.every(action => action.input.x === 0 && !action.input.dash));
  app.release('KeyD'); app.release('Space'); app.key('KeyD'); app.key('Space'); app.frame();
  assert.ok(app.snapshot().actions.some(action => action.input.x === 1 && action.input.dash));
});
test('pointer, Enter and Space completion produce the same seeded actions after short and long waits', () => {
  const results = [];
  for (const [wait, finish, key] of [[0, 'opening-continue', null], [500000, 'opening-continue', 'Enter'], [900000, 'opening-skip', 'Space']]) {
    const app = harness(); app.click('启动任务'); app.frame(wait); if (wait) { app.get('language').onclick(); app.get('sound').onclick(); }
    if (key) assert.equal(app.activate(finish, key).defaultPrevented, undefined); else app.get(finish).onclick();
    app.key('KeyD', true); app.key('Space', true); app.frame(); app.frame(); app.release('KeyD'); app.key('KeyD'); app.frame(); app.release('KeyD'); app.frame();
    assert.equal(app.seedCalls, 1); const state = app.snapshot(); results.push({ world: state.world, actions: state.actions, checksum: state.checksum });
  }
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[0], results[2]);
});
test('skip retains bilingual objective in pause; pointer capture clears and stale touch cannot refill paused input', () => {
  const app = harness(); app.click('启动任务'); app.click('跳过开场'); app.pointer('joystick', 'pointerdown'); assert.equal(app.get('joystick').hasPointerCapture(9), true);
  app.key('KeyP'); assert.equal(app.snapshot().world.phase.kind, 'paused'); assert.equal(app.get('joystick').hasPointerCapture(9), false); assert.equal(app.get('stick').style.transform, '');
  assert.equal(app.get('overlay').children[0].children.find(node => node.dataset.storyId)?.textContent, catalog[1].zh);
  app.get('language').onclick(); assert.equal(app.get('overlay').children[0].children.find(node => node.dataset.storyId)?.textContent, catalog[1].en);
  app.pointer('joystick', 'pointermove'); app.pointer('dash', 'pointerdown'); app.key('KeyP'); app.frame(); app.frame(); assert.ok(app.snapshot().actions.filter(action => action.kind === 'tick').every(action => action.input.x === 0 && !action.input.dash));
});
function naturalLoss(app, headerFocus = false) {
  app.click('启动任务'); app.click('部署出发');
  if (headerFocus) app.get('sound').focus();
  for (let i = 0; i < 15000 && !['won', 'lost'].includes(app.snapshot().world.phase.kind); i++) { if (app.snapshot().world.phase.kind === 'upgrading') app.key('Digit1'); app.frame(); }
  assert.equal(app.snapshot().screen, 'game'); assert.equal(app.snapshot().world.phase.kind, 'lost');
  return app.snapshot();
}
test('natural live loss draws the original defeat scene and preserves terminal state, content, nodes, focus and scroll', () => {
  const app = harness(), terminal = naturalLoss(app), panel = app.get('defeat-panel'), retry = app.get('defeat-retry'), replay = app.get('defeat-replay'), art = app.get('defeat-art');
  assert.equal(app.active, retry); assert.equal(art.width, 320); assert.equal(art.height, 180); assert.equal(art.attributes.role, 'img');
  const original = []; drawDesertScene({ save() {}, restore() {}, fillRect(...rect) { original.push([this.fillStyle, ...rect]); } }, 'defeat');
  assert.deepEqual(art.commands, original); assert.equal(art.commands.length, 845);
  assert.equal(createHash('sha256').update(JSON.stringify(art.commands)).digest('hex'), '326aad9e54a5279b2608ac9c0f569c8e90ed71a95ea7f3839ffa91f995ee4142');
  const defeat = catalog.find(entry => entry.beat === 'defeat');
  assert.equal(app.get('defeat-story').dataset.storyId, defeat.id); assert.equal(app.get('defeat-story').textContent, defeat.zh);
  panel.scrollTop = 81; const story = app.get('defeat-story'), statLabel = app.get('defeat-time');
  for (let i = 0; i < 20; i++) { app.frame(60000); for (const code of ['KeyD', 'Space', 'KeyP', 'Escape', 'Digit1']) app.key(code); }
  app.get('language').focus(); app.get('language').onclick();
  assert.equal(app.active, app.get('language')); assert.equal(app.get('defeat-story').textContent, defeat.en); assert.ok(art.attributes['aria-label']);
  app.get('sound').onclick(); app.event('blur'); app.document.hidden = true; app.event('visibilitychange'); app.frame(600000); app.document.hidden = false; app.event('visibilitychange');
  app.pointer('joystick', 'pointerdown'); app.pointer('dash', 'pointerdown');
  assert.deepEqual(app.snapshot(), terminal); assert.equal(app.seedCalls, 1); assert.equal(app.sessions.at(-1), 'terminal');
  assert.equal(app.get('defeat-panel'), panel); assert.equal(app.get('defeat-retry'), retry); assert.equal(app.get('defeat-replay'), replay); assert.equal(app.get('defeat-art'), art); assert.equal(app.get('defeat-story'), story); assert.equal(app.get('defeat-time'), statLabel); assert.equal(panel.scrollTop, 81); assert.equal(app.active, app.get('language'));
  for (const entry of catalog.filter(entry => ['victory', 'next-clue'].includes(entry.beat))) assert.equal(panel.children.some(node => node.dataset.storyId === entry.id || [entry.zh, entry.en].includes(node.textContent)), false);
});
test('natural loss preserves existing header focus and direct Replay verifies the full recording without live narrative', () => {
  const storage = memoryStorage();
  const app = harness(embedded, storage), terminal = naturalLoss(app, true); assert.equal(app.active, app.get('sound'));
  assert.deepEqual(storage.writes, []);
  assert.equal(app.activate('defeat-replay', 'Space').defaultPrevented, undefined); assert.equal(app.snapshot().screen, 'replay'); assert.equal(app.seedCalls, 1); assert.equal(app.get('defeat-panel'), null);
  for (let i = 0; i < 15000 && app.snapshot().screen === 'replay'; i++) { app.frame(); assert.equal(app.get('defeat-panel'), null); }
  assert.equal(app.snapshot().screen, 'replay-end'); assert.equal(app.snapshot().replayVerified, true); assert.equal(app.snapshot().checksum, terminal.checksum); assert.deepEqual(app.snapshot().world, terminal.world); assert.ok(app.logs.some(([, name]) => name === 'replay.finished')); assert.equal(app.get('defeat-panel'), null);
  assert.deepEqual(storage.writes, []);
});
test('a selected stage survives deployment, same-stage retry and replay while home restores the desert preview', async () => {
  const storage = memoryStorage(savedProgress('rainforest'));
  let requests = 0;
  const story = JSON.parse(readFileSync('content/rainforest.story.json', 'utf8'));
  const app = harness(embedded, storage, async () => { requests++; return { ok: true, json: async () => story }; });
  const selected = { stageId: 'rainforest', rulesVersion: 'rainforest-1' };
  await app.openStage(selected);
  for (const beat of ['opening', 'objective']) {
    const node = app.get(beat === 'opening' ? 'opening-story' : 'opening-objective');
    const entry = story.find(value => value.beat === beat);
    assert.equal(node.dataset.storyId, entry.id);
    assert.equal(node.textContent, entry.zh);
  }
  assert.equal(app.get('footer-left').textContent, '雨林深处');
  app.get('language').onclick();
  assert.equal(app.get('footer-left').textContent, 'Deep Rainforest');
  assert.equal(app.get('opening-story').textContent, story.find(value => value.beat === 'opening').en);
  app.get('language').onclick();
  app.get('opening-continue').onclick();
  assert.deepEqual(app.session().world.context, selected);
  assert.equal(app.session().recording.stageId, selected.stageId);
  const firstSeed = app.session().world.seed;
  assert.equal(app.get('footer-left').textContent, `雨林深处 · 任务种子 ${firstSeed} · 取回研究站的信号记录`);
  assert.equal(app.get('footer-right').textContent, '');
  app.get('language').onclick();
  assert.equal(app.get('footer-left').textContent, `Deep Rainforest · Mission seed ${firstSeed} · Recover the station's signal records`);
  app.get('language').onclick();
  for (let i = 0; i < 15000 && app.snapshot().world.phase.kind !== 'lost'; i++) {
    if (app.snapshot().world.phase.kind === 'upgrading') app.key('Digit1');
    app.frame();
  }
  const first = app.session();
  assert.equal(first.world.phase.kind, 'lost');
  const defeat = story.find(value => value.beat === 'defeat');
  const panel = app.get('defeat-panel'), art = app.get('defeat-art'), storyNode = app.get('defeat-story');
  assert.equal(app.active, app.get('defeat-retry'));
  assert.equal(storyNode.dataset.storyId, defeat.id);
  assert.equal(storyNode.textContent, defeat.zh);
  assert.match(app.get('defeat-heading').textContent, /雨林深处/);
  const original = [];
  drawRainforestFailure({ save() {}, restore() {}, fillRect(...rect) { original.push([this.fillStyle, ...rect]); } });
  assert.deepEqual(art.commands, original);
  app.get('language').focus(); app.get('language').onclick();
  assert.equal(app.active, app.get('language'));
  assert.equal(app.get('defeat-panel'), panel);
  assert.equal(storyNode.textContent, defeat.en);
  assert.match(art.getAttribute('aria-label'), /station signal/);
  assert.match(app.get('defeat-heading').textContent, /Deep Rainforest/);
  assert.equal(app.get('footer-left').textContent, `Deep Rainforest · Mission seed ${firstSeed} · Recover the station's signal records`);
  assert.equal(app.get('victory-next-clue'), null);
  app.get('language').onclick();
  app.get('defeat-retry').onclick();
  const retry = app.session();
  assert.deepEqual(retry.world.context, selected);
  assert.notEqual(retry.world.seed, first.world.seed);
  assert.deepEqual(retry.world, createWorld({ ...selected, seed: retry.world.seed }));
  finishIdle(app);
  assert.equal(app.get('defeat-story').textContent, defeat.zh);
  assert.equal(requests, 1);
  app.get('defeat-replay').onclick();
  assert.deepEqual(app.session().world.context, selected);
  assert.equal(app.session().world.seed, retry.world.seed);
  assert.equal(app.get('footer-left').textContent, `雨林深处 · 任务种子 ${retry.world.seed} · 回放中`);
  assert.equal(app.get('defeat-panel'), null);
  for (let i = 0; i < 15000 && app.snapshot().screen === 'replay'; i++) app.frame();
  assert.equal(app.snapshot().screen, 'replay-end');
  assert.equal(app.snapshot().replayVerified, true);
  assert.equal(app.get('footer-left').textContent, `雨林深处 · 任务种子 ${retry.world.seed} · 回放结束`);
  app.click('返回基地');
  assert.equal(app.snapshot().world.context.stageId, 'desert-base');
  assert.equal(app.get('footer-left').textContent, '沙漠开场与战斗测试');
  assert.equal(app.get('footer-right').textContent, '后续剧情与战役待接入');
  assert.deepEqual(storage.writes, []);
});

test('direct Retry skips the defeat narrative and rebuilds the current stage with a fresh seed', () => {
  const app = harness(), terminal = naturalLoss(app); assert.equal(app.activate('defeat-retry', 'Enter').defaultPrevented, undefined);
  const retry = app.snapshot(); assert.equal(retry.screen, 'game'); assert.equal(retry.world.phase.kind, 'running'); assert.equal(retry.world.tick, 0); assert.equal(retry.world.level, 1); assert.equal(retry.world.xp, 0); assert.equal(retry.world.player.hp, retry.world.player.maxHp); assert.deepEqual(retry.world, createWorld({ ...retry.world.context, seed: retry.world.seed })); assert.deepEqual(retry.world.context, terminal.world.context); assert.deepEqual(retry.actions, []); assert.equal(app.seedCalls, 2); assert.notEqual(retry.world.seed, terminal.world.seed); assert.equal(app.get('defeat-panel'), null); assert.equal(app.get('opening-panel'), null); assert.equal(app.active, app.get('game'));
  app.key('KeyD', true); app.key('Space', true); app.frame(); app.frame(); assert.ok(app.snapshot().actions.every(action => action.input.x === 0 && !action.input.dash));
});
function naturalWin(app, focus = 'canvas', language = 'zh') {
  app.click('启动任务'); app.click('部署出发'); app.pointer('joystick', 'pointerdown'); app.frame();
  if (language === 'en') app.get('language').onclick();
  if (focus === 'body') app.document.body.focus();
  if (focus === 'header') app.get('sound').focus();
  const { recording } = play(42);
  for (const action of recording.actions) {
    if (action.kind === 'choose') { const state = app.snapshot(); assert.equal(state.world.phase.kind, 'upgrading', `tick ${state.world.tick}`); const offers = state.world.phase.offers; app.key(`Digit${offers.indexOf(action.upgrade) + 1}`); }
    else if (action.kind === 'tick') { const input = normalizeInput(action.input); app.pointer('joystick', 'pointermove', 9, input.x * 40, input.y * 40); if (action.input.dash) { app.key('Space'); app.release('Space'); } app.frame(1000 / 60 + .000001); }
  }
  assert.equal(app.snapshot().world.phase.kind, 'won');
  const terminal = app.snapshot(), replayed = replay(terminal.lastRecording);
  assert.deepEqual(terminal.world, JSON.parse(JSON.stringify(replayed)));
  assert.deepEqual(terminal.actions, terminal.lastRecording.actions);
  assert.equal(terminal.checksum, finalChecksum(replayed));
  assert.equal(terminal.checksum, terminal.lastRecording.finalChecksum);
  assert.equal(app.snapshot().world.tick, 10800); assert.equal(app.snapshot().world.bossKilled, true);
  return app.snapshot();
}
function noticeTerminal(app) { naturalWin(app); return app.session(); }
test('normal Boss notices expire in both languages without changing the full live or replay session', () => {
  const bossEntry = catalog.find(entry => entry.beat === 'boss');
  const app = harness(), terminal = noticeTerminal(app); assertNotice(app, bossEntry.zh);
  app.advanceTimers(3499); assertNotice(app, bossEntry.zh); app.advanceTimers(1); assertNotice(app, ''); assert.deepEqual(app.session(), terminal);
  app.get('language').onclick(); app.activate('victory-replay', 'Enter');
  for (let i = 0; i < 15000 && app.progress().tick < 8400; i++) app.frame();
  assert.equal(app.session().screen, 'replay'); assertNotice(app, 'Harvester incoming'); const boss = app.session();
  app.advanceTimers(3499); assertNotice(app, 'Harvester incoming'); app.advanceTimers(1); assertNotice(app, ''); assert.deepEqual(app.session(), boss);
  for (let i = 0; i < 15000 && app.progress().screen === 'replay'; i++) app.frame();
  const done = app.session(); assert.equal(done.replayVerified, true); assert.deepEqual(done.world, terminal.world); assert.equal(done.checksum, terminal.checksum); assert.deepEqual(done.recording, terminal.recording); assert.deepEqual(done.lastRecording, terminal.lastRecording);
});
test('native Retry clears active Boss notice and timer while replacing the complete live session', () => {
  const app = harness(); naturalWin(app, 'canvas', 'en');
  const terminal = app.session(), timer = app.noticeTimer; assertNotice(app, catalog.find(entry => entry.beat === 'boss').en);
  app.advanceTimers(1000); app.activate('victory-retry', 'Enter'); assertNotice(app, ''); assert.ok(app.cancelledTimers.includes(timer));
  const actual = app.session(), world = createWorld({ ...terminal.world.context, seed: actual.world.seed });
  assert.notEqual(world.seed, terminal.world.seed); assert.equal(app.seedCalls, 2);
  assert.deepEqual(actual, { ...terminal, world, actions: [], recording: startRecording(world), playingRecording: null, screen: 'game', checksum: finalChecksum(world) });
  app.advanceTimers(1000); app.event('error', { message: 'new retry error' }); const afterError = app.session();
  app.advanceTimers(1500); assertNotice(app, 'System error. Refresh to retry.'); app.advanceTimers(1999); assertNotice(app, 'System error. Refresh to retry.'); app.advanceTimers(1); assertNotice(app, ''); assert.deepEqual(app.session(), afterError);
});
test('native Replay and Home cancel Boss timers while retaining recordings and complete replay results', async () => {
  const app = harness(), terminal = noticeTerminal(app), liveTimer = app.noticeTimer;
  app.advanceTimers(1000); app.rejectAudio(); app.activate('victory-replay', 'Space'); assertNotice(app, ''); assert.ok(app.cancelledTimers.includes(liveTimer));
  const start = app.session(), initial = createWorld({ ...terminal.world.context, seed: terminal.world.seed });
  assert.deepEqual(start, { ...terminal, world: initial, screen: 'replay', playingRecording: terminal.lastRecording, checksum: finalChecksum(initial) }); assert.equal(app.seedCalls, 1);
  await new Promise(resolve => setImmediate(resolve)); assertNotice(app, '音频启动失败，游戏可继续。');
  app.advanceTimers(2500); assertNotice(app, '音频启动失败，游戏可继续。'); app.advanceTimers(999); assertNotice(app, '音频启动失败，游戏可继续。'); app.advanceTimers(1); assertNotice(app, ''); assert.deepEqual(app.session(), start);
  for (let i = 0; i < 15000 && app.progress().screen === 'replay'; i++) app.frame();
  const done = app.session(); assert.equal(done.replayVerified, true); assert.equal(done.checksum, terminal.checksum); assert.deepEqual(done.world, terminal.world); assert.deepEqual(done.recording, terminal.recording); assert.deepEqual(done.lastRecording, terminal.lastRecording); assertNotice(app, '收割者抵达');
  const endTimer = app.noticeTimer; app.click('返回基地'); assertNotice(app, ''); assert.ok(app.cancelledTimers.includes(endTimer));
  const endHome = app.session(), endPreview = createWorld({ ...terminal.world.context, seed: 208907 });
  assert.deepEqual(endHome, { ...done, world: endPreview, screen: 'title', playingRecording: null, checksum: finalChecksum(endPreview) });
  app.click('回放上一局'); assertNotice(app, '');
  for (let i = 0; i < 15000 && app.progress().tick < 8400; i++) app.frame();
  assertNotice(app, '收割者抵达'); const boss = app.session(), replayTimer = app.noticeTimer; app.advanceTimers(1000); app.get('pause').onclick(); assertNotice(app, ''); assert.ok(app.cancelledTimers.includes(replayTimer));
  const home = app.session(), preview = createWorld({ ...terminal.world.context, seed: 208907 });
  assert.deepEqual(home, { ...boss, world: preview, screen: 'title', playingRecording: null, checksum: finalChecksum(preview) }); assert.equal(app.seedCalls, 1);
  app.click('回放上一局'); app.event('error', { message: 'before home audio failure' }); const prior = app.noticeTimer; app.rejectAudio(); app.get('pause').onclick(); assertNotice(app, ''); assert.ok(app.cancelledTimers.includes(prior));
  await new Promise(resolve => setImmediate(resolve)); assertNotice(app, '音频启动失败，游戏可继续。');
  assert.ok(app.logs.some(([level, name]) => level === 'error' && name === 'audio.activation_failed'));
  const afterError = app.session(); app.advanceTimers(3499); assertNotice(app, '音频启动失败，游戏可继续。'); app.advanceTimers(1); assertNotice(app, ''); assert.deepEqual(app.session(), afterError);
});
test('invalid Replay preserves its bilingual rejection notice and the complete current session', () => {
  const app = harness(); naturalLoss(app);
  for (const language of ['zh', 'en']) {
    if (language === 'en') app.get('language').onclick();
    app.replaceRecording({ ...app.session().lastRecording, actions: 'invalid actions' }); const before = app.session();
    app.event('error', { message: 'old terminal notice' }); const timer = app.noticeTimer; app.advanceTimers(1000); app.activate('defeat-replay', 'Enter');
    const message = language === 'zh' ? '无法播放，回放数据无效。进度未改变。' : 'Cannot play this replay. Its data is invalid. Progress is unchanged.';
    assertNotice(app, message); assert.ok(app.cancelledTimers.includes(timer)); assert.deepEqual(app.session(), before);
    assert.ok(app.logs.some(([level, name, data]) => level === 'warn' && name === 'replay.rejected' && data.code === 'invalid-data'));
    app.advanceTimers(2500); assertNotice(app, message); app.advanceTimers(999); assertNotice(app, message); app.advanceTimers(1); assertNotice(app, ''); assert.deepEqual(app.session(), before);
  }
});
test('replay end preserves a new verification error for its full duration', () => {
  const app = harness(), terminal = naturalLoss(app); app.replaceRecording({ ...terminal.lastRecording, finalChecksum: terminal.checksum === '00000000' ? 'ffffffff' : '00000000' });
  app.activate('defeat-replay', 'Enter');
  for (let i = 0; i < 15000 && app.progress().screen === 'replay'; i++) app.frame();
  const done = app.session(); assert.equal(done.screen, 'replay-end'); assert.equal(done.replayVerified, false); assert.deepEqual(done.world, terminal.world); assert.equal(done.checksum, terminal.checksum); assert.deepEqual(done.actions, terminal.actions);
  assertNotice(app, '回放校验失败。进度未改变。'); assert.ok(app.logs.some(([level, name, data]) => level === 'error' && name === 'replay.rejected' && data.code === 'checksum-mismatch'));
  app.advanceTimers(3499); assertNotice(app, '回放校验失败。进度未改变。'); app.advanceTimers(1); assertNotice(app, ''); assert.deepEqual(app.session(), done);
});
test('natural live victory draws the original scene and keeps full bilingual story, state, nodes, focus and scroll stable', () => {
  const app = harness(), terminal = naturalWin(app), panel = app.get('victory-panel'), retry = app.get('victory-retry'), replay = app.get('victory-replay'), art = app.get('victory-art');
  assert.ok(panel); assert.equal(app.active, retry); assert.equal(retry.focusOptions.preventScroll, true); assert.equal(retry.focusCalls, 1);
  assert.equal(art.width, 320); assert.equal(art.height, 180); assert.equal(art.attributes.role, 'img'); assert.equal(panel.attributes['aria-labelledby'], 'victory-heading');
  const original = []; drawDesertScene({ save() {}, restore() {}, fillRect(...rect) { original.push([this.fillStyle, ...rect]); } }, 'victory');
  assert.deepEqual(art.commands, original); assert.equal(art.commands.length, 816);
  assert.equal(createHash('sha256').update(JSON.stringify(art.commands)).digest('hex'), '98f2ed7fec6239a2a78f0f25cd8da6e8a787a2d29b1f245545b8511974001203');
  const victory = catalog.find(entry => entry.beat === 'victory'), clue = catalog.find(entry => entry.beat === 'next-clue');
  const story = app.get('victory-story'), nextClue = app.get('victory-next-clue'), statLabel = app.get('victory-time');
  assert.equal(story.dataset.storyId, victory.id); assert.equal(nextClue.dataset.storyId, clue.id);
  assert.ok(panel.children.indexOf(story) < panel.children.indexOf(nextClue));
  assert.equal(story.textContent, victory.zh); assert.equal(nextClue.textContent, clue.zh);
  assert.equal(app.get('defeat-panel'), null); assert.equal(app.get('defeat-art'), null);
  assert.equal(panel.children.at(-1).children.length, 2); assert.equal(retry.textContent, '重新部署'); assert.equal(replay.textContent, '回放上一局');
  assert.ok(app.logs.some(([, name, data]) => name === 'session.finished' && data.outcome === 'won' && data.checksum === terminal.checksum));
  panel.scrollTop = 87;
  for (let i = 0; i < 20; i++) { app.frame(60000); for (const code of ['KeyD', 'Space', 'KeyP', 'Escape', 'Digit1']) app.key(code); }
  app.get('language').focus(); app.get('language').onclick();
  assert.equal(story.textContent, victory.en); assert.equal(nextClue.textContent, clue.en); assert.ok(art.attributes['aria-label']);
  app.get('sound').onclick(); app.event('blur'); app.document.hidden = true; app.event('visibilitychange'); app.frame(600000); app.document.hidden = false; app.event('visibilitychange');
  app.pointer('joystick', 'pointerdown'); app.pointer('dash', 'pointerdown');
  assert.deepEqual(app.snapshot(), terminal); assert.equal(app.seedCalls, 1); assert.equal(app.sessions.at(-1), 'terminal');
  for (const [id, node] of [['victory-panel', panel], ['victory-retry', retry], ['victory-replay', replay], ['victory-art', art], ['victory-story', story], ['victory-next-clue', nextClue], ['victory-time', statLabel]]) assert.equal(app.get(id), node);
  assert.equal(panel.scrollTop, 87); assert.equal(app.active, app.get('language')); assert.equal(retry.focusCalls, 1);
});
test('live victory preserves header focus and direct native Replay verifies the complete recording with no result narrative', () => {
  const storage = memoryStorage();
  const app = harness(embedded, storage), terminal = naturalWin(app, 'header'); assert.equal(app.active, app.get('sound')); assert.equal(app.get('victory-retry').focusCalls, undefined);
  assert.deepEqual(storage.writes, [[progressKey, savedProgress('rainforest')]]);
  assert.equal(app.activate('victory-replay', 'Space').defaultPrevented, undefined); assert.equal(app.snapshot().screen, 'replay'); assert.equal(app.seedCalls, 1);
  for (let i = 0; i < 15000 && app.snapshot().screen === 'replay'; i++) { assertNoVictory(app); assert.equal(app.get('defeat-panel'), null); app.frame(); }
  assert.equal(app.snapshot().screen, 'replay-end'); assert.equal(app.snapshot().replayVerified, true); assert.equal(app.snapshot().checksum, terminal.checksum); assert.deepEqual(app.snapshot().world, terminal.world); assert.deepEqual(app.snapshot().lastRecording, terminal.lastRecording); assert.equal(app.seedCalls, 1);
  assert.ok(app.logs.some(([, name]) => name === 'replay.finished')); assertNoVictory(app); assert.equal(app.get('defeat-panel'), null); assert.equal(app.get('opening-panel'), null);
  assert.deepEqual(storage.writes, [[progressKey, savedProgress('rainforest')]]);
});
test('direct native victory Retry skips narrative with fresh seed, empty input and a complete initial world', () => {
  const app = harness(), terminal = naturalWin(app, 'body'); assert.equal(app.active, app.get('victory-retry')); assert.equal(app.get('victory-retry').focusOptions.preventScroll, true);
  assert.equal(app.activate('victory-retry', 'Enter').defaultPrevented, undefined);
  const retry = app.snapshot(); assert.equal(retry.screen, 'game'); assert.equal(retry.world.phase.kind, 'running'); assert.equal(retry.world.tick, 0); assert.equal(retry.world.level, 1); assert.equal(retry.world.xp, 0); assert.equal(retry.world.player.hp, retry.world.player.maxHp); assert.deepEqual(retry.world, createWorld({ ...retry.world.context, seed: retry.world.seed })); assert.deepEqual(retry.world.context, terminal.world.context); assert.deepEqual(retry.actions, []); assert.equal(app.seedCalls, 2); assert.notEqual(retry.world.seed, terminal.world.seed); assert.equal(app.get('defeat-panel'), null); assert.equal(app.get('opening-panel'), null); assert.equal(app.active, app.get('game')); assertNoVictory(app);
  app.key('KeyD', true); app.key('Space', true); app.frame(); app.frame(); assert.ok(app.snapshot().actions.every(action => action.input.x === 0 && action.input.y === 0 && !action.input.dash));
});
function assertNoVictory(app) {
  for (const id of ['victory-panel', 'victory-art', 'victory-story', 'victory-next-clue']) assert.equal(app.get(id), null);
  const walk = node => [node, ...node.children.flatMap(walk)];
  for (const entry of catalog.filter(entry => ['victory', 'next-clue'].includes(entry.beat))) assert.equal(walk(app.get('overlay')).some(node => node.dataset.storyId === entry.id || [entry.zh, entry.en].includes(node.textContent)), false);
}
test('victory content never appears in title, opening, running, paused, upgrading, lost or lost replay', () => {
  const app = harness(); assertNoVictory(app); app.click('启动任务'); assertNoVictory(app); app.click('部署出发'); assertNoVictory(app); app.key('KeyP'); assertNoVictory(app); app.release('KeyP'); app.key('KeyP');
  for (let i = 0; i < 15000 && !['won', 'lost'].includes(app.snapshot().world.phase.kind); i++) { assertNoVictory(app); if (app.snapshot().world.phase.kind === 'upgrading') app.key('Digit1'); app.frame(); }
  assert.equal(app.snapshot().world.phase.kind, 'lost'); assertNoVictory(app); app.activate('defeat-replay', 'Enter');
  for (let i = 0; i < 15000 && app.snapshot().screen === 'replay'; i++) { assertNoVictory(app); app.frame(); }
  assert.equal(app.snapshot().screen, 'replay-end'); assert.equal(app.snapshot().replayVerified, true); assertNoVictory(app);
});
test('missing and corrupt embedded runtime content report failure and cannot begin combat', () => {
  const invalid = ['', '{', '{}', JSON.stringify({ opening: { id: 'wrong' }, objective: {} })];
  for (const change of [content => { delete content.defeat; }, content => { content.defeat.id = 'desert-base.victory'; }, content => { content.defeat.zh = ' '; }, content => { content.defeat.en = ''; }, content => { content.defeat.en = 7; }, content => { content.defeat.extra = 'unexpected'; }, content => { content.extra = {}; }]) { const content = JSON.parse(embedded); change(content); invalid.push(JSON.stringify(content)); }
  for (const key of contentBeats.map(contentKey)) for (const change of [content => { delete content[key]; }, content => { content[key].id = 'desert-base.invalid'; }, content => { content[key].zh = ' '; }, content => { content[key].en = ''; }, content => { content[key].zh = 7; }, content => { content[key].en = null; }, content => { content[key].extra = 'unexpected'; }]) { const content = JSON.parse(embedded); change(content); invalid.push(JSON.stringify(content)); }
  for (const content of invalid) {
    const app = harness(content); assert.ok(app.logs.some(([level, name]) => level === 'error' && name === 'runtime.failure')); assert.ok(app.get('notice').textContent); app.click('启动任务'); assert.equal(app.seedCalls, 0); assert.equal(app.snapshot().screen, 'title');
  }
});
test('header focus preserves combat movement, pause and upgrade shortcuts while native button activation stays protected', () => {
  const app = harness(); app.click('启动任务'); app.click('部署出发'); app.get('language').focus(); app.get('language').onclick();
  app.key('KeyD', false, app.active); app.frame(); app.frame(); assert.ok(app.snapshot().actions.some(action => action.input.x === 1));
  const space = app.key('Space', false, app.active); assert.equal(space.defaultPrevented, undefined);
  app.key('KeyP', false, app.active); assert.equal(app.snapshot().world.phase.kind, 'paused'); app.release('KeyP'); app.key('KeyP', false, app.active); assert.equal(app.snapshot().world.phase.kind, 'running');
  app.release('KeyD');
  app.pointer('joystick', 'pointerdown');
  for (let i = 0; i < 3000 && app.snapshot().world.phase.kind === 'running'; i++) {
    const { player, crystals } = app.snapshot().world; const closest = crystals.toSorted((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
    const x = closest ? closest.x - player.x : Math.cos(i / 20), y = closest ? closest.y - player.y : Math.sin(i / 20), length = Math.hypot(x, y) || 1;
    app.pointer('joystick', 'pointermove', 9, x / length * 40, y / length * 40); app.frame();
  }
  assert.equal(app.snapshot().world.phase.kind, 'upgrading'); const before = app.snapshot().world.level; app.key('Digit1', false, app.active); assert.equal(app.snapshot().world.phase.kind, 'running'); assert.equal(app.snapshot().world.level, before);
});

function startLive(app) { app.click('启动任务'); app.click('部署出发'); }
function firstRadio(app) {
  startLive(app);
  for (let i = 0; i < 300 && app.radioState === 'waiting'; i++) app.frame();
  assert.equal(app.radioState, 'active'); assert.equal(app.get('radio').hidden, false);
  return app.session();
}
function radioStarts(app) { return app.logs.filter(([level, name]) => level === 'info' && name === 'story.radio.started'); }
function finishIdle(app) {
  for (let i = 0; i < 15000; i++) {
    const state = app.snapshot(); if (['won', 'lost'].includes(state.world.phase.kind)) break;
    if (state.world.phase.kind === 'upgrading') app.key('Digit1');
    app.frame();
  }
  assert.equal(app.session().world.phase.kind, 'lost'); return app.session();
}
test('first live kill starts exactly one stable full canonical radio outside overlay with no timer', () => {
  const app = harness(), entry = catalog.find(value => value.beat === 'radio.first-contact');
  assert.equal(app.radioState, 'inactive'); assert.equal(app.get('radio').hidden, true); assert.equal(app.get('radio-story').textContent, '');
  const first = firstRadio(app), radio = app.get('radio'), story = app.get('radio-story'), close = app.get('radio-close');
  assert.ok(first.world.kills > 0); assert.equal(story.textContent, entry.zh); assert.equal(story.dataset.storyId, entry.id);
  assert.equal(radio.parentElement, app.document.body); assert.equal(story.parentElement.attributes.role, 'status'); assert.equal(story.parentElement.attributes['aria-live'], 'polite'); assert.equal(close.parentElement, radio);
  assert.equal(radioStarts(app).length, 1); assert.equal(app.pendingTimers.length, 0); assert.equal(app.active, app.get('game'));
  radio.scrollTop = 43; close.focus(); const before = app.session(); app.get('language').onclick();
  assert.equal(story.textContent, entry.en); assert.equal(close.textContent, 'Close'); assert.equal(close.attributes['aria-label'], 'Close radio');
  assert.equal(app.get('radio'), radio); assert.equal(app.get('radio-story'), story); assert.equal(app.get('radio-close'), close); assert.equal(app.active, close); assert.equal(radio.scrollTop, 43); assert.deepEqual(app.session(), before);
  const writes = [story.textWrites, app.get('radio-label').textWrites, close.textWrites];
  for (let i = 0; i < 40; i++) app.frame();
  assert.deepEqual([story.textWrites, app.get('radio-label').textWrites, close.textWrites], writes);
  assert.ok(app.session().world.kills > first.world.kills); assert.equal(radioStarts(app).length, 1); assert.equal(app.get('radio'), radio);
});
test('native radio Close Enter and Space leave full World RNG recording inputs seed and audio unchanged and preserve critical notice deadline', () => {
  for (const code of ['Enter', 'Space']) {
    const app = harness(); firstRadio(app); app.key('KeyD'); app.event('error', { message: 'radio overlap error' }); const timer = app.noticeTimer;
    app.advanceTimers(1000); const before = app.session(), audio = app.audioActivations;
    const key = app.activate('radio-close', code); assert.equal(key.defaultPrevented, undefined);
    assert.equal(app.radioState, 'dismissed'); assert.equal(app.get('radio').hidden, true); assert.equal(app.get('radio-story').textContent, ''); assert.equal(app.active, app.get('game'));
    assert.deepEqual(app.session(), before); assert.equal(app.seedCalls, 1); assert.equal(app.audioActivations, audio); assert.equal(app.noticeTimer, timer); assert.deepEqual(app.cancelledTimers, []);
    assertNotice(app, '系统异常，请刷新重试。'); app.advanceTimers(2499); assertNotice(app, '系统异常，请刷新重试。'); app.advanceTimers(1); assertNotice(app, '');
    app.frame(); const ticks = app.session().actions.slice(before.actions.length); assert.ok(ticks.length > 0); assert.ok(ticks.every(action => action.kind === 'tick' && action.input.x === 1 && !action.input.dash));
    app.release('KeyD'); app.get('language').onclick(); app.frame(); assert.equal(app.get('radio').hidden, true); assert.equal(radioStarts(app).length, 1);
  }
});
test('radio visibility follows pause upgrade blur and hidden without forgetting consumed first kill or leaving hidden focus', () => {
  const app = harness(); firstRadio(app); const close = app.get('radio-close'); close.focus(); app.key('KeyP', false, close);
  assert.equal(app.radioState, 'active'); assert.equal(app.get('radio').hidden, true); assert.equal(app.active, app.get('game'));
  app.release('KeyP'); app.key('KeyP'); assert.equal(app.get('radio').hidden, false);
  app.event('blur'); assert.equal(app.get('radio').hidden, true); assert.equal(app.session().world.phase.kind, 'paused');
  app.document.hidden = true; app.event('visibilitychange'); app.document.hidden = false; app.event('visibilitychange'); assert.equal(app.get('radio').hidden, true);
  app.release('KeyP'); app.key('KeyP'); assert.equal(app.get('radio').hidden, false); assert.equal(radioStarts(app).length, 1);
});
test('pause can disable radio before or after first kill while preserving panel objective nodes focus scroll notice audio and complete session', () => {
  for (const afterKill of [false, true]) {
    const app = harness(); if (afterKill) firstRadio(app); else startLive(app);
    app.key('KeyP'); const panel = app.get('pause-panel'), objective = app.get('pause-objective'), disable = app.get('radio-disable'); panel.scrollTop = 32; disable.focus();
    app.event('error', { message: 'pause error' }); const timer = app.noticeTimer, before = app.session(), audio = app.audioActivations;
    disable.onclick(); assert.equal(app.radioState, 'disabled'); assert.equal(disable.disabled, true); assert.equal(disable.textContent, '本局无线电已关闭');
    assert.equal(app.get('pause-panel'), panel); assert.equal(app.get('pause-objective'), objective); assert.equal(app.get('radio-disable'), disable); assert.equal(panel.scrollTop, 32); assert.equal(app.active, disable);
    assert.deepEqual(app.session(), before); assert.equal(app.audioActivations, audio); assert.equal(app.noticeTimer, timer); assert.deepEqual(app.cancelledTimers, []);
    app.get('language').onclick(); assert.equal(disable.textContent, 'Radio disabled this run'); assert.equal(disable.disabled, true); assert.equal(objective.textContent, catalog.find(entry => entry.beat === 'objective').en); assert.equal(app.get('pause-panel'), panel); assert.equal(panel.scrollTop, 32); assert.equal(app.active, disable);
    app.get('pause-resume').onclick(); for (let i = 0; i < 50; i++) app.frame(); assert.equal(app.get('radio').hidden, true); assert.equal(radioStarts(app).length, afterKill ? 1 : 0);
  }
});
function fixtureKill(app, mode) {
  startLive(app); app.frame(); const world = app.session().world;
  world.enemies = [1, 2].map(id => ({ id, kind: 'crawler', x: world.player.x + 80, y: world.player.y, hp: 0, maxHp: 30, radius: 11, attack: 100, flash: 0 })); world.nextId = 3;
  if (mode === 'upgrade') world.xp = world.threshold;
  if (mode === 'terminal') world.tick = 10799;
  app.fixtureWorld(world); app.frame(1000 / 60 + .000001); return app.session();
}
test('actual dispatch multi-kill starts once, same tick upgrade retains hidden radio and terminal has priority', () => {
  for (const mode of ['multi', 'upgrade', 'terminal']) {
    const app = harness(), result = fixtureKill(app, mode); assert.equal(result.world.kills, 2); assert.equal(result.world.events.filter(value => value === 'kill').length, 2);
    if (mode === 'terminal') { assert.equal(result.world.phase.kind, 'lost'); assert.equal(app.radioState, 'inactive'); assert.equal(radioStarts(app).length, 0); assert.equal(app.get('radio-story').textContent, ''); }
    else { assert.equal(app.radioState, 'active'); assert.equal(radioStarts(app).length, 1); assert.equal(app.get('radio').hidden, mode === 'upgrade');
      if (mode === 'upgrade') { assert.equal(result.world.phase.kind, 'upgrading'); app.key('Digit1'); assert.equal(app.get('radio').hidden, false); assert.equal(radioStarts(app).length, 1); }
      app.frame(); assert.equal(radioStarts(app).length, 1);
    }
  }
});
test('radio controls paired with untouched presentation preserve full immediate sessions and identical terminal result recording and checksum', () => {
  for (const operation of ['close', 'disable']) {
    const control = harness(), changed = harness(); firstRadio(control); firstRadio(changed); assert.deepEqual(changed.session(), control.session());
    if (operation === 'disable') { control.key('KeyP'); changed.key('KeyP'); }
    const before = changed.session(), audio = changed.audioActivations;
    changed.activate(operation === 'close' ? 'radio-close' : 'radio-disable', 'Space');
    assert.deepEqual(changed.session(), before); assert.equal(changed.audioActivations, audio); assert.equal(changed.seedCalls, control.seedCalls);
    if (operation === 'disable') { control.get('pause-resume').onclick(); changed.get('pause-resume').onclick(); }
    const expected = finishIdle(control), actual = finishIdle(changed); assert.deepEqual(actual, expected); assert.equal(changed.seedCalls, control.seedCalls);
    assert.deepEqual(actual.world, JSON.parse(JSON.stringify(replay(actual.lastRecording)))); assert.equal(actual.checksum, actual.lastRecording.finalChecksum);
  }
});
test('terminal clears radio, invalid Replay preserves complete session and error, successful Replay never shows radio, Home clears and Retry resets new seed', () => {
  const app = harness(); firstRadio(app); app.activate('radio-close', 'Enter'); finishIdle(app); const terminal = app.session();
  assert.equal(app.radioState, 'inactive'); assert.equal(app.get('radio-story').textContent, '');
  app.replaceRecording({ ...terminal.lastRecording, actions: 'invalid' }); const invalid = app.session(); app.activate('defeat-replay', 'Enter'); assert.deepEqual(app.session(), invalid); assert.equal(app.radioState, 'inactive'); assertNotice(app, '无法播放，回放数据无效。进度未改变。');
  app.replaceRecording(terminal.lastRecording); app.activate('defeat-replay', 'Enter');
  for (let i = 0; i < 15000 && app.progress().screen === 'replay'; i++) { app.frame(); assert.equal(app.radioState, 'inactive'); assert.equal(app.get('radio').hidden, true); assert.equal(app.get('radio-story').textContent, ''); }
  assert.equal(app.session().replayVerified, true); assert.deepEqual(app.session().world, terminal.world); assert.equal(app.session().checksum, terminal.checksum); assert.equal(radioStarts(app).length, 1);
  app.click('返回基地'); assert.equal(app.radioState, 'inactive'); assert.equal(app.get('radio-story').textContent, ''); startLive(app); assert.equal(app.radioState, 'waiting'); assert.equal(app.seedCalls, 2); assert.notEqual(app.session().world.seed, terminal.world.seed);
  app.key('KeyP'); app.get('radio-disable').onclick(); app.get('pause-resume').onclick(); finishIdle(app); app.activate('defeat-retry', 'Enter'); assert.equal(app.radioState, 'waiting'); assert.equal(app.seedCalls, 3); assert.equal(app.session().world.tick, 0); assert.equal(app.get('radio').hidden, true);
});

test('failed Replay preparation retains an active radio and complete current session while reporting the new error', () => {
  const app = harness(); firstRadio(app); app.replaceRecording({ ...app.session().recording, version: 'bad', finalChecksum: app.session().checksum }); const before = app.session(), story = app.get('radio-story');
  app.invokeReplay(); assert.deepEqual(app.session(), before); assert.equal(app.radioState, 'active'); assert.equal(app.get('radio').hidden, false); assert.equal(app.get('radio-story'), story);
  assertNotice(app, '无法播放，回放版本不兼容。进度未改变。'); app.advanceTimers(3499); assertNotice(app, '无法播放，回放版本不兼容。进度未改变。'); app.advanceTimers(1); assertNotice(app, '');
});
test('native radio handlers publish synchronous UI failures through runtime failure notice without swallowing errors', () => {
  for (const control of ['radio-close', 'radio-disable']) {
    const app = harness(); firstRadio(app); if (control === 'radio-disable') app.key('KeyP');
    const node = app.get('radio-close'), original = node.getAttribute.bind(node); let throwOnce = true;
    node.getAttribute = key => { if (throwOnce) { throwOnce = false; throw new Error('radio control test failure'); } return original(key); };
    app.get(control).onclick(); assert.ok(app.logs.some(([level, name, data]) => level === 'error' && name === 'runtime.failure' && data.message.includes('radio control test failure')));
    assertNotice(app, '系统异常，请刷新重试。');
  }
});
function atRadioTick(app, tick, phase = { kind: 'running' }) {
  const world = app.session().world; world.tick = tick; world.phase = phase; world.enemies = []; world.shots = []; world.player.hp = world.player.maxHp;
  app.fixtureWorld(world);
}
function telemetryFixture() {
  const app = harness(); firstRadio(app); app.activate('radio-close', 'Enter'); atRadioTick(app, 5399); app.frame(1000 / 60 + .000001);
  assert.equal(app.radioBeat, 'telemetry'); return app;
}
test('midpoint boundary preserves waiting and unread first contact and only the next action schedules telemetry', () => {
  const first = catalog.find(entry => entry.beat === 'radio.first-contact'), next = catalog.find(entry => entry.beat === 'radio.telemetry');
  const waiting = harness(); startLive(waiting); waiting.frame(); atRadioTick(waiting, 5400); waiting.key('KeyP'); waiting.release('KeyP'); waiting.key('KeyP');
  assert.equal(waiting.radioState, 'waiting'); assert.equal(radioStarts(waiting).length, 0);
  const app = harness(); firstRadio(app); atRadioTick(app, 5398); app.frame(1000 / 60 + .000001); assert.equal(app.session().world.tick, 5399);
  assert.equal(app.get('radio-story').textContent, first.zh); app.frame(1000 / 60 + .000001); assert.equal(app.session().world.tick, 5400);
  assert.equal(app.get('radio-story').dataset.storyId, first.id); assert.equal(radioStarts(app).length, 1);
  const before = app.session(); app.activate('radio-close', 'Space'); assert.deepEqual(app.session(), before); assert.equal(app.radioBeat, 'firstContact'); assert.equal(app.get('radio').hidden, true);
  app.get('language').onclick(); assert.equal(app.radioState, 'dismissed'); assert.equal(radioStarts(app).length, 1);
  app.frame(1000 / 60 + .000001); assert.equal(app.radioBeat, 'telemetry'); assert.equal(app.get('radio-story').textContent, next.en); assert.equal(app.get('radio-story').dataset.storyId, next.id);
  assert.deepEqual(radioStarts(app).map(([, , data]) => data.id), [first.id, next.id]);
  app.activate('radio-close', 'Enter'); for (let i = 0; i < 5; i++) app.frame(); assert.equal(app.get('radio').hidden, true); assert.equal(radioStarts(app).length, 2);
  const early = harness(); firstRadio(early); early.activate('radio-close', 'Enter'); atRadioTick(early, 5398); early.frame(1000 / 60 + .000001); assert.equal(early.radioState, 'dismissed'); early.frame(1000 / 60 + .000001); assert.equal(early.radioBeat, 'telemetry');
});
test('normal resume and choose actions schedule eligible telemetry while hidden and upgrading actions do not', () => {
  for (const phase of ['paused', 'upgrading']) {
    const app = harness(); firstRadio(app); app.activate('radio-close', 'Enter');
    const offer = play(42).recording.actions.find(action => action.kind === 'choose').upgrade;
    atRadioTick(app, 5400, phase === 'paused' ? { kind: 'paused' } : { kind: 'upgrading', offers: [offer] });
    app.document.hidden = true;
    if (phase === 'paused') app.key('KeyP'); else app.key('Digit1');
    assert.equal(app.radioState, 'dismissed'); assert.equal(radioStarts(app).length, 1);
    app.document.hidden = false; app.get('language').onclick(); assert.equal(app.radioState, 'dismissed');
    app.key('KeyP'); app.release('KeyP'); app.key('KeyP'); assert.equal(app.radioBeat, 'telemetry'); assert.equal(app.get('radio').hidden, false);
  }
  for (const phase of ['paused', 'upgrading']) {
    const app = harness(); firstRadio(app); app.activate('radio-close', 'Enter');
    const offer = play(42).recording.actions.find(action => action.kind === 'choose').upgrade;
    atRadioTick(app, 5400, phase === 'paused' ? { kind: 'paused' } : { kind: 'upgrading', offers: [offer] });
    if (phase === 'paused') app.key('KeyP'); else app.key('Digit1');
    assert.equal(app.radioBeat, 'telemetry'); assert.equal(app.get('radio').hidden, false);
  }
});
test('telemetry retains stable full bilingual content focus visibility logs and preparation failure state', () => {
  const app = telemetryFixture(), entry = catalog.find(value => value.beat === 'radio.telemetry'), story = app.get('radio-story'), close = app.get('radio-close'), radio = app.get('radio');
  assert.equal(story.textContent, entry.zh); radio.scrollTop = 31; close.focus(); const before = app.session(); app.get('language').onclick(); assert.deepEqual(app.session(), before);
  assert.equal(story.textContent, entry.en); assert.equal(app.active, close); assert.equal(radio.scrollTop, 31);
  const writes = story.textWrites; app.frame(0); assert.equal(story.textWrites, writes); assert.equal(radioStarts(app).length, 2);
  app.key('KeyP', false, close); assert.equal(app.get('radio').hidden, true); assert.equal(app.active, app.get('game')); assert.equal(app.radioBeat, 'telemetry');
  app.document.hidden = true; app.event('visibilitychange'); app.document.hidden = false; app.event('visibilitychange'); assert.equal(app.get('radio').hidden, true);
  app.release('KeyP'); app.key('KeyP'); assert.equal(app.get('radio').hidden, false); assert.equal(app.get('radio-story'), story); assert.equal(radioStarts(app).length, 2);
  app.replaceRecording({ ...app.session().recording, version: 'bad', finalChecksum: app.session().checksum }); const prior = app.session(); app.invokeReplay(); assert.deepEqual(app.session(), prior); assert.equal(app.radioBeat, 'telemetry'); assert.equal(story.textContent, entry.en); assertNotice(app, 'Cannot play this replay. Its version is incompatible. Progress is unchanged.');
});
test('telemetry native close preserves complete session held input audio seed and error deadline with exact beat ended log', () => {
  for (const code of ['Enter', 'Space']) {
    const app = telemetryFixture(); app.key('KeyD'); app.event('error', { message: 'telemetry error' }); const before = app.session(), audio = app.audioActivations, timer = app.noticeTimer, cancelled = [...app.cancelledTimers];
    app.activate('radio-close', code); assert.deepEqual(app.session(), before); assert.equal(app.audioActivations, audio); assert.equal(app.seedCalls, 1); assert.equal(app.noticeTimer, timer); assert.deepEqual(app.cancelledTimers, cancelled); assert.equal(app.active, app.get('game'));
    assert.deepEqual(app.logs.filter(([, name]) => name === 'story.radio.ended').map(([, , data]) => data.id), ['desert-base.radio.first-contact', 'desert-base.radio.telemetry']);
    app.frame(); app.frame(); const ticks = app.session().actions.slice(before.actions.length); assert.ok(ticks.length > 0, 'expected post-close tick actions'); assert.ok(ticks.every(action => action.kind === 'tick')); assert.deepEqual(ticks.map(action => action.input.x), Array(ticks.length).fill(1)); assert.equal(radioStarts(app).length, 2);
    app.advanceTimers(3499); assertNotice(app, '系统异常，请刷新重试。'); app.advanceTimers(1); assertNotice(app, '');
  }
});
test('run disable covers waiting first dismissed and telemetry and terminal always clears eligible state', () => {
  for (const stage of ['waiting', 'first', 'dismissed', 'telemetry']) {
    const app = stage === 'telemetry' ? telemetryFixture() : harness(); if (stage !== 'telemetry') { if (stage === 'waiting') { startLive(app); app.frame(); } else firstRadio(app); if (stage === 'dismissed') app.activate('radio-close', 'Enter'); }
    const started = radioStarts(app).length; app.key('KeyP'); const before = app.session(), audio = app.audioActivations; app.activate('radio-disable', 'Space'); assert.deepEqual(app.session(), before); assert.equal(app.audioActivations, audio);
    atRadioTick(app, 5400, { kind: 'paused' }); app.get('pause-resume').onclick(); assert.equal(app.radioState, 'disabled'); assert.equal(radioStarts(app).length, started); assert.equal(app.get('radio').hidden, true);
  }
  for (const state of ['dismissed', 'active']) {
    const app = telemetryFixture(); if (state === 'dismissed') app.activate('radio-close', 'Enter'); atRadioTick(app, 10799); app.frame(1000 / 60 + .000001); assert.equal(app.radioState, 'inactive'); assert.equal(app.get('radio').hidden, true); assert.equal(radioStarts(app).length, 2);
    app.activate('defeat-retry', 'Enter'); assert.equal(app.radioState, 'waiting'); assert.equal(app.radioBeat, null); assert.equal(app.session().world.tick, 0); assert.equal(app.seedCalls, 2);
  }
});
test('seeded live action pairs observe telemetry beyond midpoint and preserve full terminal recording and real replay', () => {
  const control = harness(), changed = harness(), disabled = harness(), apps = [control, changed, disabled];
  for (const app of apps) { startLive(app); app.pointer('joystick', 'pointerdown'); app.frame(); }
  let firstClosed = false, telemetryClosed = false, disabledAtTelemetry = false;
  for (const action of play(42).recording.actions) {
    for (const app of apps) {
      if (action.kind === 'choose') { const state = app.snapshot(); app.key(`Digit${state.world.phase.offers.indexOf(action.upgrade) + 1}`); }
      else if (action.kind === 'tick') { const input = normalizeInput(action.input); app.pointer('joystick', 'pointermove', 9, input.x * 40, input.y * 40); if (action.input.dash) { app.key('Space'); app.release('Space'); } app.frame(1000 / 60 + .000001); }
    }
    if (!firstClosed && changed.radioState === 'active') {
      for (const app of [changed, disabled]) { const before = app.session(); app.activate('radio-close', 'Enter'); assert.deepEqual(app.session(), before); }
      firstClosed = true;
    }
    if (!telemetryClosed && changed.radioBeat === 'telemetry' && changed.radioState === 'active') {
      assert.ok(changed.session().world.tick >= 5400); assert.equal(changed.get('radio-story').dataset.storyId, 'desert-base.radio.telemetry'); assert.equal(changed.get('radio-story').textContent, catalog.find(entry => entry.beat === 'radio.telemetry').zh);
      const before = changed.session(), audio = changed.audioActivations; changed.activate('radio-close', 'Space'); assert.deepEqual(changed.session(), before); assert.equal(changed.audioActivations, audio); telemetryClosed = true;
      const disableBefore = disabled.session(), disableAudio = disabled.audioActivations;
      disabled.key('KeyP'); control.key('KeyP'); changed.key('KeyP'); disabled.activate('radio-disable', 'Enter'); assert.equal(disabled.audioActivations, disableAudio); disabledAtTelemetry = true;
      for (const app of apps) { app.get('pause-resume').onclick(); app.pointer('joystick', 'pointerdown'); app.frame(); }
      assert.equal(disabled.session().world.tick, disableBefore.world.tick);
    }
  }
  assert.ok(firstClosed && telemetryClosed && disabledAtTelemetry); assert.equal(radioStarts(control).length, 1); assert.equal(radioStarts(changed).length, 2); assert.equal(radioStarts(disabled).length, 2);
  const expected = control.session(); assert.equal(expected.world.phase.kind, 'won'); assert.equal(expected.world.tick, 10800);
  for (const app of [changed, disabled]) { assert.deepEqual(app.session(), expected); assert.equal(app.seedCalls, control.seedCalls); assert.deepEqual(app.session().world, JSON.parse(JSON.stringify(replay(app.session().lastRecording)))); }
  changed.activate('victory-replay', 'Enter');
  for (let i = 0; i < 15000 && changed.progress().screen === 'replay'; i++) { changed.frame(); assert.equal(changed.radioState, 'inactive'); assert.equal(changed.get('radio').hidden, true); }
  assert.equal(changed.session().replayVerified, true); assert.deepEqual(changed.session().world, expected.world); assert.equal(changed.session().checksum, expected.checksum); assert.equal(radioStarts(changed).length, 2);
});
test('late first kill still owns the unread slot and failed new preparation preserves telemetry and full session', () => {
  const app = harness(); startLive(app); app.frame(); atRadioTick(app, 5400); const world = app.session().world;
  world.enemies = [{ id: 1, kind: 'crawler', x: world.player.x + 80, y: world.player.y, hp: 0, maxHp: 30, radius: 11, attack: 100, flash: 0 }]; world.nextId = 2; app.fixtureWorld(world); app.frame(1000 / 60 + .000001);
  assert.equal(app.radioBeat, 'firstContact'); assert.equal(app.get('radio-story').dataset.storyId, 'desert-base.radio.first-contact'); assert.equal(radioStarts(app).length, 1);
  app.activate('radio-close', 'Enter'); app.frame(1000 / 60 + .000001); assert.equal(app.radioBeat, 'telemetry');
  const active = app.session(); app.failNextSeed(); app.invokeBegin(); assert.deepEqual(app.session(), active); assert.equal(app.radioBeat, 'telemetry'); assert.equal(app.get('radio').hidden, false); assertNotice(app, '系统异常，请刷新重试。');
  const offer = play(42).recording.actions.find(action => action.kind === 'choose').upgrade;
  atRadioTick(app, 5500, { kind: 'upgrading', offers: [offer] }); app.get('language').onclick(); assert.equal(app.get('radio').hidden, true); assert.equal(app.radioBeat, 'telemetry'); app.key('Digit1'); assert.equal(app.get('radio').hidden, false); assert.equal(radioStarts(app).length, 2);
});

test('title loads one local progress session and deployment does not create a save', () => {
  const storage = memoryStorage();
  const app = harness(embedded, storage);
  assert.match(app.get('title-progress').textContent, /沙漠基地 · 已解锁/);
  app.get('language').onclick();
  assert.match(app.get('title-progress').textContent, /Desert Base · Unlocked/);
  app.click('Begin mission'); app.click('Skip opening');
  assert.equal(app.snapshot().screen, 'game');
  assert.deepEqual(storage.reads, [progressKey]); assert.deepEqual(storage.writes, []);
});

test('the mission list displays all six stages in order and preserves local progress across language and back navigation', () => {
  const storage = memoryStorage(savedProgress('rainforest')), app = harness(embedded, storage), before = app.session();
  app.activate('mission-select', 'Enter');
  assert.equal(app.active.id, 'stages-heading');
  assert.equal(app.get('hud').hidden, true);
  const list = app.get('stage-list');
  assert.deepEqual(list.children.map(row => row.children.map(node => node.textContent)), [
    ['沙漠基地', '部署出发'], ['雨林深处', '已解锁，暂不可游玩'], ['寒冻南极', '未解锁'],
    ['太空电梯', '未解锁'], ['保卫哨塔', '未解锁'], ['月面回响', '未解锁']
  ]);
  app.activate('language', 'Enter');
  assert.equal(app.active.id, 'language');
  assert.deepEqual(list.children.map(row => row.children.map(node => node.textContent)), [
    ['Desert Base', 'Deploy'], ['Deep Rainforest', 'Unlocked, not yet playable'], ['Frozen Antarctica', 'Locked'],
    ['Space Elevator', 'Locked'], ['Watchtower Defense', 'Locked'], ['Lunar Echoes', 'Locked']
  ]);
  assert.equal(list.children.filter(row => row.children.some(node => node.tagName === 'BUTTON')).length, 1);
  app.activate('stages-back', 'Enter');
  assert.equal(app.active.id, 'mission-select');
  assert.deepEqual(app.session(), before);
  assert.deepEqual(storage.reads, [progressKey]); assert.deepEqual(storage.writes, []);
});

test('selecting Desert reaches the existing opening and can return before deployment', () => {
  const storage = memoryStorage(), app = harness(embedded, storage);
  app.click('选择任务');
  const list = app.get('stage-list');
  assert.ok(list.children.slice(1).every(row => row.children[1].textContent === '未解锁'));
  app.click('部署出发');
  assert.equal(app.active.id, 'opening-continue');
  assert.equal(app.get('opening-story').dataset.storyId, 'desert-base.opening');
  assert.equal(app.seedCalls, 0);
  app.click('返回选关');
  assert.equal(app.active.id, 'stages-heading');
  app.click('部署出发');
  app.activate('opening-continue', 'Enter');
  assert.equal(app.progress().screen, 'game');
  assert.equal(app.seedCalls, 1);
  assert.deepEqual(storage.writes, []);
});

test('a live desert victory saves rainforest once and a fresh title restores that unlock', () => {
  const storage = memoryStorage();
  const app = harness(embedded, storage);
  naturalWin(app);
  assert.match(app.get('victory-progress').textContent, /雨林深处 · 已解锁，暂不可游玩.*进度已保存/);
  assert.deepEqual(storage.writes, [[progressKey, savedProgress('rainforest')]]);
  const refreshed = harness(embedded, storage);
  assert.match(refreshed.get('title-progress').textContent, /雨林深处 · 已解锁，暂不可游玩/);
  naturalWin(refreshed);
  assert.deepEqual(storage.writes, [[progressKey, savedProgress('rainforest')]]);
});

test('a higher save is restored and an explicit reset writes only after confirmation', () => {
  const storage = memoryStorage(savedProgress('antarctica'));
  const app = harness(embedded, storage);
  assert.match(app.get('title-progress').textContent, /寒冻南极 · 已解锁，暂不可游玩/);
  app.click('重置本机进度'); app.activate('progress-reset-cancel', 'Enter');
  assert.equal(storage.raw, savedProgress('antarctica')); assert.deepEqual(storage.writes, []);
  app.click('重置本机进度'); app.activate('progress-reset-confirm', 'Enter');
  assert.match(app.get('title-progress').textContent, /沙漠基地.*本机进度已重置/);
  assert.deepEqual(storage.writes, [[progressKey, savedProgress('desert-base')]]);
});

test('invalid and unknown saves block deployment until the player chooses recovery or temporary play', () => {
  for (const [raw, reason] of [[' {broken', /local save is invalid/], [' {"version":99}', /unknown version/]]) {
    const storage = memoryStorage(raw), app = harness(embedded, storage);
    assert.equal(app.get('mission-start'), null);
    app.get('language').onclick();
    assert.match(app.get('progress-reset-panel').children[2].textContent, reason);
    assert.equal(storage.raw, raw); assert.deepEqual(storage.writes, []);
    app.click('Play without saving');
    assert.match(app.get('title-progress').textContent, /Progress cannot be saved/);
    assert.equal(storage.raw, raw); assert.deepEqual(storage.writes, []);
    app.click('Reset local progress'); app.click('Confirm reset');
    assert.equal(storage.raw, savedProgress('desert-base'));
    assert.match(app.get('title-progress').textContent, /Local progress reset/);
  }
});

test('a save changed to unknown after startup is protected until explicit confirmation', () => {
  const raw = ' {"version":99}', storage = memoryStorage();
  const app = harness(embedded, storage);
  storage.raw = raw;
  const terminal = naturalWin(app);
  assert.equal(app.get('victory-retry'), null);
  assert.ok(app.get('progress-reset-panel'));
  assert.deepEqual(storage.writes, []); assert.equal(storage.raw, raw);
  app.click('临时游玩');
  assert.match(app.get('victory-progress').textContent, /雨林深处.*无法保存/);
  assert.deepEqual(app.snapshot(), terminal);
  assert.equal(storage.raw, raw); assert.deepEqual(storage.writes, []);
});

test('write and read-back failures keep the live unlock with different messages', () => {
  for (const verification of [false, true]) {
    const storage = memoryStorage();
    storage.setItem = (key, value) => {
      storage.writes.push([key, value]);
      if (!verification) throw new Error('blocked write');
    };
    const app = harness(embedded, storage);
    naturalWin(app);
    const message = app.get('victory-progress').textContent;
    assert.match(message, /雨林深处/);
    assert.match(message, verification ? /无法确认本次进度是否保存/ : /本次进度未保存/);
    assert.deepEqual(storage.writes, [[progressKey, savedProgress('rainforest')]]);
    assert.ok(app.logs.some(([level, name, data]) => level === 'error' && name === 'progress.storage_failed' && data.phase === (verification ? 'save_verify' : 'save_write')));
  }
});

test('an unavailable local storage read falls back to a temporary session', () => {
  const storage = memoryStorage();
  storage.getItem = () => { throw new Error('blocked read'); };
  const app = harness(embedded, storage);
  assert.match(app.get('title-progress').textContent, /本次仅临时游玩/);
  assert.equal(app.get('progress-reset-panel'), null);
  assert.deepEqual(storage.writes, []);
});

test('failed or unconfirmed resets report whether saving remains blocked', () => {
  for (const [raw, protectedSession] of [[' {bad', true], [savedProgress('antarctica'), false]]) {
    for (const verifyFailed of [false, true]) {
      const storage = memoryStorage(raw);
      storage.setItem = () => {
        if (!verifyFailed) throw new Error('blocked reset');
        storage.raw = savedProgress('rainforest');
      };
      const app = harness(embedded, storage);
      if (!protectedSession) app.click('重置本机进度');
      app.click('确认重置');
      const message = app.get('title-progress').textContent;
      assert.match(message, verifyFailed ? /无法确认重置结果/ : /未能重置本机进度/);
      assert.equal(message.includes('无法保存进度'), protectedSession);
      assert.match(message, protectedSession ? /沙漠基地/ : /寒冻南极/);
    }
  }
});

test('temporary play unlocks rainforest in memory without replacing the invalid save', () => {
  const raw = ' {bad', storage = memoryStorage(raw), app = harness(embedded, storage);
  app.click('临时游玩');
  naturalWin(app);
  assert.match(app.get('victory-progress').textContent, /雨林深处.*无法保存进度/);
  assert.deepEqual(storage.reads, [progressKey]); assert.deepEqual(storage.writes, []); assert.equal(storage.raw, raw);
});

test('a higher save written after startup cannot be downgraded by a desert victory', () => {
  const storage = memoryStorage(), app = harness(embedded, storage);
  storage.raw = savedProgress('antarctica');
  naturalWin(app);
  assert.match(app.get('victory-progress').textContent, /寒冻南极.*进度已保存/);
  assert.equal(storage.raw, savedProgress('antarctica'));
  assert.deepEqual(storage.writes, [[progressKey, savedProgress('antarctica')]]);
});

test('rainforest opening load failure preserves the current screen and progress', async () => {
  const storage = memoryStorage();
  const app = harness(embedded, storage, async () => ({ ok: false, status: 503 }));
  const before = app.session();
  await app.openStage({ stageId: 'rainforest', rulesVersion: 'rainforest-1' });
  assert.deepEqual(app.session(), before);
  assert.equal(app.get('opening-panel'), null);
  assert.equal(app.seedCalls, 0);
  assert.deepEqual(storage.writes, []);
  assertNotice(app, '雨林开场未能加载，请重试。');
  assert.ok(app.logs.some(([level, event]) => level === 'error' && event === 'story.opening.load_failed'));
});

test('invalid rainforest defeat copy leaves opening, the failure illustration and redeployment usable', async () => {
  const story = JSON.parse(readFileSync('content/rainforest.story.json', 'utf8'));
  const defeat = story.find(entry => entry.beat === 'defeat');
  defeat.outcome = 'won';
  const app = harness(embedded, memoryStorage(), async () => ({ ok: true, json: async () => story }));
  await app.openStage({ stageId: 'rainforest', rulesVersion: 'rainforest-1' });
  app.get('opening-skip').onclick();
  finishIdle(app);
  assert.equal(app.get('defeat-story').textContent, '');
  assert.equal(app.get('defeat-story').dataset.storyId, undefined);
  assert.ok(app.get('defeat-art').commands.length > 0);
  assert.match(app.get('defeat-heading').textContent, /雨林深处/);
  assert.equal(app.logs.filter(([level, event]) => level === 'warn' && event === 'story.defeat.content_unavailable').length, 1);
  app.get('defeat-retry').onclick();
  assert.equal(app.session().world.phase.kind, 'running');
  assert.equal(app.session().recording.stageId, 'rainforest');
});

function finishRainforestVictory(app) {
  app.pointer('joystick', 'pointerdown');
  app.frame(0);
  const { recording } = playArmorCase(core, 42, 'skilled', 'attack', RAINFOREST_CONTEXT);
  for (const action of recording.actions) {
    if (action.kind === 'choose') {
      const phase = app.snapshot().world.phase;
      assert.equal(phase.kind, 'upgrading');
      app.key(`Digit${phase.offers.indexOf(action.upgrade) + 1}`);
    } else if (action.kind === 'tick') {
      const { x, y } = normalizeInput(action.input);
      app.pointer('joystick', 'pointermove', 9, x * 40, y * 40);
      if (action.input.dash) { app.key('Space'); app.release('Space'); }
      app.frame(1000 / 60 + .000001);
    }
  }
  const terminal = app.snapshot();
  assert.equal(terminal.world.phase.kind, 'won');
  assert.equal(terminal.world.tick, 11700);
  assert.equal(terminal.world.bossKilled, true);
  return terminal;
}

test('live rainforest victory presents the canonical bilingual story and Antarctic handoff once', async () => {
  const story = JSON.parse(readFileSync('content/rainforest.story.json', 'utf8'));
  const storage = memoryStorage(savedProgress('rainforest'));
  let requests = 0;
  const app = harness(embedded, storage, async () => { requests++; return { ok: true, json: async () => story }; });
  await app.openStage(RAINFOREST_CONTEXT);
  app.activate('opening-continue', 'Enter');
  const terminal = finishRainforestVictory(app);
  assertNotice(app, '孢子母体抵达');
  assert.equal(app.get('notice').classList.contains('boss-notice'), true);
  const panel = app.get('victory-panel'), art = app.get('victory-art');
  const victory = story.find(entry => entry.beat === 'victory'), clue = story.find(entry => entry.beat === 'next-clue');
  assert.deepEqual([app.get('victory-story').dataset.storyId, app.get('victory-next-clue').dataset.storyId], [victory.id, clue.id]);
  assert.deepEqual([app.get('victory-story').textContent, app.get('victory-next-clue').textContent], [victory.zh, clue.zh]);
  assert.match(app.get('victory-heading').textContent, /雨林深处/);
  assert.match(art.attributes['aria-label'], /研究站/);
  const original = [];
  drawRainforestVictory({ save() {}, restore() {}, fillRect(...rect) { original.push([this.fillStyle, ...rect]); } });
  assert.deepEqual(art.commands, original);
  assert.equal(app.get('victory-description').hidden, true);
  assert.deepEqual(storage.writes, [[progressKey, savedProgress('antarctica')]]);
  assert.match(app.get('victory-progress').textContent, /寒冻南极 · 已解锁，暂不可游玩/);
  app.get('language').onclick();
  assert.deepEqual([app.get('victory-story').textContent, app.get('victory-next-clue').textContent], [victory.en, clue.en]);
  assert.equal(app.get('victory-panel'), panel);
  assert.equal(app.get('victory-art'), art);
  app.activate('victory-replay', 'Space');
  assert.equal(app.get('victory-panel'), null);
  for (let i = 0; i < 15000 && app.progress().tick < 9300; i++) app.frame();
  assert.equal(app.progress().screen, 'replay');
  assertNotice(app, 'Spore Matriarch incoming');
  assert.equal(app.get('notice').classList.contains('boss-notice'), true);
  app.advanceTimers(3499); assertNotice(app, 'Spore Matriarch incoming');
  app.advanceTimers(1); assertNotice(app, '');
  for (let i = 0; i < 15000 && app.snapshot().screen === 'replay'; i++) app.frame();
  assert.equal(app.snapshot().screen, 'replay-end');
  assert.equal(app.snapshot().checksum, terminal.checksum);
  assert.equal(app.snapshot().replayVerified, true);
  assert.equal(app.get('victory-panel'), null);
  assert.equal(requests, 1);
  assert.deepEqual(storage.writes, [[progressKey, savedProgress('antarctica')]]);
});

test('an invalid rainforest handoff hides that paragraph and keeps the valid victory report and retry usable', async () => {
  const story = JSON.parse(readFileSync('content/rainforest.story.json', 'utf8'));
  story.find(entry => entry.beat === 'next-clue').nextStageId = 'watchtower';
  const app = harness(embedded, memoryStorage(savedProgress('rainforest')), async () => ({ ok: true, json: async () => story }));
  await app.openStage(RAINFOREST_CONTEXT);
  app.activate('opening-skip', 'Enter');
  const terminal = finishRainforestVictory(app);
  assert.equal(app.get('victory-story').dataset.storyId, 'rainforest.victory');
  assert.equal(app.get('victory-next-clue').hidden, true);
  assert.equal(app.get('victory-next-clue').textContent, '');
  assert.ok(app.get('victory-art').commands.length > 0);
  assert.equal(app.logs.filter(([level, event, data]) => level === 'warn' && event === 'story.victory.content_unavailable' && data.beat === 'next-clue').length, 1);
  app.activate('victory-retry', 'Enter');
  const retry = app.session();
  assert.equal(retry.world.phase.kind, 'running');
  assert.deepEqual(retry.world.context, RAINFOREST_CONTEXT);
  assert.notEqual(retry.world.seed, terminal.world.seed);
  assert.equal(app.get('victory-panel'), null);
});
