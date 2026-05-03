/**
 * v6demo.js — Modular Entry Point for Layout Engine V6 Demo.
 * Orchestrates engine, partitioning, and rendering.
 */

import { LayoutEngineV6 } from '../core/engine.js';
import { bspPartition, resetSplitCount, splitCount, groupByRatioBalance } from '../modules/bsp.js';
import { drawRenderGraph, PALETTE } from '../modules/renderer.js';
import { getAllShapes } from '../modules/shapesFactory.js';

// ============================================================================
// APP STATE & CONSTANTS
// ============================================================================

const MARGIN = 14;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width, H = canvas.height;
const tooltip = document.getElementById('tooltip');

const engine = new LayoutEngineV6();

let currentImageRatios = [];
let isSpreadState = false;

// ============================================================================
// ASPECT RATIO GENERATOR
// ============================================================================

function getAspectRatios(preset, n) {
    const gen = {
        portrait: () => 0.58 + Math.random() * 0.18,
        landscape: () => 1.35 + Math.random() * 0.45,
        square: () => 0.88 + Math.random() * 0.24,
        mixed: () => [0.6, 0.65, 0.72, 1.4, 1.5, 1.6, 1.0][Math.floor(Math.random() * 7)],
        random: () => 0.38 + Math.random() * 1.9,
    };
    return Array.from({ length: n }, gen[preset] || gen.mixed);
}

// ============================================================================
// CORE WORKFLOW
// ============================================================================

function buildAndRender() {
    const gap = parseInt(document.getElementById('gapSlider').value);
    const bleed = parseInt(document.getElementById('bleedSlider').value);
    const isSpread = isSpreadState;
    const spineWidth = parseInt(document.getElementById('spineSlider').value);
    const marginSize = parseInt(document.getElementById('marginSlider').value);

    const config = {
        width: W, height: H, bleed,
        isSpread,
        spineWidth: isSpread ? spineWidth : 0,
        margins: { top: marginSize, bottom: marginSize, left: marginSize, right: marginSize }
    };

    engine.loadTemplates([]); // Clear current template if any
    const planes = engine.getLayoutPlanes(config); // Temporary use to get rects for BSP

    resetSplitCount();
    const indices = currentImageRatios.map((_, i) => i);
    
    // If spread, split the image indices between pages (simple split for demo)
    let bspSlots = [];
    const options = { allowDiagonal: true }; // Strategy 1: Enable diagonal splits

    if (isSpread && indices.length > 1) {
        // Use aspect ratios to find a natural split point
        const [leftGroupIndices, rightGroupIndices] = groupByRatioBalance(currentImageRatios);
        const leftIndices = leftGroupIndices.map(i => indices[i]);
        const rightIndices = rightGroupIndices.map(i => indices[i]);
        
        const leftSlots = bspPartition(leftIndices, currentImageRatios, planes[0].content, gap, options);
        const rightSlots = bspPartition(rightIndices, currentImageRatios, planes[1].content, gap, options);
        
        // Mark which page they belong to
        leftSlots.forEach(s => s.page = 'left');
        rightSlots.forEach(s => s.page = 'right');
        bspSlots = [...leftSlots, ...rightSlots];
    } else {
        const slots = bspPartition(indices, currentImageRatios, planes[0].content, gap, options);
        slots.forEach(s => s.page = 'content');
        bspSlots = slots;
    }

    // Create template
    const template = {
        id: `tpl_${Date.now()}`,
        page: { width: W, height: H },
        slots: bspSlots.map((s, idx) => ({
            slotId: `slot_${idx}`,
            _imageIndex: s.imageIndex,
            page: s.page,
            type: 'image',
            // Strategy 1: Use Polygons instead of rect anchors for generated layouts
            shape: { 
                type: 'polygon', 
                points: s.points.map(p => ({ 
                    x: p.x / W, 
                    y: p.y / H 
                })) 
            },
            siblingId: s.siblingId,
            bleed: true,
            zIndex: idx + 1
        }))
    };

    engine.loadTemplates([template]);
    engine.selectTemplate(template.id, config);

    // Assign images
    const assignments = template.slots.map(slot => ({
        slotId: slot.slotId,
        type: 'image',
        data: {
            width: currentImageRatios[slot._imageIndex] * 1000,
            height: 1000,
            focalPoint: { x: 0.5, y: 0.5 },
            _imageIndex: slot._imageIndex
        }
    }));
    engine.batchAssign(assignments);

    render();
}

function render() {
    const graph = engine.getRenderGraph();
    const planes = engine.getLayoutPlanes();
    drawRenderGraph(ctx, graph, currentImageRatios, W, H, planes);

    // Calculate Stats
    let totalErr = 0, worstErr = 0;
    for (const node of graph) {
        const b = node.unrotatedBounds || node.bounds;
        if (!b || b.w <= 0) continue;
        const imgIdx = node._imageIndex ?? 0;
        const ratio = currentImageRatios[imgIdx];
        const err = Math.abs((b.w / b.h) - ratio) / ratio;
        totalErr += err;
        worstErr = Math.max(worstErr, err);
    }

    const avgErr = graph.length ? totalErr / graph.length : 0;
    const errEl = document.getElementById('statErr');
    const wrstEl = document.getElementById('statWorst');

    errEl.textContent = (avgErr * 100).toFixed(1) + '%';
    wrstEl.textContent = (worstErr * 100).toFixed(1) + '%';
    errEl.className = 'stat-val ' + (avgErr < 0.1 ? 'good' : avgErr < 0.2 ? 'mid' : 'bad');
    wrstEl.className = 'stat-val ' + (worstErr < 0.15 ? 'good' : worstErr < 0.3 ? 'mid' : 'bad');

    document.getElementById('statSplits').textContent = splitCount;
    document.getElementById('statSlots').textContent = engine.getSlotCount();
    document.getElementById('statEngine').textContent = `u:${engine.getUndoDepth()} r:${engine.getRedoDepth()}`;

    updateHistoryDots();
    updateUndoRedo();
}

function regenerate() {
    const n = parseInt(document.getElementById('imgCount').value);
    const preset = document.querySelector('.ratio-btn.active').dataset.preset;
    currentImageRatios = getAspectRatios(preset, n);
    buildAndRender();
}

// ============================================================================
// UI SYNC
// ============================================================================

function updateHistoryDots() {
    const dots = document.getElementById('historyDots');
    const depth = Math.min(engine.getUndoDepth(), 8);
    dots.innerHTML = '';
    for (let i = 0; i < depth; i++) {
        const d = document.createElement('div');
        d.className = 'hdot ' + (i === depth - 1 ? 'current' : 'filled');
        dots.appendChild(d);
    }
    const redoDepth = Math.min(engine.getRedoDepth(), 4);
    for (let i = 0; i < redoDepth; i++) {
        const d = document.createElement('div');
        d.className = 'hdot';
        d.style.opacity = '0.35';
        dots.appendChild(d);
    }
}

function updateUndoRedo() {
    document.getElementById('btnUndo').disabled = engine.getUndoDepth() <= 1;
    document.getElementById('btnRedo').disabled = engine.getRedoDepth() === 0;
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

document.getElementById('imgCount').oninput = function () {
    document.getElementById('imgCountVal').textContent = this.value;
    regenerate();
};
document.getElementById('widthSlider').oninput = function () {
    W = parseInt(this.value);
    canvas.width = W;
    document.getElementById('widthVal').textContent = W;
    buildAndRender();
};
document.getElementById('heightSlider').oninput = function () {
    H = parseInt(this.value);
    canvas.height = H;
    document.getElementById('heightVal').textContent = H;
    buildAndRender();
};
document.getElementById('gapSlider').oninput = function () {
    document.getElementById('gapVal').textContent = this.value;
    buildAndRender();
};
document.getElementById('bleedSlider').oninput = function () {
    document.getElementById('bleedVal').textContent = this.value;
    buildAndRender();
};

document.querySelectorAll('.ratio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelector('.ratio-btn.active').classList.remove('active');
        btn.classList.add('active');
        regenerate();
    });
});

document.getElementById('spreadToggle').onclick = function () {
    isSpreadState = !isSpreadState;
    this.classList.toggle('spread-active', isSpreadState);
    buildAndRender();
};
document.getElementById('spineSlider').oninput = function () {
    document.getElementById('spineVal').textContent = this.value;
    buildAndRender();
};
document.getElementById('marginSlider').oninput = function () {
    document.getElementById('marginVal').textContent = this.value;
    buildAndRender();
};
document.getElementById('btnShuffle').onclick = regenerate;
document.getElementById('btnUndo').onclick = () => { if (engine.undo()) render(); };
document.getElementById('btnRedo').onclick = () => { if (engine.redo()) render(); };

// Mouse Hover logic
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const graph = engine.getRenderGraph();
    let found = null;
    for (const node of graph) {
        const b = node.unrotatedBounds || node.bounds;
        if (b && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
            found = node; break;
        }
    }

    if (found) {
        const b = found.unrotatedBounds || found.bounds;
        const imgIdx = found._imageIndex ?? 0;
        const ratio = currentImageRatios[imgIdx];
        const slotR = b.w / b.h;
        const err = Math.abs(slotR - ratio) / ratio;

        tooltip.innerHTML = `<strong>${found.slotId}</strong><br>` +
            `img ratio: ${ratio.toFixed(3)}<br>` +
            `slot ratio: ${slotR.toFixed(3)}<br>` +
            `fit error: ${(err * 100).toFixed(1)}%<br>` +
            `bounds: ${Math.round(b.w)}×${Math.round(b.h)}`;

        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top = (e.clientY - 10) + 'px';
        tooltip.classList.add('show');
        document.getElementById('overlayText').textContent = found.slotId;
        canvas.style.cursor = 'crosshair';
    } else {
        tooltip.classList.remove('show');
        document.getElementById('overlayText').textContent = 'hover a slot';
        canvas.style.cursor = 'default';
    }
});

canvas.addEventListener('mouseleave', () => {
    tooltip.classList.remove('show');
    document.getElementById('overlayText').textContent = 'hover a slot';
});

// Click to nudge focal point (demonstrates undo stack)
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const graph = engine.getRenderGraph();
    for (const node of graph) {
        const b = node.unrotatedBounds || node.bounds;
        if (b && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
            const imgIdx = node._imageIndex ?? 0;
            engine.assignImage(node.slotId, {
                width: currentImageRatios[imgIdx] * 1000,
                height: 1000,
                focalPoint: { x: Math.random(), y: Math.random() },
                _imageIndex: imgIdx
            });
            render();
            break;
        }
    }
});

// Drag and Drop for shapes
canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    canvas.classList.add('canvas-drag-over');
});
canvas.addEventListener('dragleave', () => {
    canvas.classList.remove('canvas-drag-over');
});
canvas.addEventListener('drop', (e) => {
    console.log(`[v6demo] Drop event triggered.`);
    e.preventDefault();
    canvas.classList.remove('canvas-drag-over');

    console.log(`[v6demo] DataTransfer types: ${e.dataTransfer.types.join(', ')}`);
    const shapeId = e.dataTransfer.getData('text/plain');
    console.log(`[v6demo] Dropped shapeId: ${shapeId}`);
    if (!shapeId) {
        console.log(`[v6demo] No shapeId found in dataTransfer.`);
        return;
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const graph = engine.getRenderGraph();
    let foundNode = null;
    for (const node of graph) {
        const b = node.unrotatedBounds || node.bounds;
        if (b && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
            foundNode = node;
            break;
        }
    }

    if (foundNode) {
        console.log(`[v6demo] Found slot ${foundNode.slotId} at drop coordinates.`);
        engine.setSlotShape(foundNode.slotId, shapeId);
        // Re-render will be triggered by the engine's 'stateChanged' event
    } else {
        console.log(`[v6demo] No slot found at drop coordinates.`);
    }
});
// Engine listener
engine.addEventListener('stateChanged', () => {
    updateUndoRedo();
    updateHistoryDots();
});

// INITIALIZE
regenerate();
initializeShapePalette();

// ============================================================================
// SHAPE PALETTE & DRAG-DROP
// ============================================================================

function initializeShapePalette() {
    const palette = document.getElementById('shape-palette');
    if (!palette) return;
    const shapes = getAllShapes();
    palette.innerHTML = shapes.map(shape => `
        <div class="shape-item" draggable="true" data-shape-id="${shape.id}" title="${shape.label}">
            <svg viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet">
                <path d="${shape.svgPath}"></path>
            </svg>
            <span>${shape.label}</span>
        </div>
    `).join('');
    
    document.querySelectorAll('.shape-item').forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
    });
}

function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.closest('.shape-item').dataset.shapeId);
    e.dataTransfer.effectAllowed = 'copy';
}
