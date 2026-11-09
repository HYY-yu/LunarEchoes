import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { drawDesertScene } from '../dist/desert-scene.js';
import { createWorld, normalizeInput } from '../dist/core.js';
import { play } from '../scripts/simulate.mjs';
import ts from 'typescript';
import { embedDesertContent } from '../scripts/desert-content.mjs';
const catalog = JSON.parse(readFileSync('content/desert-base.story.json', 'utf8'));
const html = readFileSync('dist/index.html', 'utf8');
const embedded = html.match(/<script id="desert-content" type="application\/json">([^]*?)<\/script>/)[1];
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
    if (name === 'main.js') source += '\nglobalThis.inspectMain = () => JSON.stringify({ world, actions: recording.actions, screen, checksum: finalChecksum(world), replayVerified, lastRecording });';
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
test('built content contains exactly three canonical entries and escapes every locale without changing text', () => {
  const expected = Object.fromEntries(catalog.filter(entry => ['opening', 'objective', 'defeat'].includes(entry.beat)).map(({ beat, id, zh, en }) => [beat, { id, zh, en }]));
  assert.deepEqual(JSON.parse(embedded), expected);
  for (const beat of ['opening', 'objective', 'defeat']) for (const language of ['zh', 'en']) {
    const changed = structuredClone(catalog); changed.find(entry => entry.beat === beat)[language] = '</script><strong>" & \u2028\u2029 text';
    const output = embedDesertContent('<script id="desert-content" type="application/json"></script>', changed);
    assert.equal(JSON.parse(output.match(/json">([^]*?)<\/script>/)[1])[beat][language], changed.find(entry => entry.beat === beat)[language]);
    assert.equal(output.match(/<\/script>/g).length, 1);
  }
  for (const invalid of [null, catalog.slice(1), catalog.map((entry, i) => i ? entry : { ...entry, en: '' })]) assert.throws(() => embedDesertContent('', invalid));
  for (const invalid of [catalog.filter(entry => entry.beat !== 'defeat'), catalog.map(entry => entry.beat === 'defeat' ? { ...entry, id: 'desert-base.victory' } : entry), catalog.map(entry => entry.beat === 'defeat' ? { ...entry, zh: '' } : entry)]) assert.throws(() => embedDesertContent('<script id="desert-content" type="application/json"></script>', invalid));
  assert.throws(() => embedDesertContent('', catalog), /anchor/);
});
test('embedded content preserves replacement tokens in all three bilingual entries', () => {
  const anchor = '<script id="desert-content" type="application/json"></script>';
  for (const token of ['$$', '$&', '$`', "$'", '$1', '$<name>']) {
    const changed = structuredClone(catalog);
    for (const entry of changed) for (const language of ['zh', 'en']) entry[language] = `Signal ${token} received`;
    const output = embedDesertContent(`before${anchor}after`, changed);
    const content = JSON.parse(output.match(/json">([^]*?)<\/script>/)[1]);
    for (const beat of ['opening', 'objective', 'defeat']) for (const language of ['zh', 'en']) assert.equal(content[beat][language], changed.find(entry => entry.beat === beat)[language]);
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
test('a naturally won live session retains the existing generic result without defeat story or art', () => {
  const app = harness(); app.click('启动任务'); app.click('部署出发'); app.pointer('joystick', 'pointerdown'); app.frame();
  const { recording } = play(42);
  for (const action of recording.actions) {
    if (action.kind === 'choose') { const state = app.snapshot(); assert.equal(state.world.phase.kind, 'upgrading', `tick ${state.world.tick}`); const offers = state.world.phase.offers; app.key(`Digit${offers.indexOf(action.upgrade) + 1}`); }
    else if (action.kind === 'tick') { const input = normalizeInput(action.input); app.pointer('joystick', 'pointermove', 9, input.x * 40, input.y * 40); if (action.input.dash) { app.key('Space'); app.release('Space'); } app.frame(1000 / 60 + .000001); }
  }
  assert.equal(app.snapshot().world.phase.kind, 'won'); assert.equal(app.get('defeat-panel'), null); assert.equal(app.get('defeat-art'), null); assert.ok(app.get('overlay').children[0].children.some(node => node.textContent === '信号已送达'));
});
test('missing and corrupt embedded runtime content report failure and cannot begin combat', () => {
  const invalid = ['', '{', '{}', JSON.stringify({ opening: { id: 'wrong' }, objective: {} })];
  for (const change of [content => { delete content.defeat; }, content => { content.defeat.id = 'desert-base.victory'; }, content => { content.defeat.zh = ' '; }, content => { content.defeat.en = ''; }, content => { content.defeat.en = 7; }, content => { content.defeat.extra = 'unexpected'; }, content => { content.extra = {}; }]) { const content = JSON.parse(embedded); change(content); invalid.push(JSON.stringify(content)); }
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
