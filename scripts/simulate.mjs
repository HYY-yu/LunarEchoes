import { runTask } from './task.mjs';
let play;
if (import.meta.main) await runTask('simulate');
else ({ play } = await import('./simulation.mjs'));
export { play };
