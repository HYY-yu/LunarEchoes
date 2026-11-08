import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { embedDesertOpening } from '../scripts/desert-opening.mjs';
const catalog = JSON.parse(readFileSync('content/desert-base.story.json', 'utf8'));
const html = readFileSync('dist/index.html', 'utf8');
const embedded = html.match(/<script id="desert-opening" type="application\/json">([^]*?)<\/script>/)[1];
function harness(content = embedded) {
  const listeners = new Map(), logs = [], sessions = [];
  let active, raf, seedCalls = 0, now = 1000;
  class Element {
    constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.style = {}; this.dataset = {}; this.attributes = {}; this.hidden = false; this.textContent = ''; this.id = ''; this.scrollTop = 0; this.captures = new Set(); this.events = new Map(); this.classList = { add() {}, remove() {}, toggle() {} }; }
    append(...nodes) { this.children.push(...nodes); for (const node of nodes) node.parentElement = this; }
    replaceChildren(...nodes) { for (const node of this.children) node.parentElement = null; this.children = []; this.append(...nodes); }
    remove() { this.parentElement.children = this.parentElement.children.filter(node => node !== this); }
    setAttribute(key, value) { this.attributes[key] = value; }
    focus() { active = this; }
    closest(selector) { return selector.split(', ').includes(this.tagName.toLowerCase()) ? this : this.parentElement?.closest(selector) ?? null; }
    addEventListener(name, handler) { this.events.set(name, handler); }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); }
    getBoundingClientRect() { return { left: 0, top: 0, width: 110, height: 110 }; }
  }
  class Canvas extends Element { constructor() { super('canvas'); } getContext() { return { fillRect() {}, save() {}, restore() {} }; } }
  const body = new Element('body');
  for (const id of ['game', 'overlay', 'hud', 'touch', 'armor-cells', 'notice', 'footer-right', 'sound', 'language', 'pause', 'health-label', 'time-label', 'clock', 'sync-fill', 'level', 'kills', 'xp-fill', 'dash', 'footer-left', 'equipment', 'joystick', 'stick', 'desert-opening']) {
    const node = id === 'game' ? new Canvas() : new Element(['sound', 'language', 'pause', 'dash'].includes(id) ? 'button' : 'div'); node.id = id; if (id === 'desert-opening') node.textContent = content; body.append(node);
  }
  const all = (node = body) => [node, ...node.children.flatMap(child => all(child))];
  const get = id => all().find(node => node.id === id) ?? null;
  const document = { body, documentElement: {}, hidden: false, get activeElement() { return active; }, getElementById: get, createElement: tag => tag === 'canvas' ? new Canvas() : new Element(tag), addEventListener: (name, handler) => listeners.set(name, handler) };
  class Synth {
    muted = false;
    async activate() { return true; }
    setMuted(value) { this.muted = value; }
    setSession(value) { sessions.push(value); }
    setHidden() {}
    reset() {}
    play() {}
    events() {}
  }
  const context = vm.createContext({ document, HTMLElement: Element, HTMLCanvasElement: Canvas, matchMedia: () => ({ matches: true }), crypto: { getRandomValues(array) { seedCalls++; array[0] = 41 + seedCalls; } }, requestAnimationFrame: callback => { raf = callback; }, console, location: { search: '' }, URLSearchParams, setTimeout: () => 1, clearTimeout() {}, addEventListener: (name, handler) => listeners.set(name, handler) });
  context.window = context;
  const cache = new Map();
  function load(name) {
    if (cache.has(name)) return cache.get(name).exports;
    const module = { exports: {} }; cache.set(name, module);
    let source = readFileSync(`dist/${name}`, 'utf8');
    if (name === 'main.js') source += '\nglobalThis.inspectMain = () => JSON.stringify({ world, actions: recording.actions, screen, checksum: finalChecksum(world), replayVerified });';
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const require = path => path === './render.js' ? { createRenderer: () => () => {} } : path === './audio.js' ? { Synth } : path === './logger.js' ? { log: (...entry) => logs.push(entry) } : load(path.slice(2));
    vm.runInContext(`(function(require,module,exports){${compiled}\n})`, context, { filename: name })(require, module, module.exports);
    return module.exports;
  }
  load('main.js');
  const snapshot = () => JSON.parse(context.inspectMain());
  const event = (name, props = {}) => { const value = { target: active ?? get('game'), repeat: false, preventDefault() { this.defaultPrevented = true; }, ...props }; listeners.get(name)?.(value); return value; };
  const click = label => { const node = all().find(node => node.tagName === 'BUTTON' && node.textContent === label); assert.ok(node, `button ${label}`); node.onclick(); return node; };
  return { get, click, event, logs, sessions, snapshot, document, get active() { return active; }, get seedCalls() { return seedCalls; }, frame(delta = 100) { now += delta; raf(now); }, key(code, repeat = false, target = get('game')) { return event('keydown', { code, repeat, target }); }, release(code) { event('keyup', { code }); }, pointer(id, name, pointerId = 9, x = 45, y = 0) { get(id).events.get(name)?.({ pointerId, clientX: 55 + x, clientY: 55 + y, preventDefault() {} }); }, activate(id, code) { const node = get(id); node.focus(); const down = event('keydown', { code, target: node }); event('keyup', { code, target: node }); if (!down.defaultPrevented) node.onclick(); return down; } };
}
test('built opening contains exactly canonical entries and escapes closing script without changing text', () => {
  const expected = Object.fromEntries(catalog.slice(0, 2).map(({ beat, id, zh, en }) => [beat, { id, zh, en }]));
  assert.deepEqual(JSON.parse(embedded), expected);
  const changed = structuredClone(catalog); changed[0].en = '</script><strong>" & text';
  const output = embedDesertOpening('<script id="desert-opening" type="application/json"></script>', changed);
  assert.equal(JSON.parse(output.match(/json">([^]*?)<\/script>/)[1]).opening.en, changed[0].en);
  assert.equal(output.match(/<\/script>/g).length, 1);
  for (const invalid of [null, catalog.slice(1), catalog.map((entry, i) => i ? entry : { ...entry, en: '' })]) assert.throws(() => embedDesertOpening('', invalid));
  assert.throws(() => embedDesertOpening('', catalog), /anchor/);
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
test('actual main terminal replay verifies and retry directly creates a fresh current-stage fight', () => {
  const app = harness(); app.click('启动任务'); app.click('部署出发');
  for (let i = 0; i < 15000 && !['won', 'lost'].includes(app.snapshot().world.phase.kind); i++) { if (app.snapshot().world.phase.kind === 'upgrading') app.key('Digit1'); app.frame(); }
  const terminal = app.snapshot(); assert.ok(['won', 'lost'].includes(terminal.world.phase.kind));
  app.click('回放上一局'); assert.equal(app.snapshot().screen, 'replay'); assert.equal(app.seedCalls, 1);
  for (let i = 0; i < 15000 && app.snapshot().screen === 'replay'; i++) app.frame();
  assert.equal(app.snapshot().screen, 'replay-end'); assert.equal(app.snapshot().replayVerified, true); assert.equal(app.snapshot().checksum, terminal.checksum);
  app.click('返回基地'); app.click('启动任务'); app.click('跳过开场');
  for (let i = 0; i < 15000 && !['won', 'lost'].includes(app.snapshot().world.phase.kind); i++) { if (app.snapshot().world.phase.kind === 'upgrading') app.key('Digit1'); app.frame(); }
  const previousSeed = app.snapshot().world.seed; app.click('重新部署'); const retry = app.snapshot(); assert.equal(retry.screen, 'game'); assert.equal(retry.world.tick, 0); assert.equal(retry.world.level, 1); assert.deepEqual(retry.actions, []); assert.equal(app.seedCalls, 3); assert.notEqual(retry.world.seed, previousSeed);
});
test('missing and corrupt embedded runtime content report failure and cannot begin combat', () => {
  for (const content of ['', '{', '{}', JSON.stringify({ opening: { id: 'wrong' }, objective: {} })]) {
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
