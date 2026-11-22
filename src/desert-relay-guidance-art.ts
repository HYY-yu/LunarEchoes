import type { RelayObjective } from './desert-repair.js';

export function drawRelayObjective(
  ctx: CanvasRenderingContext2D, objective: RelayObjective,
  left: number, top: number, zoom: number, width: number, height: number
): void {
  const { target } = objective;
  const x = (target.x - left) * zoom;
  const y = (target.y - top) * zoom;
  const inView = x >= 0 && x <= width && y >= 0 && y <= height;
  if (inView && objective.kind === 'supply') return;

  ctx.save();
  ctx.fillStyle = objective.kind === 'repair' ? '#7ef5d1' : objective.target.material === 'wood' ? '#ffcf86' : '#abe3f2';
  ctx.strokeStyle = '#182c34';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (inView) {
    const markerY = Math.max(8, y - 45 * zoom);
    ctx.moveTo(x - 5, markerY);
    ctx.lineTo(x + 5, markerY);
    ctx.lineTo(x, markerY + 6);
  } else {
    const horizontal = x - width / 2;
    const vertical = y - height / 2;
    const edgeX = width / 2 - 13;
    const edgeY = width >= 300 ? height * .32
      : vertical < 0 ? height / 2 - Math.min(height * .34, 106) : height * .20;
    const factor = Math.min(edgeX / Math.abs(horizontal), edgeY / Math.abs(vertical));
    const bearing = Math.atan2(vertical, horizontal);
    ctx.translate(width / 2 + horizontal * factor, height / 2 + vertical * factor);
    ctx.rotate(bearing);
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-4, 5);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}
