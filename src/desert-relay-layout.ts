export const DESERT_RELAY_CENTER = Object.freeze({ x: 750, y: 750 });

export const DESERT_RELAY_CORNERS = [
  { x: -160, y: -160, direction: 'north' },
  { x: 160, y: -160, direction: 'east' },
  { x: 160, y: 160, direction: 'south' },
  { x: -160, y: 160, direction: 'west' }
] as const;
