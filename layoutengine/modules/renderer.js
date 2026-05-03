/**
 * canvasRenderer.js — Canvas-specific rendering logic for LayoutEngineV6.
 */
import { transformPath } from './shapesFactory.js';

export const PALETTE = [
    { bg: '#b5d4f4', fg: '#042c53', accent: '#3b82f6' },
    { bg: '#9fe1cb', fg: '#04342c', accent: '#10b981' },
    { bg: '#f5c4b3', fg: '#4a1b0c', accent: '#f97316' },
    { bg: '#fac775', fg: '#412402', accent: '#f59e0b' },
    { bg: '#c0dd97', fg: '#173404', accent: '#84cc16' },
    { bg: '#f4c0d1', fg: '#4b1528', accent: '#ec4899' },
    { bg: '#cecbf6', fg: '#26215c', accent: '#8b5cf6' },
    { bg: '#d3d1c7', fg: '#2c2c2a', accent: '#6b7280' },
    { bg: '#fde68a', fg: '#451a03', accent: '#d97706' }
];

/**
 * Draws the entire render graph onto a 2D canvas context.
 */
export function drawRenderGraph(ctx, renderGraph, imageRatios, W, H, planes = []) {
    ctx.clearRect(0, 0, W, H);

    // Draw Planes (Pages & Spine)
    for (const plane of planes) {
        // Full Page Area
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0,0,0,0.1)';
        ctx.fillRect(plane.full.x, plane.full.y, plane.full.w, plane.full.h);
        ctx.shadowBlur = 0;

        // Content Area (Margins)
        ctx.strokeStyle = '#e5e7eb';
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(plane.content.x, plane.content.y, plane.content.w, plane.content.h);
        ctx.setLineDash([]);
    }

    // Draw Spine if in spread mode
    if (planes.length > 1) {
        const spineX = planes[0].full.w;
        const spineW = planes[1].full.x - planes[0].full.w;
        if (spineW > 0) {
            const grad = ctx.createLinearGradient(spineX, 0, spineX + spineW, 0);
            grad.addColorStop(0, '#f3f4f6');
            grad.addColorStop(0.5, '#e5e7eb');
            grad.addColorStop(1, '#f3f4f6');
            ctx.fillStyle = grad;
            ctx.fillRect(spineX, 0, spineW, H);
            
            // Spine line
            ctx.strokeStyle = '#d1d5db';
            ctx.beginPath();
            ctx.moveTo(spineX + spineW / 2, 0);
            ctx.lineTo(spineX + spineW / 2, H);
            ctx.stroke();
        }
    }

    for (const node of renderGraph) {
        const bounds = node.unrotatedBounds || node.bounds;
        if (!bounds || bounds.w <= 0 || bounds.h <= 0) continue;

        const imgIdx = node._imageIndex ?? 0;
        const pal = PALETTE[imgIdx % PALETTE.length];
        const { x, y, w, h } = bounds;
        const r = 5;

        // --- Path Creation ---
        let path;
        if (node.shapeId) {
            const pathString = transformPath(node.shapeId, bounds);
            path = new Path2D(pathString);
        } else if (node.points?.length > 2) {
            path = new Path2D();
            path.moveTo(node.points[0].x, node.points[0].y);
            for (let i = 1; i < node.points.length; i++) {
                path.lineTo(node.points[i].x, node.points[i].y);
            }
            path.closePath();
        } else {
            // Fallback for simple rects that didn't get polygon points
            path = new Path2D();
            path.roundRect(x, y, w, h, r);
        }

        // Fill background
        ctx.fillStyle = pal.bg;
        ctx.fill(path);

        // Strategy 1: Sibling Visualization
        if (node.siblingId) {
            ctx.strokeStyle = pal.accent;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            ctx.setLineDash([2, 2]);
            ctx.stroke(path);
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }

        // Subtle crosshatch pattern
        ctx.save();
        ctx.clip(path);
        ctx.strokeStyle = pal.fg;
        ctx.globalAlpha = 0.055;
        ctx.lineWidth = 1;
        for (let d = -h; d < w + h; d += 20) {
            ctx.beginPath();
            ctx.moveTo(x + d, y);
            ctx.lineTo(x + d + h, y + h);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        // Accent highlight bar at the top
        ctx.fillStyle = pal.accent;
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.roundRect(x, y, w, 3, [r, r, 0, 0]);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Ratio and dimension labels
        const imgRatio = imageRatios[imgIdx];
        const slotRatio = w / h;
        const err = Math.abs(slotRatio - imgRatio) / imgRatio;

        if (w > 52 && h > 36) {
            ctx.fillStyle = pal.fg;
            ctx.font = '500 11px "DM Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(imgRatio.toFixed(2), x + w / 2, y + h / 2 - 9);

            ctx.font = '400 9px "DM Mono", monospace';
            ctx.globalAlpha = 0.45;
            ctx.fillText(`${Math.round(w)}×${Math.round(h)}`, x + w / 2, y + h / 2 + 5);
            ctx.globalAlpha = 1;

            // Fit Error Label (Badge)
            if (err > 0.01) {
                const errColor = err > 0.25 ? '#f87171' : err > 0.1 ? '#fb923c' : '#4ade80';
                ctx.fillStyle = errColor;
                ctx.globalAlpha = 0.85;
                ctx.font = '400 8px "DM Mono", monospace';
                ctx.fillText(`±${(err * 100).toFixed(0)}%`, x + w / 2, y + h / 2 + 17);
                ctx.globalAlpha = 1;
            }
        }

        // Slot ID Badge
        if (w > 30 && h > 22) {
            ctx.fillStyle = pal.fg;
            ctx.globalAlpha = 0.18;
            ctx.fillRect(x + 5, y + 7, 22, 13);
            ctx.globalAlpha = 0.6;
            ctx.font = '500 8px "DM Mono", monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`S${imgIdx}`, x + 7, y + 14);
            ctx.globalAlpha = 1;
        }
    }
}
