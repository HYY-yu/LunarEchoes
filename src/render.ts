import {
  hasDesertRelay, hasRelayBase, stageRules
} from './stage-rules.js';
import { ROCKET_WARNING_TICKS, type Enemy, type Shot, type World } from './core.js';
import type { StageId } from './stage-contract.js';
import { createAtlas } from './art.js';
import { createAstronautFacingArt, directionalVisorBounds } from './astronaut-art.js';
import { createBossBodyArt, type BossPose } from './boss-body-art.js';
import { createSecondBossArt } from './boss-atlas-two.js';
import { createFinalBossArt } from './boss-final-pair.js';
import { createDesertMap } from './desert-map.js';
import { drawCampaignTerrain } from './campaign-maps.js';
import { createAntarcticBearingArt } from './antarctic-bearing-art.js';
import { drawAntarcticBarrageWarning, drawIceShard } from './antarctic-barrage-art.js';
import { createOrbitalLiftArt } from './orbital-lift-art.js';
import { createWatchtowerChargeArt } from './watchtower-charge-art.js';
import { drawWatchtowerStrike } from './watchtower-strike-art.js';
import { createLunarIsolationArt } from './lunar-isolation-art.js';
import { createLunarEchoArt, drawLunarEchoDispersal, drawLunarEchoSites } from './lunar-echo-cast-art.js';
import { drawRainforestTerrain } from './rainforest-map.js';
import { createRainforestArchiveArt } from './rainforest-archive-art.js';
import { drawRainforestBrood, rainforestBroodBurstProgress } from './rainforest-brood-art.js';
import { rainforestBroodWarning } from './rainforest-brood.js';
import { createDesertSupplyArt } from './desert-supply-art.js';
import { createDesertTowerArt } from './desert-tower-art.js';
import { createFrostGuardArt } from './frost-guard-art.js';
import { createInsulatedSuitArt } from './insulated-suit-art.js';
import { createRocketBotArt } from './rocket-bot-art.js';
import { createDesertRelayArt } from './desert-relay-art.js';
import { RELAY_CENTER } from './relay-layout.js';
import { desertTowerCapacity, relayObjective, selectTurretTarget, type DirectionalTower, type TowerDirection, type TowerModule } from './desert-repair.js';
import { drawRelayObjective } from './desert-relay-guidance-art.js';
import { drawMaterialMotion } from './material-motion-art.js';
import { drawElevatorBossArmor, elevatorArmorImpact } from './elevator-boss-armor-art.js';
import { isDesertStasisActive } from './desert-stasis.js';
import {
  desertStasisBossInView, drawDesertStasisClock, drawDesertStasisWarning, drawDesertStasisRipple, drawFrozenHostileBolt
} from './desert-stasis-art.js';
import { advanceTowerTurn, type TowerTurnPose } from './tower-turn-motion.js';

const BOSS_SCALE = 3.8;
type DrawBossBody = ReturnType<typeof createBossBodyArt>;
const BOSS_BODY_FACTORIES: Readonly<Record<StageId, () => DrawBossBody>> = {
  'desert-base': () => createBossBodyArt('harvester'),
  rainforest: () => createBossBodyArt('matriarch'),
  antarctica: () => createSecondBossArt('glacier'),
  'space-elevator': () => createSecondBossArt('orbital'),
  watchtower: () => createFinalBossArt('siege'),
  'lunar-echoes': () => createFinalBossArt('lunar')
};

type BossMotion = Pick<Enemy, 'id' | 'x' | 'y'> & { world: World; tick: number; pose: BossPose };

const TURRET_IDLE_ANGLE: Readonly<Record<TowerDirection, number>> = {
  north: -Math.PI / 2, east: 0, south: Math.PI / 2, west: Math.PI
};

const TOWER_MODULE_STYLE = {
  fire: { color: '#ff9b65', glyph: ['..#..', '..##.', '.###.', '##.##', '.###.'] },
  electric: { color: '#9df3ff', glyph: ['..##.', '.##..', '.####', '..##.', '.##..'] },
  powder: { color: '#f5db9a', glyph: ['..#..', '.....', '#.#.#', '.....', '..#..'] }
} satisfies Record<TowerModule, { color: string; glyph: readonly string[] }>;

function drawModulePickup(ctx: CanvasRenderingContext2D, { x, y, module }: NonNullable<World['desertSalvage']>['modules'][number]) {
  const { color, glyph } = TOWER_MODULE_STYLE[module];
  const left = Math.round(x) - 8, top = Math.round(y) - 13;
  ctx.fillStyle = '#102a36';
  ctx.fillRect(left - 1, top - 1, 18, 18);
  ctx.strokeStyle = color;
  ctx.strokeRect(left + .5, top + .5, 15, 15);
  ctx.fillStyle = color;
  for (const [row, pixels] of glyph.entries()) {
    for (let col = 0; col < pixels.length; col++) {
      if (pixels[col] === '#') ctx.fillRect(left + 3 + col * 2, top + 3 + row * 2, 2, 2);
    }
  }
}

function drawTowerArmor(ctx: CanvasRenderingContext2D, tower: DirectionalTower) {
  if (tower.kind !== 'repaired' || !tower.armor) return;
  const capacity = desertTowerCapacity(tower);
  const x = Math.round(tower.x - capacity * 4 / 2), y = Math.round(tower.y) - 43;
  ctx.fillStyle = '#102a36';
  ctx.fillRect(x - 2, y - 2, capacity * 4 + 3, 7);
  for (let hit = 0; hit < capacity; hit++) {
    ctx.fillStyle = hit < tower.armor.hits ? (tower.loadout?.reinforced ? '#efbf72' : '#9be5d4') : '#50626a';
    ctx.fillRect(x + hit * 4, y, 3, 3);
  }
}

function drawTowerModuleShot(ctx: CanvasRenderingContext2D, shot: Shot): boolean {
  const { kind, x, y, vx, vy } = shot;
  if (kind !== 'tower-fire' && kind !== 'tower-electric' && kind !== 'tower-powder') return false;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(Math.atan2(vy, vx));
  if (kind === 'tower-fire') {
    ctx.fillStyle = '#d86445';
    ctx.fillRect(-15, -1, 12, 3);
    ctx.fillStyle = TOWER_MODULE_STYLE.fire.color;
    ctx.fillRect(-7, -3, 10, 7);
    ctx.fillStyle = '#fff0b4';
    ctx.fillRect(-3, -1, 6, 3);
  } else if (kind === 'tower-electric') {
    ctx.strokeStyle = TOWER_MODULE_STYLE.electric.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-16, 2); ctx.lineTo(-10, -3); ctx.lineTo(-7, 3); ctx.lineTo(0, 0);
    ctx.stroke();
    ctx.fillStyle = '#f1ffff';
    ctx.fillRect(-1, -1, 3, 3);
  } else {
    ctx.fillStyle = TOWER_MODULE_STYLE.powder.color;
    ctx.fillRect(-1, -1, 4, 3); ctx.fillRect(-6, -5, 4, 3); ctx.fillRect(-9, 3, 4, 3);
  }
  ctx.restore();
  return true;
}

function bossSpecialAttack(world: World, enemy: Enemy, title: boolean): boolean {
  if (title) return false;
  switch (world.context.stageId) {
    case 'desert-base': {
      const stasis = world.desertStasis;
      return stasis?.bossId === enemy.id && (world.tick < stasis.beginsAt || isDesertStasisActive(stasis, world.tick));
    }
    case 'rainforest': {
      const brood = world.rainforestBrood;
      return rainforestBroodWarning(world.context, world.tick) !== undefined ||
        brood?.motherId === enemy.id && rainforestBroodBurstProgress(brood, world.tick) !== undefined;
    }
    case 'antarctica':
      return world.antarcticBarrage?.bossId === enemy.id;
    case 'space-elevator':
      return elevatorArmorImpact(enemy.armor, world.tick);
    case 'watchtower':
      return world.watchtowerStrike?.bossId === enemy.id;
    case 'lunar-echoes':
      return world.lunarEchoCast?.bossId === enemy.id;
  }
}

export function createRenderer(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas 2D is unavailable');
  const ctx = context;
  const atlas = createAtlas();
  const drawAstronaut = createAstronautFacingArt();
  let bossMotion: BossMotion | undefined;
  const bossBodyArt = new Map<StageId, DrawBossBody>();
  const drawDesertMap = createDesertMap();
  const drawSupply = createDesertSupplyArt();
  const drawTower = createDesertTowerArt();
  const towerPoses = new Map<TowerDirection, TowerTurnPose>();
  let towerFrame: { world: World; tick: number } | undefined;
  let drawRocketBot: ReturnType<typeof createRocketBotArt> | undefined;
  let drawInsulatedSuit: ReturnType<typeof createInsulatedSuitArt> | undefined;
  let drawFrostGuard: ReturnType<typeof createFrostGuardArt> | undefined;
  let drawDesertRelay: ReturnType<typeof createDesertRelayArt> | undefined;
  let drawAntarcticBearing: ReturnType<typeof createAntarcticBearingArt> | undefined;
  let drawOrbitalLift: ReturnType<typeof createOrbitalLiftArt> | undefined;
  let drawWatchtowerCharge: ReturnType<typeof createWatchtowerChargeArt> | undefined;
  let drawLunarEcho: ReturnType<typeof createLunarEchoArt> | undefined;
  let drawLunarIsolation: ReturnType<typeof createLunarIsolationArt> | undefined;
  let drawRainforestArchive: ReturnType<typeof createRainforestArchiveArt> | undefined;
  function renderTower(tower: Parameters<typeof drawTower>[1], world: World, direction?: TowerDirection) {
    const { x, y, kind } = tower;
    ctx.strokeStyle = kind === 'repaired' ? '#7ef5d1' : '#ffe09b';
    ctx.setLineDash(kind === 'damaged' ? [4, 4] : []);
    ctx.beginPath(); ctx.ellipse(x, y, 21, 12, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    if (direction === undefined || kind === 'damaged') {
      if (direction !== undefined) towerPoses.delete(direction);
      drawTower(ctx, tower, undefined, false);
      return;
    }

    let pose = towerPoses.get(direction);
    if (pose?.tick !== world.tick) {
      const rest = hasRelayBase(world.context)
        ? Math.atan2(y - RELAY_CENTER.y, x - RELAY_CENTER.x)
        : TURRET_IDLE_ANGLE[direction];
      pose = advanceTowerTurn(pose, world.tick, rest, world.desertTurretShots?.[direction], () => {
        const selected = selectTurretTarget(world, tower, direction);
        if (selected) return Math.atan2(selected.target.y - y, selected.target.x - x);
      });
      towerPoses.set(direction, pose);
    }
    drawTower(ctx, tower, pose.angle, pose.flash);
  }
  return function render(world: World, time: number, title = false, showWorldBossHealth = true) {
    const p = world.player, arena = stageRules(world.context).arenaSize;
    if (towerFrame?.world !== world || world.tick < towerFrame.tick) {
      towerPoses.clear();
      towerFrame = { world, tick: world.tick };
    } else {
      towerFrame.tick = world.tick;
    }
    const width = Math.ceil(canvas.clientWidth / 2), height = Math.ceil(canvas.clientHeight / 2);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    ctx.imageSmoothingEnabled = false;
    const zoom = Math.max(.8, Math.min(1.2, width / 600));
    const cameraX = title ? 700 + Math.sin(time * .00008) * 30 : world.player.x;
    const cameraY = title ? 660 : world.player.y;
    ctx.save(); ctx.scale(zoom, zoom);
    const vw = width / zoom, vh = height / zoom;
    ctx.translate(vw / 2 - cameraX, vh / 2 - cameraY);
    const view = { left: cameraX - vw / 2, top: cameraY - vh / 2, width: vw, height: vh };
    if (world.context.stageId === 'rainforest') {
      drawRainforestTerrain(ctx, view);
      if (hasRelayBase(world.context)) {
        drawRainforestArchive ??= createRainforestArchiveArt();
        drawRainforestArchive(ctx, world.tick);
      }
      if (!title) drawRainforestBrood(ctx, world, arena);
    } else if (world.context.stageId === 'desert-base') drawDesertMap(ctx, arena, view);
    else drawCampaignTerrain(ctx, view, world.context.stageId, arena, world.tick, time);
    if (world.context.stageId === 'antarctica' && hasRelayBase(world.context)) {
      drawAntarcticBearing ??= createAntarcticBearingArt();
      drawAntarcticBearing(ctx, world.tick);
    }
    if (world.context.stageId === 'space-elevator' && hasRelayBase(world.context)) {
      drawOrbitalLift ??= createOrbitalLiftArt();
      drawOrbitalLift(ctx, world.tick);
    }
    if (world.context.stageId === 'watchtower' && hasRelayBase(world.context)) {
      drawWatchtowerCharge ??= createWatchtowerChargeArt();
      drawWatchtowerCharge(ctx, world.tick);
    }
    if (world.context.stageId === 'lunar-echoes' && hasRelayBase(world.context)) {
      drawLunarIsolation ??= createLunarIsolationArt();
      drawLunarIsolation(ctx, world.tick);
    }
    if (hasDesertRelay(world.context)) {
      drawDesertRelay ??= createDesertRelayArt();
      drawDesertRelay(ctx, world.tick);
    }
    if (!title) {
      drawAntarcticBarrageWarning(ctx, world);
      if (world.watchtowerStrike) drawWatchtowerStrike(ctx, world.watchtowerStrike, world.tick);
      drawLunarEchoSites(ctx, world);
    }
    const repair = world.desertRepair;
    if (!title && repair) {
      for (const supply of repair.supplies) drawSupply(ctx, supply);
      if ('towers' in repair) {
        for (const tower of repair.towers) {
          renderTower(tower, world, tower.direction);
          drawTowerArmor(ctx, tower);
        }
      } else {
        renderTower(repair.tower, world, repair.nextTurretShotTick === undefined ? undefined : 'north');
      }
    }
    if (!title && world.desertSalvage) {
      for (const module of world.desertSalvage.modules) drawModulePickup(ctx, module);
    }
    for (const crystal of world.crystals) atlas.draw(ctx, 'crystal', crystal.x, crystal.y + Math.sin(time * .004 + crystal.x) * 2, .9);
    const stasis = title ? undefined : world.desertStasis;
    const stasisActive = isDesertStasisActive(stasis, world.tick);
    const stasisBoss = stasis && world.enemies.find(enemy => enemy.id === stasis.bossId && enemy.kind === 'boss' && enemy.hp > 0);
    const stasisBossInView = stasisBoss && desertStasisBossInView(stasisBoss, view);
    if (stasis && stasisBoss && stasisBossInView && stasisActive) drawDesertStasisRipple(ctx, stasisBoss, stasis, world.tick);
    const { stageId } = world.context;
    const boss = world.enemies.find(enemy => enemy.kind === 'boss' && enemy.hp > 0);
    if (!boss) bossMotion = undefined;
    for (const enemy of world.enemies) {
      if (enemy.kind === 'boss-echo') {
        drawLunarEcho ??= createLunarEchoArt(atlas.draw);
        drawLunarEcho(ctx, enemy.x, enemy.y, BOSS_SCALE, world.tick, enemy.flash);
        continue;
      }
      const scale = enemy.kind === 'boss' ? BOSS_SCALE : enemy.kind === 'sentry' ? 1.8 : 1.5;
      ctx.fillStyle = '#1a2e3b55'; ctx.beginPath(); ctx.ellipse(enemy.x + 3, enemy.y + 9, scale * 6, scale * 3, 0, 0, Math.PI * 2); ctx.fill();
      const rocketBot = enemy.kind === 'rocket-bot';
      const warningTicks = rocketBot ? ROCKET_WARNING_TICKS : 36;
      const attackWarning = (rocketBot || enemy.kind === 'sentry' || enemy.kind === 'boss') && enemy.attack < warningTicks;
      if (attackWarning) {
        ctx.strokeStyle = rocketBot ? '#ffb886' : '#ffd499';
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 10 + (warningTicks - enemy.attack) / 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = enemy.flash > 0 ? .45 : 1;
      const tick = world.tick + enemy.id * 7;
      if (enemy.kind === 'rocket-bot') {
        drawRocketBot ??= createRocketBotArt();
        drawRocketBot(ctx, enemy.x, enemy.y, tick, scale);
      } else if (enemy.kind === 'frost-guard') {
        drawFrostGuard ??= createFrostGuardArt();
        drawFrostGuard(ctx, enemy.x, enemy.y, tick, scale);
      } else if (enemy.kind === 'insulated-suit') {
        drawInsulatedSuit ??= createInsulatedSuitArt();
        drawInsulatedSuit(ctx, enemy.x, enemy.y, tick, scale);
      } else if (enemy === boss) {
        let motion = bossMotion?.world === world && bossMotion.id === enemy.id && bossMotion.tick <= world.tick
          ? bossMotion : undefined;
        if (motion?.tick !== world.tick) {
          const moved = motion && (motion.x !== enemy.x || motion.y !== enemy.y);
          let pose: BossPose = moved ? 'move' : 'idle';
          if (attackWarning || bossSpecialAttack(world, enemy, title)) pose = 'attack';
          motion = { world, id: enemy.id, tick: world.tick, x: enemy.x, y: enemy.y, pose };
          bossMotion = motion;
        }
        let drawBossBody = bossBodyArt.get(stageId);
        if (!drawBossBody) {
          drawBossBody = BOSS_BODY_FACTORIES[stageId]();
          bossBodyArt.set(stageId, drawBossBody);
        }
        drawBossBody(ctx, enemy.x, enemy.y, motion.pose, world.tick);
      } else {
        atlas.draw(ctx, enemy.kind, enemy.x, enemy.y + (enemy.kind === 'drone' ? Math.sin(time * .006 + enemy.id) * 3 - 5 : 0), scale, tick);
      }
      ctx.globalAlpha = 1;
      if (enemy.kind === 'boss') {
        if (enemy.armor) drawElevatorBossArmor(ctx, enemy.x, enemy.y, scale, enemy.armor, world.tick);
        if (showWorldBossHealth) {
          ctx.fillStyle = '#172c3d'; ctx.fillRect(enemy.x - 30, enemy.y - 39, 60, 3);
          ctx.fillStyle = '#f5ba78'; ctx.fillRect(enemy.x - 30, enemy.y - 39, 60 * Math.max(0, enemy.hp / enemy.maxHp), 3);
        }
      }
    }
    for (const shot of world.shots) {
      if (stasisActive && shot.hostile) {
        drawFrozenHostileBolt(ctx, shot);
        continue;
      }
      if (shot.kind === 'ice-shard') {
        drawIceShard(ctx, shot);
        continue;
      }
      if (drawTowerModuleShot(ctx, shot)) continue;
      if (shot.kind === 'rocket') {
        ctx.fillStyle = '#ffbd75';
        ctx.fillRect(Math.round(shot.x) - 3, Math.round(shot.y) - 3, 7, 7);
        ctx.fillStyle = '#fff0b4';
        ctx.fillRect(Math.round(shot.x) - 1, Math.round(shot.y) - 1, 3, 3);
      } else {
        ctx.fillStyle = shot.hostile ? '#f6b77c' : '#d9fff2';
        ctx.fillRect(Math.round(shot.x) - 2, Math.round(shot.y) - 2, shot.hostile ? 5 : 3, shot.hostile ? 5 : 3);
      }
      ctx.strokeStyle = shot.hostile ? '#dc916166' : '#8af5e5aa'; ctx.beginPath(); ctx.moveTo(shot.x, shot.y); ctx.lineTo(shot.x - shot.vx * 2, shot.y - shot.vy * 2); ctx.stroke();
    }
    ctx.fillStyle = '#1c344455'; ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + 12, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (stasis && stasisBoss && !stasisBossInView && (stasisActive || world.tick < stasis.beginsAt)) {
      drawDesertStasisClock(ctx, p, stasis, world.tick, stasisActive);
    }
    ctx.globalAlpha = p.invincible > 0 && world.tick % 6 < 3 ? .45 : 1;
    const facing = drawAstronaut(ctx, world, p.x, p.y, world.tick, world.phase.kind === 'running');
    ctx.globalAlpha = 1;
    if (!title && world.materialMotions?.length) {
      const visor = directionalVisorBounds(p.x, p.y, facing);
      if (visor) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(view.left, view.top, view.width, view.height);
        ctx.rect(visor.x, visor.y, visor.width, visor.height);
        ctx.clip('evenodd');
      }
      for (const motion of world.materialMotions) drawMaterialMotion(ctx, motion, world.tick, p);
      if (visor) ctx.restore();
    }
    for (let i = 0; i < Math.min(4, world.upgrades.orbit); i++) {
      const angle = world.tick * .055 + i * Math.PI * 2 / Math.min(4, world.upgrades.orbit);
      const x = p.x + Math.cos(angle) * 58, y = p.y + Math.sin(angle) * 58;
      ctx.strokeStyle = '#a4f8e333'; ctx.beginPath(); ctx.arc(p.x, p.y, 58, 0, Math.PI * 2); ctx.stroke(); atlas.draw(ctx, 'drone', x, y, .9);
    }
    for (const effect of world.effects) {
      if (effect.kind === 'echo-dispersal') {
        drawLunarEchoDispersal(ctx, effect);
        continue;
      }
      ctx.globalAlpha = Math.min(1, effect.life / 15);
      ctx.strokeStyle = effect.kind === 'hit' ? '#f2a177' : '#b5ffe5'; ctx.fillStyle = ctx.strokeStyle;
      if (effect.kind === 'nova') {
        const frame = Math.floor((30 - effect.life) / 2);
        const progress = Math.min(1, (frame * 2 + 1) / 30);
        const radius = effect.size * (.14 + .82 * (1 - (1 - progress) ** 2));
        const fragments = effect.life > 16 ? 11 : Math.max(1, Math.ceil(effect.life * 11 / 16));
        for (let segment = 0; segment < 64; segment++) {
          if (segment * 7 % 11 >= fragments) continue;
          const angle = segment * Math.PI / 32;
          const nextAngle = (segment + 1) * Math.PI / 32;
          const reach = radius - (segment * 5 % 9);
          const nextReach = radius - ((segment + 1) * 5 % 9);
          const x = Math.cos(angle) * reach, y = Math.sin(angle) * reach;
          const nextX = Math.cos(nextAngle) * nextReach, nextY = Math.sin(nextAngle) * nextReach;
          for (let point = 0; point < 4; point++) {
            const px = Math.round(effect.x + x + (nextX - x) * point / 4);
            const py = Math.round(effect.y + y + (nextY - y) * point / 4);
            const spark = effect.life >= 27 && segment % 16 === 0;
            const size = spark ? 3 : 2;
            if (Math.max((px - effect.x) ** 2, (px + size - effect.x) ** 2) + Math.max((py - effect.y) ** 2, (py + size - effect.y) ** 2) > effect.size ** 2) continue;
            ctx.fillStyle = spark || segment % 8 === 0 && point < 2 ? '#d9fff2' : '#50d9ee';
            ctx.fillRect(px, py, size, size);
          }
        }
      }
      else for (let i = 0; i < 6; i++) { const a = i * 1.047 + effect.x; const d = (25 - effect.life) * .7; ctx.fillRect(effect.x + Math.cos(a) * d, effect.y + Math.sin(a) * d, 2, 2); }
    }
    ctx.globalAlpha = 1; ctx.restore();
    const shade = ctx.createRadialGradient(width / 2, height / 2, width * .15, width / 2, height / 2, width * .7); shade.addColorStop(0, '#04141b00'); shade.addColorStop(1, '#06182799'); ctx.fillStyle = shade; ctx.fillRect(0, 0, width, height);
    if (stasis && stasisBoss && stasisBossInView && world.tick < stasis.beginsAt) {
      ctx.save();
      ctx.setTransform(zoom, 0, 0, zoom, -view.left * zoom, -view.top * zoom);
      drawDesertStasisWarning(ctx, stasisBoss, stasis.beginsAt - world.tick);
      ctx.restore();
    }
    if (!title && world.phase.kind === 'running' && hasRelayBase(world.context) && repair && 'towers' in repair) {
      const objective = relayObjective(repair, p);
      if (objective) drawRelayObjective(ctx, objective, view.left, view.top, zoom, width, height);
    }
    if (title) {
      ctx.fillStyle = '#071420aa'; ctx.fillRect(0, 0, width, height);
    }
  };
}
