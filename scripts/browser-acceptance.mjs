import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { serve } from './task-steps.mjs';

const pilot = await readFile(new URL('./desert-assault-pilot.mjs', import.meta.url), 'utf8');
const probe = `
window.acceptance = {
  player: () => ({ x: world.player.x, dashCooldown: world.player.dashCooldown }),
  deployment: () => ({
    seed: world.seed,
    deliveries: world.desertAssault.deliveries,
    repairs: world.desertRepair.towers.filter(tower => tower.kind === 'repaired').length
  }),
  completeDesert: () => {
    while (world.tick < 18000) {
      if (world.phase.kind === 'upgrading') {
        const priority = world.player.hp < 50
          ? ['hull', 'pulse', 'orbit', 'nova', 'boots', 'magnet']
          : ['pulse', 'orbit', 'nova', 'hull', 'magnet', 'boots'];
        act({ kind: 'choose', upgrade: priority.find(upgrade => world.phase.offers.includes(upgrade)) });
      } else if (world.phase.kind === 'running') {
        act({ kind: 'tick', input: planDesertAssaultInput(world, {}) });
      } else break;
    }
    updateUi(true);
    return { phase: world.phase.kind, tick: world.tick, seed: world.seed };
  }
};`;

const scenarios = [
  { language: 'zh', width: 1280, height: 800, touch: false, seed: 42 },
  { language: 'zh', width: 320, height: 568, touch: true, seed: 101 },
  { language: 'en', width: 390, height: 693, touch: true, seed: 101 }
];

async function verifyMovement(page, touch) {
  const before = await page.evaluate(() => window.acceptance.player());
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    const stick = await page.locator('#joystick').boundingBox();
    const dash = await page.locator('#dash').boundingBox();
    assert(stick && dash, 'Touch controls are visible');
    const joystickFinger = { x: stick.x + stick.width / 2 + 35, y: stick.y + stick.height / 2, id: 1 };
    const dashFinger = { x: dash.x + dash.width / 2, y: dash.y + dash.height / 2, id: 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [joystickFinger] });
    await page.clock.runFor(90);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [joystickFinger, dashFinger] });
    await page.clock.runFor(90);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.keyboard.down('d');
    await page.keyboard.press('Space');
    await page.clock.runFor(150);
    await page.keyboard.up('d');
  }
  const after = await page.evaluate(() => window.acceptance.player());
  assert(after.x > before.x && after.dashCooldown > 0, 'Move right and dash through browser input');
}

async function verifyReportActions(page) {
  const buttons = await page.locator('#victory-panel button').evaluateAll(nodes => nodes.map(button => {
    const rect = button.getBoundingClientRect();
    const panel = button.closest('#victory-panel').getBoundingClientRect();
    const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return {
      id: button.id,
      reachable: !button.disabled && button.contains(target) && rect.height >= 44 &&
        rect.top >= Math.max(0, panel.top) && rect.bottom <= Math.min(innerHeight, panel.bottom) &&
        rect.left >= Math.max(0, panel.left) && rect.right <= Math.min(innerWidth, panel.right),
      bounds: rect.toJSON()
    };
  }));
  assert.deepEqual(buttons.map(button => button.id), ['victory-next', 'victory-retry', 'victory-missions']);
  assert(buttons.every(button => button.reachable), JSON.stringify(buttons));
  return buttons;
}

async function verifyDesert(browser, url, scenario) {
  const { language, width, height, touch, seed } = scenario;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const click = selector => touch ? page.locator(selector).tap() : page.locator(selector).click();
  const checkpoint = name => console.log(JSON.stringify({ level: 'debug', event: 'browser_acceptance.checkpoint', ...scenario, name }));
  try {
    await page.addInitScript(seed => {
      let next = seed;
      crypto.getRandomValues = array => { array[0] = next++; return array; };
    }, seed);
    await page.route('**/main.js', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: [await response.text(), pilot, probe].join('\n') });
    });
    const clock = new Date('2026-11-22T04:00:00Z');
    await page.clock.install({ time: clock });
    await page.clock.pauseAt(new Date(+clock + 1000));
    await page.goto(url);
    if (language === 'en') await click('#language');
    await click('#mission-start');
    assert.match(await page.locator('#opening-objective').textContent(), language === 'en' ? /Repair all four turrets/ : /修复四座炮塔/);
    await click('#opening-continue');
    await page.clock.runFor(65);
    await verifyMovement(page, touch);
    checkpoint('movement');

    const terminal = await page.evaluate(() => window.acceptance.completeDesert());
    assert.equal(terminal.phase, 'won', JSON.stringify(terminal));
    await page.clock.runFor(3600);
    await page.locator('#victory-panel').waitFor();
    assert.match(await page.locator('#victory-progress').textContent(), language === 'en' ? /Deep Rainforest/ : /雨林深处/);
    if (touch) {
      const actions = await verifyReportActions(page);
      const scrolled = await page.locator('.victory-body').evaluate(body => {
        body.scrollTop = body.scrollHeight;
        return body.scrollTop;
      });
      assert(scrolled > 0, 'Victory report body scrolls independently');
      assert.deepEqual(await verifyReportActions(page), actions);
      await click('#victory-next');
    } else {
      assert.equal(await page.evaluate(() => document.activeElement.id), 'victory-next');
      await page.keyboard.press('Enter');
    }
    assert.match(await page.locator('#opening-heading').textContent(), language === 'en' ? /Deep Rainforest/ : /雨林深处/);
    await click('#opening-back');
    if (touch) await verifyReportActions(page);
    checkpoint('mission_report');

    if (language === 'zh' && touch) {
      await click('#victory-retry');
      const deployment = await page.evaluate(() => window.acceptance.deployment());
      assert.notEqual(deployment.seed, terminal.seed);
      assert.equal(deployment.deliveries, 0);
      assert.equal(deployment.repairs, 0);
      await click('#pause');
      await click('#pause-home');
      await click('#mission-select');
    } else await click('#victory-missions');
    const rainforest = page.locator('#stage-list [data-stage-id="rainforest"] button');
    await rainforest.waitFor();
    assert(await rainforest.isEnabled(), 'Rainforest is unlocked after winning');
    await page.reload();
    await click('#mission-select');
    await rainforest.waitFor();
    assert(await rainforest.isEnabled(), 'Rainforest stays unlocked after reload');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ level: 'info', event: 'browser_acceptance.passed', ...scenario, tick: terminal.tick }));
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'browser_acceptance.failed', ...scenario, errors, message: String(error) }));
    throw error;
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch();
let server;
const serving = serve(fileURLToPath(new URL('../dist', import.meta.url)).replace(/\/$/, ''), {
  setServer: value => { server = value; },
  info: event => console.log(JSON.stringify({ level: 'info', ...event })),
  error: event => console.error(JSON.stringify({ level: 'error', ...event }))
}, 0);
try {
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/`;
  for (const scenario of scenarios) await verifyDesert(browser, url, scenario);
} finally {
  server.close();
  server.closeAllConnections();
  await Promise.all([browser.close(), serving]);
}
