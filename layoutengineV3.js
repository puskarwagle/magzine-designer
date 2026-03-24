// layoutEngineV3.js

/**
 * V3 Layout Engine - Production-grade layout engine with private fields,
 * robust transforms, image fitting with focal points, undo/redo, and event system.
 */

// ============================================================================
// TRANSFORM ENGINE
// ============================================================================

/**
 * Handles geometric transformations of shapes (rotation, translation, scaling).
 */
export class TransformEngine {
    /**
     * Apply rotation and scaling to shape points.
     * @param {Object} shape - Shape with points, optional rotation and pivot.
     * @param {Object} scale - { width, height } scaling factors (pixel dimensions).
     * @returns {Object} { points: Array<{x,y}>, bounds: {x,y,w,h} }
     */
    static applyTransform(shape, scale) {
        const rad = (shape.rotation || 0) * (Math.PI / 180);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // Scale points to pixel space
        let points = shape.points.map(p => ({
            x: p.x * scale.width,
            y: p.y * scale.height
        }));

        // Apply rotation if any
        if (shape.rotation) {
            // Compute pivot: either explicit or centroid
            const pivot = shape.pivot
                ? { x: shape.pivot.x * scale.width, y: shape.pivot.y * scale.height }
                : points.reduce(
                    (acc, p) => ({ x: acc.x + p.x / points.length, y: acc.y + p.y / points.length }),
                    { x: 0, y: 0 }
                );

            points = points.map(p => ({
                x: pivot.x + (p.x - pivot.x) * cos - (p.y - pivot.y) * sin,
                y: pivot.y + (p.x - pivot.x) * sin + (p.y - pivot.y) * cos
            }));
        }

        // Compute bounding box
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const bounds = {
            x: Math.min(...xs),
            y: Math.min(...ys),
            w: Math.max(...xs) - Math.min(...xs),
            h: Math.max(...ys) - Math.min(...ys)
        };

        return { points, bounds };
    }
}

// ============================================================================
// IMAGE MATH (OBJECT-FIT WITH FOCAL POINTS)
// ============================================================================

/**
 * Handles image sizing and positioning within a bounding box.
 * Supports 'fill' (cover) and 'fit' (contain) modes with optional focal point.
 */
export class ImageMath {
    /**
     * Calculate the image rectangle to fit/fill the bounds.
     * @param {Object} bounds - { x, y, w, h } destination rectangle.
     * @param {number} imgW - Image width.
     * @param {number} imgH - Image height.
     * @param {string} mode - 'fill' (cover) or 'fit' (contain).
     * @param {Object} focalPoint - { x, y } in normalized coordinates (0-1).
     * @returns {Object} { x, y, w, h } image rectangle.
     */
    static calculateRect(bounds, imgW, imgH, mode = 'fill', focalPoint = { x: 0.5, y: 0.5 }) {
        const boundRatio = bounds.w / bounds.h;
        const imgRatio = imgW / imgH;

        let finalW, finalH;
        if (mode === 'fill') {
            // Cover: scale to fill, may crop
            if (boundRatio > imgRatio) {
                finalW = bounds.w;
                finalH = bounds.w / imgRatio;
            } else {
                finalH = bounds.h;
                finalW = bounds.h * imgRatio;
            }
        } else {
            // Contain: scale to fit inside
            if (boundRatio > imgRatio) {
                finalH = bounds.h;
                finalW = bounds.h * imgRatio;
            } else {
                finalW = bounds.w;
                finalH = bounds.w / imgRatio;
            }
        }

        // Base position: centered
        let x = bounds.x + (bounds.w - finalW) / 2;
        let y = bounds.y + (bounds.h - finalH) / 2;

        // Apply focal point offset (only for fill mode, to control cropping)
        if (mode === 'fill') {
            const offsetX = (bounds.w - finalW) * (0.5 - focalPoint.x);
            const offsetY = (bounds.h - finalH) * (0.5 - focalPoint.y);
            x += offsetX;
            y += offsetY;
        }

        return { x, y, w: finalW, h: finalH };
    }
}

// ============================================================================
// LAYOUT ENGINE V3 (Enhanced)
// ============================================================================

/**
 * Main layout engine class. Manages template selection, asset assignment,
 * undo/redo, and provides render data.
 * Uses private fields for encapsulation.
 */
export class LayoutEngineV3 extends EventTarget {
    // Private fields
    #registry = new Map();         // templateId -> template
    #undoStack = [];               // array of state snapshots
    #redoStack = [];               // optional, for better UX
    #state = {
        template: null,              // current template object
        config: null,                // page config { width, height, bleed, safeZone }
        images: new Map(),           // slotId -> image data { id, width, height, path, focalPoint? }
        texts: new Map(),            // slotId -> text data { content, config? }
        slots: []                    // processed slots (cached)
    };

    /**
     * Load multiple templates into the registry.
     * @param {Object[]} templates - Array of template objects.
     */
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

    /**
     * Select a template by ID.
     * @param {string} templateId - Template identifier.
     * @param {Object} config - Page configuration { width, height, bleed, safeZone }.
     */
    selectTemplate(templateId, config) {
        const template = this.#registry.get(templateId);
        if (!template) throw new Error(`Template ${templateId} not found`);

        this.#state.template = template;
        this.#state.config = { ...config, bleed: config.bleed || 0, safeZone: config.safeZone || 0 };
        this.#processSlots();
        this.#saveState();
        this.#dispatchStateChange();
    }

    /**
     * Automatically select the best template for a given image count.
     * @param {number} imageCount - Number of images to place.
     * @param {Object} options - { style, tags, pageConfig }.
     * @returns {Object|null} Selected template or null if none.
     */
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

    /**
     * Assign an image to a slot.
     * @param {string} slotId - Slot identifier.
     * @param {Object} imageData - { id, width, height, path, focalPoint? }.
     */
    assignImage(slotId, imageData) {
        this.#state.images.set(slotId, {
            ...imageData,
            focalPoint: imageData.focalPoint || { x: 0.5, y: 0.5 }
        });
        this.#saveState();
        this.#dispatchStateChange();
    }

    /**
     * Assign text to a slot.
     * @param {string} slotId - Slot identifier.
     * @param {Object} textData - { content, config? }.
     */
    assignText(slotId, textData) {
        this.#state.texts.set(slotId, textData);
        this.#saveState();
        this.#dispatchStateChange();
    }

    /**
     * Batch assign multiple assets in one operation (atomic).
     * @param {Array} assignments - [{ slotId, type, data }].
     */
    batchAssign(assignments) {
        const snapshot = structuredClone(this.#state);
        try {
            for (const { slotId, type, data } of assignments) {
                if (type === 'image') {
                    this.#state.images.set(slotId, {
                        ...data,
                        focalPoint: data.focalPoint || { x: 0.5, y: 0.5 }
                    });
                } else if (type === 'text') {
                    this.#state.texts.set(slotId, data);
                }
            }
            this.#saveState();
            this.#dispatchStateChange();
        } catch (err) {
            // Rollback on error
            this.#state = snapshot;
            this.#processSlots(); // re-process slots if needed
            throw err;
        }
    }

    /**
     * Undo the last state change.
     */
    undo() {
        if (this.#undoStack.length === 0) return;
        const previous = this.#undoStack.pop();
        // Push current state to redo stack
        this.#redoStack.push(structuredClone(this.#state));
        this.#state = previous;
        this.#processSlots(); // ensure slots are up-to-date
        this.#dispatchStateChange();
    }

    /**
     * Redo a previously undone change.
     */
    redo() {
        if (this.#redoStack.length === 0) return;
        const next = this.#redoStack.pop();
        this.#undoStack.push(structuredClone(this.#state));
        this.#state = next;
        this.#processSlots();
        this.#dispatchStateChange();
    }

    /**
     * Get the render graph: slots with computed clip paths and asset rectangles.
     * @returns {Array} Render-ready slot data.
     */
    getRenderGraph() {
        return this.#state.slots.map(slot => {
            const image = this.#state.images.get(slot.slotId);
            const text = this.#state.texts.get(slot.slotId);

            // Build SVG clip path string
            const clipPath = `M ${slot.points.map(p => `${p.x} ${p.y}`).join(' L ')} Z`;

            let assetRect = null;
            let assetData = null;

            if (image) {
                assetRect = ImageMath.calculateRect(
                    slot.bounds,
                    image.width,
                    image.height,
                    slot.mode || 'fill',
                    image.focalPoint
                );
                assetData = image;
            } else if (text) {
                // For text, we can optionally use the whole bounds or a padded rect
                const textBounds = { ...slot.bounds };
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
                // Convenience properties
                type: slot.type,
                textConfig: slot.textConfig,
                mode: slot.mode
            };
        });
    }

    /**
     * Get the current page configuration.
     * @returns {Object|null}
     */
    getPageConfig() {
        return this.#state.config;
    }

    /**
     * Get the current template metadata.
     * @returns {Object|null}
     */
    getTemplateMetadata() {
        return this.#state.template?.metadata || null;
    }

    /**
     * Clear all assets (images and texts).
     */
    clearAssets() {
        this.#state.images.clear();
        this.#state.texts.clear();
        this.#saveState();
        this.#dispatchStateChange();
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    /**
     * Process slots: apply transforms, bleed, sort by zIndex.
     */
    #processSlots() {
        if (!this.#state.template || !this.#state.config) return;

        const { width, height, bleed } = this.#state.config;

        this.#state.slots = this.#state.template.slots
            .map(slot => {
                // Transform shape points to pixels
                const { points, bounds } = TransformEngine.applyTransform(slot.shape, { width, height });

                // Apply bleed if slot requests it (expand outwards)
                const adjustedPoints = slot.bleed
                    ? points.map(p => ({ x: p.x + bleed, y: p.y + bleed }))
                    : points;

                // Adjust bounds for bleed? Bounds remain the original (for clipping) but we store both.
                return {
                    ...slot,
                    points: adjustedPoints,
                    bounds,
                    originalBounds: bounds,
                    zIndex: slot.zIndex || 1
                };
            })
            .sort((a, b) => a.zIndex - b.zIndex);
    }

    /**
     * Validate a template for structural issues.
     * @param {Object} template - Template object.
     * @returns {string[]} List of errors.
     */
    #validateTemplate(template) {
        const errors = [];

        // Basic required fields
        if (!template.id) errors.push('Missing id');
        if (!template.slots || !Array.isArray(template.slots)) errors.push('Missing or invalid slots');
        if (!template.page) errors.push('Missing page config');

        if (!errors.length) {
            // Check for overlapping slots
            for (let i = 0; i < template.slots.length; i++) {
                for (let j = i + 1; j < template.slots.length; j++) {
                    if (this.#slotsOverlap(template.slots[i], template.slots[j])) {
                        errors.push(`Slots ${template.slots[i].slotId} and ${template.slots[j].slotId} overlap`);
                    }
                }
            }

            // Check bleed vs safe zone
            if (template.page.bleed && template.page.safeZone && template.page.bleed > template.page.safeZone) {
                errors.push('Bleed cannot exceed safe zone');
            }
        }

        return errors;
    }

    /**
     * Check if two slots overlap (based on their shape points).
     * @param {Object} a - Slot A.
     * @param {Object} b - Slot B.
     * @returns {boolean}
     */
    #slotsOverlap(a, b) {
        // Simple bounding box overlap test (fast enough for validation)
        const aPoints = a.shape.points;
        const bPoints = b.shape.points;
        const aMinX = Math.min(...aPoints.map(p => p.x));
        const aMaxX = Math.max(...aPoints.map(p => p.x));
        const aMinY = Math.min(...aPoints.map(p => p.y));
        const aMaxY = Math.max(...aPoints.map(p => p.y));
        const bMinX = Math.min(...bPoints.map(p => p.x));
        const bMaxX = Math.max(...bPoints.map(p => p.x));
        const bMinY = Math.min(...bPoints.map(p => p.y));
        const bMaxY = Math.max(...bPoints.map(p => p.y));

        return !(aMaxX < bMinX || aMinX > bMaxX || aMaxY < bMinY || aMinY > bMaxY);
    }

    /**
     * Score a template for auto-selection.
     * @param {Object} template - Template.
     * @param {number} imageCount - Number of images.
     * @param {Object} options - { style, tags }.
     * @returns {number} Score (higher is better).
     */
    #scoreTemplate(template, imageCount, options) {
        let score = 0;

        // Prefer templates that exactly match image count within their range
        const max = template.metadata?.maxImages ?? template.slots.length;
        const min = template.metadata?.minImages ?? template.slots.length;
        const exactMatch = (imageCount === min && imageCount === max) ? 1 : 0;
        score += exactMatch * 10;

        // Prefer templates with style matching
        if (options.style && template.metadata?.style === options.style) {
            score += 5;
        }

        // Prefer templates with matching tags
        if (options.tags && options.tags.length && template.metadata?.tags) {
            const matchCount = options.tags.filter(tag => template.metadata.tags.includes(tag)).length;
            score += matchCount * 2;
        }

        // Lower complexity is slightly better (default)
        const complexity = template.metadata?.complexity || 0.5;
        score += (1 - complexity) * 2;

        return score;
    }

    /**
     * Save current state to undo stack.
     */
    #saveState() {
        this.#undoStack.push(structuredClone(this.#state));
        // Limit stack size (optional)
        if (this.#undoStack.length > 50) this.#undoStack.shift();
        // Clear redo stack on new action (typical undo behavior)
        this.#redoStack = [];
    }

    /**
     * Dispatch a state change event.
     */
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

// ============================================================================
// Example Usage (Development)
// ============================================================================

if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
    const sampleTemplate = {
        id: 'hero-right-stack',
        name: 'Hero with Right Stack',
        page: { width: 3600, height: 2400, bleed: 40, safeZone: 60 },
        slots: [
            {
                slotId: 'hero',
                type: 'image',
                zIndex: 1,
                mode: 'fill',
                shape: {
                    type: 'rectangle',
                    points: [[60, 60], [2340, 60], [2340, 2340], [60, 2340]]
                }
            },
            {
                slotId: 'support-1',
                type: 'image',
                zIndex: 2,
                mode: 'fill',
                shape: {
                    type: 'rectangle',
                    points: [[2400, 60], [3540, 60], [3540, 1140], [2400, 1140]]
                }
            },
            {
                slotId: 'support-2',
                type: 'image',
                zIndex: 2,
                mode: 'fill',
                shape: {
                    type: 'rectangle',
                    points: [[2400, 1260], [3540, 1260], [3540, 2340], [2400, 2340]]
                }
            }
        ],
        metadata: { style: 'editorial', complexity: 0.2, tags: ['hero', 'asymmetric'], maxImages: 3, minImages: 3 }
    };

    const engine = new LayoutEngineV3();
    engine.loadTemplates([sampleTemplate]);

    // Auto-select best template for 3 images
    engine.selectBestTemplate(3, {
        style: 'editorial',
        tags: ['hero'],
        pageConfig: { width: 3600, height: 2400, bleed: 40 }
    });

    // Assign images
    engine.assignImage('hero', {
        id: 'img1',
        width: 1920,
        height: 1080,
        path: '/images/hero.jpg',
        focalPoint: { x: 0.7, y: 0.3 }
    });
    engine.assignImage('support-1', {
        id: 'img2',
        width: 800,
        height: 600,
        path: '/images/support1.jpg'
    });
    engine.assignImage('support-2', {
        id: 'img3',
        width: 800,
        height: 600,
        path: '/images/support2.jpg'
    });

    // Get render data
    const renderGraph = engine.getRenderGraph();
    console.log('Render graph:', renderGraph);
}


This is ** already very strong **, but I can show you * exactly * where the weaknesses are and how to turn this from a good engine into a ** world - class professional layout engine ** like AlbumXpress, Canva, Photobook Designer, or SmartAlbums.

Below is a ** short, no - nonsense critique ** and then ** concrete improvements **.

---

# ❌ ** Critical Issues You Should Fix **

## ** 1. The “shape” system isn’t abstracted **

    Right now:
`slot.shape.type` exists but your code ** ignores shape.type ** and assumes `shape.points` always drives everything.

    Missing:

* rectangle with width / height
* circle / ellipse
* path curves
    * rounded corners
        * parametric shapes(e.g., “diagonal 20° rectangle”)
            * polygons with holes(text wraps!)

Fix:
Introduce a ** ShapeFactory ** abstraction.

```js
ShapeFactory.toPolygon(shape, scale) → { points, bounds }
```

Then you can support ANY future shape with no engine rewrites.

---

## ** 2. Bleed application is wrong **

    You apply bleed by ** offsetting every point outward **:

```js
points.map(p => ({ x: p.x + bleed, y: p.y + bleed }))
```

This is geometrically incorrect.
Correct bleed expands ** perpendicular to each edge **, not uniformly.

Fix using polygon offset algorithm:

    * ** Miter offset **
* Clipper.js(best!)
        * Paper.js`Path.expand()`

---

## ** 3. You don’t support curved clipping paths **

    Your clipPath is:

```js
M x y L x y ... Z
```

This cannot represent:

* rounded rectangles
    * soft corners
        * curved masks
            * brush shapes

You need optional ** bezier commands ** in the shape description:

```json
"shape": {
  "type": "path",
  "commands": [
    { "cmd": "M", "x": 100, "y": 100 },
    { "cmd": "Q", "cx": 130, "cy": 80, "x": 160, "y": 100 },
    { "cmd": "Z" }
  ]
}
```

Then convert to polygon for hit - testing & bounding boxes.

---

## ** 4. Slot overlap validation is naive **

    You test overlap using bounding boxes only.
        But you support rotated polygons — so two slots could:

            * have bounding-box overlap
                * but not geometrically overlap

You need:

### SAT – Separating Axis Theorem

Detect polygon intersection accurately.

This prevents rejecting valid diagonal templates.

---

## ** 5. No “reactive layout” or shape anchoring **

    If user toggles:

* page to spread mode
    * page size changes
        * margin changes

Slots should reposition / scale ** intelligently **, not only scale raw points.

You need ** anchor constraints **, like Figma / AutoLayout:

```json
"anchors": {
  "left": 0.05,
  "top": 0.1,
  "width": 0.40,
  "height": 0.30
}
```

If page ratio changes → shapes adapt.

---

## ** 6. No engine for slot collision resolution **

    For editorial layouts, one user action can require ** relayout **:

* swapping 2 image slots
    * rotating a slot
        * user replaces one image with tall portrait → slot ratio changes

You need a ** LayoutAdapter **:

```
Template slots → Constraints → LayoutEngine → Adapted final geometry
```

Right now your geometry is static.

---

## ** 7. No narrative visual flow scoring **

    Professional album tools(SmartAlbums, SmartFill, Canva AI) consider:

* weight distribution
    * eye flow
        * hero → secondary → fillers
            * left - page vs right - page reading direction

Your scorer only uses:

* tags
    * style
    * complexity

You need a visual - weight model.

---

## ** 8. Slots with rotation should NOT return rectangular bounds **

    Currently:

```js
bounds = max-min in X,Y
```

But rotated rectangles cause messy oversized bounds.

    Fix:
Store ** unrotated bounds + rotation matrix **, not rotated polygon bounding box.
This simplifies image fitting too.

---

## ** 9. No support for per - slot user transforms **

    Users often:

* drag crop
    * rotate within slot
        * zoom image

Your engine has no image transform state, e.g.:

```json
"imageTransform": {
  "scale": 1.2,
  "offsetX": -40,
  "offsetY": 20,
  "rotation": 5
}
```

Without it, the UI cannot persist user edits.

---

## ** 10. Missing invisible “mask” and “frame” layers **

    Professional templates use:

* decorative shapes
    * borders
    * masks
    * overlays
    * shadow layers

You currently assume ** slot = single polygon **.

Should be:

```
slot has: mask, frame, bg, image, overlay
```

---

# ⭐ ** Concrete Improvements ** (copy - paste ready)

## ** A.Add ShapeFactory abstraction **

    ```js
class ShapeFactory {
  static toPolygon(shape, scale) {
    switch(shape.type) {
      case "rectangle":
        return this.fromRect(shape, scale);
      case "polygon":
        return this.fromPolygon(shape, scale);
      case "path":
        return this.fromPath(shape, scale);
      default:
        throw new Error("Unknown shape type");
    }
  }
}
```

Replace all `shape.points` with:

```js
const { points, bounds } = ShapeFactory.toPolygon(slot.shape, scale);
```

---

## ** B.Add slot transform + mask layers **

    Add new fields:

```json
"components": {
  "mask": { "shape": {...} },
  "frame": { "shape": {...}, "stroke": "#fff", "width": 4 },
  "image": { "mode": "fill" },
  "overlay": { "color": "rgba(0,0,0,0.1)" }
}
```

This mirrors:

* Figma
    * Canva
    * Photoshop clipping masks

---

## ** C.Add persistent image transforms **

    In engine:

```js
#state.imageTransforms = new Map();
```

Per slot:

```json
{
  "scale": 1.0,
  "offsetX": 0,
  "offsetY": 0,
  "rotation": 0
}
```

---

## ** D.Add SAT for precise slot collision **

    Use:

    ```js
#polygonsIntersect(polyA, polyB)
```

Instead of bounding - box overlap.

---

## ** E.Add template dynamic anchors **

    ```js
anchors: {
  left: 0.1,
  top: 0.2,
  width: 0.4,
  height: 0.3
}
```

Then in `#processSlots()` apply anchors before polygon conversion.

---

## ** F.Add narrative - weight scoring **

    Add a function:

    ```js
#visualFlowScore(template)
```

Based on:

* slot area hierarchy
    * position(optical center)
    * reading order flow
        * balance left / right

---

# ⭐ Summary: What Your Engine Is Missing

    | Feature | Your V3 Status | Needed to Reach Pro Level |
| ---------------------- | -------------- | -------------------------------------- |
| Polygon shapes | ✔ basic | ❌ path curves, rounded corners |
| Transform engine | ✔ decent | ❌ bleed offset, SAT, parametric shapes |
| Clipping | ✔ polygon | ❌ paths, masks, frames, multi - layer |
| Image fitting | ✔ with focal | ❌ user transforms, rotation |
| Template scoring | ✔ basic | ❌ visual weight, narrative flow |
| Auto layout adaptation | ❌              | ✔ dynamic anchors, reflow logic |
| Undo / redo | ✔ good | ✔                                      |
| Validation | ✔ basic | ❌ polygon collision, gutter awareness |
| Render graph | ✔              | ✔ but improve shapes + masks |

    ---

# 🔥 I want…


### 1️⃣ “LayoutEngine V4” spec

Includes all improvements above.
