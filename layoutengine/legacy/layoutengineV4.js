// layoutengineV4.js

/**
 * V4 Layout Engine - Professional-grade layout engine with ShapeFactory, 
 * accurate bleed offset, SAT collision detection, anchors for responsive layout, 
 * user image transforms, visual flow scoring, and path-based masks.
 */

// ============================================================================
// SHAPE FACTORY & MATH
// ============================================================================

export class ShapeFactory {
    static toPolygon(shape, scale) {
        if (!shape) return { points: [], bounds: { x: 0, y: 0, w: 0, h: 0 } };

        switch (shape.type) {
            case 'rectangle':
                return this.fromRect(shape, scale);
            case 'polygon':
                return this.fromPolygon(shape, scale);
            case 'path':
                return this.fromPath(shape, scale);
            default:
                // Default fallback
                if (shape.points) return this.fromPolygon(shape, scale);
                throw new Error("Unknown shape type: " + shape.type);
        }
    }

    static fromRect(shape, scale) {
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
        return this.fromPolygon({ ...shape, points }, scale);
    }

    static fromPolygon(shape, scale) {
        let points = (shape.points || []).map(p => ({
            x: (p.x !== undefined ? p.x : p[0]) * scale.width,
            y: (p.y !== undefined ? p.y : p[1]) * scale.height
        }));

        const bounds = this.computeBounds(points);
        return { points, bounds };
    }

    static fromPath(shape, scale) {
        // Simplified path interpretation for bounding box/polygon approx
        let points = [];
        if (shape.commands) {
            for (let cmd of shape.commands) {
                if (cmd.x !== undefined && cmd.y !== undefined) {
                    points.push({ x: cmd.x * scale.width, y: cmd.y * scale.height });
                }
            }
        }
        const bounds = this.computeBounds(points);
        return { points, bounds };
    }

    static computeBounds(points) {
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

// SAT Math for Precise Collision Detection
export class GeometryMath {
    static getAxes(polygon) {
        const axes = [];
        for (let i = 0; i < polygon.length; i++) {
            const p1 = polygon[i];
            const p2 = polygon[(i + 1) % polygon.length];
            const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
            const normal = { x: -edge.y, y: edge.x };
            // Normalize
            const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
            if (len > 0) {
                axes.push({ x: normal.x / len, y: normal.y / len });
            }
        }
        return axes;
    }

    static projectPolygon(axis, polygon) {
        let min = (polygon[0].x * axis.x + polygon[0].y * axis.y);
        let max = min;
        for (let i = 1; i < polygon.length; i++) {
            const p = (polygon[i].x * axis.x + polygon[i].y * axis.y);
            if (p < min) min = p;
            if (p > max) max = p;
        }
        return { min, max };
    }

    static polygonsIntersect(polyA, polyB) {
        const axes = [...this.getAxes(polyA), ...this.getAxes(polyB)];
        for (const axis of axes) {
            const projA = this.projectPolygon(axis, polyA);
            const projB = this.projectPolygon(axis, polyB);
            if (projA.max < projB.min || projB.max < projA.min) {
                return false; // Separating axis found
            }
        }
        return true;
    }
    
    // Perpendicular offset (Miter equivalent) for true bleed expansion
    static offsetPolygon(points, offset) {
        if (offset === 0 || points.length < 3) return [...points];
        const result = [];
        const n = points.length;
        
        for (let i = 0; i < n; i++) {
            const prev = points[(i - 1 + n) % n];
            const curr = points[i];
            const next = points[(i + 1) % n];
            
            // Edges vectors
            const e1 = { x: curr.x - prev.x, y: curr.y - prev.y };
            const e2 = { x: next.x - curr.x, y: next.y - curr.y };
            
            // Normalize
            const l1 = Math.sqrt(e1.x*e1.x + e1.y*e1.y);
            const l2 = Math.sqrt(e2.x*e2.x + e2.y*e2.y);
            
            const n1 = { x: -e1.y/l1, y: e1.x/l1 };
            const n2 = { x: -e2.y/l2, y: e2.x/l2 };
            
            // Average normal for vertex
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

export class TransformEngine {
    static applyTransform(geom, rotation = 0, pivot = null) {
        if (!rotation) {
            return {
                points: geom.points,
                bounds: geom.bounds,
                unrotatedBounds: geom.bounds,
                rotationMatrix: { rotation: 0, pivot: null }
            };
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

        return {
            points: transformedPoints,
            bounds: ShapeFactory.computeBounds(transformedPoints),
            unrotatedBounds: geom.bounds, // Preserve original unrotated bounds
            rotationMatrix: { rotation, pivot: center }
        };
    }
}

export class ImageMath {
    static calculateRect(bounds, imgW, imgH, mode = 'fill', focalPoint = { x: 0.5, y: 0.5 }, userTransform = null) {
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
            const offsetX = (bounds.w - finalW) * (0.5 - focalPoint.x);
            const offsetY = (bounds.h - finalH) * (0.5 - focalPoint.y);
            x += offsetX;
            y += offsetY;
        }
        
        // Apply user overrides (zoom, pan, rotate)
        if (userTransform) {
            const scale = userTransform.scale || 1.0;
            const scaledW = finalW * scale;
            const scaledH = finalH * scale;
            
            // Keep the rect centered based on zoom difference, plus explicit translation
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
// LAYOUT ENGINE V4 (Pro Grade)
// ============================================================================

export class LayoutEngineV4 extends EventTarget {
    #registry = new Map();         
    #undoStack = [];               
    #redoStack = [];               
    #state = {
        template: null,              
        config: null,                
        images: new Map(),           
        texts: new Map(),            
        imageTransforms: new Map(),  
        slots: []                    
    };

    loadTemplates(templates) {
        for (const t of templates) {
            const errors = this.#validateTemplate(t);
            if (errors.length) {
                console.warn(`Template ${t.id} validation failed:`, errors);
                continue;
            }
            this.#registry.set(t.id, t);
        }
    }

    selectTemplate(templateId, config) {
        const template = this.#registry.get(templateId);
        if (!template) throw new Error(`Template ${templateId} not found`);

        this.#state.template = template;
        this.#state.config = { ...config, bleed: config.bleed || 0, safeZone: config.safeZone || 0 };
        
        this.#processSlots();
        this.#saveState();
        this.#dispatchStateChange();
    }

    selectBestTemplate(imageCount, options = {}) {
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

    assignImage(slotId, imageData, transform = null) {
        this.#state.images.set(slotId, {
            ...imageData,
            focalPoint: imageData.focalPoint || { x: 0.5, y: 0.5 }
        });
        if (transform) {
            this.#state.imageTransforms.set(slotId, transform);
        }
        this.#saveState();
        this.#dispatchStateChange();
    }
    
    updateImageTransform(slotId, transformDelta) {
        const current = this.#state.imageTransforms.get(slotId) || { scale: 1, offsetX: 0, offsetY: 0, rotation: 0 };
        this.#state.imageTransforms.set(slotId, {
            scale: current.scale * (transformDelta.scale || 1),
            offsetX: current.offsetX + (transformDelta.offsetX || 0),
            offsetY: current.offsetY + (transformDelta.offsetY || 0),
            rotation: current.rotation + (transformDelta.rotation || 0)
        });
        this.#saveState();
        this.#dispatchStateChange();
    }

    assignText(slotId, textData) {
        this.#state.texts.set(slotId, textData);
        this.#saveState();
        this.#dispatchStateChange();
    }

    batchAssign(assignments) {
        const snapshot = structuredClone(this.#state);
        try {
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
        if (this.#undoStack.length === 0) return;
        const previous = this.#undoStack.pop();
        this.#redoStack.push(structuredClone(this.#state));
        this.#state = previous;
        this.#processSlots();
        this.#dispatchStateChange();
    }

    redo() {
        if (this.#redoStack.length === 0) return;
        const next = this.#redoStack.pop();
        this.#undoStack.push(structuredClone(this.#state));
        this.#state = next;
        this.#processSlots();
        this.#dispatchStateChange();
    }

    getRenderGraph() {
        return this.#state.slots.map(slot => {
            const image = this.#state.images.get(slot.slotId);
            const text = this.#state.texts.get(slot.slotId);
            const userTransform = this.#state.imageTransforms.get(slot.slotId) || null;

            // Using standard SVG path generator for clip path
            let clipPath = "";
            const shapeToUse = slot.shape || slot.components?.mask?.shape;

            if (shapeToUse?.type === "path" && shapeToUse.commands) {
                clipPath = shapeToUse.commands.map(c => 
                    c.cmd === "Z" ? "Z" : `${c.cmd} ${c.x || c.cx || ''} ${c.y || c.cy || ''}`.trim()
                ).join(" ");
            } else if (slot.points && slot.points.length) {
                clipPath = `M ${slot.points.map(p => `${p.x} ${p.y}`).join(' L ')} Z`;
            }

            let assetRect = null;
            let assetData = null;

            // Base bounds for fitting. If rotated, we use unrotatedBounds for cleaner fitting
            const fitBounds = slot.unrotatedBounds || slot.bounds;

            if (image) {
                assetRect = ImageMath.calculateRect(
                    fitBounds,
                    image.width,
                    image.height,
                    slot.components?.image?.mode || slot.mode || 'fill',
                    image.focalPoint,
                    userTransform
                );
                assetData = image;
            } else if (text) {
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
                clipPath,
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
        this.#state.images.clear();
        this.#state.texts.clear();
        this.#state.imageTransforms.clear();
        this.#saveState();
        this.#dispatchStateChange();
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    #processSlots() {
        if (!this.#state.template || !this.#state.config) return;

        const { width, height, bleed } = this.#state.config;

        this.#state.slots = this.#state.template.slots
            .map(slot => {
                // Apply anchors if present (responsive reflow logic)
                const workingShape = structuredClone(slot.shape || slot.components?.mask?.shape || { type: 'rectangle', width: 1, height: 1 });
                if (slot.anchors) {
                    if (workingShape.type === 'rectangle') {
                        workingShape.x = slot.anchors.left ? slot.anchors.left * width : 0;
                        workingShape.y = slot.anchors.top ? slot.anchors.top * height : 0;
                        workingShape.width = slot.anchors.width ? slot.anchors.width * width : width;
                        workingShape.height = slot.anchors.height ? slot.anchors.height * height : height;
                    }
                }

                // If anchors provide pixel values, map via {1, 1} else map by {width, height}
                const scale = slot.anchors ? { width: 1, height: 1 } : { width, height };
                const geom = ShapeFactory.toPolygon(workingShape, scale);
                
                const transformed = TransformEngine.applyTransform(geom, slot.rotation, slot.pivot);

                // Apply true perpendicular bleed offset
                const adjustedPoints = (slot.bleed && bleed > 0)
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
            .sort((a, b) => a.zIndex - b.zIndex);
    }

    #validateTemplate(template) {
        const errors = [];
        if (!template.id) errors.push('Missing id');
        if (!template.slots || !Array.isArray(template.slots)) errors.push('Missing or invalid slots');
        if (!template.page) errors.push('Missing page config');

        if (!errors.length) {
            // Convert slots to check geometric collisions accurately with SAT
            const testSlots = template.slots.map(s => {
                const shapeToUse = s.shape || s.components?.mask?.shape || { type: 'rectangle', width:1, height:1 };
                const geom = ShapeFactory.toPolygon(shapeToUse, {width: 1, height: 1}); 
                return TransformEngine.applyTransform(geom, s.rotation, s.pivot);
            });

            for (let i = 0; i < testSlots.length; i++) {
                if (!testSlots[i].points || testSlots[i].points.length === 0) continue;
                for (let j = i + 1; j < testSlots.length; j++) {
                    if (!testSlots[j].points || testSlots[j].points.length === 0) continue;

                    if (GeometryMath.polygonsIntersect(testSlots[i].points, testSlots[j].points)) {
                        errors.push(`Slots ${template.slots[i].slotId} and ${template.slots[j].slotId} overlap geometrically`);
                    }
                }
            }
        }
        return errors;
    }

    #scoreTemplate(template, imageCount, options) {
        let score = 0;

        const max = template.metadata?.maxImages ?? template.slots.length;
        const min = template.metadata?.minImages ?? template.slots.length;
        const exactMatch = (imageCount === min && imageCount === max) ? 1 : 0;
        score += exactMatch * 10;

        // Visual Flow & Weight logic
        score += this.#visualFlowScore(template);

        if (options.style && template.metadata?.style === options.style) score += 5;
        if (options.tags && options.tags.length && template.metadata?.tags) {
            const matchCount = options.tags.filter(tag => template.metadata.tags.includes(tag)).length;
            score += matchCount * 2;
        }

        const complexity = template.metadata?.complexity || 0.5;
        score += (1 - complexity) * 2;

        return score;
    }

    #visualFlowScore(template) {
        let score = 0;
        if (!template.slots || template.slots.length === 0) return 0;
        
        let totalArea = 0;
        let largestArea = 0;
        
        template.slots.forEach(slot => {
            const w = slot.anchors ? slot.anchors.width : (slot.shape?.width || 0.5);
            const h = slot.anchors ? slot.anchors.height : (slot.shape?.height || 0.5);
            const area = w * h;
            totalArea += area;
            if (area > largestArea) largestArea = area;
        });

        // Reward templates that have a clear hero image (dominant area)
        if (largestArea > totalArea * 0.4) {
            score += 3; 
        }

        return score;
    }

    #saveState() {
        this.#undoStack.push(structuredClone(this.#state));
        if (this.#undoStack.length > 50) this.#undoStack.shift();
        this.#redoStack = [];
    }

    #dispatchStateChange() {
        this.dispatchEvent(new CustomEvent('stateChanged', {
            detail: {
                slots: this.#state.slots.length,
                images: this.#state.images.size,
                texts: this.#state.texts.size,
                templateId: this.#state.template?.id
            }
        }));
    }
}
