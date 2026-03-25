import { EventTarget } from 'event-target-shim';

export interface Point { x: number; y: number; }
export interface Bounds { x: number; y: number; w: number; h: number; }
export interface Scale { width: number; height: number; }

export interface Shape {
    type: string;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    points?: Array<{ x: number, y: number } | [number, number]>;
    commands?: Array<{ cmd: string, x?: number, y?: number, cx?: number, cy?: number }>;
}

export interface Transform {
    scale?: number;
    offsetX?: number;
    offsetY?: number;
    rotation?: number;
}

export interface ImageTransform extends Transform {
    scale: number;
    offsetX: number;
    offsetY: number;
    rotation: number;
}

export interface FocalPoint { x: number; y: number; }

export interface Slot {
    slotId: string;
    shape?: Shape;
    components?: { mask?: { shape?: Shape }; image?: { mode?: string }; };
    anchors?: { left?: number; top?: number; width?: number; height?: number; };
    rotation?: number;
    pivot?: Point | null;
    bleed?: boolean;
    zIndex?: number;
    points?: Point[];
    bounds?: Bounds;
    unrotatedBounds?: Bounds;
    rotationMatrix?: { rotation: number, pivot: Point | null };
    mode?: string;
    textConfig?: { padding?: number };
    type?: string;
}

export interface Config {
    width: number;
    height: number;
    bleed?: number;
    safeZone?: number;
}

// Generics for Type Safety
export interface Template<TMetadata = any, TPage = any> {
    id: string;
    slots: Slot[];
    page: TPage;
    metadata?: TMetadata;
}

export interface RenderGraphNode<TAsset = any> extends Slot {
    assetRect: (Bounds & { rotation?: number }) | null;
    assetData: TAsset | null;
    userTransform: Transform | null;
}

// ============================================================================
// SHAPE FACTORY & CACHING (Visitor Pattern & WeakMap)
// ============================================================================

export interface ShapeResult { points: Point[]; bounds: Bounds; }
export interface ShapeVisitor {
    visitRectangle(shape: Shape, scale: Scale): ShapeResult;
    visitPolygon(shape: Shape, scale: Scale): ShapeResult;
    visitPath(shape: Shape, scale: Scale): ShapeResult;
}

const computeBounds = (points: Point[]): Bounds => {
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

export class DefaultShapeVisitor implements ShapeVisitor {
    visitRectangle(shape: Shape, scale: Scale): ShapeResult {
        const x = shape.x ?? 0, y = shape.y ?? 0, w = shape.width ?? 1, h = shape.height ?? 1;
        const pts = [
            { x: x * scale.width, y: y * scale.height },
            { x: (x + w) * scale.width, y: y * scale.height },
            { x: (x + w) * scale.width, y: (y + h) * scale.height },
            { x: x * scale.width, y: (y + h) * scale.height }
        ];
        return { points: pts, bounds: computeBounds(pts) };
    }
    visitPolygon(shape: Shape, scale: Scale): ShapeResult {
        const pts = (shape.points || []).map(p => {
            if (Array.isArray(p)) return { x: p[0] * scale.width, y: p[1] * scale.height };
            return { x: (p.x ?? 0) * scale.width, y: (p.y ?? 0) * scale.height };
        });
        return { points: pts, bounds: computeBounds(pts) };
    }
    visitPath(shape: Shape, scale: Scale): ShapeResult {
        const pts: Point[] = [];
        if (shape.commands) {
            for (const cmd of shape.commands) {
                if (cmd.x !== undefined && cmd.y !== undefined) pts.push({ x: cmd.x * scale.width, y: cmd.y * scale.height });
            }
        }
        return { points: pts, bounds: computeBounds(pts) };
    }
}

export class ShapeFactory {
    static visitor: ShapeVisitor = new DefaultShapeVisitor();
    // Cache by shape instance reference
    private static cache = new WeakMap<Shape, Map<string, ShapeResult>>();

    static toPolygon(shape: Shape | undefined, scale: Scale): ShapeResult {
        if (!shape) return { points: [], bounds: { x: 0, y: 0, w: 0, h: 0 } };
        
        let shapeCache = this.cache.get(shape);
        if (!shapeCache) {
            shapeCache = new Map<string, ShapeResult>();
            this.cache.set(shape, shapeCache);
        }
        
        const scaleKey = `${scale.width}x${scale.height}`;
        let result = shapeCache.get(scaleKey);
        if (result) return result;

        if (shape.type === 'rectangle' || (!shape.points && !shape.commands)) result = this.visitor.visitRectangle(shape, scale);
        else if (shape.type === 'polygon' || shape.points) result = this.visitor.visitPolygon(shape, scale);
        else if (shape.type === 'path' || shape.commands) result = this.visitor.visitPath(shape, scale);
        else throw new Error(`Unknown shape type: ${shape.type}`);

        shapeCache.set(scaleKey, result);
        return result;
    }
    static computeBounds = computeBounds;
}

// ============================================================================
// GEOMETRY & MATH
// ============================================================================

export class GeometryMath {
    static getAxes(polygon: Point[]): Point[] {
        const axes: Point[] = [];
        const eps = 1e-9;
        for (let i = 0; i < polygon.length; i++) {
            const p1 = polygon[i];
            const p2 = polygon[(i + 1) % polygon.length];
            const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
            const len = Math.sqrt(edge.x * edge.x + edge.y * edge.y);
            // Handle degenerate cases (zero-length edges)
            if (len > eps) {
                axes.push({ x: -edge.y / len, y: edge.x / len });
            }
        }
        return axes;
    }

    static projectPolygon(axis: Point, polygon: Point[]) {
        let min = (polygon[0].x * axis.x + polygon[0].y * axis.y);
        let max = min;
        for (let i = 1; i < polygon.length; i++) {
            const p = (polygon[i].x * axis.x + polygon[i].y * axis.y);
            if (p < min) min = p;
            else if (p > max) max = p;
        }
        return { min, max };
    }

    static aabbIntersect(a: Bounds, b: Bounds): boolean {
        return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
    }

    static polygonsIntersect(polyA: Point[], polyB: Point[]): boolean {
        // Robust SAT missing axes bugfix: combine both polygons' axes
        const axes = [...this.getAxes(polyA), ...this.getAxes(polyB)];
        const eps = 1e-9;
        for (const axis of axes) {
            const projA = this.projectPolygon(axis, polyA);
            const projB = this.projectPolygon(axis, polyB);
            if (projA.max < projB.min - eps || projB.max < projA.min - eps) {
                return false; // Separating axis found
            }
        }
        return true;
    }
    
    static offsetPolygon(points: Point[], offset: number): Point[] {
        if (offset === 0 || points.length < 3) return [...points];
        const result: Point[] = [];
        const n = points.length;
        
        for (let i = 0; i < n; i++) {
            const prev = points[(i - 1 + n) % n];
            const curr = points[i];
            const next = points[(i + 1) % n];
            
            const e1 = { x: curr.x - prev.x, y: curr.y - prev.y };
            const e2 = { x: next.x - curr.x, y: next.y - curr.y };
            const l1 = Math.sqrt(e1.x*e1.x + e1.y*e1.y) || 1e-9;
            const l2 = Math.sqrt(e2.x*e2.x + e2.y*e2.y) || 1e-9;
            
            const n1 = { x: -e1.y/l1, y: e1.x/l1 };
            const n2 = { x: -e2.y/l2, y: e2.x/l2 };
            
            const nx = n1.x + n2.x;
            const ny = n1.y + n2.y;
            const ln = Math.sqrt(nx*nx + ny*ny) || 1e-9;
            
            result.push({
                x: curr.x + (nx/ln) * offset,
                y: curr.y + (ny/ln) * offset
            });
        }
        return result;
    }
}

export class TransformEngine {
    // DOMMatrix fallback for Node environments (can mock or replace with pure math if truly needed)
    static applyTransform(geom: ShapeResult, rotation: number = 0, pivot: Point | null = null): ShapeResult & { unrotatedBounds: Bounds, rotationMatrix: any } {
        if (!rotation || Math.abs(rotation) < 1e-6) {
            return {
                points: geom.points,
                bounds: geom.bounds,
                unrotatedBounds: geom.bounds,
                rotationMatrix: { rotation: 0, pivot: null }
            };
        }

        const pointList = geom.points || [];
        const center = pivot || pointList.reduce(
            (acc, p) => ({ x: acc.x + p.x / pointList.length, y: acc.y + p.y / pointList.length }),
            { x: 0, y: 0 }
        );

        let transformedPoints: Point[];
        
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
            // Fallback for Node without DOMMatrix
            const rad = rotation * (Math.PI / 180);
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            transformedPoints = pointList.map(p => ({
                x: center.x + (p.x - center.x) * cos - (p.y - center.y) * sin,
                y: center.y + (p.x - center.x) * sin + (p.y - center.y) * cos
            }));
        }

        return {
            points: transformedPoints,
            bounds: ShapeFactory.computeBounds(transformedPoints),
            unrotatedBounds: geom.bounds, 
            rotationMatrix: { rotation, pivot: center }
        };
    }
}

export class ImageMath {
    static clamp(val: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, val));
    }

    static calculateRect(bounds: Bounds, imgW: number, imgH: number, mode: string = 'fill', focalPoint: FocalPoint = { x: 0.5, y: 0.5 }, userTransform: Transform | null = null) {
        const boundRatio = bounds.w / bounds.h;
        const imgRatio = imgW / imgH;

        let finalW, finalH;
        if (mode === 'fill') {
            if (boundRatio > imgRatio) {
                finalW = bounds.w;
                finalH = bounds.w / imgRatio;
            } else {
                finalH = bounds.h;
                finalW = bounds.h * imgRatio;
            }
        } else {
            if (boundRatio > imgRatio) {
                finalH = bounds.h;
                finalW = bounds.h * imgRatio;
            } else {
                finalW = bounds.w;
                finalH = bounds.w / imgRatio;
            }
        }

        let x = bounds.x + (bounds.w - finalW) / 2;
        let y = bounds.y + (bounds.h - finalH) / 2;

        if (mode === 'fill') {
            const fx = this.clamp(focalPoint.x, 0, 1);
            const fy = this.clamp(focalPoint.y, 0, 1);
            x += (bounds.w - finalW) * (0.5 - fx);
            y += (bounds.h - finalH) * (0.5 - fy);
        }
        
        if (userTransform) {
            const scale = Math.max(1e-4, userTransform.scale || 1.0);
            const scaledW = finalW * scale;
            const scaledH = finalH * scale;
            
            x = x + (finalW - scaledW) / 2 + (userTransform.offsetX || 0);
            y = y + (finalH - scaledH) / 2 + (userTransform.offsetY || 0);
            
            return { x, y, w: scaledW, h: scaledH, rotation: userTransform.rotation || 0 };
        }

        return { x, y, w: finalW, h: finalH, rotation: 0 };
    }
}

// ============================================================================
// TEMPLATE SCORING SYSTEM (Decoupled)
// ============================================================================

export interface ScorerOptions {
    style?: string;
    tags?: string[];
    pageConfig?: Config;
}

export class TemplateScorer {
    static score<TMetadata extends { maxImages?: number; minImages?: number; style?: string; tags?: string[]; complexity?: number }>(
        template: Template<TMetadata>, 
        imageCount: number, 
        options: ScorerOptions
    ): number {
        let score = 0;
        const max = template.metadata?.maxImages ?? template.slots.length;
        const min = template.metadata?.minImages ?? template.slots.length;
        if (imageCount === min && imageCount === max) score += 10;

        score += this.visualFlowScore(template);

        if (options.style && template.metadata?.style === options.style) score += 5;
        if (options.tags?.length && template.metadata?.tags?.length) {
            const matchCount = options.tags.filter(tag => template.metadata!.tags!.includes(tag)).length;
            score += matchCount * 2;
        }

        const complexity = template.metadata?.complexity || 0.5;
        score += (1 - complexity) * 2;

        return score;
    }

    static visualFlowScore<T>(template: Template<T>): number {
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

// ============================================================================
// RENDERER LOGIC
// ============================================================================

export class Renderer {
    static generateSVGClipPath(slot: Slot): string {
        const shapeToUse = slot.shape || slot.components?.mask?.shape;

        let pathStr = "";
        if (shapeToUse?.type === "path" && shapeToUse.commands) {
            pathStr = shapeToUse.commands.map(c => 
                c.cmd === "Z" ? "Z" : `${c.cmd} ${c.x ?? c.cx ?? ''} ${c.y ?? c.cy ?? ''}`.trim()
            ).join(" ");
        } else if (slot.unrotatedBounds) {
            const { x, y, w, h } = slot.unrotatedBounds;
            pathStr = `M ${x} ${y} L ${x+w} ${y} L ${x+w} ${y+h} L ${x} ${y+h} Z`;
        } else if (slot.points && slot.points.length) {
            pathStr = `M ${slot.points.map(p => `${p.x} ${p.y}`).join(' L ')} Z`;
        }

        // Return ONLY the path data string (d attribute) for maximum flexibility
        return pathStr;
    }
}

// ============================================================================
// LAYOUT ENGINE V6 (TypeScript + Pro Grade + Optimized)
// ============================================================================

interface LayoutEngineState<TMetadata, TAsset, TPage> {
    template: Template<TMetadata, TPage> | null;
    config: Config | null;
    images: Map<string, TAsset & { focalPoint?: FocalPoint, width: number, height: number }>;
    texts: Map<string, any>;
    imageTransforms: Map<string, ImageTransform>;
    slots: Slot[];
}

interface IEventTarget {
    addEventListener(type: string, callback: Function): void;
    dispatchEvent(event: { type: string, detail?: any }): boolean;
}

// Compatibility Polyfills for Node
const BaseEventTarget = (typeof EventTarget !== "undefined" ? EventTarget : class {
    private _listeners = new Map<string, Function[]>();
    addEventListener(type: string, callback: Function) {
        if (!this._listeners.has(type)) this._listeners.set(type, []);
        this._listeners.get(type)!.push(callback);
    }
    dispatchEvent(event: any): boolean {
        const listeners = this._listeners.get(event.type);
        if (listeners) listeners.forEach(cb => cb(event));
        return true;
    }
}) as { new(): IEventTarget };

export class LayoutEngineV6<TMetadata = any, TAsset = any, TPage = any> extends BaseEventTarget {
    #registry = new Map<string, Template<TMetadata, TPage>>();
    #undoStack: LayoutEngineState<TMetadata, TAsset, TPage>[] = [];
    #redoStack: LayoutEngineState<TMetadata, TAsset, TPage>[] = [];
    
    // Memoization cache for slots to prevent recomputing unchanged slots
    #slotGeometryCache = new Map<string, Slot>();
    
    #state: LayoutEngineState<TMetadata, TAsset, TPage> = {
        template: null, config: null, images: new Map(), texts: new Map(), imageTransforms: new Map(), slots: []
    };

    loadTemplates(templates: Template<TMetadata, TPage>[]) {
        for (const t of templates) {
            const errors = this.#validateTemplate(t);
            if (errors.length) {
                console.warn(`Template ${t.id} validation failed:`, errors);
                continue;
            }
            this.#registry.set(t.id, t);
        }
    }

    selectTemplate(templateId: string, config: Config) {
        const template = this.#registry.get(templateId);
        if (!template) throw new Error(`Template ${templateId} not found`);

        this.#state.template = template;
        this.#state.config = { ...config, bleed: config.bleed ?? 0, safeZone: config.safeZone ?? 0 };
        this.#slotGeometryCache.clear(); // Reset lazy cache on template change
        
        this.#processSlots();
        this.#saveState();
        this.#dispatchStateChange();
    }

    selectBestTemplate(imageCount: number, options: ScorerOptions = {}): Template<TMetadata, TPage> | null {
        if (!options.pageConfig) {
            throw new Error('selectBestTemplate requires options.pageConfig');
        }
        const candidates = Array.from(this.#registry.values()).filter(t => {
            const max = (t.metadata as any)?.maxImages ?? t.slots.length;
            const min = (t.metadata as any)?.minImages ?? t.slots.length;
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

    assignImage(slotId: string, imageData: TAsset & { width: number, height: number, focalPoint?: FocalPoint }, transform: ImageTransform | null = null) {
        this.#state.images = new Map(this.#state.images);
        this.#state.images.set(slotId, { ...imageData, focalPoint: imageData.focalPoint || { x: 0.5, y: 0.5 } });

        if (transform) {
            this.#state.imageTransforms = new Map(this.#state.imageTransforms);
            this.#state.imageTransforms.set(slotId, transform);
        }

        this.#saveState();
        this.#dispatchStateChange();
    }
    
    updateImageTransform(slotId: string, transformDelta: Transform, pushToHistory = true) {
        const current = this.#state.imageTransforms.get(slotId) || { scale: 1, offsetX: 0, offsetY: 0, rotation: 0 };
        this.#state.imageTransforms = new Map(this.#state.imageTransforms);
        this.#state.imageTransforms.set(slotId, {
            scale: current.scale + (transformDelta.scale ?? 0), // Changed from multiplicative to additive
            offsetX: current.offsetX + (transformDelta.offsetX ?? 0),
            offsetY: current.offsetY + (transformDelta.offsetY ?? 0),
            rotation: current.rotation + (transformDelta.rotation ?? 0)
        });

        if (pushToHistory) this.#saveState();
        this.#dispatchStateChange();
    }

    assignText(slotId: string, textData: any) {
        this.#state.texts = new Map(this.#state.texts);
        this.#state.texts.set(slotId, textData);
        this.#saveState();
        this.#dispatchStateChange();
    }

    batchAssign(assignments: any[]) {
        const snapshot = this.#shallowCloneState(this.#state);
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
        if (this.#undoStack.length <= 1) return;
        const current = this.#undoStack.pop()!;
        this.#redoStack.push(current);
        const previous = this.#undoStack[this.#undoStack.length - 1];
        this.#state = this.#shallowCloneState(previous);
        // Removed redundant #processSlots() - geometry is already stored in state.slots
        this.#dispatchStateChange();
    }

    redo() {
        if (!this.#redoStack.length) return;
        const next = this.#redoStack.pop()!;
        this.#undoStack.push(next);
        this.#state = this.#shallowCloneState(next);
        // Removed redundant #processSlots()
        this.#dispatchStateChange();
    }

    getRenderGraph(): RenderGraphNode<TAsset>[] {
        return this.#state.slots.map(slot => {
            const image = this.#state.images.get(slot.slotId);
            const text = this.#state.texts.get(slot.slotId);
            const userTransform = this.#state.imageTransforms.get(slot.slotId) || null;

            let assetRect = null;
            let assetData = null;
            const fitBounds = slot.unrotatedBounds || slot.bounds;

            if (image && fitBounds) {
                assetRect = ImageMath.calculateRect(fitBounds, image.width, image.height, slot.components?.image?.mode || slot.mode || 'fill', image.focalPoint, userTransform);
                assetData = image;
            } else if (text && fitBounds) {
                const textBounds = { ...fitBounds };
                if (slot.textConfig?.padding) {
                    const pad = slot.textConfig.padding;
                    textBounds.x += pad; textBounds.y += pad; textBounds.w -= pad * 2; textBounds.h -= pad * 2;
                }
                assetRect = textBounds;
                assetData = text;
            }

            return { ...slot, assetRect, assetData, userTransform, type: slot.type || 'image', textConfig: slot.textConfig, mode: slot.mode, components: slot.components || {} };
        });
    }

    getAssignedSlots(): RenderGraphNode<TAsset>[] {
        return this.getRenderGraph().filter(node => node.assetData !== null);
    }

    getSlotById(slotId: string): Slot | null {
        return this.#state.slots.find(s => s.slotId === slotId) || null;
    }

    toJSON(): string {
        return JSON.stringify({
            registry: Array.from(this.#registry.entries()),
            state: {
                ...this.#state,
                images: Array.from(this.#state.images.entries()),
                texts: Array.from(this.#state.texts.entries()),
                imageTransforms: Array.from(this.#state.imageTransforms.entries())
            },
            undoStack: this.#undoStack.map(s => ({
                ...s,
                images: Array.from(s.images.entries()),
                texts: Array.from(s.texts.entries()),
                imageTransforms: Array.from(s.imageTransforms.entries())
            }))
        });
    }

    static fromJSON<TM, TA, TP>(json: string): LayoutEngineV6<TM, TA, TP> {
        const raw = JSON.parse(json);
        const engine = new LayoutEngineV6<TM, TA, TP>();
        
        engine.#registry = new Map(raw.registry);
        
        const hydrateState = (s: any) => ({
            ...s,
            images: new Map(s.images),
            texts: new Map(s.texts),
            imageTransforms: new Map(s.imageTransforms)
        });

        engine.#state = hydrateState(raw.state);
        engine.#undoStack = raw.undoStack.map(hydrateState);
        
        return engine;
    }

    #shallowCloneState(state: LayoutEngineState<TMetadata, TAsset, TPage>): LayoutEngineState<TMetadata, TAsset, TPage> {
        return {
            template: state.template,
            config: state.config,
            images: new Map(state.images),
            texts: new Map(state.texts),
            imageTransforms: new Map(state.imageTransforms),
            slots: [...state.slots]
        };
    }

    // Lazy Processing & Memoization applied here
    #processSlots() {
        if (!this.#state.template || !this.#state.config) return;

        const { width, height, bleed } = this.#state.config;

        this.#state.slots = this.#state.template.slots
            .map(slot => {
                // If the slot layout/shape/rotation hasn't changed, we could reuse it if we had immutable slot definitions
                // We'll assume the slot object from template is consistent and use its reference as a key or slot ID.
                const cacheKey = `${slot.slotId}_${width}x${height}_${bleed}_${slot.rotation}`;
                if (this.#slotGeometryCache.has(cacheKey)) {
                    return this.#slotGeometryCache.get(cacheKey)!;
                }

                const workingShape = slot.shape || slot.components?.mask?.shape || { type: 'rectangle', width: 1, height: 1 };
                let shapeToUse = { ...workingShape };
                
                if (slot.anchors && workingShape.type === 'rectangle') {
                    shapeToUse.x = slot.anchors.left ? slot.anchors.left * width : 0;
                    shapeToUse.y = slot.anchors.top ? slot.anchors.top * height : 0;
                    shapeToUse.width = slot.anchors.width ? slot.anchors.width * width : width;
                    shapeToUse.height = slot.anchors.height ? slot.anchors.height * height : height;
                }

                const scale = slot.anchors ? { width: 1, height: 1 } : { width, height };
                const geom = ShapeFactory.toPolygon(shapeToUse, scale);
                const transformed = TransformEngine.applyTransform(geom, slot.rotation, slot.pivot);
                const adjustedPoints = (slot.bleed && bleed && bleed > 0) ? GeometryMath.offsetPolygon(transformed.points, bleed) : transformed.points;

                const processedSlot = {
                    ...slot,
                    points: adjustedPoints,
                    bounds: transformed.bounds,
                    unrotatedBounds: transformed.unrotatedBounds,
                    rotationMatrix: transformed.rotationMatrix,
                    zIndex: slot.zIndex || 1
                };

                this.#slotGeometryCache.set(cacheKey, processedSlot);
                return processedSlot;
            })
            .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    }

    #validateTemplate(template: Template<TMetadata, TPage>): string[] {
        const errors: string[] = [];
        if (!template.id) errors.push('Missing id');
        if (!template.slots || !Array.isArray(template.slots)) errors.push('Missing slots');
        if (!template.page) errors.push('Missing page config');

        if (!errors.length) {
            const testSlots = template.slots.map(s => {
                const workingShape = s.shape || s.components?.mask?.shape || { type: 'rectangle', width: 1, height: 1 };
                const scale = s.anchors ? { width: 1, height: 1 } : { width: 1, height: 1 }; // Canonical scale
                const geom = ShapeFactory.toPolygon(workingShape, scale);
                return TransformEngine.applyTransform(geom, s.rotation, s.pivot);
            });

            for (let i = 0; i < testSlots.length; i++) {
                if (!testSlots[i].points || testSlots[i].points.length === 0) continue;
                for (let j = i + 1; j < testSlots.length; j++) {
                    if (!testSlots[j].points || testSlots[j].points.length === 0) continue;

                    if (!GeometryMath.aabbIntersect(testSlots[i].bounds, testSlots[j].bounds)) {
                        continue;
                    }

                    if (GeometryMath.polygonsIntersect(testSlots[i].points, testSlots[j].points)) {
                        errors.push(`Slots ${template.slots[i].slotId} and ${template.slots[j].slotId} overlap geometrically`);
                    }
                }
            }
        }
        return errors;
    }

    #saveState() {
        this.#undoStack.push(this.#shallowCloneState(this.#state));
        if (this.#undoStack.length > 50) this.#undoStack.shift();
        this.#redoStack = [];
    }

    #dispatchStateChange() {
        const detail = {
            slots: this.#state.slots.length,
            images: this.#state.images.size,
            texts: this.#state.texts.size,
            templateId: this.#state.template?.id
        };

        if (typeof CustomEvent !== 'undefined') {
            this.dispatchEvent(new CustomEvent('stateChanged', { detail }));
        } else {
            // Node compatibility fallback
            this.dispatchEvent({ type: 'stateChanged', detail } as any);
        }
    }
}
