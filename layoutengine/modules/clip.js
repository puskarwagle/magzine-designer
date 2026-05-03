/**
 * clip.js - Specialized geometry clipping and splitting operations.
 */

/**
 * Sutherland-Hodgman Clipping for convex polygons.
 * @param {Array<{x,y}>} polygon - Original convex polygon vertices.
 * @param {object} p0 - Point on the clipping line.
 * @param {object} n - Normal vector of the clipping line (pointing "inside").
 * @returns {Array<{x,y}>} Clipped polygon vertices.
 */
export function clipPolygon(polygon, p0, n) {
    if (!polygon || polygon.length < 3) return [];
    const result = [];
    const eps = 1e-9;
    
    for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];
        
        // Dot product to determine "insideness"
        const da = (a.x - p0.x) * n.x + (a.y - p0.y) * n.y;
        const db = (b.x - p0.x) * n.x + (b.y - p0.y) * n.y;
        
        if (da >= -eps) {
            // 'a' is inside (or on the edge)
            result.push(a);
        }
        
        // Edge crosses the clipping line
        if ((da > eps && db < -eps) || (da < -eps && db > eps)) {
            const t = da / (da - db);
            const intersect = {
                x: a.x + t * (b.x - a.x),
                y: a.y + t * (b.y - a.y)
            };
            result.push(intersect);
        }
    }
    
    // Final sanity check: remove duplicate adjacent points
    return result.filter((p, i, arr) => {
        const next = arr[(i + 1) % arr.length];
        return Math.abs(p.x - next.x) > eps || Math.abs(p.y - next.y) > eps;
    });
}

/**
 * Calculates the area of a polygon using the Shoelace formula.
 */
export function getPolygonArea(polygon) {
    if (!polygon || polygon.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];
        area += a.x * b.y - b.x * a.y;
    }
    return Math.abs(area / 2);
}

/**
 * Checks if vertices are collinear within a tolerance.
 */
export function isCollinear(p1, p2, p3, eps = 1e-6) {
    const area = Math.abs(p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
    return area < eps;
}

/**
 * Splits a polygon into two children.
 * Implements Strategy 1: Geometric Split Operators.
 */
export function PolygonSplitter(vertices, point, angle, gap = 0) {
    // Standard normal from angle
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    
    const hg = gap / 2;
    
    // Half-gap offset points
    const pA = { x: point.x + nx * hg, y: point.y + ny * hg };
    const nA = { x: nx, y: ny };
    const polyA = clipPolygon(vertices, pA, nA);
    
    const pB = { x: point.x - nx * hg, y: point.y - ny * hg };
    const nB = { x: -nx, y: -ny };
    const polyB = clipPolygon(vertices, pB, nB);
    
    // --- Degenerate Guard (Strategy 1) ---
    const parentArea = getPolygonArea(vertices);
    const areaA = getPolygonArea(polyA);
    const areaB = getPolygonArea(polyB);
    
    const minAreaThreshold = parentArea * 0.01;
    
    if (areaA < minAreaThreshold || areaB < minAreaThreshold || polyA.length < 3 || polyB.length < 3) {
        return null; // Reject split, return null to signal failure to split
    }
    
    return [polyA, polyB];
}

/**
 * Returns the bounding box of a polygon.
 */
export function getPolygonBoundingBox(polygon) {
    if (!polygon || !polygon.length) return { x: 0, y: 0, w: 0, h: 0 };
    let minX = polygon[0].x, maxX = minX;
    let minY = polygon[0].y, maxY = minY;
    for (const p of polygon) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Returns the visual center (centroid) of a polygon.
 */
export function getPolygonCentroid(polygon) {
    if (!Array.isArray(polygon) || polygon.length === 0) return { x: 0, y: 0 };
    let cx = 0, cy = 0, area = 0;
    for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];
        const cross = a.x * b.y - b.x * a.y;
        area += cross;
        cx += (a.x + b.x) * cross;
        cy += (a.y + b.y) * cross;
    }
    area /= 2;
    if (Math.abs(area) < 1e-9) {
        let avgX = 0, avgY = 0;
        for (const p of polygon) { avgX += p.x; avgY += p.y; }
        return { x: avgX / (polygon.length || 1), y: avgY / (polygon.length || 1) };
    }
    cx /= (6 * area);
    cy /= (6 * area);
    return { x: cx, y: cy };
}
