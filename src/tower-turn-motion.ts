import type { DesertTurretShot } from './desert-repair.js';

const TURN_PER_TICK = Math.PI / 45;
const FLASH_TICKS = 8;

export type TowerTurnPose = Readonly<{ tick: number; angle: number; flash: boolean }>;

export function advanceTowerTurn(
  previous: TowerTurnPose | undefined,
  tick: number,
  rest: number,
  shot: DesertTurretShot | undefined,
  targetAngle: () => number | undefined
): TowerTurnPose {
  let angle = previous?.angle ?? rest;
  let fromTick = previous?.tick ?? tick;
  if (shot && shot.tick <= tick) {
    const lastFlashTick = shot.tick + FLASH_TICKS - 1;
    if (tick <= lastFlashTick) {
      return { tick, angle: Math.atan2(shot.vy, shot.vx), flash: true };
    }
    if (fromTick < lastFlashTick) {
      angle = Math.atan2(shot.vy, shot.vx);
      fromTick = lastFlashTick;
    }
  }

  const goal = fromTick < tick ? targetAngle() : undefined;
  if (goal !== undefined) {
    const delta = Math.atan2(Math.sin(goal - angle), Math.cos(goal - angle));
    const limit = (tick - fromTick) * TURN_PER_TICK;
    angle += Math.max(-limit, Math.min(limit, delta));
  }
  return { tick, angle, flash: false };
}
