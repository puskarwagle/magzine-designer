/**
 * Sampat Layout Engine — Recursive Binary Partition
 *
 * Replaces the preset-slot system with a content-driven approach.
 * Images dictate the geometry; the page doesn't impose it on them.
 *
 * Output format is identical to the old preset slots:
 *   { x, y, w, h }  — normalized 0..1 for single page, 0..2 for spreads
 *
 * Usage:
 *   import { generateLayout } from './layoutEngine.js'
 *
 *   const slots = generateLayout(images, {
 *     pageWidth: 2480,
 *     pageHeight: 3508,
 *     margin: 80,
 *     gap: 20,
 *   })
 *   // slots[i].imageIndex matches images[i]
 */

// ---------------------------------------------------------------------------
// Core recursive partitioner
// ---------------------------------------------------------------------------

/**
 * Partition a rectangle among a set of images using recursive binary splitting.
 *
 * @param {number[]} indices   - Which images (by index) go in this region
 * @param {object}   rect      - { x, y, w, h } in pixels
 * @param {number[]} ratios    - Aspect ratios (w/h) for all images
 * @param {number}   gap       - Gap between slots in pixels
 * @param {number}   depth     - Recursion depth (internal)
 * @returns {{ imageIndex: number, rect: object }[]}
 */
function partition(indices, rect, ratios, gap, depth = 0) {
  if (indices.length === 0) return []

  if (indices.length === 1) {
    return [{ imageIndex: indices[0], rect }]
  }

  const [groupA, groupB] = splitIntoTwo(indices, ratios)

  // Choose split axis: split along the longer dimension
  const splitHorizontal = rect.w >= rect.h

  if (splitHorizontal) {
    // Left / right split
    // Weight by total "naturalness": sum of aspect ratios in each group
    const sumA = groupA.reduce((s, i) => s + ratios[i], 0)
    const sumB = groupB.reduce((s, i) => s + ratios[i], 0)
    let ratio = sumA / (sumA + sumB)
    ratio = clamp(ratio, 0.25, 0.75)

    const w1 = Math.round((rect.w - gap) * ratio)
    const w2 = rect.w - gap - w1
    const rectA = { x: rect.x,          y: rect.y, w: w1, h: rect.h }
    const rectB = { x: rect.x + w1 + gap, y: rect.y, w: w2, h: rect.h }
    return [
      ...partition(groupA, rectA, ratios, gap, depth + 1),
      ...partition(groupB, rectB, ratios, gap, depth + 1),
    ]
  } else {
    // Top / bottom split
    // Weight by inverse ratio (portrait images need more height per pixel of width)
    const sumA = groupA.reduce((s, i) => s + 1 / ratios[i], 0)
    const sumB = groupB.reduce((s, i) => s + 1 / ratios[i], 0)
    let ratio = sumA / (sumA + sumB)
    ratio = clamp(ratio, 0.25, 0.75)

    const h1 = Math.round((rect.h - gap) * ratio)
    const h2 = rect.h - gap - h1
    const rectA = { x: rect.x, y: rect.y,          w: rect.w, h: h1 }
    const rectB = { x: rect.x, y: rect.y + h1 + gap, w: rect.w, h: h2 }
    return [
      ...partition(groupA, rectA, ratios, gap, depth + 1),
      ...partition(groupB, rectB, ratios, gap, depth + 1),
    ]
  }
}

/**
 * Split an array of image indices into two groups that minimise
 * intra-group aspect ratio variance.
 *
 * Strategy: sort by ratio, find the split point that minimises
 * the sum of squared deviations from each group's median.
 */
function splitIntoTwo(indices, ratios) {
  if (indices.length === 2) {
    return [[indices[0]], [indices[1]]]
  }

  const sorted = [...indices].sort((a, b) => ratios[a] - ratios[b])

  let bestScore = Infinity
  let bestSplit = 1

  for (let s = 1; s < sorted.length; s++) {
    const g1 = sorted.slice(0, s)
    const g2 = sorted.slice(s)
    const score = groupVariance(g1, ratios) + groupVariance(g2, ratios)
    if (score < bestScore) {
      bestScore = score
      bestSplit = s
    }
  }

  return [sorted.slice(0, bestSplit), sorted.slice(bestSplit)]
}

function groupVariance(indices, ratios) {
  if (indices.length <= 1) return 0
  const vals = indices.map(i => ratios[i])
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length
  return vals.reduce((s, v) => s + (v - mean) ** 2, 0)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a layout for a set of images.
 *
 * @param {object[]} images
 *   Each image must have: { width: number, height: number }
 *   Optional: { ratio: number } — overrides width/height
 *
 * @param {object} options
 *   pageWidth   {number} — canvas width in pixels
 *   pageHeight  {number} — canvas height in pixels
 *   margin      {number} — outer margin in pixels (default: 0)
 *   gap         {number} — gap between slots in pixels (default: 8)
 *   normalize   {boolean} — if true, output x/y/w/h as 0..1 fractions (default: true)
 *
 * @returns {object[]} slots
 *   [{ imageIndex, x, y, w, h, aspectRatioError }]
 */
export function generateLayout(images, options = {}) {
  const {
    pageWidth,
    pageHeight,
    margin = 0,
    gap = 8,
    normalize = true,
  } = options

  if (!images || images.length === 0) return []

  const ratios = images.map(img =>
    img.ratio ?? (img.width / img.height)
  )

  const contentRect = {
    x: margin,
    y: margin,
    w: pageWidth  - margin * 2,
    h: pageHeight - margin * 2,
  }

  const indices = images.map((_, i) => i)
  const rawSlots = partition(indices, contentRect, ratios, gap)

  return rawSlots.map(({ imageIndex, rect }) => {
    const slot = normalize
      ? {
          x: rect.x / pageWidth,
          y: rect.y / pageHeight,
          w: rect.w / pageWidth,
          h: rect.h / pageHeight,
        }
      : { ...rect }

    const slotRatio = rect.w / rect.h
    const imgRatio  = ratios[imageIndex]
    const aspectRatioError = Math.abs(slotRatio - imgRatio) / imgRatio

    return {
      imageIndex,
      ...slot,
      aspectRatioError,
    }
  })
}

/**
 * Score a layout by mean aspect ratio error across all slots.
 * Lower = better fit. 0 = perfect (slots exactly match image ratios).
 *
 * @param {object[]} slots — output of generateLayout()
 * @returns {number} mean error as a fraction (0..1)
 */
export function scoreLayout(slots) {
  if (!slots.length) return 0
  return slots.reduce((s, slot) => s + slot.aspectRatioError, 0) / slots.length
}

/**
 * Mirror a layout horizontally (flip left/right).
 * Operates on normalized coordinates.
 *
 * @param {object[]} slots
 * @returns {object[]}
 */
export function mirrorLayout(slots) {
  return slots.map(slot => ({
    ...slot,
    x: 1 - slot.x - slot.w,
  }))
}

/**
 * Shuffle image assignments among slots, respecting any locked slots.
 *
 * @param {object[]} slots
 * @param {Set<number>} lockedImageIndices — imageIndex values that must not move
 * @returns {object[]} new slots with shuffled imageIndex values
 */
export function shuffleLayout(slots, lockedImageIndices = new Set()) {
  const free     = slots.filter(s => !lockedImageIndices.has(s.imageIndex))
  const locked   = slots.filter(s =>  lockedImageIndices.has(s.imageIndex))

  const freeIndices = shuffle(free.map(s => s.imageIndex))
  const freeSlots   = free.map((slot, i) => ({ ...slot, imageIndex: freeIndices[i] }))

  return [...freeSlots, ...locked].sort((a, b) => {
    // Restore original visual order (top-to-bottom, left-to-right)
    return a.y !== b.y ? a.y - b.y : a.x - b.x
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
