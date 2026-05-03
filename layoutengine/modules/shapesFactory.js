/**
 * ShapeFactory.js
 * Transforms normalized SVG path shapes into:
 *   - Konva-ready path strings (for rendering)
 *   - Sampled polygon point arrays (for layout math / BSP intersection)
 */

import shapesData from './shapes.json' assert { type: 'json' };

// ─── Shape Registry ──────────────────────────────────────────────────────────

const SHAPE_MAP = Object.fromEntries(shapesData.map(s => [s.id, s]));

export function getShape(id) {
  const shape = SHAPE_MAP[id];
  if (!shape) throw new Error(`ShapeFactory: unknown shape id "${id}"`);
  return shape;
}

export function getAllShapes() {
  return shapesData;
}

export function getShapesByTag(tag) {
  return shapesData.filter(s => s.tags.includes(tag));
}

// ─── SVG Path Transform ───────────────────────────────────────────────────────

/**
 * Parse a normalized SVG path (0–1 unit square) and scale it into a target rect.
 *
 * @param {string} pathStr  - Normalized SVG path string
 * @param {object} rect     - { x, y, width, height } target slot rect
 * @param {object} [opts]   - { padding: 0–1 relative inset }
 * @returns {string}        - Scaled SVG path string ready for Konva.Path
 */
export function transformPath(pathStr, rect, opts = {}) {
  const { x = 0, y = 0, width = 100, height = 100 } = rect;
  const padding = opts.padding ?? 0;

  const px = x + width * padding;
  const py = y + height * padding;
  const pw = width * (1 - padding * 2);
  const ph = height * (1 - padding * 2);

  // Replace all coordinate pairs in the path, scaling from 0–1 to target rect.
  // Handles: M, L, C, Q, A, Z and lowercase variants.
  return pathStr.replace(
    /([MLCQAZ])([^MLCQAZ]*)/gi,
    (_, cmd, args) => {
      const nums = args.trim().split(/[\s,]+/).map(Number);
      const scaled = scaleCoords(cmd, nums, px, py, pw, ph);
      return `${cmd.toUpperCase()} ${scaled.join(' ')}`;
    }
  );
}

function scaleCoords(cmd, nums, x, y, w, h) {
  const upper = cmd.toUpperCase();
  const isRelative = cmd === cmd.toLowerCase() && cmd !== 'z' && cmd !== 'Z';

  // Z has no coords
  if (upper === 'Z') return [];

  // For relative commands we'd need current point tracking — for now
  // all shapes in shapes.json are absolute, so this is fine.
  const out = [];

  if (upper === 'A') {
    // Arc: rx ry x-rotation large-arc-flag sweep-flag x y (per segment)
    for (let i = 0; i < nums.length; i += 7) {
      out.push(
        nums[i] * w,       // rx
        nums[i + 1] * h,   // ry
        nums[i + 2],       // x-rotation (angle, not a coord)
        nums[i + 3],       // large-arc-flag
        nums[i + 4],       // sweep-flag
        x + nums[i + 5] * w,
        y + nums[i + 6] * h
      );
    }
    return out;
  }

  // All other commands: pair up x, y
  for (let i = 0; i < nums.length; i++) {
    if (i % 2 === 0) out.push(x + nums[i] * w);
    else out.push(y + nums[i] * h);
  }
  return out;
}

// ─── Konva Path Builder ───────────────────────────────────────────────────────

/**
 * Build a Konva.Path config from a shape ID and slot rect.
 *
 * @param {string} shapeId
 * @param {object} rect        - { x, y, width, height }
 * @param {object} [styleOpts] - Extra Konva style props (fill, stroke, etc.)
 * @returns {object}           - Konva.Path config
 */
export function buildKonvaPath(shapeId, rect, styleOpts = {}) {
  const shape = getShape(shapeId);
  const data = transformPath(shape.svgPath, rect);
  return {
    data,
    x: 0,
    y: 0,
    fill: styleOpts.fill ?? '#cccccc',
    stroke: styleOpts.stroke ?? null,
    strokeWidth: styleOpts.strokeWidth ?? 0,
    shadowBlur: styleOpts.shadowBlur ?? 0,
    cornerRadius: styleOpts.cornerRadius ?? 0,
    ...styleOpts,
    // Konva needs the path in its own coord space
    sceneFunc: undefined,
  };
}

/**
 * Build a Konva clip function for a shape, used to mask an image group.
 * Usage: imageGroup.clipFunc(buildKonvaClipFunc(shapeId, rect))
 *
 * @param {string} shapeId
 * @param {object} rect
 * @returns {function}  - ctx => void clip function
 */
export function buildKonvaClipFunc(shapeId, rect) {
  const shape = getShape(shapeId);
  const scaledPath = transformPath(shape.svgPath, rect);
  return function (ctx) {
    const path = new Path2D(scaledPath);
    ctx.beginPath();
    ctx._context.addPath(path);
    ctx.closePath();
  };
}

// ─── Polygon Sampler (for layout math) ───────────────────────────────────────

/**
 * Sample N evenly-spaced points along a normalized SVG path, then scale to rect.
 * Used for BSP intersection checks, area calculation, centroid, etc.
 *
 * @param {string} shapeId
 * @param {object} rect       - { x, y, width, height }
 * @param {number} [samples]  - Number of polygon vertices to approximate curve (default 64)
 * @returns {{ x: number, y: number }[]}
 */
export function samplePolygon(shapeId, rect, samples = 64) {
  const shape = getShape(shapeId);
  const scaledPath = transformPath(shape.svgPath, rect);

  // Use an offscreen SVG to leverage the browser's own path length API
  if (typeof document !== 'undefined') {
    return sampleViaSVG(scaledPath, samples);
  }

  // Node/non-browser fallback: crude linear segment extraction
  return extractLinearPoints(scaledPath);
}

function sampleViaSVG(pathStr, samples) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathEl.setAttribute('d', pathStr);
  svg.appendChild(pathEl);
  document.body.appendChild(svg);

  const total = pathEl.getTotalLength();
  const points = [];
  for (let i = 0; i < samples; i++) {
    const pt = pathEl.getPointAtLength((i / samples) * total);
    points.push({ x: pt.x, y: pt.y });
  }

  document.body.removeChild(svg);
  return points;
}

function extractLinearPoints(pathStr) {
  // Fallback: pull all numeric coordinate pairs from M and L commands only
  const points = [];
  const re = /[ML]\s*([\d.]+)[,\s]+([\d.]+)/gi;
  let m;
  while ((m = re.exec(pathStr)) !== null) {
    points.push({ x: parseFloat(m[1]), y: parseFloat(m[2]) });
  }
  return points;
}

// ─── Geometry Utilities ───────────────────────────────────────────────────────

/**
 * Compute the centroid (visual center) of a sampled polygon.
 */
export function polygonCentroid(points) {
  const n = points.length;
  return {
    x: points.reduce((s, p) => s + p.x, 0) / n,
    y: points.reduce((s, p) => s + p.y, 0) / n,
  };
}

/**
 * Compute the approximate aspect ratio of a shape's bounding box after scaling to rect.
 */
export function shapeAspectRatio(shapeId, rect) {
  const pts = samplePolygon(shapeId, rect);
  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  return w / h;
}

/**
 * Compute approximate polygon area via Shoelace formula.
 */
export function polygonArea(points) {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

// ─── Slot Shape Descriptor ────────────────────────────────────────────────────

/**
 * Generate a full slot shape descriptor for use in layoutEngine.js templates.
 * Drop this into a slot object instead of / alongside the default rect.
 *
 * @param {string} shapeId
 * @param {object} rect
 * @returns {object} slot.shape descriptor
 */
export function buildSlotShape(shapeId, rect) {
  const shape = getShape(shapeId);
  return {
    type: 'custom',
    shapeId: shape.id,
    label: shape.label,
    tags: shape.tags,
    svgPath: transformPath(shape.svgPath, rect),
    boundingRect: rect,
  };
}
