import { UPGRADE_ORDER } from '/core.js';
import { upgradeLabel } from '/i18n.js';
let capacity = 10, language = 'zh';
function paint() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.getElementById('health-label').textContent = language === 'zh' ? '装甲' : 'Armor';
  document.getElementById('fixture-label').textContent = language === 'zh' ? '布局压力夹具：合成容量，非真实战斗。' : 'Layout stress fixture: synthetic capacities, not combat.';
  document.getElementById('fixture-language').textContent = language === 'zh' ? 'English' : '中文';
  const armor = document.getElementById('armor-cells'); armor.replaceChildren(); armor.setAttribute('aria-valuenow', String(capacity - 1)); armor.setAttribute('aria-valuemax', String(capacity));
  for (let n = 0; n < capacity; n++) { const cell = document.createElement('span'); cell.className = `armor-cell${n < capacity - 1 ? ' filled' : ''}`; cell.setAttribute('aria-hidden', 'true'); armor.append(cell); }
  const equipment = document.getElementById('equipment'); equipment.replaceChildren();
  for (const id of UPGRADE_ORDER) { const item = document.createElement('span'); item.title = upgradeLabel(id, language).title; const icon = document.createElement('b'); icon.className = `module-icon icon-${id}`; const level = document.createElement('span'); level.textContent = 'LV 1'; item.append(icon, level); equipment.append(item); }
}
for (const button of document.querySelectorAll('button[data-capacity]')) button.onclick = () => { capacity = Number(button.dataset.capacity); paint(); };
document.getElementById('fixture-language').onclick = () => { language = language === 'zh' ? 'en' : 'zh'; paint(); };
paint();
