/**
 * bspPartition.js — Recursive partitioning logic for generating templates.
 */

export let splitCount = 0;

export function resetSplitCount() {
    splitCount = 0;
}

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
 * Recursively partitions a rectangle based on image aspect ratios.
 * @returns {Array} Flat array of { imageIndex, rect }
 */
export function bspPartition(indices, allRatios, rect, gap) {
    splitCount++;
    if (!indices.length) return [];
    if (indices.length === 1) return [{ imageIndex: indices[0], rect }];

    const ratioSubset = indices.map(i => allRatios[i]);
    const [g1i, g2i] = groupByRatioBalance(ratioSubset);
    const g1 = g1i.map(i => indices[i]);
    const g2 = g2i.map(i => indices[i]);

    const useH = rect.w >= rect.h; // horizontal split (left/right) if wide

    if (useH) {
        const a1 = g1.reduce((s, i) => s + allRatios[i], 0);
        const a2 = g2.reduce((s, i) => s + allRatios[i], 0);
        let sr = Math.max(0.25, Math.min(0.75, a1 / (a1 + a2)));
        const w1 = Math.round((rect.w - gap) * sr);
        const w2 = rect.w - gap - w1;
        return [
            ...bspPartition(g1, allRatios, { x: rect.x, y: rect.y, w: w1, h: rect.h }, gap),
            ...bspPartition(g2, allRatios, { x: rect.x + w1 + gap, y: rect.y, w: w2, h: rect.h }, gap)
        ];
    } else {
        const h1r = g1.reduce((s, i) => s + (1 / allRatios[i]), 0);
        const h2r = g2.reduce((s, i) => s + (1 / allRatios[i]), 0);
        let sr = Math.max(0.25, Math.min(0.75, h1r / (h1r + h2r)));
        const h1 = Math.round((rect.h - gap) * sr);
        const h2 = rect.h - gap - h1;
        return [
            ...bspPartition(g1, allRatios, { x: rect.x, y: rect.y, w: rect.w, h: h1 }, gap),
            ...bspPartition(g2, allRatios, { x: rect.x, y: rect.y + h1 + gap, w: rect.w, h: h2 }, gap)
        ];
    }
}

/**
 * Converts BSP results to a LayoutEngineV6 Template.
 */
export function bspToTemplate(bspSlots, config, templateId) {
    const slots = bspSlots.map((s, idx) => {
        const { x, y, w, h } = s.rect;
        return {
            slotId: `slot_${idx}`,
            _imageIndex: s.imageIndex,
            type: 'image',
            anchors: {
                left: x / config.width,
                top: y / config.height,
                width: w / config.width,
                height: h / config.height
            },
            shape: { type: 'rectangle', width: 1, height: 1 },
            zIndex: idx + 1
        };
    });
    return {
        id: templateId,
        page: { width: config.width, height: config.height },
        slots,
        metadata: { maxImages: slots.length, minImages: slots.length }
    };
}
