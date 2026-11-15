import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve('dist');
const destination = resolve(process.argv[2] || '/private/tmp/lunar-astrocade-package');
const read = file => readFile(join(root, file), 'utf8');
const replaceOne = (source, before, after, name) => {
  if (source.split(before).length !== 2) throw new Error(`Expected exactly one ${name}`);
  return source.replace(before, after);
};
const [htmlSource, rawCss, rainforest, campaign] = await Promise.all(['index.html', 'style.css', 'rainforest.story.json', 'campaign-later.story.json'].map(read));
const css = rawCss.replaceAll('max-width:700px', 'max-width:740px').replaceAll('min-width:701px', 'min-width:741px') + `\n@media(pointer:coarse){body{--joystick-size:160px}#dash{width:120px;height:120px}nav button{min-width:80px;min-height:80px}#radio-close{min-width:80px;min-height:80px}}`;
const scripts = (await readdir(root)).filter(name => name.endsWith('.js'));
const files = Object.fromEntries(await Promise.all(scripts.map(async name => [name, await read(name)])));
let main = files['main.js'];
main = replaceOne(main, "import { openProgressStorage } from './progress-storage.js';", "import * as rainforestArt from './rainforest-story-art.js';", 'storage import');
main = replaceOne(main, `const progressStorage = openProgressStorage({\n    getItem: key => window.localStorage.getItem(key),\n    setItem: (key, value) => window.localStorage.setItem(key, value)\n});`, '', 'storage initialization');
main = replaceOne(main, "let language = 'zh';", "let language = 'en';\nlet progressPending = false;", 'language default');
main = replaceOne(main, "const [response, art] = await Promise.all([fetch('./rainforest.story.json'), import('./rainforest-story-art.js')]);", `const [response, art] = [{ ok: true, json: async () => ${JSON.stringify(JSON.parse(rainforest))} }, rainforestArt];`, 'rainforest content');
main = replaceOne(main, '    const { result } = progressStorage.saveAdvanced(transition);\n    logProgressResult(result);', `    progressPending = true;
    void progressStorage.saveAdvanced(transition).then(({ result }) => {
        progressPending = false;
        logProgressResult(result);
        updateUi(true);
    }).catch(error => { progressPending = false; fail(error); updateUi(true); });`, 'victory persistence');
main = replaceOne(main, 'function progressFeedback() {\n    const t = text(), { result, protection } = progressStorage.snapshot();', "function progressFeedback() {\n    if (progressPending) return language === 'zh' ? '正在保存进度…' : 'Saving progress…';\n    const t = text(), { result, protection } = progressStorage.snapshot();", 'pending feedback');
main = replaceOne(main, `function resolveProgressReset(decision) {
    const { result } = progressStorage.reset(decision);`, `async function resolveProgressReset(decision) {
    if (progressPending) return;
    progressPending = true;
    let result;
    try { ({ result } = await progressStorage.reset(decision)); }
    catch (error) { progressPending = false; fail(error); updateUi(true); return; }
    progressPending = false;`, 'reset persistence');
main = replaceOne(main, 'export function startReplay()', 'function startReplay()', 'replay export');
const lines = main.split('\n');
let firstBody = lines.findIndex(line => !line.startsWith('import '));
if (firstBody < 0) throw new Error('Missing game body');
main = `${lines.slice(0, firstBody).join('\n')}\nexport function startGame(progressStorage) {\n${lines.slice(firstBody).join('\n')}\n}\n`;
files['main.js'] = main;
files['i18n.js'] = files['i18n.js']
  .replaceAll('本机', '战役')
  .replaceAll('Local unlock progress', 'Campaign progress')
  .replaceAll('Local progress reset.', 'Campaign progress reset.')
  .replaceAll('local progress', 'campaign progress')
  .replaceAll('local save', 'campaign save')
  .replaceAll('DESERT BASE · COMBAT TEST', 'DESERT BASE')
  .replaceAll('DESERT OPENING AND COMBAT TEST', 'DESERT BASE')
  .replaceAll('沙漠基地 · 战斗测试', '沙漠基地')
  .replaceAll('沙漠开场与战斗测试', '沙漠基地');
files['campaign-scenes.js'] = replaceOne(files['campaign-scenes.js'], "const response = await fetch('./campaign-later.story.json');", `const response = { ok: true, json: async () => ${JSON.stringify(JSON.parse(campaign))} };`, 'campaign content');
let html = replaceOne(htmlSource, '<link rel="stylesheet" href="/style.css">', `<style>${css}</style>`, 'stylesheet');
html = replaceOne(html, '<script type="module" src="/main.js"></script>', '<script type="module" src="./game.js"></script>', 'entry');
html = html.replace('<html lang="zh-CN">', '<html lang="en">').replace('<i>TEST</i>', '').replace('href="/"', 'href="#"').replace('沙漠战斗测试。开场已接入，后续剧情与战役待接入。Desert opening available; later story and campaign pending.', '六关科幻生存战役。A six-mission science-fiction survival campaign.');
html = html.replace('<title>月面回响 · Lunar Relay</title>', '<title>Lunar Relay</title>');
files['index.html'] = html;
files['game.js'] = `import { startGame } from './main.js';
import { openAstrocadeProgressStorage } from './astrocade-progress-storage.js';
let started = false;
let loading = false;
async function run(mode) {
  const current = document.getElementById('astrocade-edit');
  if (mode === 'edit') {
    if (!document.getElementById('pause')?.hidden) document.getElementById('pause').click();
    if (!current) {
      const preview = document.createElement('div');
      preview.id = 'astrocade-edit';
      preview.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;place-content:center;text-align:center;color:#b6e8df;font:30px sans-serif;background:#091b26';
      preview.innerHTML = '<h1>LUNAR RELAY</h1><p>Switch to Play to begin / 切换至试玩开始</p>';
      document.body.append(preview);
    }
    return;
  }
  current?.remove();
  if (started || loading) return;
  loading = true;
  try {
    const storage = await openAstrocadeProgressStorage(window.lib);
    startGame(storage);
    started = true;
  } catch (error) {
    console.error('Astrocade startup failed', error);
    document.body.innerHTML = '<main style="color:white;background:#091b26;padding:2rem;font:24px sans-serif">Unable to start. Please reload. / 无法启动，请重新加载。</main>';
  } finally { loading = false; }
}
window.run = run;
`;
files['README.md'] = '# Lunar Relay / 月面回响\n\nSix-mission science-fiction survival campaign. Move, collect energy, choose upgrades, and defeat each mission boss. Progress is stored through Astrocade.\n\nThe game entry is game.js; the game and story modules are compiled from the Lunar Relay source.\n';
files['game_config.json'] = '{}';
files['asset_map.json'] = '{}';
if (Object.values(files).some(value => /\bfetch\s*\(|\bimport\s*\(/.test(value))) throw new Error('Unexpected runtime fetch or dynamic import');
if (!files['astrocade-progress-storage.js']) throw new Error('Missing Astrocade progress adapter: rebuild first');
await mkdir(destination, { recursive: true });
await Promise.all(Object.entries(files).map(([name, content]) => writeFile(join(destination, name), content)));
await writeFile(join(destination, 'manifest.json'), JSON.stringify(files));
console.log(JSON.stringify({ destination, files: Object.keys(files), bytes: Buffer.byteLength(JSON.stringify(files)) }));
