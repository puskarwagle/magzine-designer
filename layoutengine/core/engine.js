/**
 * engineV6.js — A pure JavaScript port of LayoutEngineV6.
 * (Based on layoutengineV6.ts)
 */

export const computeBounds = (points) => {
    if (!points.length) return { x: 0, y: 0, w: 0, h: 0 };
    let minX = points[0].x, minY = points[0].y, maxX = points[0].x, maxY = points[0].y;
    for (let i = 1; i < points.length; i++) {
        const p = points[i];
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
};

export class DefaultShapeVisitor {
    visitRectangle(shape, scale) {
        const x = shape.x ?? 0, y = shape.y ?? 0, w = shape.width ?? 1, h = shape.height ?? 1;
        const pts = [
            { x: x * scale.width, y: y * scale.height },
            { x: (x + w) * scale.width, y: y * scale.height },
            { x: (x + w) * scale.width, y: (y + h) * scale.height },
            { x: x * scale.width, y: (y + h) * scale.height }
        ];
        return { points: pts, bounds: computeBounds(pts) };
    }
    visitPolygon(shape, scale) {
        const pts = (shape.points || []).map(p =>
            Array.isArray(p)
                ? { x: p[0] * scale.width, y: p[1] * scale.height }
                : { x: (p.x ?? 0) * scale.width, y: (p.y ?? 0) * scale.height }
        );
        return { points: pts, bounds: computeBounds(pts) };
    }
    visitPath(shape, scale) {
        const pts = [];
        if (shape.commands) {
            for (const cmd of shape.commands) {
                if (cmd.x !== undefined && cmd.y !== undefined)
                    pts.push({ x: cmd.x * scale.width, y: cmd.y * scale.height });
            }
        }
        return { points: pts, bounds: computeBounds(pts) };
    }
}

export class ShapeFactory {
    static visitor = new DefaultShapeVisitor();
    static _cache = new WeakMap();

    static toPolygon(shape, scale) {
        if (!shape) return { points: [], bounds: { x: 0, y: 0, w: 0, h: 0 } };
        let shapeCache = this._cache.get(shape);
        if (!shapeCache) { shapeCache = new Map(); this._cache.set(shape, shapeCache); }
        const key = `${scale.width}x${scale.height}`;
        if (shapeCache.has(key)) return shapeCache.get(key);
        let result;
        if (shape.type === 'rectangle' || (!shape.points && !shape.commands))
            result = this.visitor.visitRectangle(shape, scale);
        else if (shape.type === 'polygon' || shape.points)
            result = this.visitor.visitPolygon(shape, scale);
        else if (shape.type === 'path' || shape.commands)
            result = this.visitor.visitPath(shape, scale);
        else throw new Error(`Unknown shape type: ${shape.type}`);
        shapeCache.set(key, result);
        return result;
    }
}

export class GeometryMath {
    static getAxes(polygon) {
        const axes = [], eps = 1e-9;
        for (let i = 0; i < polygon.length; i++) {
            const p1 = polygon[i], p2 = polygon[(i + 1) % polygon.length];
            const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
            const len = Math.sqrt(edge.x * edge.x + edge.y * edge.y);
            if (len > eps) axes.push({ x: -edge.y / len, y: edge.x / len });
        }
        return axes;
    }
    static projectPolygon(axis, polygon) {
        let min = polygon[0].x * axis.x + polygon[0].y * axis.y, max = min;
        for (let i = 1; i < polygon.length; i++) {
            const p = polygon[i].x * axis.x + polygon[i].y * axis.y;
            if (p < min) min = p; else if (p > max) max = p;
        }
        return { min, max };
    }
    static aabbIntersect(a, b) {
        return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
    }
    static polygonsIntersect(polyA, polyB) {
        const axes = [...this.getAxes(polyA), ...this.getAxes(polyB)];
        const eps = 1e-9;
        for (const axis of axes) {
            const pA = this.projectPolygon(axis, polyA);
            const pB = this.projectPolygon(axis, polyB);
            if (pA.max < pB.min - eps * 10 || pB.max < pA.min - eps * 10) return false;
        }
        return true;
    }
    static offsetPolygon(points, offset) {
        if (offset === 0 || points.length < 3) return [...points];
        const result = [], n = points.length;
        for (let i = 0; i < n; i++) {
            const prev = points[(i - 1 + n) % n], curr = points[i], next = points[(i + 1) % n];
            const e1 = { x: curr.x - prev.x, y: curr.y - prev.y };
            const e2 = { x: next.x - curr.x, y: next.y - curr.y };
            const l1 = Math.sqrt(e1.x * e1.x + e1.y * e1.y) || 1e-9;
            const l2 = Math.sqrt(e2.x * e2.x + e2.y * e2.y) || 1e-9;
            const n1 = { x: -e1.y / l1, y: e1.x / l1 };
            const n2 = { x: -e2.y / l2, y: e2.x / l2 };
            const nx = n1.x + n2.x, ny = n1.y + n2.y;
            const ln = Math.sqrt(nx * nx + ny * ny) || 1e-9;
            result.push({ x: curr.x + (nx / ln) * offset, y: curr.y + (ny / ln) * offset });
        }
        return result;
    }
}

export class TransformEngine {
    static applyTransform(geom, rotation = 0, pivot = null) {
        if (!rotation || Math.abs(rotation) < 1e-6) {
            return { points: geom.points, bounds: geom.bounds, unrotatedBounds: geom.bounds, rotationMatrix: { rotation: 0, pivot: null } };
        }
        const pointList = geom.points || [];
        const center = pivot || pointList.reduce(
            (acc, p) => ({ x: acc.x + p.x / pointList.length, y: acc.y + p.y / pointList.length }),
            { x: 0, y: 0 }
        );

        let transformedPoints;
        if (typeof DOMMatrix !== 'undefined') {
            const matrix = new DOMMatrix()
                .translate(center.x, center.y)
                .rotate(rotation)
                .translate(-center.x, -center.y);
            transformedPoints = pointList.map(p => {
                const pt = matrix.transformPoint(new DOMPoint(p.x, p.y));
                return { x: pt.x, y: pt.y };
            });
        } else {
            const rad = rotation * (Math.PI / 180), cos = Math.cos(rad), sin = Math.sin(rad);
            transformedPoints = pointList.map(p => ({
                x: center.x + (p.x - center.x) * cos - (p.y - center.y) * sin,
                y: center.y + (p.x - center.x) * sin + (p.y - center.y) * cos
            }));
        }

        return {
            points: transformedPoints,
            bounds: computeBounds(transformedPoints),
            unrotatedBounds: geom.bounds,
            rotationMatrix: { rotation, pivot: center }
        };
    }
}

export class PolygonMath {
    static pointInPolygon(p, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            const intersect = ((yi > p.y) !== (yj > p.y)) &&
                (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    static getPointToEdgeDistance(p, p1, p2) {
        let x = p1.x, y = p1.y, dx = p2.x - x, dy = p2.y - y;
        if (dx !== 0 || dy !== 0) {
            const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
            if (t > 1) { x = p2.x; y = p2.y; }
            else if (t > 0) { x += dx * t; y += dy * t; }
        }
        dx = p.x - x; dy = p.y - y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static getPolylineDistance(p, polygon) {
        let minDist = Infinity;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            minDist = Math.min(minDist, this.getPointToEdgeDistance(p, polygon[i], polygon[j]));
        }
        return minDist;
    }

    static getVisualCenter(polygon, precision = 1.0) {
        if (!polygon?.length) return { x: 0, y: 0, distance: 0 };
        const bounds = computeBounds(polygon);
        if (bounds.w === 0 || bounds.h === 0) return { x: bounds.x, y: bounds.y, distance: 0 };
        
        const getDist = (x, y) => {
            const dist = this.getPolylineDistance({ x, y }, polygon);
            return this.pointInPolygon({ x, y }, polygon) ? dist : -dist;
        };

        let bestPoint = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2, distance: -Infinity };
        bestPoint.distance = getDist(bestPoint.x, bestPoint.y);

        // Initial Grid Sampling
        const step = Math.min(bounds.w, bounds.h) / 4;
        for (let x = bounds.x + step; x < bounds.x + bounds.w; x += step) {
            for (let y = bounds.y + step; y < bounds.y + bounds.h; y += step) {
                const d = getDist(x, y);
                if (d > bestPoint.distance) bestPoint = { x, y, distance: d };
            }
        }

        const refine = (cellX, cellY, size) => {
            const h = size / 2;
            const cx = cellX + h, cy = cellY + h;
            const dist = getDist(cx, cy);
            
            if (dist > bestPoint.distance) {
                bestPoint = { x: cx, y: cy, distance: dist };
            }
            
            if (size <= precision) return;
            
            // Pruning: if the max possible distance in this cell is less than bestPoint.distance, skip
            if (dist + size * 0.7071 <= bestPoint.distance) return;

            refine(cellX, cellY, h);
            refine(cellX + h, cellY, h);
            refine(cellX, cellY + h, h);
            refine(cellX + h, cellY + h, h);
        };

        refine(bounds.x, bounds.y, Math.max(bounds.w, bounds.h));
        return bestPoint;
    }
}

export class ImageMath {
    static clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }

    static calculateRect(slot, imgW, imgH, options = {}) {
        const mode = options.mode || 'fill';
        const focalPoint = options.focalPoint || { x: 0.5, y: 0.5 };
        const userTransform = options.userTransform || null;
        const containmentBuffer = options.containmentBuffer || 1.0;
        const maxScaleOverfill = options.maxScaleOverfill || 2.0;

        const points = slot.points || [];
        const rotation = slot.rotation || 0;
        const bounds = slot.bounds || computeBounds(points);
        const visualCenter = (points.length >= 3) ? PolygonMath.getVisualCenter(points) : { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };

        const ir = imgW / imgH;
        let finalW, finalH;

        if (mode === 'fill' && points.length >= 3) {
            // Minimal scale calculation to cover all vertices
            let maxDistW = 0, maxDistH = 0;
            // $O(N)$ circumcircle optimization (simple version: max distance in each axis relative to VC)
            for (const p of points) {
                maxDistW = Math.max(maxDistW, Math.abs(p.x - visualCenter.x));
                maxDistH = Math.max(maxDistH, Math.abs(p.y - visualCenter.y));
            }
            
            // Required W/H to cover the distance from visual center
            let reqW = (maxDistW * 2) + containmentBuffer;
            let reqH = (maxDistH * 2) + containmentBuffer;

            // Maintain image aspect ratio
            if (reqW / reqH > ir) {
                finalW = reqW;
                finalH = reqW / ir;
            } else {
                finalH = reqH;
                finalW = reqH * ir;
            }

            // Aspect Ratio Clamping
            const aabbScaleW = finalW / bounds.w;
            const aabbScaleH = finalH / bounds.h;
            const maxScale = Math.max(aabbScaleW, aabbScaleH);
            if (maxScale > maxScaleOverfill) {
                const ratio = maxScaleOverfill / maxScale;
                finalW *= ratio;
                finalH *= ratio;
            }
        } else {
            // Default AABB Fallback for rects or mode='fit'
            const br = bounds.w / bounds.h;
            if (mode === 'fill') {
                if (br > ir) { finalW = bounds.w; finalH = bounds.w / ir; }
                else { finalH = bounds.h; finalW = bounds.h * ir; }
            } else {
                if (br > ir) { finalH = bounds.h; finalW = bounds.h * ir; }
                else { finalW = bounds.w; finalH = bounds.w / ir; }
            }
        }

        let x = visualCenter.x - finalW / 2;
        let y = visualCenter.y - finalH / 2;

        if (mode === 'fill') {
            const fx = this.clamp(focalPoint.x, 0, 1), fy = this.clamp(focalPoint.y, 0, 1);
            x += (visualCenter.x - (x + finalW / 2)) * (0.5 - fx); // Adjusted for VC
            y += (visualCenter.y - (y + finalH / 2)) * (0.5 - fy);
            // Re-center focal point logic around the Visual Center
            x -= (fx - 0.5) * (finalW - bounds.w);
            y -= (fy - 0.5) * (finalH - bounds.h);
        }

        if (userTransform) {
            const scale = Math.max(1e-4, userTransform.scale || 1.0);
            const scaledW = finalW * scale, scaledH = finalH * scale;
            x = x + (finalW - scaledW) / 2 + (userTransform.offsetX || 0);
            y = y + (finalH - scaledH) / 2 + (userTransform.offsetY || 0);
            return { x, y, w: scaledW, h: scaledH, rotation: userTransform.rotation || 0 };
        }
        return { x, y, w: finalW, h: finalH, rotation: 0 };
    }
}

export class TemplateScorer {
    static score(template, imageCount, options = {}) {
        let score = 0;
        const max = template.metadata?.maxImages ?? template.slots.length;
        const min = template.metadata?.minImages ?? template.slots.length;
        if (imageCount === min && imageCount === max) score += 10;
        if (options.style && template.metadata?.style === options.style) score += 5;
        if (options.tags?.length && template.metadata?.tags?.length) {
            score += options.tags.filter(t => template.metadata.tags.includes(t)).length * 2;
        }
        score += (1 - (template.metadata?.complexity || 0.5)) * 2;
        score += this.visualFlowScore(template);
        return score;
    }

    static visualFlowScore(template) {
        if (!template.slots?.length) return 0;
        let totalArea = 0, largestArea = 0;
        template.slots.forEach(slot => {
            const w = slot.anchors?.width ?? slot.shape?.width ?? 0.5;
            const h = slot.anchors?.height ?? slot.shape?.height ?? 0.5;
            const area = w * h;
            totalArea += area;
            if (area > largestArea) largestArea = area;
        });
        return (totalArea > 0 && largestArea > totalArea * 0.4) ? 3 : 0;
    }
}

export class Renderer {
    static generateSVGClipPath(slot) {
        const shapeToUse = slot.shape || slot.components?.mask?.shape;
        let pathStr = "";
        if (shapeToUse?.type === "path" && shapeToUse.commands) {
            pathStr = shapeToUse.commands.map(c =>
                c.cmd === "Z" ? "Z" : `${c.cmd} ${c.x ?? c.cx ?? ''} ${c.y ?? c.cy ?? ''}`.trim()
            ).join(" ");
        } else if (slot.unrotatedBounds) {
            const { x, y, w, h } = slot.unrotatedBounds;
            pathStr = `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
        } else if (slot.points && slot.points.length) {
            pathStr = `M ${slot.points.map(p => `${p.x} ${p.y}`).join(' L ')} Z`;
        }
        return pathStr;
    }
}

// Compatibility Polyfill for Node.js environments
const BaseEventTarget = (typeof EventTarget !== "undefined" ? EventTarget : class {
    constructor() { this._listeners = new Map(); }
    addEventListener(type, callback) {
        if (!this._listeners.has(type)) this._listeners.set(type, []);
        this._listeners.get(type).push(callback);
    }
    dispatchEvent(event) {
        const listeners = this._listeners.get(event.type) || [];
        listeners.forEach(cb => cb(event));
        return true;
    }
});

export class LayoutEngineV6 extends BaseEventTarget {
    #registry = new Map();
    #undoStack = [];
    #redoStack = [];
    #slotGeometryCache = new Map();
    #state = {
        template: null,
        config: {
            width: 1000,
            height: 1000,
            isSpread: false,
            spineWidth: 0,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            bleed: 0,
            safeZone: 0
        },
        images: new Map(),
        texts: new Map(),
        imageTransforms: new Map(),
        slots: []
    };

    loadTemplates(templates) {
        for (const t of templates) {
            const errs = this.#validateTemplate(t);
            if (errs.length) { console.warn(`Template ${t.id}:`, errs); continue; }
            this.#registry.set(t.id, t);
        }
    }

    selectTemplate(templateId, config) {
        const template = this.#registry.get(templateId);
        if (!template) throw new Error(`Template ${templateId} not found`);
        this.#state.template = template;
        this.#state.config = {
            ...this.#state.config,
            ...config,
            margins: config.margins ? { ...config.margins } : this.#state.config.margins
        };
        this.#slotGeometryCache.clear();
        this.#processSlots();
        this.#saveState();
        this.#dispatchStateChange();
    }

    selectBestTemplate(imageCount, options = {}) {
        if (!options.pageConfig) throw new Error('selectBestTemplate requires options.pageConfig');
        const candidates = Array.from(this.#registry.values()).filter(t => {
            const max = t.metadata?.maxImages ?? t.slots.length;
            const min = t.metadata?.minImages ?? t.slots.length;
            return imageCount >= min && imageCount <= max;
        });
        if (!candidates.length) return null;
        const best = candidates
            .map(t => ({ template: t, score: TemplateScorer.score(t, imageCount, options) }))
            .sort((a, b) => b.score - a.score)[0];
        if (best) {
            this.selectTemplate(best.template.id, options.pageConfig);
            return best.template;
        }
        return null;
    }

    assignImage(slotId, imageData, transform = null) {
        this.#state.images = new Map(this.#state.images);
        this.#state.images.set(slotId, { ...imageData, focalPoint: imageData.focalPoint || { x: 0.5, y: 0.5 } });
        if (transform) {
            this.#state.imageTransforms = new Map(this.#state.imageTransforms);
            this.#state.imageTransforms.set(slotId, transform);
        }
        this.#saveState();
        this.#dispatchStateChange();
    }

    updateImageTransform(slotId, delta, pushToHistory = true) {
        const cur = this.#state.imageTransforms.get(slotId) || { scale: 1, offsetX: 0, offsetY: 0, rotation: 0 };
        this.#state.imageTransforms = new Map(this.#state.imageTransforms);
        this.#state.imageTransforms.set(slotId, {
            scale: cur.scale + (delta.scale ?? 0),
            offsetX: cur.offsetX + (delta.offsetX ?? 0),
            offsetY: cur.offsetY + (delta.offsetY ?? 0),
            rotation: cur.rotation + (delta.rotation ?? 0)
        });
        if (pushToHistory) this.#saveState();
        this.#dispatchStateChange();
    }

    assignText(slotId, textData) {
        this.#state.texts = new Map(this.#state.texts);
        this.#state.texts.set(slotId, textData);
        this.#saveState();
        this.#dispatchStateChange();
    }

    batchAssign(assignments) {
        const snapshot = this.#cloneState(this.#state);
        try {
            this.#state.images = new Map(this.#state.images);
            this.#state.texts = new Map(this.#state.texts);
            this.#state.imageTransforms = new Map(this.#state.imageTransforms);
            for (const { slotId, type, data, transform } of assignments) {
                if (type === 'image') {
                    this.#state.images.set(slotId, { ...data, focalPoint: data.focalPoint || { x: 0.5, y: 0.5 } });
                    if (transform) this.#state.imageTransforms.set(slotId, transform);
                } else if (type === 'text') {
                    this.#state.texts.set(slotId, data);
                }
            }
            this.#saveState();
            this.#dispatchStateChange();
        } catch (err) {
            this.#state = snapshot;
            this.#slotGeometryCache.clear();
            this.#processSlots();
            throw err;
        }
    }

    undo() {
        if (this.#undoStack.length <= 1) return false;
        this.#redoStack.push(this.#undoStack.pop());
        this.#state = this.#cloneState(this.#undoStack[this.#undoStack.length - 1]);
        this.#dispatchStateChange();
        return true;
    }

    redo() {
        if (!this.#redoStack.length) return false;
        const next = this.#redoStack.pop();
        this.#undoStack.push(next);
        this.#state = this.#cloneState(next);
        this.#dispatchStateChange();
        return true;
    }

    getRenderGraph() {
        return this.#state.slots.map(slot => {
            const image = this.#state.images.get(slot.slotId);
            const text = this.#state.texts.get(slot.slotId);
            const userTransform = this.#state.imageTransforms.get(slot.slotId) || null;
            let assetRect = null, assetData = null;
            const fitBounds = slot.unrotatedBounds || slot.bounds;
            if (image && fitBounds) {
                assetRect = ImageMath.calculateRect(slot, image.width, image.height, {
                    mode: slot.components?.image?.mode || slot.mode || 'fill',
                    focalPoint: image.focalPoint,
                    userTransform
                });
                assetData = image;
            } else if (text && fitBounds) {
                const tb = { ...fitBounds };
                if (slot.textConfig?.padding) {
                    const p = slot.textConfig.padding;
                    tb.x += p; tb.y += p; tb.w -= p * 2; tb.h -= p * 2;
                }
                assetRect = tb; assetData = text;
            }
            return {
                ...slot, assetRect, assetData, userTransform,
                type: slot.type || 'image', components: slot.components || {}
            };
        });
    }

    getAssignedSlots() {
        return this.getRenderGraph().filter(node => node.assetData !== null);
    }

    getSlotById(slotId) {
        return this.#state.slots.find(s => s.slotId === slotId) || null;
    }

    toJSON() {
        const mapToJson = m => Array.from(m.entries());
        const stateToJson = s => ({
            ...s,
            images: mapToJson(s.images),
            texts: mapToJson(s.texts),
            imageTransforms: mapToJson(s.imageTransforms)
        });
        return JSON.stringify({
            registry: mapToJson(this.#registry),
            state: stateToJson(this.#state),
            undoStack: this.#undoStack.map(stateToJson)
        });
    }

    static fromJSON(json) {
        const raw = JSON.parse(json);
        const engine = new LayoutEngineV6();
        engine.#registry = new Map(raw.registry);
        const hydrate = s => ({
            ...s,
            images: new Map(s.images),
            texts: new Map(s.texts),
            imageTransforms: new Map(s.imageTransforms)
        });
        engine.#state = hydrate(raw.state);
        engine.#undoStack = raw.undoStack.map(hydrate);
        return engine;
    }

    getUndoDepth() { return this.#undoStack.length; }
    getRedoDepth() { return this.#redoStack.length; }
    getSlotCount() { return this.#state.slots.length; }
    getTemplateId() { return this.#state.template?.id || null; }

    getLayoutPlanes(config) {
        const cfg = config || this.#state.config;
        const { width, height, isSpread, spineWidth, margins } = cfg;
        const m = margins || { top: 0, bottom: 0, left: 0, right: 0 };

        if (!isSpread) {
            return [{
                type: 'page',
                full: { x: 0, y: 0, w: width, h: height },
                content: {
                    x: m.left,
                    y: m.top,
                    w: width - m.left - m.right,
                    h: height - m.top - m.bottom
                }
            }];
        } else {
            const pw = (width - (spineWidth || 0)) / 2;
            const sw = spineWidth || 0;
            return [
                {
                    type: 'left-page',
                    full: { x: 0, y: 0, w: pw, h: height },
                    content: {
                        x: m.left,
                        y: m.top,
                        w: pw - m.left - m.right,
                        h: height - m.top - m.bottom
                    }
                },
                {
                    type: 'right-page',
                    full: { x: pw + sw, y: 0, w: pw, h: height },
                    content: {
                        x: pw + sw + m.left,
                        y: m.top,
                        w: pw - m.left - m.right,
                        h: height - m.top - m.bottom
                    }
                }
            ];
        }
    }

    clearAssets() {
        this.#state.images = new Map();
        this.#state.texts = new Map();
        this.#state.imageTransforms = new Map();
        this.#saveState();
        this.#dispatchStateChange();
    }

    #cloneState(state) {
        return {
            template: state.template,
            config: state.config,
            images: new Map(state.images),
            texts: new Map(state.texts),
            imageTransforms: new Map(state.imageTransforms),
            slots: [...state.slots]
        };
    }

    #processSlots() {
        if (!this.#state.template || !this.#state.config) return;
        const { width, height, bleed, isSpread, spineWidth, margins } = this.#state.config;
        const planes = this.getLayoutPlanes();

        this.#state.slots = this.#state.template.slots.map(slot => {
            const cacheKey = `${slot.slotId}_${width}_${height}_${bleed}_${isSpread}_${spineWidth}_${JSON.stringify(margins)}_${slot.rotation}_${JSON.stringify(slot.pivot)}_${JSON.stringify(slot.anchors)}`;
            if (this.#slotGeometryCache.has(cacheKey)) return this.#slotGeometryCache.get(cacheKey);

            const workingShape = slot.shape || slot.components?.mask?.shape || { type: 'rectangle', width: 1, height: 1 };
            let shapeToUse = { ...workingShape };

            // Determine which plane/coordinate space to use
            // If template specifies a page, or if we want to map into the usable content area
            let targetRect = { x: 0, y: 0, w: width, h: height };
            if (slot.page === 'left' && planes.length > 1) {
                targetRect = planes[0].content;
            } else if (slot.page === 'right' && planes.length > 1) {
                targetRect = planes[1].content;
            } else if (slot.page === 'content') {
                targetRect = planes[0].content;
            }

            if (slot.anchors && workingShape.type === 'rectangle') {
                shapeToUse.x = targetRect.x + (slot.anchors.left ?? 0) * targetRect.w;
                shapeToUse.y = targetRect.y + (slot.anchors.top ?? 0) * targetRect.h;
                shapeToUse.width = (slot.anchors.width ?? 1) * targetRect.w;
                shapeToUse.height = (slot.anchors.height ?? 1) * targetRect.h;
            }
            const scale = slot.anchors ? { width: 1, height: 1 } : { width, height };
            const geom = ShapeFactory.toPolygon(shapeToUse, scale);
            const tformed = TransformEngine.applyTransform(geom, slot.rotation, slot.pivot);
            const hasBleed = slot.bleed && bleed > 0;
            const adjPts = hasBleed ? GeometryMath.offsetPolygon(tformed.points, -bleed) : tformed.points;

            const processed = {
                ...slot,
                points: adjPts,
                bounds: hasBleed ? computeBounds(adjPts) : tformed.bounds,
                unrotatedBounds: hasBleed ? computeBounds(GeometryMath.offsetPolygon(geom.points, -bleed)) : tformed.unrotatedBounds,
                rotationMatrix: tformed.rotationMatrix,
                zIndex: slot.zIndex || 1
            };
            this.#slotGeometryCache.set(cacheKey, processed);
            return processed;
        }).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    }

    #validateTemplate(template) {
        const errors = [];
        if (!template.id) errors.push('Missing id');
        if (!Array.isArray(template.slots)) errors.push('Missing slots');
        if (!template.page) errors.push('Missing page');

        if (!errors.length) {
            const testSlots = template.slots.map(s => {
                const workingShape = s.shape || s.components?.mask?.shape || { type: 'rectangle', width: 1, height: 1 };
                let shapeToUse = { ...workingShape };
                
                // CRITICAL: Apply anchors if they exist so we validate the actual bounds
                if (s.anchors && workingShape.type === 'rectangle') {
                    shapeToUse.x = s.anchors.left ?? 0;
                    shapeToUse.y = s.anchors.top ?? 0;
                    shapeToUse.width = s.anchors.width ?? 1;
                    shapeToUse.height = s.anchors.height ?? 1;
                }

                // Use 1x1 as canonical scale for validation
                const geom = ShapeFactory.toPolygon(shapeToUse, { width: 1, height: 1 });
                return TransformEngine.applyTransform(geom, s.rotation, s.pivot);
            });

            for (let i = 0; i < testSlots.length; i++) {
                if (!testSlots[i].points?.length) continue;
                for (let j = i + 1; j < testSlots.length; j++) {
                    if (template.slots[i].page !== template.slots[j].page) continue;
                    if (!testSlots[j].points?.length) continue;
                    if (!GeometryMath.aabbIntersect(testSlots[i].bounds, testSlots[j].bounds)) continue;
                    if (GeometryMath.polygonsIntersect(testSlots[i].points, testSlots[j].points)) {
                        errors.push(`Slots ${template.slots[i].slotId} and ${template.slots[j].slotId} overlap geometrically`);
                    }
                }
            }
        }
        return errors;
    }

    #saveState() {
        this.#undoStack.push(this.#cloneState(this.#state));
        if (this.#undoStack.length > 50) this.#undoStack.shift();
        this.#redoStack = [];
    }

    #dispatchStateChange() {
        const detail = {
            slots: this.#state.slots.length,
            images: this.#state.images.size,
            texts: this.#state.texts.size,
            templateId: this.#state.template?.id,
            undoDepth: this.#undoStack.length,
            redoDepth: this.#redoStack.length
        };
        if (typeof CustomEvent !== 'undefined') {
            this.dispatchEvent(new CustomEvent('stateChanged', { detail }));
        } else {
            this.dispatchEvent({ type: 'stateChanged', detail });
        }
    }
}
