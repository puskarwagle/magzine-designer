import { toPixels } from './utils.js';
import { UndoStack } from './undo.js';

/**
 * Layout Preset Engine
 * Implements the album layout preset system for placing images on pages.
 */

// ============================================================================
// DATA STRUCTURES
// ============================================================================

/**
 * @typedef {Object} Slot
 * @property {number} x - Top-left X coordinate in [0,1] inside margin box (0-2 for spread mode)
 * @property {number} y - Top-left Y coordinate in [0,1] inside margin box
 * @property {number} w - Width in [0,1] inside margin box (0-2 for spread mode)
 * @property {number} h - Height in [0,1] inside margin box
 * @property {number} priority - Bigger = more important (must be unique within preset)
 * @property {'portrait'|'landscape'|'square'|'any'} [preferredRatio] - Ideal image orientation for this slot (inferred from w/h if absent)
 * @property {'fit'|'fill'} [mode='fit'] - 'fit' letterboxes, 'fill' crops to cover slot
 * @property {number} [rotation] - Rotation in degrees (for collage presets)
 * @property {number} [zIndex] - Stacking order (for overlapping collage presets)
 */

/**
 * @typedef {Object} LayoutPreset
 * @property {string} id - Unique identifier (e.g., "P3-1")
 * @property {number} imageCount - Number of images this preset supports
 * @property {Slot[]} slots - Array of slot definitions (length === imageCount)
 * @property {'clean'|'collage'|'editorial'} [style='clean'] - Visual style category
 * @property {string[]} [tags] - Style tags for filtering (e.g., ['grid', 'hero', 'editorial'])
 * @property {number} [gap] - Per-preset gap override (falls back to DEFAULT_LAYOUT_CONFIG.slotGap)
 * @property {string} [mix] - Orientation mix descriptor (e.g., '2P-1L' for 2 Portrait, 1 Landscape)
 * @property {'single'|'spread'} [pageType='single'] - 'single' for per-page, 'spread' for cross-gutter layouts
 */

/**
 * @typedef {Object} LayoutConfig
 * @property {number} slotGap - Gap between slots as fraction of margin box (e.g., 0.02 = 2%)
 */

/**
 * @typedef {Object} PageLayoutState
 * @property {string[]} imageIds - Ordered array of image IDs assigned to this page
 * @property {number} currentPresetIndex - Index into presetsByCount[N] for cycling
 */

/**
 * Valid style tags for preset filtering
 * @type {string[]}
 */
const VALID_TAGS = ['grid', 'hero', 'editorial', 'collage', 'fullbleed', 'minimal'];

/**
 * Spread-mode gutter constants (as fraction of spread width)
 */
const GUTTER_WIDTH = 0.03;
const GUTTER_START = 0.5 - GUTTER_WIDTH / 2;
const GUTTER_END = 0.5 + GUTTER_WIDTH / 2;

// Default layout configuration
const DEFAULT_LAYOUT_CONFIG = {
  slotGap: 0.02, // 2% gap between slots
};

const GAP = 0.02; // Standard gap between slots

const presetsByCount = new Map();
const spreadPresetsByCount = new Map();

// ============================================================================
// EXPORTS (Moved to top to prevent circular dependency issues)
// ============================================================================

// Export for use in renderer.js
export const LayoutEngine = {
  // Configuration
  DEFAULT_LAYOUT_CONFIG,
  VALID_TAGS,
  GUTTER_WIDTH,
  GUTTER_START,
  GUTTER_END,
  
  // Preset Registry
  presetsByCount,
  spreadPresetsByCount,
  getPresetsForCount,
  getPresetsForCountSorted,
  getSpreadPresetsForCount,
  generateGenericGrid,
  generateGenericSpreadGrid,
  generateDynamicPreset,
  
  // Orientation Matching
  getImageOrientation,
  inferSlotRatio,
  orientationMatches,
  scorePresetMatch,
  
  // Validation
  validatePreset,
  validateAllPresets,
  loadPresetsFromData,
  
  // Layout Computation
  computeMarginBox,
  computeSpreadMarginBox,
  mapImagesToSlots,
  computeSlotRectangles,
  fitImageInSlot,
  fillImageInSlot,
  applyPresetToPage,
  applyPresetToSpread,
  isSlotInGutter,
  
  // State Management
  createPageLayoutState,
  nextPreset,
  getCurrentPreset,
  updatePageImages,
  
  // Preset Transformations
  mirrorPreset,
  shuffleImagesInPreset,

  // Undo/Redo
  UndoStack,
  layoutUndoStack: new UndoStack(50),
};

// ============================================================================
// PRESET VALIDATION
// ============================================================================

/**
 * Validates a preset for correctness.
 * @param {LayoutPreset} preset - The preset to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
function validatePreset(preset) {
  const errors = [];

  // Check slot count matches imageCount
  if (preset.slots.length !== preset.imageCount) {
    errors.push(`Slot count (${preset.slots.length}) does not match imageCount (${preset.imageCount})`);
  }

  const priorities = new Set();
  
  for (let i = 0; i < preset.slots.length; i++) {
    const slot = preset.slots[i];
    const slotId = `Slot ${i}`;

    // Bounds check
    if (slot.x < 0 || slot.y < 0 || slot.x + slot.w > 1.01 || slot.y + slot.h > 1.01) {
      errors.push(`${slotId}: Out of bounds (x=${slot.x}, y=${slot.y}, w=${slot.w}, h=${slot.h})`);
    }

    // Priority uniqueness
    if (priorities.has(slot.priority)) {
      errors.push(`${slotId}: Duplicate priority ${slot.priority}`);
    }
    priorities.add(slot.priority);

    // Overlap detection with other slots
    for (let j = i + 1; j < preset.slots.length; j++) {
      const other = preset.slots[j];
      if (slotsOverlap(slot, other)) {
        errors.push(`${slotId} overlaps with Slot ${j}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Checks if two slots overlap.
 */
function slotsOverlap(a, b) {
  const aRight = a.x + a.w;
  const aBottom = a.y + a.h;
  const bRight = b.x + b.w;
  const bBottom = b.y + b.h;

  return !(aRight <= b.x || bRight <= a.x || aBottom <= b.y || bBottom <= a.y);
}

/**
 * Validates all presets in the registry.
 * @returns {{valid: boolean, results: Map<string, {valid: boolean, errors: string[]}>}}
 */
function validateAllPresets() {
  const results = new Map();
  let allValid = true;

  for (const [count, presets] of presetsByCount) {
    for (const preset of presets) {
      const result = validatePreset(preset);
      results.set(preset.id, result);
      if (!result.valid) {
        allValid = false;
        console.warn(`Preset ${preset.id} validation failed:`, result.errors);
      }
    }
  }

  return { valid: allValid, results };
}

// ============================================================================
// GENERIC GRID FALLBACK
// ============================================================================

/**
 * Generates a generic grid layout for N images when no preset exists.
 * @param {number} n - Number of images
 * @returns {LayoutPreset}
 */
function generateGenericGrid(n) {
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const slots = [];

  const cellW = (1 - GAP * (cols - 1)) / cols;
  const cellH = (1 - GAP * (rows - 1)) / rows;

  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    slots.push({
      x: col * (cellW + GAP),
      y: row * (cellH + GAP),
      w: cellW,
      h: cellH,
      priority: n - i,
    });
  }

  return {
    id: `GRID-${n}`,
    imageCount: n,
    slots,
  };
}

// ============================================================================
// LAYOUT ENGINE
// ============================================================================

/**
 * Gets the list of available presets for a given image count.
 * Falls back to generic grid if no presets exist.
 * @param {number} imageCount
 * @returns {LayoutPreset[]}
 */
function getPresetsForCount(imageCount) {
  return [
    { id: `DYNAMIC-P-${imageCount}-0`, label: 'Dynamic (Auto)', imageCount, pageType: 'single', style: 'clean', slots: [] },
    { id: `DYNAMIC-P-${imageCount}-1`, label: 'Dynamic (Horizontal)', imageCount, pageType: 'single', style: 'clean', slots: [] },
    { id: `DYNAMIC-P-${imageCount}-2`, label: 'Dynamic (Vertical)', imageCount, pageType: 'single', style: 'clean', slots: [] },
  ];
}

/**
 * Computes the margin box in pixels for a single page.
 * @param {Object} margins - {top, bottom, inner, outer} in physical units
 * @param {number} pageWidthPx - Page width in pixels
 * @param {number} pageHeightPx - Page height in pixels
 * @param {string} unit - 'in' or 'cm'
 * @param {number} dpi - Dots per inch
 * @param {boolean} isLeftPage - Whether this is the left page of a spread
 * @returns {{left: number, top: number, width: number, height: number}}
 */
function computeMarginBox(margins, pageWidthPx, pageHeightPx, unit, dpi, isLeftPage) {
  const topPx = toPixels(margins.top, unit, dpi);
  const bottomPx = toPixels(margins.bottom, unit, dpi);
  const innerPx = toPixels(margins.inner, unit, dpi);
  const outerPx = toPixels(margins.outer, unit, dpi);

  let left, right;
  if (isLeftPage) {
    left = outerPx;
    right = pageWidthPx - innerPx;
  } else {
    left = innerPx;
    right = pageWidthPx - outerPx;
  }

  return {
    left,
    top: topPx,
    width: right - left,
    height: pageHeightPx - topPx - bottomPx,
  };
}

/**
 * Maps images to slots based on slot priority.
 * @param {string[]} imageIds - Ordered array of image IDs
 * @param {Slot[]} slots - Slots from the preset
 * @returns {Array<{imageId: string, slot: Slot}>}
 */
function mapImagesToSlots(imageIds, slots) {
  const sortedSlots = [...slots].sort((a, b) => b.priority - a.priority);
  return imageIds.map((imageId, index) => ({
    imageId,
    slot: sortedSlots[index] || null,
  }));
}

/**
 * Computes pixel rectangles for images on a page.
 * @param {Object} params
 * @param {string[]} params.imageIds - Ordered array of image IDs
 * @param {LayoutPreset} params.preset - The layout preset to use
 * @param {Object} params.marginBox - {left, top, width, height} in pixels
 * @param {Object} params.customSlots - Optional manual overrides { [imageId]: {x, y, w, h} }
 * @returns {Array<{imageId: string, x: number, y: number, w: number, h: number, visible: boolean, slot: Slot|null}>}
 */
function computeSlotRectangles({ imageIds, preset, marginBox, customSlots = {}, images = [] }) {
  // Handle Dynamic Layout generation
  let activePreset = preset;
  if (preset.id.startsWith('DYNAMIC')) {
    const pageImages = imageIds.map(id => images.find(img => img.id === id)).filter(Boolean);
    
    // Determine strategy from ID suffix
    const parts = preset.id.split('-');
    const strategy = parseInt(parts[parts.length - 1]) || 0;
    
    const generated = generateDynamicPreset(pageImages, preset.pageType === 'spread', { strategy });
    activePreset = { ...preset, slots: generated.slots };
  }

  const mapping = mapImagesToSlots(imageIds, activePreset.slots);
  const isSpread = activePreset.pageType === 'spread';
  const unitW = isSpread ? marginBox.width / 2 : marginBox.width;
  
  return mapping.map(({ imageId, slot }) => {
    if (!slot && !customSlots[imageId]) {
      return { imageId, x: 0, y: 0, w: 0, h: 0, visible: false, slot: null };
    }

    // Prioritize custom slot coordinates if available
    const custom = customSlots[imageId];
    const x = marginBox.left + (custom ? custom.x : slot.x) * unitW;
    const y = marginBox.top + (custom ? custom.y : slot.y) * marginBox.height;
    const w = (custom ? custom.w : slot.w) * unitW;
    const h = (custom ? custom.h : slot.h) * marginBox.height;

    return { imageId, x, y, w, h, visible: true, slot };
  });
}

/**
 * Fits an image inside a slot without cropping (letterbox/pillarbox).
 * @param {number} imgW - Intrinsic image width
 * @param {number} imgH - Intrinsic image height
 * @param {number} slotW - Slot width in pixels
 * @param {number} slotH - Slot height in pixels
 * @returns {{x: number, y: number, w: number, h: number, overflow: boolean}}
 */
function fitImageInSlot(imgW, imgH, slotW, slotH) {
  const scale = Math.min(slotW / imgW, slotH / imgH);
  const renderW = imgW * scale;
  const renderH = imgH * scale;
  const x = (slotW - renderW) / 2;
  const y = (slotH - renderH) / 2;

  return { x, y, w: renderW, h: renderH, overflow: false };
}

/**
 * Fills a slot with an image, cropping to cover (no letterbox).
 * Image is centered; overflow is hidden by the renderer.
 * @param {number} imgW - Intrinsic image width
 * @param {number} imgH - Intrinsic image height
 * @param {number} slotW - Slot width in pixels
 * @param {number} slotH - Slot height in pixels
 * @returns {{x: number, y: number, w: number, h: number, overflow: boolean}}
 */
function fillImageInSlot(imgW, imgH, slotW, slotH) {
  const scale = Math.max(slotW / imgW, slotH / imgH);
  const renderW = imgW * scale;
  const renderH = imgH * scale;
  const x = (slotW - renderW) / 2;
  const y = (slotH - renderH) / 2;

  return { x, y, w: renderW, h: renderH, overflow: true };
}

/**
 * Applies a preset to a page and computes final image positions.
 * @param {Object} params
 * @param {PageLayoutState} params.pageState - Current page layout state
 * @param {Object[]} params.images - Array of image objects with {id, path, width, height}
 * @param {Object} params.margins - Page margins
 * @param {number} params.pageWidthPx - Page width in pixels
 * @param {number} params.pageHeightPx - Page height in pixels
 * @param {string} params.unit - 'in' or 'cm'
 * @param {number} params.dpi - Dots per inch
 * @param {boolean} params.isLeftPage - Whether this is the left page
 * @param {LayoutPreset} [params.overridePreset] - Optional preset to use instead of looking up by index
 * @returns {Array<{imageId: string, imagePath: string, slotRect: {x, y, w, h}, imageRect: {x, y, w, h, overflow: boolean}, slot: Slot}>}
 */
function applyPresetToPage({
  pageState,
  images,
  margins,
  pageWidthPx,
  pageHeightPx,
  unit,
  dpi,
  isLeftPage,
  overridePreset,
}) {
  const imageCount = pageState.imageIds.length;
  if (imageCount === 0) {
    return [];
  }

  let preset;
  if (overridePreset) {
    preset = overridePreset;
  } else {
    const presets = getPresetsForCount(imageCount);
    const presetIndex = pageState.currentPresetIndex % presets.length;
    preset = presets[presetIndex];
  }

  const marginBox = computeMarginBox(margins, pageWidthPx, pageHeightPx, unit, dpi, isLeftPage);
  const slotRects = computeSlotRectangles({
    imageIds: pageState.imageIds,
    preset,
    marginBox,
    customSlots: pageState.customSlots || {},
    images,
  });

  const imageMap = new Map(images.map(img => [img.id, img]));

  return slotRects.map(({ imageId, x, y, w, h, visible, slot }) => {
    const image = imageMap.get(imageId);
    if (!image || !visible) {
      return null;
    }

    const imgW = image.width || 1000;
    const imgH = image.height || 1000;
    
    const mode = slot?.mode || 'fit';
    const imageRect = mode === 'fill'
      ? fillImageInSlot(imgW, imgH, w, h)
      : fitImageInSlot(imgW, imgH, w, h);

    return {
      imageId,
      imagePath: image.path,
      slotRect: { x, y, w, h },
      imageRect,
      slot,
    };
  }).filter(Boolean);
}

// ============================================================================
// PAGE LAYOUT STATE HELPERS
// ============================================================================

/**
 * Creates a new PageLayoutState.
 * @param {string[]} imageIds - Initial image IDs
 * @returns {PageLayoutState}
 */
function createPageLayoutState(imageIds = []) {
  return {
    imageIds: [...imageIds],
    currentPresetIndex: 0,
  };
}

/**
 * Advances to the next preset for a page.
 * @param {PageLayoutState} pageState
 * @returns {PageLayoutState} New state with incremented preset index
 */
function nextPreset(pageState) {
  const presets = getPresetsForCount(pageState.imageIds.length);
  return {
    ...pageState,
    currentPresetIndex: (pageState.currentPresetIndex + 1) % presets.length,
  };
}

/**
 * Gets the current preset for a page state.
 * @param {PageLayoutState} pageState
 * @returns {LayoutPreset}
 */
function getCurrentPreset(pageState) {
  const presets = getPresetsForCount(pageState.imageIds.length);
  return presets[pageState.currentPresetIndex % presets.length];
}

/**
 * Updates image IDs and resets preset index if count changes.
 * @param {PageLayoutState} pageState
 * @param {string[]} newImageIds
 * @returns {PageLayoutState}
 */
function updatePageImages(pageState, newImageIds) {
  const countChanged = newImageIds.length !== pageState.imageIds.length;
  return {
    imageIds: [...newImageIds],
    currentPresetIndex: countChanged ? 0 : pageState.currentPresetIndex,
  };
}

// ============================================================================
// ORIENTATION MATCHING
// ============================================================================

/**
 * Determines the orientation of an image based on aspect ratio.
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {'portrait'|'landscape'|'square'}
 */
function getImageOrientation(width, height) {
  const ratio = width / height;
  if (ratio > 1.15) return 'landscape';
  if (ratio < 0.85) return 'portrait';
  return 'square';
}

/**
 * Infers the preferred orientation for a slot based on its dimensions.
 * @param {Slot} slot - The slot to analyze
 * @returns {'portrait'|'landscape'|'square'}
 */
function inferSlotRatio(slot) {
  if (slot.preferredRatio && slot.preferredRatio !== 'any') {
    return slot.preferredRatio;
  }
  const ratio = slot.w / slot.h;
  if (ratio > 1.15) return 'landscape';
  if (ratio < 0.85) return 'portrait';
  return 'square';
}

/**
 * Checks if an image orientation matches a slot's preferred orientation.
 * Square slots/images are considered compatible with anything.
 * @param {'portrait'|'landscape'|'square'} imageOrientation
 * @param {'portrait'|'landscape'|'square'} slotRatio
 * @returns {boolean}
 */
function orientationMatches(imageOrientation, slotRatio) {
  if (imageOrientation === 'square' || slotRatio === 'square') return true;
  return imageOrientation === slotRatio;
}

/**
 * Scores how well a preset matches a set of images based on orientation.
 * Higher score = better match. Score is count of matching slots.
 * @param {LayoutPreset} preset - The preset to score
 * @param {Array<{width: number, height: number}>} images - Images with dimensions
 * @returns {{score: number, total: number, matches: boolean[]}}
 */
function scorePresetMatch(preset, images) {
  if (images.length !== preset.imageCount) {
    return { score: 0, total: preset.imageCount, matches: [] };
  }

  const sortedSlots = [...preset.slots].sort((a, b) => b.priority - a.priority);
  const matches = images.map((img, idx) => {
    const slot = sortedSlots[idx];
    if (!slot) return false;
    const imgOrientation = getImageOrientation(img.width, img.height);
    const slotRatio = inferSlotRatio(slot);
    return orientationMatches(imgOrientation, slotRatio);
  });

  const score = matches.filter(Boolean).length;
  return { score, total: images.length, matches };
}

/**
 * Gets presets for a count, optionally sorted by match score.
 * @param {number} imageCount - Number of images
 * @param {Array<{width: number, height: number}>} [images] - Optional images to sort by match score
 * @returns {LayoutPreset[]}
 */
function getPresetsForCountSorted(imageCount, images) {
  const presets = getPresetsForCount(imageCount);
  
  if (!images || images.length === 0 || images.length !== imageCount) {
    return presets;
  }

  return [...presets].sort((a, b) => {
    const scoreA = scorePresetMatch(a, images).score;
    const scoreB = scorePresetMatch(b, images).score;
    return scoreB - scoreA;
  });
}

// ============================================================================
// PRESET TRANSFORMATIONS
// ============================================================================

/**
 * Creates a horizontally mirrored copy of a preset.
 * Flips all slot X coordinates across the vertical axis.
 * @param {LayoutPreset} preset - The preset to mirror
 * @returns {LayoutPreset} A new preset with mirrored slots
 */
function mirrorPreset(preset) {
  const isSpread = preset.pageType === 'spread';
  const width = isSpread ? 2.0 : 1.0;
  return {
    ...preset,
    id: `${preset.id}-M`,
    slots: preset.slots.map(slot => ({
      ...slot,
      x: width - (slot.x + slot.w),
    })),
  };
}

// ============================================================================
// SPREAD-MODE FUNCTIONS
// ============================================================================

/**
 * Checks if a spread-mode slot crosses the gutter zone.
 * @param {Slot} slot - The slot to check (with x in 0-2 range)
 * @returns {boolean}
 */
function isSlotInGutter(slot) {
  const slotLeft = slot.x;
  const slotRight = slot.x + slot.w;
  return slotLeft < GUTTER_END && slotRight > GUTTER_START;
}

/**
 * Gets spread presets for a given image count.
 * Falls back to generic spread grid if no presets exist.
 * @param {number} imageCount
 * @returns {LayoutPreset[]}
 */
function getSpreadPresetsForCount(imageCount) {
  return [
    { id: `DYNAMIC-S-${imageCount}-0`, label: 'Dynamic (Balanced)', imageCount, pageType: 'spread', style: 'clean', slots: [] },
    { id: `DYNAMIC-S-${imageCount}-1`, label: 'Dynamic (Sequential)', imageCount, pageType: 'spread', style: 'clean', slots: [] },
    { id: `DYNAMIC-S-${imageCount}-2`, label: 'Dynamic (Interleaved)', imageCount, pageType: 'spread', style: 'clean', slots: [] },
    { id: `DYNAMIC-S-${imageCount}-3`, label: 'Dynamic (H-Bias)', imageCount, pageType: 'spread', style: 'clean', slots: [] },
    { id: `DYNAMIC-S-${imageCount}-4`, label: 'Dynamic (V-Bias)', imageCount, pageType: 'spread', style: 'clean', slots: [] },
  ];
}

/**
 * Generates a generic grid layout for N images spanning a spread.
 * @param {number} n - Number of images
 * @returns {LayoutPreset}
 */
function generateGenericSpreadGrid(n) {
  const cols = Math.ceil(Math.sqrt(n * 2));
  const rows = Math.ceil(n / cols);
  const slots = [];

  const cellW = (2 - GAP * (cols + 1)) / cols;
  const cellH = (1 - GAP * (rows + 1)) / rows;

  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    slots.push({
      x: GAP + col * (cellW + GAP),
      y: GAP + row * (cellH + GAP),
      w: cellW,
      h: cellH,
      priority: n - i,
    });
  }

  return {
    id: `SPREAD-GRID-${n}`,
    imageCount: n,
    pageType: 'spread',
    slots,
  };
}

/**
 * Computes the spread margin box spanning both pages.
 * @param {Object} margins - {top, bottom, inner, outer} in physical units
 * @param {number} spreadWidthPx - Full spread width in pixels (2 pages)
 * @param {number} spreadHeightPx - Spread height in pixels
 * @param {string} unit - 'in' or 'cm'
 * @param {number} dpi - Dots per inch
 * @returns {{left: number, top: number, width: number, height: number}}
 */
function computeSpreadMarginBox(margins, spreadWidthPx, spreadHeightPx, unit, dpi) {
  const topPx = toPixels(margins.top, unit, dpi);
  const bottomPx = toPixels(margins.bottom, unit, dpi);
  const outerPx = toPixels(margins.outer, unit, dpi);

  return {
    left: outerPx,
    top: topPx,
    width: spreadWidthPx - (outerPx * 2),
    height: spreadHeightPx - topPx - bottomPx,
  };
}

/**
 * Applies a spread preset and computes final image positions.
 * @param {Object} params
 * @param {PageLayoutState} params.spreadState - Layout state for the spread
 * @param {Object[]} params.images - Array of image objects with {id, path, width, height}
 * @param {Object} params.margins - Spread margins
 * @param {number} params.spreadWidthPx - Full spread width in pixels
 * @param {number} params.spreadHeightPx - Spread height in pixels
 * @param {string} params.unit - 'in' or 'cm'
 * @param {number} params.dpi - Dots per inch
 * @param {LayoutPreset} [params.overridePreset] - Optional preset to use instead of looking up
 * @returns {Array<{imageId: string, imagePath: string, slotRect: {x, y, w, h}, imageRect: Object, slot: Slot, crossesGutter: boolean}>}
 */
function applyPresetToSpread({
  spreadState,
  images,
  margins,
  spreadWidthPx,
  spreadHeightPx,
  unit,
  dpi,
}) {
  const imageCount = spreadState.imageIds.length;
  if (imageCount === 0) {
    return [];
  }

  const imageMap = new Map(images.map(img => [img.id, img]));
  const pageWidthPx = spreadWidthPx / 2;
  const pageHeightPx = spreadHeightPx;
  const rightPageStartX = pageWidthPx;

  // Determine assignment and splitting strategies from cycling index
  const presets = getSpreadPresetsForCount(imageCount);
  const variant = spreadState.currentPresetIndex % presets.length;
  
  // variant 0: Balanced assignment, Auto split
  // variant 1: Sequential assignment, Auto split
  // variant 2: Interleaved assignment, Auto split
  // variant 3: Balanced assignment, H-Bias split
  // variant 4: Balanced assignment, V-Bias split
  
  const pageImages = spreadState.imageIds.map(id => imageMap.get(id)).filter(Boolean);
  const imageRatios = pageImages.map(img => (img.width / img.height) || 1);
  const indices = spreadState.imageIds.map((_, i) => i);
  
  let leftIndices, rightIndices;
  let strategy = 0; // Auto split by default

  if (imageCount === 1) {
    leftIndices = [0];
    rightIndices = [];
  } else {
    // Page Assignment logic
    if (variant === 1) {
      // Sequential: First half left, rest right
      const mid = Math.ceil(imageCount / 2);
      leftIndices = indices.slice(0, mid);
      rightIndices = indices.slice(mid);
    } else if (variant === 2) {
      // Interleaved: even indices left, odd indices right
      leftIndices = indices.filter(i => i % 2 === 0);
      rightIndices = indices.filter(i => i % 2 !== 0);
    } else {
      // Balanced (Default for variant 0, 3, 4)
      const [groupA, groupB] = splitIntoTwo(indices, imageRatios);
      leftIndices = groupA;
      rightIndices = groupB;
      
      // Map splitting strategy
      if (variant === 3) strategy = 1; // H-Bias
      if (variant === 4) strategy = 2; // V-Bias
    }
  }

  const leftIds = leftIndices.map(i => spreadState.imageIds[i]);
  const rightIds = rightIndices.map(i => spreadState.imageIds[i]);

  const marginBoxL = computeMarginBox(margins, pageWidthPx, pageHeightPx, unit, dpi, true);
  const marginBoxR = computeMarginBox(margins, pageWidthPx, pageHeightPx, unit, dpi, false);
  
  // Offset marginBoxR to absolute spread space
  marginBoxR.left += rightPageStartX;

  const slotRectsL = computeSlotRectangles({
    imageIds: leftIds,
    preset: { id: `DYNAMIC-L-${leftIds.length}-${strategy}`, pageType: 'single', slots: [] },
    marginBox: marginBoxL,
    images,
  });

  const slotRectsR = computeSlotRectangles({
    imageIds: rightIds,
    preset: { id: `DYNAMIC-R-${rightIds.length}-${strategy}`, pageType: 'single', slots: [] },
    marginBox: marginBoxR,
    images,
  });

  const allSlotRects = [...slotRectsL, ...slotRectsR];

  return allSlotRects.map(({ imageId, x, y, w, h, visible, slot }) => {
    const image = imageMap.get(imageId);
    if (!visible || !image) return null;

    const imgW = image.width || 1000;
    const imgH = image.height || 1000;
    
    const mode = slot?.mode || 'fill';
    const imageRect = mode === 'fill'
      ? fillImageInSlot(imgW, imgH, w, h)
      : fitImageInSlot(imgW, imgH, w, h);

    return {
      imageId,
      imagePath: image.path,
      slotRect: { x, y, w, h },
      imageRect,
      slot,
      crossesGutter: false, // In this mode, images never cross the gutter
    };
  }).filter(Boolean);
}

/**
 * Shuffles image IDs while respecting locked slot positions.
 * Uses Fisher-Yates algorithm on unlocked positions only.
 * @param {string[]} imageIds - Array of image IDs to shuffle
 * @param {Set<number>} lockedIndices - Set of slot indices that should not move
 * @returns {string[]} New array with shuffled unlocked images
 */
function shuffleImagesInPreset(imageIds, lockedIndices = new Set()) {
  const result = [...imageIds];
  
  // Collect unlocked indices and their values
  const unlockedIndices = [];
  const unlockedValues = [];
  
  for (let i = 0; i < result.length; i++) {
    if (!lockedIndices.has(i)) {
      unlockedIndices.push(i);
      unlockedValues.push(result[i]);
    }
  }
  
  // Fisher-Yates shuffle on unlocked values
  for (let i = unlockedValues.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unlockedValues[i], unlockedValues[j]] = [unlockedValues[j], unlockedValues[i]];
  }
  
  // Put shuffled values back into unlocked positions
  for (let i = 0; i < unlockedIndices.length; i++) {
    result[unlockedIndices[i]] = unlockedValues[i];
  }
  
  return result;
}

// ============================================================================
// RECURSIVE PARTITION ENGINE (DYNAMIC LAYOUTS)
// ============================================================================

/**
 * Generates a dynamic LayoutPreset using recursive binary partitioning.
 * @param {Object[]} images - Array of image objects with {id, width, height}
 * @param {boolean} isSpread - Whether this is a spread-mode layout
 * @returns {LayoutPreset}
 */
export function generateDynamicPreset(images = [], isSpread = false, options = {}) {
  const n = images.length;
  if (n === 0) return isSpread ? generateGenericSpreadGrid(0) : generateGenericGrid(0);

  const strategy = options.strategy || 0;
  const ratios = images.map(img => (img.width / img.height) || 1);
  const indices = images.map((_, i) => i);
  const gap = GAP; // Normalized gap (0.02)

  // Target rectangle in normalized coordinates
  // For spreads, we partition in a 2x1 space
  const rect = { x: 0, y: 0, w: isSpread ? 2 : 1, h: 1 };
  
  // Use a large scale for partitioning to avoid precision issues
  const scale = 2000;
  const pixelRect = { x: rect.x * scale, y: rect.y * scale, w: rect.w * scale, h: rect.h * scale };
  const pixelGap = gap * scale;

  const rawSlots = partition(indices, pixelRect, ratios, pixelGap, strategy);

  const slots = rawSlots.map(({ imageIndex, rect: r }) => ({
    id: `dyn-${imageIndex}`,
    x: r.x / scale,
    y: r.y / scale,
    w: r.w / scale,
    h: r.h / scale,
    priority: n - imageIndex,
    preferredRatio: getImageOrientation(images[imageIndex]?.width || 1, images[imageIndex]?.height || 1),
    mode: 'fill'
  }));

  return {
    id: `DYNAMIC-${isSpread ? 'S' : 'P'}-${n}-${strategy}`,
    label: strategy === 0 ? 'Dynamic (Auto)' : (strategy === 1 ? 'Dynamic (Horizontal)' : 'Dynamic (Vertical)'),
    imageCount: n,
    pageType: isSpread ? 'spread' : 'single',
    slots,
  };
}

/**
 * Recursive binary partition algorithm.
 */
function partition(indices, rect, ratios, gap, strategy = 0) {
  if (indices.length === 0) return [];
  if (indices.length === 1) {
    return [{ imageIndex: indices[0], rect }];
  }

  const [groupA, groupB] = splitIntoTwo(indices, ratios);

  // Split direction decision
  let splitHorizontal;
  if (strategy === 1) {
    splitHorizontal = true;
  } else if (strategy === 2) {
    splitHorizontal = false;
  } else {
    splitHorizontal = rect.w >= rect.h;
  }

  if (splitHorizontal) {
    // Left/Right split
    // Weight by sum of aspect ratios (total horizontal "desire")
    const sumA = groupA.reduce((s, i) => s + ratios[i], 0);
    const sumB = groupB.reduce((s, i) => s + ratios[i], 0);
    let ratio = sumA / (sumA + sumB);
    ratio = Math.max(0.25, Math.min(0.75, ratio));

    const w1 = Math.round((rect.w - gap) * ratio);
    const w2 = rect.w - gap - w1;
    const rectA = { x: rect.x, y: rect.y, w: w1, h: rect.h };
    const rectB = { x: rect.x + w1 + gap, y: rect.y, w: w2, h: rect.h };
    return [
      ...partition(groupA, rectA, ratios, gap, strategy),
      ...partition(groupB, rectB, ratios, gap, strategy),
    ];
  } else {
    // Top/Bottom split
    // Weight by sum of inverse ratios (total vertical "desire")
    const sumA = groupA.reduce((s, i) => s + (1 / ratios[i]), 0);
    const sumB = groupB.reduce((s, i) => s + (1 / ratios[i]), 0);
    let ratio = sumA / (sumA + sumB);
    ratio = Math.max(0.25, Math.min(0.75, ratio));

    const h1 = Math.round((rect.h - gap) * ratio);
    const h2 = rect.h - gap - h1;
    const rectA = { x: rect.x, y: rect.y, w: rect.w, h: h1 };
    const rectB = { x: rect.x, y: rect.y + h1 + gap, w: rect.w, h: h2 };
    return [
      ...partition(groupA, rectA, ratios, gap, strategy),
      ...partition(groupB, rectB, ratios, gap, strategy),
    ];
  }
}

function splitIntoTwo(indices, ratios) {
  if (indices.length === 2) return [[indices[0]], [indices[1]]];

  const sorted = [...indices].sort((a, b) => ratios[a] - ratios[b]);
  let bestScore = Infinity;
  let bestSplit = 1;

  for (let s = 1; s < sorted.length; s++) {
    const g1 = sorted.slice(0, s);
    const g2 = sorted.slice(s);
    const score = groupVariance(g1, ratios) + groupVariance(g2, ratios);
    if (score < bestScore) {
      bestScore = score;
      bestSplit = s;
    }
  }
  return [sorted.slice(0, bestSplit), sorted.slice(bestSplit)];
}

function groupVariance(indices, ratios) {
  if (indices.length <= 1) return 0;
  const vals = indices.map(i => ratios[i]);
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  return vals.reduce((s, v) => s + (v - mean) ** 2, 0);
}

/**
 * Loads presets from an external array (e.g. from presets.json) and replaces
 * the preset registries for the counts present in the data.
 * Presets are grouped by imageCount and pageType. Invalid presets are skipped.
 * @param {LayoutPreset[]} presetArray - Array of preset objects
 * @returns {{ loaded: number, skipped: number, errors: string[] }}
 */
function loadPresetsFromData(presetArray) {
  const result = { loaded: 0, skipped: 0, errors: [] };
  if (!presetArray || !Array.isArray(presetArray) || presetArray.length === 0) {
    return result;
  }

  // Clear existing registries to ensure we only use loaded data
  presetsByCount.clear();
  spreadPresetsByCount.clear();

  for (const preset of presetArray) {
    const validation = validatePreset(preset);
    if (!validation.valid) {
      result.skipped += 1;
      result.errors.push(`${preset.id || 'unknown'}: ${validation.errors.join('; ')}`);
      continue;
    }

    const n = preset.imageCount;
    const isSpread = preset.pageType === 'spread';
    const targetMap = isSpread ? spreadPresetsByCount : presetsByCount;

    if (!targetMap.has(n)) {
      targetMap.set(n, []);
    }
    targetMap.get(n).push(preset);
    result.loaded += 1;
  }
  return result;
}

// Run validation in dev mode
if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
  const validation = validateAllPresets();
  if (!validation.valid) {
    console.error('Layout preset validation failed! Check console warnings.');
  } else {
    console.log('All layout presets validated successfully.');
  }
}
