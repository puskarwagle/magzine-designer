/**
 * bsp.js — Recursive partitioning logic for generating templates using convex polygons.
 */
import { PolygonSplitter, getPolygonCentroid, getPolygonBoundingBox } from './clip.js';

export let splitCount = 0;

export function resetSplitCount() {
    splitCount = 0;
}

/**
 * Groups aspect ratios into two balanced buckets.
 */
export function groupByRatioBalance(ratios) {
    const indexed = ratios.map((r, i) => ({ r, i })).sort((a, b) => a.r - b.r);
    let bestScore = Infinity, bestSplit = 1;
    for (let s = 1; s < indexed.length; s++) {
        const g1 = indexed.slice(0, s).map(x => x.r);
        const g2 = indexed.slice(s).map(x => x.r);
        const med1 = g1[Math.floor(g1.length / 2)];
        const med2 = g2[Math.floor(g2.length / 2)];
        const err = g1.reduce((a, r) => a + Math.abs(r - med1), 0) +
            g2.reduce((a, r) => a + Math.abs(r - med2), 0);
        if (err < bestScore) { bestScore = err; bestSplit = s; }
    }
    return [indexed.slice(0, bestSplit).map(x => x.i), indexed.slice(bestSplit).map(x => x.i)];
}

/**
 * Recursively partitions a polygon based on image aspect ratios.
 * @param {Array<number>} indices - Indices of images to place.
 * @param {Array<number>} allRatios - Aspect ratios of all images.
 * @param {Array<{x,y}>|object} vertices - Current polygon vertices or rect {x,y,w,h}.
 * @param {number} gap - Gutter size.
 * @param {object} options - Generation options (seed, splitVariances, etc.)
 * @returns {Array} Flat array of { imageIndex, points, rect, siblingId }
 */
export function bspPartition(indices, allRatios, vertices, gap, options = {}) {
    // --- Normalization (Fix for "polygon is not iterable") ---
    let polyVertices = vertices;
    if (!Array.isArray(vertices) && vertices && typeof vertices === 'object' && vertices.w !== undefined) {
        polyVertices = [
            { x: vertices.x, y: vertices.y },
            { x: vertices.x + vertices.w, y: vertices.y },
            { x: vertices.x + vertices.w, y: vertices.y + vertices.h },
            { x: vertices.x, y: vertices.y + vertices.h }
        ];
    }

    splitCount++;
    const currentSplitId = `split_${splitCount}`;
    
    if (!indices.length) return [];
    if (indices.length === 1) {
        return [{ 
            imageIndex: indices[0], 
            points: polyVertices,
            rect: getPolygonBoundingBox(polyVertices) // Added for backward compatibility
        }];
    }

    const ratioSubset = indices.map(i => allRatios[i]);
    const [g1i, g2i] = groupByRatioBalance(ratioSubset);
    const g1 = g1i.map(i => indices[i]);
    const g2 = g2i.map(i => indices[i]);

    const bounds = getPolygonBoundingBox(polyVertices);
    const centroid = getPolygonCentroid(polyVertices);
    
    // Determine split orientation
    // Default: split along the longest axis
    let angle = (bounds.w >= bounds.h) ? Math.PI / 2 : 0; 
    
    // Support for diagonal variance
    if (options.allowDiagonal && Math.random() > 0.7) {
        angle = (Math.random() * Math.PI / 4) + (angle - Math.PI / 8); 
    }

    const splitResult = PolygonSplitter(polyVertices, centroid, angle, gap);
    
    if (!splitResult) {
        return [{ 
            imageIndex: indices[0], 
            points: polyVertices,
            rect: getPolygonBoundingBox(polyVertices)
        }];
    }

    const [polyA, polyB] = splitResult;
    
    const resultsA = bspPartition(g1, allRatios, polyA, gap, options);
    const resultsB = bspPartition(g2, allRatios, polyB, gap, options);
    
    // Sibling Tagging
    if (resultsA.length === 1) resultsA[0].siblingId = currentSplitId;
    if (resultsB.length === 1) resultsB[0].siblingId = currentSplitId;

    return [...resultsA, ...resultsB];
}

/**
 * Converts BSP results to a LayoutEngineV6 Template.
 */
export function bspToTemplate(bspSlots, config, templateId) {
    const slots = bspSlots.map((s, idx) => {
        return {
            slotId: `slot_${idx}`,
            _imageIndex: s.imageIndex,
            type: 'image',
            shape: { 
                type: 'polygon', 
                points: s.points.map(p => ({ x: p.x / config.width, y: p.y / config.height })) 
            },
            siblingId: s.siblingId,
            zIndex: idx + 1
        };
    });
    
    return {
        id: templateId,
        page: { width: config.width, height: config.height },
        slots,
        metadata: { 
            maxImages: slots.length, 
            minImages: slots.length,
            generated: true
        }
    };
}
