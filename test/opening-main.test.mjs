import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { drawDesertScene } from '../dist/desert-scene.js';
import { createWorld, normalizeInput, replay, finalChecksum, startRecording } from '../dist/core.js';
import { play } from '../scripts/simulate.mjs';
import ts from 'typescript';
import { embedDesertContent } from '../scripts/desert-content.mjs';
const catalog = JSON.parse(readFileSync('content/desert-base.story.json', 'utf8'));
const html = readFileSync('dist/index.html', 'utf8');
const contentBeats = ['opening', 'objective', 'defeat', 'victory', 'next-clue'];
const contentKey = beat => beat === 'next-clue' ? 'nextClue' : beat;
const embedded = html.match(/<script id="desert-content" type="application\/json">([^]*?)<\/script>/)[1];
function harness(content = embedded) {
  const listeners = new Map(), logs = [], sessions = [], timers = new Map(), cancelledTimers = [];
  let active, raf, seedCalls = 0, now = 1000, timerNow = 0, nextTimer = 1, audioFailure = false;
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
    constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.style = {}; this.dataset = {}; this.attributes = {}; this.hidden = false; this.textContent = ''; this.id = ''; this.scrollTop = 0; this.captures = new Set(); this.events = new Map(); const classes = new Set(); this.classList = { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name), toggle(name, force = !classes.has(name)) { if (force) classes.add(name); else classes.delete(name); return force; } }; }
    append(...nodes) { this.children.push(...nodes); for (const node of nodes) node.parentElement = this; }
    replaceChildren(...nodes) { for (const node of this.children) node.parentElement = null; this.children = []; this.append(...nodes); }
    remove() { this.parentElement.children = this.parentElement.children.filter(node => node !== this); }
    setAttribute(key, value) { this.attributes[key] = value; }
    focus(options) { active = this; this.focusOptions = options; this.focusCalls = (this.focusCalls ?? 0) + 1; }
    closest(selector) { return selector.split(', ').includes(this.tagName.toLowerCase()) ? this : this.parentElement?.closest(selector) ?? null; }
    addEventListener(name, handler) { this.events.set(name, handler); }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); }
    getBoundingClientRect() { return { left: 0, top: 0, width: 110, height: 110 }; }
  }
  class Canvas extends Element { constructor() { super('canvas'); this.commands = []; } getContext() { const commands = this.commands; return { fillRect(...rect) { commands.push([this.fillStyle, ...rect]); }, save() {}, restore() {} }; } }
  const body = new Element('body');
  for (const id of ['game', 'overlay', 'hud', 'touch', 'armor-cells', 'notice', 'footer-right', 'sound', 'language', 'pause', 'health-label', 'time-label', 'clock', 'sync-fill', 'level', 'kills', 'xp-fill', 'dash', 'footer-left', 'equipment', 'joystick', 'stick', 'desert-content']) {
    const node = id === 'game' ? new Canvas() : new Element(['sound', 'language', 'pause', 'dash'].includes(id) ? 'button' : 'div'); node.id = id; if (id === 'desert-content') node.textContent = content; body.append(node);
  }
  const all = (node = body) => [node, ...node.children.flatMap(child => all(child))];
  const get = id => all().find(node => node.id === id) ?? null;
  const document = { body, documentElement: {}, hidden: false, get activeElement() { return active; }, getElementById: get, createElement: tag => tag === 'canvas' ? new Canvas() : new Element(tag), addEventListener: (name, handler) => listeners.set(name, handler) };
  class Synth {
    muted = false;
    async activate() { if (audioFailure) { audioFailure = false; throw new Error('test audio unavailable'); } return true; }
    setMuted(value) { this.muted = value; }
    setSession(value) { sessions.push(value); }
    setHidden() {}
    reset() {}
    play() {}
    events() {}
  }
  const context = vm.createContext({ document, HTMLElement: Element, HTMLCanvasElement: Canvas, matchMedia: () => ({ matches: true }), crypto: { getRandomValues(array) { seedCalls++; array[0] = 41 + seedCalls; } }, requestAnimationFrame: callback => { raf = callback; }, console, location: { search: '' }, URLSearchParams, setTimeout, clearTimeout, addEventListener: (name, handler) => listeners.set(name, handler) });
  context.window = context;
  const cache = new Map();
  function load(name) {
    if (cache.has(name)) return cache.get(name).exports;
    const module = { exports: {} }; cache.set(name, module);
    let source = readFileSync(`dist/${name}`, 'utf8');
    if (name === 'main.js') source += '\nglobalThis.inspectMain = (complete = false) => JSON.stringify({ world, actions: recording.actions, screen, checksum: finalChecksum(world), replayVerified, lastRecording, ...(complete ? { recording, playingRecording } : {}) }); globalThis.inspectContentFrozen = () => Object.isFrozen(desertContent) && Object.values(desertContent).every(value => Object.isFrozen(value)); globalThis.inspectNoticeTimer = () => noticeTimer; globalThis.inspectProgress = () => JSON.stringify({ screen, tick: world.tick }); globalThis.replaceRecording = value => { lastRecording = JSON.parse(value); };';
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const require = path => path === './render.js' ? { createRenderer: () => () => {} } : path === './audio.js' ? { Synth } : path === './logger.js' ? { log: (...entry) => logs.push(entry) } : load(path.slice(2));
    vm.runInContext(`(function(require,module,exports){${compiled}\n})`, context, { filename: name })(require, module, module.exports);
    return module.exports;
  }
  load('main.js');
  const snapshot = (complete = false) => JSON.parse(context.inspectMain(complete));
  const event = (name, props = {}) => { const value = { target: active ?? get('game'), repeat: false, preventDefault() { this.defaultPrevented = true; }, ...props }; listeners.get(name)?.(value); return value; };
  const click = label => { const node = all().find(node => node.tagName === 'BUTTON' && node.textContent === label); assert.ok(node, `button ${label}`); node.onclick(); return node; };
  return { get, click, event, logs, sessions, snapshot, session: () => snapshot(true), progress: () => JSON.parse(context.inspectProgress()), document, advanceTimers, cancelledTimers, get noticeTimer() { return context.inspectNoticeTimer(); }, get pendingTimers() { return [...timers.keys()]; }, rejectAudio() { audioFailure = true; }, replaceRecording(value) { context.replaceRecording(JSON.stringify(value)); }, get active() { return active; }, get seedCalls() { return seedCalls; }, get contentFrozen() { return context.inspectContentFrozen(); }, frame(delta = 100) { now += delta; raf(now); }, key(code, repeat = false, target = get('game')) { return event('keydown', { code, repeat, target }); }, release(code) { event('keyup', { code }); }, pointer(id, name, pointerId = 9, x = 45, y = 0) { get(id).events.get(name)?.({ pointerId, clientX: 55 + x, clientY: 55 + y, preventDefault() {} }); }, activate(id, code) { const node = get(id); node.focus(); const down = event('keydown', { code, target: node }); event('keyup', { code, target: node }); if (!down.defaultPrevented) node.onclick(); return down; } };
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
test('built content contains exactly five canonical entries and escapes every locale without changing text', () => {
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
  for (const beat of ['victory', 'next-clue']) for (const transform of [entries => entries.filter(entry => entry.beat !== beat), entries => entries.map(entry => entry.beat === beat ? { ...entry, id: 'desert-base.defeat' } : entry), entries => entries.map(entry => entry.beat === beat ? { ...entry, en: ' ' } : entry), entries => entries.map(entry => entry.beat === beat ? { ...entry, zh: 7 } : entry), entries => entries.map(entry => entry.beat === beat ? { ...entry, extra: true } : entry)]) assert.throws(() => embedDesertContent('<script id="desert-content" type="application/json"></script>', transform(structuredClone(catalog))));
  assert.throws(() => embedDesertContent('', catalog), /anchor/);
});
test('embedded content preserves replacement tokens in all five bilingual entries', () => {
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
  const app = harness(), terminal = naturalLoss(app, true); assert.equal(app.active, app.get('sound'));
  assert.equal(app.activate('defeat-replay', 'Space').defaultPrevented, undefined); assert.equal(app.snapshot().screen, 'replay'); assert.equal(app.seedCalls, 1); assert.equal(app.get('defeat-panel'), null);
  for (let i = 0; i < 15000 && app.snapshot().screen === 'replay'; i++) { app.frame(); assert.equal(app.get('defeat-panel'), null); }
  assert.equal(app.snapshot().screen, 'replay-end'); assert.equal(app.snapshot().replayVerified, true); assert.equal(app.snapshot().checksum, terminal.checksum); assert.deepEqual(app.snapshot().world, terminal.world); assert.ok(app.logs.some(([, name]) => name === 'replay.finished')); assert.equal(app.get('defeat-panel'), null);
});
test('direct Retry skips the defeat narrative and rebuilds the current stage with a fresh seed', () => {
  const app = harness(), terminal = naturalLoss(app); assert.equal(app.activate('defeat-retry', 'Enter').defaultPrevented, undefined);
  const retry = app.snapshot(); assert.equal(retry.screen, 'game'); assert.equal(retry.world.phase.kind, 'running'); assert.equal(retry.world.tick, 0); assert.equal(retry.world.level, 1); assert.equal(retry.world.xp, 0); assert.equal(retry.world.player.hp, retry.world.player.maxHp); assert.deepEqual(retry.world, createWorld({ ...retry.world.context, seed: retry.world.seed })); assert.deepEqual(retry.world.context, terminal.world.context); assert.deepEqual(retry.actions, []); assert.equal(app.seedCalls, 2); assert.notEqual(retry.world.seed, terminal.world.seed); assert.equal(app.get('defeat-panel'), null); assert.equal(app.get('opening-panel'), null); assert.equal(app.active, app.get('game'));
  app.key('KeyD', true); app.key('Space', true); app.frame(); app.frame(); assert.ok(app.snapshot().actions.every(action => action.input.x === 0 && !action.input.dash));
});
function naturalWin(app, focus = 'canvas') {
  app.click('启动任务'); app.click('部署出发'); app.pointer('joystick', 'pointerdown'); app.frame();
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
  const app = harness(), terminal = noticeTerminal(app); assertNotice(app, '收割者抵达');
  app.advanceTimers(3499); assertNotice(app, '收割者抵达'); app.advanceTimers(1); assertNotice(app, ''); assert.deepEqual(app.session(), terminal);
  app.get('language').onclick(); app.activate('victory-replay', 'Enter');
  for (let i = 0; i < 15000 && app.progress().tick < 8400; i++) app.frame();
  assert.equal(app.session().screen, 'replay'); assertNotice(app, 'Harvester incoming'); const boss = app.session();
  app.advanceTimers(3499); assertNotice(app, 'Harvester incoming'); app.advanceTimers(1); assertNotice(app, ''); assert.deepEqual(app.session(), boss);
  for (let i = 0; i < 15000 && app.progress().screen === 'replay'; i++) app.frame();
  const done = app.session(); assert.equal(done.replayVerified, true); assert.deepEqual(done.world, terminal.world); assert.equal(done.checksum, terminal.checksum); assert.deepEqual(done.recording, terminal.recording); assert.deepEqual(done.lastRecording, terminal.lastRecording);
});
test('native Retry clears active Boss notice and timer while replacing the complete live session', () => {
  const app = harness(), terminal = noticeTerminal(app), timer = app.noticeTimer; assertNotice(app, '收割者抵达');
  app.advanceTimers(1000); app.activate('victory-retry', 'Enter'); assertNotice(app, ''); assert.ok(app.cancelledTimers.includes(timer));
  const actual = app.session(), world = createWorld({ ...terminal.world.context, seed: actual.world.seed });
  assert.notEqual(world.seed, terminal.world.seed); assert.equal(app.seedCalls, 2);
  assert.deepEqual(actual, { ...terminal, world, actions: [], recording: startRecording(world), playingRecording: null, screen: 'game', checksum: finalChecksum(world) });
  app.advanceTimers(1000); app.event('error', { message: 'new retry error' }); const afterError = app.session();
  app.advanceTimers(1500); assertNotice(app, '系统异常，请刷新重试。'); app.advanceTimers(1999); assertNotice(app, '系统异常，请刷新重试。'); app.advanceTimers(1); assertNotice(app, ''); assert.deepEqual(app.session(), afterError);
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
  const app = harness(), terminal = naturalWin(app, 'header'); assert.equal(app.active, app.get('sound')); assert.equal(app.get('victory-retry').focusCalls, undefined);
  assert.equal(app.activate('victory-replay', 'Space').defaultPrevented, undefined); assert.equal(app.snapshot().screen, 'replay'); assert.equal(app.seedCalls, 1);
  for (let i = 0; i < 15000 && app.snapshot().screen === 'replay'; i++) { assertNoVictory(app); assert.equal(app.get('defeat-panel'), null); app.frame(); }
  assert.equal(app.snapshot().screen, 'replay-end'); assert.equal(app.snapshot().replayVerified, true); assert.equal(app.snapshot().checksum, terminal.checksum); assert.deepEqual(app.snapshot().world, terminal.world); assert.deepEqual(app.snapshot().lastRecording, terminal.lastRecording); assert.equal(app.seedCalls, 1);
  assert.ok(app.logs.some(([, name]) => name === 'replay.finished')); assertNoVictory(app); assert.equal(app.get('defeat-panel'), null); assert.equal(app.get('opening-panel'), null);
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
  for (const key of ['victory', 'nextClue']) for (const change of [content => { delete content[key]; }, content => { content[key].id = 'desert-base.defeat'; }, content => { content[key].zh = ' '; }, content => { content[key].en = ''; }, content => { content[key].zh = 7; }, content => { content[key].en = null; }, content => { content[key].extra = 'unexpected'; }]) { const content = JSON.parse(embedded); change(content); invalid.push(JSON.stringify(content)); }
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
