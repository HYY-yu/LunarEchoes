export const DESERT_STASIS = Object.freeze({ warningTicks: 45, freezeTicks: 72 });

export type DesertStasis = Readonly<{ bossId: number; beginsAt: number; endsAt: number }>;

export function planDesertStasis(bossId: number, tick: number): DesertStasis {
  const beginsAt = tick + DESERT_STASIS.warningTicks;
  return { bossId, beginsAt, endsAt: beginsAt + DESERT_STASIS.freezeTicks };
}

export function isDesertStasisActive(stasis: DesertStasis | undefined, tick: number): boolean {
  return stasis !== undefined && tick >= stasis.beginsAt && tick < stasis.endsAt;
}
