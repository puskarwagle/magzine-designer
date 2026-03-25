import { EventTarget } from 'event-target-shim'; // Or native if available in environments

export interface Point {
    x: number;
    y: number;
}

export interface Bounds {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface Scale {
    width: number;
    height: number;
}

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

export interface FocalPoint {
    x: number;
    y: number;
}

export interface Slot {
    slotId: string;
    shape?: Shape;
    components?: {
        mask?: { shape?: Shape };
        image?: { mode?: string };
    };
    anchors?: {
        left?: number;
        top?: number;
        width?: number;
        height?: number;
    };
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

export interface Template {
    id: string;
    slots: Slot[];
    page: any;
    metadata?: {
        maxImages?: number;
        minImages?: number;
        style?: string;
        tags?: string[];
        complexity?: number;
    };
}

export interface RenderGraphNode extends Slot {
    assetRect: Bounds & { rotation?: number } | null;
    assetData: any;
    userTransform: Transform | null;
}

// ============================================================================
// SHAPE FACTORY & CACHING
// ============================================================================

export type ShapeHandler = (shape: Shape, scale: Scale) => { points: Point[], bounds: Bounds };

const polygonCache = new Map<string, { points: Point[], bounds: Bounds }>();

export class ShapeFactory {
    private static handlers = new Map<string, ShapeHandler>();

    static register(type: string, handler: ShapeHandler) {
        this.handlers.set(type, handler);
    }

    static toPolygon(shape: Shape | undefined, scale: Scale): { points: Point[], bounds: Bounds } {
        if (!shape) return { points: [], bounds: { x: 0, y: 0, w: 0, h: 0 } };

        const cacheKey = JSON.stringify({ shape, scale });
        if (polygonCache.has(cacheKey)) {
            return polygonCache.get(cacheKey)!;
        }

        const handler = this.handlers.get(shape.type);
        if (!handler) {
            if (shape.points) {
                const result = this.fromPolygon(shape, scale);
                polygonCache.set(cacheKey, result);
                return result;
            }
            throw new Error(`Unknown shape type: ${shape.type}`);
        }

        const result = handler.call(this, shape, scale);
        polygonCache.set(cacheKey, result);
        return result;
    }

    static fromRect(shape: Shape, scale: Scale) {
        const x = shape.x !== undefined ? shape.x : 0;
        const y = shape.y !== undefined ? shape.y : 0;
        const width = shape.width !== undefined ? shape.width : 1;
        const height = shape.height !== undefined ? shape.height : 1;
        
        const points = [
            { x, y },
            { x: x + width, y },
            { x: x + width, y: y + height },
            { x, y: y + height }
        ];
        return ShapeFactory.fromPolygon({ ...shape, points }, scale);
    }

    static fromPolygon(shape: Shape, scale: Scale) {
        const points = (shape.points || []).map(p => {
            if (Array.isArray(p)) {
                return { x: p[0] * scale.width, y: p[1] * scale.height };
            }
            return {
                x: (p.x !== undefined ? p.x : 0) * scale.width,
                y: (p.y !== undefined ? p.y : 0) * scale.height
            };
        });

        const bounds = ShapeFactory.computeBounds(points);
        return { points, bounds };
    }

    static fromPath(shape: Shape, scale: Scale) {
        const points: Point[] = [];
        if (shape.commands) {
            for (let cmd of shape.commands) {
                if (cmd.x !== undefined && cmd.y !== undefined) {
                    points.push({ x: cmd.x * scale.width, y: cmd.y * scale.height });
                }
            }
        }
        const bounds = ShapeFactory.computeBounds(points);
        return { points, bounds };
    }

    static computeBounds(points: Point[]): Bounds {
        if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        return {
            x: minX,
            y: minY,
            w: Math.max(...xs) - minX,
            h: Math.max(...ys) - minY
        };
    }
}

// Register default handlers
ShapeFactory.register('rectangle', ShapeFactory.fromRect);
ShapeFactory.register('polygon', ShapeFactory.fromPolygon);
ShapeFactory.register('path', ShapeFactory.fromPath);

// ============================================================================
// GEOMETRY & MATH
// ============================================================================

export class GeometryMath {
    static getAxes(polygon: Point[]): Point[] {
        const axes: Point[] = [];
        for (let i = 0; i < polygon.length; i++) {
            const p1 = polygon[i];
            const p2 = polygon[(i + 1) % polygon.length];
            const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
            const normal = { x: -edge.y, y: edge.x };
            const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
            if (len > 0) {
                axes.push({ x: normal.x / len, y: normal.y / len });
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
            if (p > max) max = p;
        }
        return { min, max };
    }

    static aabbIntersect(a: Bounds, b: Bounds): boolean {
        return a.x <= b.x + b.w && 
               a.x + a.w >= b.x && 
               a.y <= b.y + b.h && 
               a.y + a.h >= b.y;
    }

    static polygonsIntersect(polyA: Point[], polyB: Point[]): boolean {
        const axes = [...this.getAxes(polyA), ...this.getAxes(polyB)];
        const eps = 1e-9;
        for (const axis of axes) {
            const projA = this.projectPolygon(axis, polyA);
            const projB = this.projectPolygon(axis, polyB);
            if (projA.max < projB.min - eps || projB.max < projA.min - eps) {
                return false;
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
            
            const l1 = Math.sqrt(e1.x*e1.x + e1.y*e1.y);
            const l2 = Math.sqrt(e2.x*e2.x + e2.y*e2.y);
            
            const n1 = { x: -e1.y/l1, y: e1.x/l1 };
            const n2 = { x: -e2.y/l2, y: e2.x/l2 };
            
            const nx = n1.x + n2.x;
            const ny = n1.y + n2.y;
            const ln = Math.sqrt(nx*nx + ny*ny) || 1;
            
            result.push({
                x: curr.x + (nx/ln) * offset,
                y: curr.y + (ny/ln) * offset
            });
        }
        return result;
    }
}

const transformCache = new Map<string, any>();

export class TransformEngine {
    static applyTransform(geom: { points: Point[], bounds: Bounds }, rotation: number = 0, pivot: Point | null = null) {
        if (!rotation) {
            return {
                points: geom.points,
                bounds: geom.bounds,
                unrotatedBounds: geom.bounds,
                rotationMatrix: { rotation: 0, pivot: null }
            };
        }

        const cacheKey = JSON.stringify({ geom, rotation, pivot });
        if (transformCache.has(cacheKey)) {
            return transformCache.get(cacheKey);
        }
        
        const rad = rotation * (Math.PI / 180);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const pointList = geom.points || [];
        
        const center = pivot || pointList.reduce(
            (acc, p) => ({ x: acc.x + p.x / pointList.length, y: acc.y + p.y / pointList.length }),
            { x: 0, y: 0 }
        );

        const transformedPoints = pointList.map(p => ({
            x: center.x + (p.x - center.x) * cos - (p.y - center.y) * sin,
            y: center.y + (p.x - center.x) * sin + (p.y - center.y) * cos
        }));

        const result = {
            points: transformedPoints,
            bounds: ShapeFactory.computeBounds(transformedPoints),
            unrotatedBounds: geom.bounds, 
            rotationMatrix: { rotation, pivot: center }
        };

        transformCache.set(cacheKey, result);
        return result;
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
            const offsetX = (bounds.w - finalW) * (0.5 - fx);
            const offsetY = (bounds.h - finalH) * (0.5 - fy);
            x += offsetX;
            y += offsetY;
        }
        
        if (userTransform) {
            const scale = Math.max(1e-4, userTransform.scale || 1.0);
            const scaledW = finalW * scale;
            const scaledH = finalH * scale;
            
            const zoomOffsetX = (finalW - scaledW) / 2;
            const zoomOffsetY = (finalH - scaledH) / 2;
            
            x = x + zoomOffsetX + (userTransform.offsetX || 0);
            y = y + zoomOffsetY + (userTransform.offsetY || 0);
            
            return { x, y, w: scaledW, h: scaledH, rotation: userTransform.rotation || 0 };
        }

        return { x, y, w: finalW, h: finalH, rotation: 0 };
    }
}

// ============================================================================
// RENDERER LOGIC
// ============================================================================

export class Renderer {
    static generateSVGClipPath(slot: Slot): string {
        const shapeToUse = slot.shape || slot.components?.mask?.shape;

        if (shapeToUse?.type === "path" && shapeToUse.commands) {
            return shapeToUse.commands.map(c => 
                c.cmd === "Z" ? "Z" : `${c.cmd} ${c.x || c.cx || ''} ${c.y || c.cy || ''}`.trim()
            ).join(" ");
        } else if (slot.points && slot.points.length) {
            return `M ${slot.points.map(p => `${p.x} ${p.y}`).join(' L ')} Z`;
        }
        return "";
    }
}

// ============================================================================
// LAYOUT ENGINE V5 (TypeScript + Pro Grade + Immutable Paths)
// ============================================================================

interface LayoutEngineState {
    template: Template | null;
    config: Config | null;
    images: Map<string, any>;
    texts: Map<string, any>;
    imageTransforms: Map<string, ImageTransform>;
    slots: Slot[];
}

export class LayoutEngineV5 extends (typeof EventTarget !== "undefined" ? EventTarget : Object) {
    #registry = new Map<string, Template>();
    #undoStack: LayoutEngineState[] = [];
    #redoStack: LayoutEngineState[] = [];
    
    #state: LayoutEngineState = {
        template: null,
        config: null,
        images: new Map(),
        texts: new Map(),
        imageTransforms: new Map(),
        slots: []
    };

    loadTemplates(templates: Template[]) {
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
        this.#state.config = { ...config, bleed: config.bleed || 0, safeZone: config.safeZone || 0 };
        
        this.#processSlots();
        this.#saveState();
        this.#dispatchStateChange();
    }

    selectBestTemplate(imageCount: number, options: any = {}): Template | null {
        const candidates = Array.from(this.#registry.values()).filter(t => {
            const max = t.metadata?.maxImages ?? t.slots.length;
            const min = t.metadata?.minImages ?? t.slots.length;
            return imageCount >= min && imageCount <= max;
        });

        if (!candidates.length) return null;

        const scored = candidates.map(t => ({
            template: t,
            score: this.#scoreTemplate(t, imageCount, options)
        }));

        const best = scored.sort((a, b) => b.score - a.score)[0];
        if (best) {
            this.selectTemplate(best.template.id, options.pageConfig);
            return best.template;
        }
        return null;
    }

    assignImage(slotId: string, imageData: any, transform: ImageTransform | null = null) {
        // Create new objects to ensure immutability
        this.#state.images = new Map(this.#state.images);
        this.#state.images.set(slotId, {
            ...imageData,
            focalPoint: imageData.focalPoint || { x: 0.5, y: 0.5 }
        });

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
            scale: current.scale * (transformDelta.scale || 1),
            offsetX: current.offsetX + (transformDelta.offsetX || 0),
            offsetY: current.offsetY + (transformDelta.offsetY || 0),
            rotation: current.rotation + (transformDelta.rotation || 0)
        });

        if (pushToHistory) {
            this.#saveState();
        }
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
                    this.#state.images.set(slotId, {
                        ...data,
                        focalPoint: data.focalPoint || { x: 0.5, y: 0.5 }
                    });
                    if (transform) this.#state.imageTransforms.set(slotId, transform);
                } else if (type === 'text') {
                    this.#state.texts.set(slotId, data);
                }
            }
            this.#saveState();
            this.#dispatchStateChange();
        } catch (err) {
            this.#state = snapshot;
            this.#processSlots();
            throw err;
        }
    }

    undo() {
        if (this.#undoStack.length <= 1) return; // Need at least current state + 1 past state
        const current = this.#undoStack.pop()!;
        this.#redoStack.push(current);
        
        const previous = this.#undoStack[this.#undoStack.length - 1];
        this.#state = this.#shallowCloneState(previous);
        
        this.#processSlots();
        this.#dispatchStateChange();
    }

    redo() {
        if (this.#redoStack.length === 0) return;
        const next = this.#redoStack.pop()!;
        this.#undoStack.push(next);
        
        this.#state = this.#shallowCloneState(next);
        
        this.#processSlots();
        this.#dispatchStateChange();
    }

    getRenderGraph(): RenderGraphNode[] {
        return this.#state.slots.map(slot => {
            const image = this.#state.images.get(slot.slotId);
            const text = this.#state.texts.get(slot.slotId);
            const userTransform = this.#state.imageTransforms.get(slot.slotId) || null;

            let assetRect = null;
            let assetData = null;

            const fitBounds = slot.unrotatedBounds || slot.bounds;

            if (image && fitBounds) {
                assetRect = ImageMath.calculateRect(
                    fitBounds,
                    image.width,
                    image.height,
                    slot.components?.image?.mode || slot.mode || 'fill',
                    image.focalPoint,
                    userTransform
                );
                assetData = image;
            } else if (text && fitBounds) {
                const textBounds = { ...fitBounds };
                if (slot.textConfig?.padding) {
                    const pad = slot.textConfig.padding;
                    textBounds.x += pad;
                    textBounds.y += pad;
                    textBounds.w -= pad * 2;
                    textBounds.h -= pad * 2;
                }
                assetRect = textBounds;
                assetData = text;
            }

            return {
                ...slot,
                assetRect,
                assetData,
                userTransform,
                type: slot.type || 'image',
                textConfig: slot.textConfig,
                mode: slot.mode,
                components: slot.components || {}
            };
        });
    }

    getPageConfig() {
        return this.#state.config;
    }

    getTemplateMetadata() {
        return this.#state.template?.metadata || null;
    }

    clearAssets() {
        this.#state.images = new Map();
        this.#state.texts = new Map();
        this.#state.imageTransforms = new Map();
        this.#saveState();
        this.#dispatchStateChange();
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    #shallowCloneState(state: LayoutEngineState): LayoutEngineState {
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

        const { width, height, bleed } = this.#state.config;

        this.#state.slots = this.#state.template.slots
            .map(slot => {
                const workingShape = slot.shape || slot.components?.mask?.shape || { type: 'rectangle', width: 1, height: 1 };
                let shapeToUse = { ...workingShape };
                
                if (slot.anchors) {
                    if (workingShape.type === 'rectangle') {
                        shapeToUse.x = slot.anchors.left ? slot.anchors.left * width : 0;
                        shapeToUse.y = slot.anchors.top ? slot.anchors.top * height : 0;
                        shapeToUse.width = slot.anchors.width ? slot.anchors.width * width : width;
                        shapeToUse.height = slot.anchors.height ? slot.anchors.height * height : height;
                    }
                }

                const scale = slot.anchors ? { width: 1, height: 1 } : { width, height };
                const geom = ShapeFactory.toPolygon(shapeToUse, scale);
                
                const transformed = TransformEngine.applyTransform(geom, slot.rotation, slot.pivot);

                const adjustedPoints = (slot.bleed && bleed && bleed > 0)
                    ? GeometryMath.offsetPolygon(transformed.points, bleed)
                    : transformed.points;

                return {
                    ...slot,
                    points: adjustedPoints,
                    bounds: transformed.bounds,
                    unrotatedBounds: transformed.unrotatedBounds,
                    rotationMatrix: transformed.rotationMatrix,
                    zIndex: slot.zIndex || 1
                };
            })
            .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    }

    #validateTemplate(template: Template): string[] {
        const errors: string[] = [];
        if (!template.id) errors.push('Missing id');
        if (!template.slots || !Array.isArray(template.slots)) errors.push('Missing or invalid slots');
        if (!template.page) errors.push('Missing page config');

        if (!errors.length) {
            const testSlots = template.slots.map(s => {
                const shapeToUse = s.shape || s.components?.mask?.shape || { type: 'rectangle', width:1, height:1 };
                const geom = ShapeFactory.toPolygon(shapeToUse, {width: 1, height: 1}); 
                return TransformEngine.applyTransform(geom, s.rotation, s.pivot);
            });

            for (let i = 0; i < testSlots.length; i++) {
                if (!testSlots[i].points || testSlots[i].points!.length === 0) continue;
                for (let j = i + 1; j < testSlots.length; j++) {
                    if (!testSlots[j].points || testSlots[j].points!.length === 0) continue;

                    // AABB Check
                    if (!GeometryMath.aabbIntersect(testSlots[i].bounds!, testSlots[j].bounds!)) {
                        continue;
                    }

                    // Precise SAT Check
                    if (GeometryMath.polygonsIntersect(testSlots[i].points!, testSlots[j].points!)) {
                        errors.push(`Slots ${template.slots[i].slotId} and ${template.slots[j].slotId} overlap geometrically`);
                    }
                }
            }
        }
        return errors;
    }

    #scoreTemplate(template: Template, imageCount: number, options: any): number {
        let score = 0;

        const max = template.metadata?.maxImages ?? template.slots.length;
        const min = template.metadata?.minImages ?? template.slots.length;
        const exactMatch = (imageCount === min && imageCount === max) ? 1 : 0;
        score += exactMatch * 10;

        score += this.#visualFlowScore(template);

        if (options.style && template.metadata?.style === options.style) score += 5;
        if (options.tags && options.tags.length && template.metadata?.tags) {
            const matchCount = options.tags.filter((tag: string) => template.metadata!.tags!.includes(tag)).length;
            score += matchCount * 2;
        }

        const complexity = template.metadata?.complexity || 0.5;
        score += (1 - complexity) * 2;

        return score;
    }

    #visualFlowScore(template: Template): number {
        let score = 0;
        if (!template.slots || template.slots.length === 0) return 0;
        
        let totalArea = 0;
        let largestArea = 0;
        
        template.slots.forEach(slot => {
            const w = slot.anchors ? (slot.anchors.width || 0) : (slot.shape?.width || 0.5);
            const h = slot.anchors ? (slot.anchors.height || 0) : (slot.shape?.height || 0.5);
            const area = w * h;
            totalArea += area;
            if (area > largestArea) largestArea = area;
        });

        if (totalArea > 0 && largestArea > totalArea * 0.4) {
            score += 3; 
        }

        return score;
    }

    #saveState() {
        this.#undoStack.push(this.#shallowCloneState(this.#state));
        if (this.#undoStack.length > 50) this.#undoStack.shift();
        this.#redoStack = [];
    }

    #dispatchStateChange() {
        if (typeof CustomEvent !== 'undefined') {
            (this as any).dispatchEvent(new CustomEvent('stateChanged', {
                detail: {
                    slots: this.#state.slots.length,
                    images: this.#state.images.size,
                    texts: this.#state.texts.size,
                    templateId: this.#state.template?.id
                }
            }));
        }
    }
}
