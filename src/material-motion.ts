type Point = Readonly<{ x: number; y: number }>;
export type Material = 'wood' | 'iron';

export type MaterialMotion =
  | Readonly<{ kind: 'pickup'; tick: number; source: Point; material: Material }>
  | Readonly<{ kind: 'deposit'; tick: number; source: Point; tower: Point }>;

export function materialMotionDuration(kind: MaterialMotion['kind']): number {
  return kind === 'pickup' ? 18 : 30;
}
