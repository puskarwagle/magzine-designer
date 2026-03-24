// ============================================================================
// IMPROVED RECURSIVE PARTITION ENGINE
// Drop-in replacement for the partition(), splitIntoTwo(), scoreSplit(),
// and generateDynamicPreset() functions in layoutEngine.js
// ============================================================================

/**
 * Main recursive partition — improved version.
 *
 * Key changes vs original:
 * - Direction-aware grouping: splitIntoTwo now receives the intended split axis
 *   so it can optimise for horizontal vs vertical weight.
 * - Alternating direction: each recursion level alternates H/V unless a
 *   strategy forces a specific axis, producing more varied geometry.
 * - Count-weighted split ratios: group area allocation is weighted by image
 *   count, not just summed ratios, so large groups don't get squeezed.
 * - Adaptive clamping: clamp range widens when group sizes are very unequal.
 * - Real-error Best Fit: strategy 5 runs the full sub-partition on both
 *   splits and picks the one with lower actual slot error.
 *
 * @param {number[]}        indices    - Image indices to place
 * @param {object}          rect       - { x, y, w, h } in pixel-scale coordinates
 * @param {number[]}        ratios     - Aspect ratios for all images
 * @param {number}          gap        - Gap in pixel-scale units
 * @param {number}          strategy   - 0=standard,1=H-bias,2=V-bias,3=balanced,
 *                                       4=hero,5=best-fit,6=chaos
 * @param {'h'|'v'|null}    parentDir  - Direction used by the parent split (internal)
 * @returns {{ imageIndex: number, rect: object }[]}
 */
function partition(indices, rect, ratios, gap, strategy = 0, parentDir = null) {
    if (indices.length === 0) return [];
    if (indices.length === 1) return [{ imageIndex: indices[0], rect }];

    // ── Grouping ──────────────────────────────────────────────────────────────
    let groupA, groupB;
    if (strategy === 4) {
        // Hero: first image always gets its own panel
        groupA = [indices[0]];
        groupB = indices.slice(1);
    } else {
        // Tentative direction used to inform grouping metric
        const tentativeH = strategy === 1 ? true
            : strategy === 2 ? false
                : rect.w >= rect.h;
        [groupA, groupB] = splitIntoTwo(indices, ratios, strategy === 3, tentativeH);
    }

    // ── Split direction ───────────────────────────────────────────────────────
    let splitHorizontal;
    if (strategy === 1) {
        splitHorizontal = true;
    } else if (strategy === 2) {
        splitHorizontal = false;
    } else if (strategy === 6) {
        // Chaos: probabilistic, biased toward longer dimension
        const hWeight = rect.w / (rect.w + rect.h);
        splitHorizontal = Math.random() < hWeight;
    } else if (strategy === 5) {
        // Best Fit: run both sub-partitions, pick the one with lower real slot error
        const scoreH = computePartitionError(groupA, groupB, rect, ratios, gap, true, strategy, 'h');
        const scoreV = computePartitionError(groupA, groupB, rect, ratios, gap, false, strategy, 'v');
        splitHorizontal = scoreH <= scoreV;
    } else {
        // Standard (0) + Balanced (3): alternate relative to parent direction.
        // Root level falls back to longer-dimension split.
        if (parentDir === 'h') {
            splitHorizontal = false;
        } else if (parentDir === 'v') {
            splitHorizontal = true;
        } else {
            splitHorizontal = rect.w >= rect.h;
        }
    }

    const childDir = splitHorizontal ? 'h' : 'v';

    // ── Split ratio ───────────────────────────────────────────────────────────
    let ratio;
    if (splitHorizontal) {
        // Width share proportional to total aspect ratio weight, adjusted by count
        const areaA = weightedRatioSum(groupA, ratios);
        const areaB = weightedRatioSum(groupB, ratios);
        ratio = areaA / (areaA + areaB);
    } else {
        // Height share proportional to total inverse-ratio weight, adjusted by count
        const areaA = weightedInvRatioSum(groupA, ratios);
        const areaB = weightedInvRatioSum(groupB, ratios);
        ratio = areaA / (areaA + areaB);
    }

    // Adaptive clamp: equal groups → tight clamp [0.25, 0.75];
    // very unequal groups → loose clamp [0.10, 0.90]
    const sizeFrac = Math.min(groupA.length, groupB.length) /
        Math.max(groupA.length, groupB.length);
    const minClamp = 0.10 + sizeFrac * 0.15; // 0.10 … 0.25
    const maxClamp = 1 - minClamp;           // 0.90 … 0.75
    ratio = Math.max(minClamp, Math.min(maxClamp, ratio));

    if (strategy === 6) {
        ratio = Math.max(minClamp, Math.min(maxClamp, ratio + (Math.random() - 0.5) * 0.15));
    }

    // ── Recurse ───────────────────────────────────────────────────────────────
    if (splitHorizontal) {
        const w1 = Math.round((rect.w - gap) * ratio);
        const w2 = rect.w - gap - w1;
        const rectA = { x: rect.x, y: rect.y, w: w1, h: rect.h };
        const rectB = { x: rect.x + w1 + gap, y: rect.y, w: w2, h: rect.h };
        return [
            ...partition(groupA, rectA, ratios, gap, strategy, childDir),
            ...partition(groupB, rectB, ratios, gap, strategy, childDir),
        ];
    } else {
        const h1 = Math.round((rect.h - gap) * ratio);
        const h2 = rect.h - gap - h1;
        const rectA = { x: rect.x, y: rect.y, w: rect.w, h: h1 };
        const rectB = { x: rect.x, y: rect.y + h1 + gap, w: rect.w, h: h2 };
        return [
            ...partition(groupA, rectA, ratios, gap, strategy, childDir),
            ...partition(groupB, rectB, ratios, gap, strategy, childDir),
        ];
    }
}

// ── Grouping helper ───────────────────────────────────────────────────────────

/**
 * Split indices into two groups that minimise intra-group ratio spread.
 * Now direction-aware: sorts and scores by the metric relevant to the split axis.
 *
 * Horizontal split → optimise for similar total width weight (sum of ratios)
 * Vertical split   → optimise for similar total height weight (sum of 1/ratios)
 *
 * @param {number[]} indices
 * @param {number[]} ratios
 * @param {boolean}  balanced    - Extra penalty for very unequal group sizes
 * @param {boolean}  horizontal  - Intended split direction (changes sort + score metric)
 */
function splitIntoTwo(indices, ratios, balanced = false, horizontal = true) {
    if (indices.length === 2) return [[indices[0]], [indices[1]]];

    // Sort by the metric relevant to the split direction
    const metric = i => horizontal ? ratios[i] : 1 / ratios[i];
    const sorted = [...indices].sort((a, b) => metric(a) - metric(b));

    let bestScore = Infinity;
    let bestSplit = 1;

    for (let s = 1; s < sorted.length; s++) {
        const g1 = sorted.slice(0, s);
        const g2 = sorted.slice(s);

        // L1 error from median — robust to outlier ratios
        const score = groupL1Error(g1, ratios, horizontal)
            + groupL1Error(g2, ratios, horizontal);

        // Optional: penalise very unequal group sizes (strategy 3 = balanced)
        const balancePenalty = balanced
            ? Math.abs(g1.length - g2.length) * 0.15
            : 0;

        const finalScore = score + balancePenalty;
        if (finalScore < bestScore) {
            bestScore = finalScore;
            bestSplit = s;
        }
    }

    return [sorted.slice(0, bestSplit), sorted.slice(bestSplit)];
}

// ── Scoring (Best Fit strategy) ───────────────────────────────────────────────

/**
 * Run the full partition on both sub-groups and return the mean aspect ratio
 * error across all resulting slots. Used by strategy 5 (Best Fit) to choose
 * split direction at each level.
 *
 * This is more expensive than the old one-level approximation, but it's
 * called with sub-groups so depth is bounded by log2(n).
 */
function computePartitionError(groupA, groupB, rect, ratios, gap, horizontal, strategy, childDir) {
    let ratio;
    if (horizontal) {
        const areaA = weightedRatioSum(groupA, ratios);
        const areaB = weightedRatioSum(groupB, ratios);
        ratio = Math.max(0.2, Math.min(0.8, areaA / (areaA + areaB)));
        const w1 = Math.round((rect.w - gap) * ratio);
        const w2 = rect.w - gap - w1;
        const rectA = { x: rect.x, y: rect.y, w: w1, h: rect.h };
        const rectB = { x: rect.x + w1 + gap, y: rect.y, w: w2, h: rect.h };
        const slotsA = partition(groupA, rectA, ratios, gap, strategy, childDir);
        const slotsB = partition(groupB, rectB, ratios, gap, strategy, childDir);
        return meanSlotError([...slotsA, ...slotsB], ratios);
    } else {
        const areaA = weightedInvRatioSum(groupA, ratios);
        const areaB = weightedInvRatioSum(groupB, ratios);
        ratio = Math.max(0.2, Math.min(0.8, areaA / (areaA + areaB)));
        const h1 = Math.round((rect.h - gap) * ratio);
        const h2 = rect.h - gap - h1;
        const rectA = { x: rect.x, y: rect.y, w: rect.w, h: h1 };
        const rectB = { x: rect.x, y: rect.y + h1 + gap, w: rect.w, h: h2 };
        const slotsA = partition(groupA, rectA, ratios, gap, strategy, childDir);
        const slotsB = partition(groupB, rectB, ratios, gap, strategy, childDir);
        return meanSlotError([...slotsA, ...slotsB], ratios);
    }
}

/**
 * Mean aspect ratio error across a set of slots.
 * error = |slotRatio - imageRatio| / imageRatio
 */
function meanSlotError(slots, ratios) {
    if (!slots.length) return 0;
    const total = slots.reduce(({ imageIndex, rect: r }) => {
        const slotRatio = r.w / r.h;
        const imgRatio = ratios[imageIndex];
        return Math.abs(slotRatio - imgRatio) / imgRatio;
    }, 0);
    return total / slots.length;
}

// ── Area weight helpers ───────────────────────────────────────────────────────

/**
 * Count-weighted sum of aspect ratios.
 * A group of 3 portrait images (ratio ~0.67) should claim proportionally
 * more horizontal space than a lone landscape image (ratio ~1.5).
 * Without count weighting, the landscape image's large single ratio can
 * dominate and starve the portrait group.
 *
 * Formula: mean(ratio) * sqrt(count)
 * sqrt(count) grows sub-linearly — it gives groups credit for size
 * without allowing a large group of tiny images to claim everything.
 */
function weightedRatioSum(indices, ratios) {
    if (!indices.length) return 0;
    const mean = indices.reduce((s, i) => s + ratios[i], 0) / indices.length;
    return mean * Math.sqrt(indices.length);
}

/**
 * Count-weighted sum of inverse aspect ratios (height weight).
 */
function weightedInvRatioSum(indices, ratios) {
    if (!indices.length) return 0;
    const mean = indices.reduce((s, i) => s + 1 / ratios[i], 0) / indices.length;
    return mean * Math.sqrt(indices.length);
}

// ── Error metrics ─────────────────────────────────────────────────────────────

/**
 * L1 error from median for a group.
 * horizontal=true  → error on ratio values (width metric)
 * horizontal=false → error on inverse ratio values (height metric)
 */
function groupL1Error(indices, ratios, horizontal = true) {
    if (indices.length <= 1) return 0;
    const vals = indices.map(i => horizontal ? ratios[i] : 1 / ratios[i])
        .sort((a, b) => a - b);
    const median = vals[Math.floor(vals.length / 2)];
    return vals.reduce((s, v) => s + Math.abs(v - median), 0);
}

// ── Updated generateDynamicPreset ─────────────────────────────────────────────

/**
 * Generates a dynamic LayoutPreset using the improved recursive binary partition.
 * Drop-in replacement for the original generateDynamicPreset().
 *
 * @param {Object[]} images   - Array of { id, width, height }
 * @param {Object|boolean} isSpreadOrOptions - Options object or legacy isSpread bool
 * @param {Object} [legacyOptions]
 * @returns {LayoutPreset}
 */
export function generateDynamicPreset(images = [], isSpreadOrOptions = false, legacyOptions = {}) {
    // Support old two-argument signature: generateDynamicPreset(images, isSpread, options)
    let isSpread, options;
    if (typeof isSpreadOrOptions === 'object') {
        options = isSpreadOrOptions;
        isSpread = options.isSpread || false;
    } else {
        isSpread = isSpreadOrOptions;
        options = legacyOptions;
    }

    const n = images.length;
    if (n === 0) return isSpread ? generateGenericSpreadGrid(0) : generateGenericGrid(0);

    const strategy = options.strategy ?? 0;
    const ratios = images.map(img => (img.width / img.height) || 1);
    const indices = images.map((_, i) => i);

    // Work in a large integer pixel space to avoid float precision drift
    const scale = 2000;
    const gap = (options.gap ?? GAP) * scale;
    const baseRect = { x: 0, y: 0, w: (isSpread ? 2 : 1) * scale, h: scale };

    // parentDir starts null — root picks the longer dimension
    const rawSlots = partition(indices, baseRect, ratios, gap, strategy, null);

    const slots = rawSlots.map(({ imageIndex, rect: r }) => ({
        id: `dyn-${imageIndex}`,
        x: r.x / scale,
        y: r.y / scale,
        w: r.w / scale,
        h: r.h / scale,
        priority: n - imageIndex,
        preferredRatio: getImageOrientation(
            images[imageIndex]?.width || 1,
            images[imageIndex]?.height || 1
        ),
        mode: 'fill',
    }));

    const presetId = options.id || `DYNAMIC-${isSpread ? 'S' : 'P'}-${n}-${strategy}`;
    const labelPrefix = presetId.startsWith('FLUID') ? 'Fluid' : 'Dynamic';
    const labels = {
        0: 'Standard',
        1: 'Horizontal',
        2: 'Vertical',
        3: 'Balanced',
        4: 'Hero',
        5: 'Best Fit',
        6: 'Chaos',
    };

    return {
        id: presetId,
        label: `${labelPrefix} (${labels[strategy] ?? 'Auto'})`,
        imageCount: n,
        pageType: isSpread ? 'spread' : 'single',
        slots,
    };
}