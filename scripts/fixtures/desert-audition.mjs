import { drawDesertScene } from '/desert-scene.js';
const canvas = document.getElementById('scene'), ctx = canvas.getContext('2d', { alpha: false });
const scenes = ['opening', 'victory', 'defeat'];
const labels = {
  zh: { title: '沙漠基地', scope: '剧情画预览 · 未接入关卡', opening: '失联基地', victory: '求援已发出', defeat: '通讯中断', tabs: ['开场', '胜利', '失败'], language: 'English', chapter: '01 / 06 · 地球防卫部队', error: '剧情画无法加载，请刷新后重试。' },
  en: { title: 'DESERT BASE', scope: 'Scene preview · Not connected to a stage', opening: 'THE SILENT BASE', victory: 'SIGNAL TRANSMITTED', defeat: 'CONNECTION LOST', tabs: ['Opening', 'Victory', 'Defeat'], language: '中文', chapter: '01 / 06 · EARTH DEFENSE FORCE', error: 'Scene could not load. Refresh to retry.' }
};
let language = 'zh', scene = 'opening', story;
function fail(error) { document.getElementById('error').textContent = labels[language].error; console.error({ level: 'error', event: 'desert_audition.failed', error: String(error) }); }
function paint() {
  const text = labels[language], entry = story.find(value => value.id === `desert-base.${scene}`);
  if (!entry || typeof entry[language] !== 'string' || !entry[language].trim()) throw new Error(`Missing story desert-base.${scene}/${language}`);
  drawDesertScene(ctx, scene);
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.title = `${text.title} · ${text.scope}`;
  for (const id of ['title', 'scope', 'chapter']) document.getElementById(id).textContent = text[id];
  document.getElementById('heading').textContent = text[scene];
  document.getElementById('text').textContent = entry[language];
  document.getElementById('language').textContent = text.language;
  document.querySelector('nav').setAttribute('aria-label', language === 'zh' ? '场景预览' : 'Scene preview');
  canvas.setAttribute('aria-label', `${text.title} · ${text[scene]}`);
  canvas.dataset.scene = scene;
  canvas.dataset.storyId = entry.id;
  document.querySelectorAll('button[data-scene]').forEach((button, index) => { button.textContent = text.tabs[index]; button.setAttribute('aria-pressed', String(button.dataset.scene === scene)); });
  console.debug({ event: 'desert_audition.scene', scene, language, storyId: entry.id });
}
function resize() { const scale = Math.max(1, Math.min(Math.floor((document.querySelector('main').clientWidth - (innerWidth <= 600 ? 32 : 40)) / 320), Math.floor((innerHeight - 330) / 180))); canvas.style.width = `${320 * scale}px`; canvas.style.height = `${180 * scale}px`; }
try {
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  const response = await fetch('/story.json');
  if (!response.ok) throw new Error(`Story HTTP ${response.status}`);
  story = await response.json();
  if (!Array.isArray(story)) throw new Error('Invalid story catalog');
  for (const beat of scenes) if (!story.some(entry => entry?.id === `desert-base.${beat}`)) throw new Error(`Missing story ${beat}`);
  document.querySelectorAll('button[data-scene]').forEach(button => button.addEventListener('click', () => { try { scene = button.dataset.scene; paint(); } catch (error) { fail(error); } }));
  document.getElementById('language').addEventListener('click', () => { try { language = language === 'zh' ? 'en' : 'zh'; paint(); } catch (error) { fail(error); } });
  addEventListener('resize', resize);
  addEventListener('error', event => fail(event.message));
  addEventListener('unhandledrejection', event => fail(event.reason));
  resize(); paint();
  console.info({ level: 'info', event: 'desert_audition.ready', scenes });
} catch (error) { fail(error); }
