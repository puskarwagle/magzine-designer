import { writable, derived, get } from 'svelte/store';
import { albumSettingsStore } from './settings.js';
import { projectStore } from './project.js';
import { LayoutEngine } from '../lib/layoutEngine.js';
import { toPixels } from '../lib/utils.js';

function createDefaultSpread(type = 'spread') {
  return {
    id: Date.now() + Math.random(),
    type: type, // 'single' or 'spread'
    imageIds: [],
    currentPresetIndex: 0,
    useCustomMargins: false,
    margins: { top: 0.5, bottom: 0.5, inner: 0.5, outer: 0.5 }
  };
}

// The core store holding all active spreads/pages in the album
export const spreadsStore = writable([createDefaultSpread('spread')]);

// Store for removed but preserved spreads (soft delete)
export const archivedSpreadsStore = writable([]);

export const currentSpreadIndexStore = writable(0);
export const activePageStore = writable('left'); // 'left' or 'right'
export const layoutModeStore = writable('spread'); // 'single' (per-page) or 'spread' (cross-gutter)

export const lockedSlotsStore = writable(new Map());
export const selectedSlotIdStore = writable(null);

/**
 * Derived store that tracks all unique image IDs currently used in any spread or page.
 */
export const usedImageIdsStore = derived(spreadsStore, ($spreads) => {
  const ids = new Set();
  if (!$spreads) return ids;
  
  $spreads.forEach(spread => {
    if (spread.imageIds) {
      spread.imageIds.forEach(id => ids.add(id));
    }
  });
  return ids;
});

/**
 * Checks if a spread has any images placed on it.
 */
export function isSpreadPopulated(spread) {
  if (!spread) return false;
  return spread.imageIds.length > 0;
}

/**
 * Adds a new spread or single page to the album.
 */
export function addSpread(type = 'spread') {
  spreadsStore.update(s => {
    // Logic: 2 pages make 1 spread. 
    // If adding a 'single' page and the last entry is also a 'single' page, 
    // we just "complete" the last spread instead of adding a new entry.
    if (type === 'single' && s.length > 0) {
      const last = s[s.length - 1];
      if (last.type === 'single') {
        const updated = [...s];
        updated[updated.length - 1] = { ...last, type: 'spread' };
        return updated;
      }
    }
    return [...s, createDefaultSpread(type)];
  });
  const currentSpreads = get(spreadsStore);
  currentSpreadIndexStore.set(currentSpreads.length - 1);
}

/**
 * Moves a spread to the archive (soft delete).
 */
export function removeSpread(index) {
  const spreads = get(spreadsStore);
  const spreadToRemove = spreads[index];
  if (!spreadToRemove) return;

  archivedSpreadsStore.update(a => [...a, spreadToRemove]);
  
  spreadsStore.update(s => s.filter((_, i) => i !== index));

  // Adjust index
  const newCount = spreads.length - 1;
  if (newCount === 0) {
    spreadsStore.set([createDefaultSpread()]);
    currentSpreadIndexStore.set(0);
  } else {
    currentSpreadIndexStore.update(i => Math.min(newCount - 1, i));
  }
}

/**
 * Permanently deletes a spread.
 */
export function destroySpread(index) {
  const spreads = get(spreadsStore);
  if (index < 0 || index >= spreads.length) return;

  spreadsStore.update(s => s.filter((_, i) => i !== index));

  // Adjust index
  const newCount = spreads.length - 1;
  if (newCount === 0) {
    spreadsStore.set([createDefaultSpread()]);
    currentSpreadIndexStore.set(0);
  } else {
    currentSpreadIndexStore.update(i => Math.min(newCount - 1, i));
  }
}

/**
 * Updates an image in a specific slot within the current spread.
 */
export function updateSlotImage(spreadIndex, pageType, oldImageId, newImageId) {
  spreadsStore.update($spreads => {
    const spreads = [...$spreads];
    const spread = { ...spreads[spreadIndex] };
    if (!spread) return $spreads;

    const index = spread.imageIds.indexOf(oldImageId);
    if (index !== -1) {
      const newIds = [...spread.imageIds];
      newIds[index] = newImageId;
      spread.imageIds = newIds;
    }

    spreads[spreadIndex] = spread;
    return spreads;
  });
}

/**
 * Updates the custom geometry (x, y, w, h in 0-1) for a slot.
 */
export function updateSlotGeometry(spreadIndex, pageType, imageId, newGeo) {
  console.warn('updateSlotGeometry not fully implemented for unified spread yet');
  // For now, we ignore the custom geometry for the sake of finishing the lens approach.
  // In a real app, we'd store these in a spread-level customSlots bucket.
}

/**
 * Updates the custom geometry using pixel coordinates.
 */
export function updateSlotGeometryInPixels(spreadIndex, pageType, isLeftPage, imageId, pixelGeo) {
  const layouts = get(activeSpreadLayout);
  const settings = get(albumSettingsStore);
  
  const unit = settings.unit || 'in';
  const dpi = Number(settings.dpi) || 300;
  
  let normGeo = { x: 0, y: 0, w: 0, h: 0 };

  if (layouts.layoutMode === 'spread' && pageType === 'spread') {
    const marginBox = LayoutEngine.computeSpreadMarginBox(layouts.margins, layouts.totalSpreadWidthPx, layouts.spreadHeightPx, unit, dpi);
    const halfW = marginBox.width / 2;
    
    // Convert current pixelGeo (relative to page) to absolute spread coordinates
    const rightPageStartX = layouts.pageWidthPx + (layouts.spineWidthPx || 0);
    const absoluteX = isLeftPage ? pixelGeo.x : pixelGeo.x + rightPageStartX;
    
    normGeo.x = (absoluteX - marginBox.left) / halfW;
    normGeo.y = (pixelGeo.y - marginBox.top) / marginBox.height;
    normGeo.w = pixelGeo.w / halfW;
    normGeo.h = pixelGeo.h / marginBox.height;
  } else {
    const marginBox = LayoutEngine.computeMarginBox(layouts.margins, layouts.pageWidthPx, layouts.pageHeightPx, unit, dpi, isLeftPage);
    normGeo.x = (pixelGeo.x - marginBox.left) / marginBox.width;
    normGeo.y = (pixelGeo.y - marginBox.top) / marginBox.height;
    normGeo.w = pixelGeo.w / marginBox.width;
    normGeo.h = pixelGeo.h / marginBox.height;
  }

  updateSlotGeometry(spreadIndex, pageType, imageId, normGeo);
}

/**
 * Adds an image to the current spread/page.
 */
export function addImageToCurrentSpread(imageId) {
  const spreadIndex = get(currentSpreadIndexStore);
  
  spreadsStore.update($spreads => {
    const spreads = [...$spreads];
    const spread = { ...spreads[spreadIndex] };
    if (!spread) return $spreads;

    // Avoid duplicate image IDs in the same spread pool
    if (spread.imageIds.includes(imageId)) return $spreads;

    spread.imageIds = [...spread.imageIds, imageId];

    spreads[spreadIndex] = spread;
    return spreads;
  });
}

/**
 * Shuffles images ONLY within the current spread.
 */
export function shuffleCurrentSpread() {
  const currentIndex = get(currentSpreadIndexStore);
  spreadsStore.update($spreads => {
    const spreads = [...$spreads];
    const spread = { ...spreads[currentIndex] };
    if (!spread || spread.imageIds.length <= 1) return $spreads;

    // In-place shuffle of the spread's image pool
    const newIds = [...spread.imageIds];
    for (let i = newIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newIds[i], newIds[j]] = [newIds[j], newIds[i]];
    }

    spread.imageIds = newIds;
    spreads[currentIndex] = spread;
    return spreads;
  });
}

/**
 * Shuffles all images across all spreads in the album.
 * Maintains the original number of images in each page/spread location.
 */
export function shuffleAllImages() {
  spreadsStore.update($spreads => {
    let allImages = [];
    const spreadStructures = [];

    // 1. Collect all images and remember where they came from
    $spreads.forEach(spread => {
      allImages.push(...spread.imageIds);
      spreadStructures.push({
        origCount: spread.imageIds.length
      });
    });

    if (allImages.length <= 1) return $spreads;

    // 2. Shuffle
    for (let i = allImages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allImages[i], allImages[j]] = [allImages[j], allImages[i]];
    }

    // 3. Redistribute
    let offset = 0;
    return $spreads.map((spread, i) => {
      const count = spreadStructures[i].origCount;
      const newIds = allImages.slice(offset, offset + count);
      offset += count;

      return {
        ...spread,
        imageIds: newIds
      };
    });
  });
}

import { layoutConfigStore } from './ui.js';

/**
 * Derived store that computes the layout data for the currently active spread/page.
 */
export const activeSpreadLayout = derived(
  [spreadsStore, currentSpreadIndexStore, albumSettingsStore, projectStore, layoutModeStore, activePageStore, layoutConfigStore],
  ([$spreads, $currentIndex, $settings, $project, $layoutMode, $activePage, $layoutConfig]) => {
    let layoutData = {
      type: 'spread',
      layoutMode: $layoutMode || 'spread',
      spineWidthPx: 10,
      totalSpreadWidthPx: 1000,
      pageWidthPx: 500,
      pageHeightPx: 500,
      spreadHeightPx: 500,
      margins: { top: 0, bottom: 0, inner: 0, outer: 0 },
      leftPageMarginBox: { left: 0, top: 0, width: 0, height: 0 },
      rightPageMarginBox: { left: 0, top: 0, width: 0, height: 0 },
      slots: [],
      leftPageSlots: [],
      rightPageSlots: [],
      loading: false,
      error: false,
      message: ''
    };

    try {
      if (!$spreads || $spreads.length === 0) {
        return { ...layoutData, error: true, message: 'No spreads available.' };
      }

      const spread = $spreads[$currentIndex];
      if (!spread) {
        return { ...layoutData, error: true, message: `Spread at index ${$currentIndex} does not exist.` };
      }

      const safeNum = (v, defaultVal = 0) => {
        const num = Number(v);
        return isNaN(num) ? defaultVal : num;
      };

      const pageWidth = safeNum($settings.pageWidth, 12);
      const pageHeight = safeNum($settings.pageHeight, 12);
      const unit = $settings.unit || 'in';
      const dpi = safeNum($settings.dpi, 300);

      const margins = spread.useCustomMargins ? (spread.margins || $settings.globalMargins) : $settings.globalMargins;
      
      const pageWidthPx = safeNum(toPixels(pageWidth, unit, dpi), 500);
      const pageHeightPx = safeNum(toPixels(pageHeight, unit, dpi), 500);
      const spreadHeightPx = pageHeightPx;

      // Handle Single Page vs Spread Entry
      const isEntrySingle = spread.type === 'single';
      const isModeSingle = $layoutMode === 'single';
      
      // If either the entry is single OR the global mode is single, we effectively render a single page
      const effectivelySingle = isEntrySingle || isModeSingle;

      // The physical spread is always 2 pages + spine, regardless of how we view it.
      const fullSpreadWidthPx = (pageWidthPx * 2) + 10;
      const spineWidthPx = isEntrySingle ? 0 : 10;
      const totalSpreadViewWidthPx = effectivelySingle ? pageWidthPx : (pageWidthPx * 2) + spineWidthPx;

      const outerPx = safeNum(toPixels(margins.outer, unit, dpi));
      const topPx = safeNum(toPixels(margins.top, unit, dpi));
      const innerPx = safeNum(toPixels(margins.inner, unit, dpi));
      const bottomPx = safeNum(toPixels(margins.bottom, unit, dpi));

      const leftPageMarginBox = {
        left: outerPx,
        top: topPx,
        width: pageWidthPx - outerPx - innerPx,
        height: pageHeightPx - topPx - bottomPx
      };
      const rightPageMarginBox = {
        left: innerPx,
        top: topPx,
        width: pageWidthPx - outerPx - innerPx,
        height: pageHeightPx - topPx - bottomPx
      };

      layoutData = {
        ...layoutData,
        type: spread.type,
        layoutMode: $layoutMode,
        activePage: isEntrySingle ? 'left' : $activePage, // Force left only for single-entry types (covers)
        spineWidthPx,
        totalSpreadWidthPx: totalSpreadViewWidthPx,
        pageWidthPx,
        pageHeightPx,
        spreadHeightPx,
        margins,
        leftPageMarginBox,
        rightPageMarginBox
      };

      const spreadState = {
        imageIds: spread.imageIds,
        currentPresetIndex: spread.currentPresetIndex
      };

      if (isEntrySingle) {
        layoutData.slots = LayoutEngine.applyPresetToPage({
          pageState: spreadState,
          images: $project.images || [],
          margins: margins,
          pageWidthPx,
          pageHeightPx,
          unit: unit,
          dpi: dpi,
          isLeftPage: true,
          slotGapPx: $layoutConfig.slotGap
        });
        layoutData.leftPageSlots = layoutData.slots;
        layoutData.rightPageSlots = [];
      } else {
        // ALWAYS compute a full spread layout using the full spread width.
        // This ensures the layout is stable regardless of whether we are viewing a single page or the whole spread.
        layoutData.slots = LayoutEngine.applyPresetToSpread({
          spreadState,
          images: $project.images || [],
          margins: margins,
          spreadWidthPx: fullSpreadWidthPx,
          spreadHeightPx,
          unit: unit,
          dpi: dpi,
          slotGapPx: $layoutConfig.slotGap
        });

        // Split spread slots into left/right page slots for KonvaPage rendering
        const rightPageStartX = pageWidthPx + 10; // Use the same spine offset used for layout
        const leftSlots = [];
        const rightSlots = [];
        for (const slot of layoutData.slots) {
          const slotCenterX = slot.slotRect.x + slot.slotRect.w / 2;
          if (slotCenterX < rightPageStartX) {
            leftSlots.push(slot);
          } else {
            rightSlots.push({
              ...slot,
              slotRect: {
                ...slot.slotRect,
                x: slot.slotRect.x - rightPageStartX
              }
            });
          }
        }
        layoutData.leftPageSlots = leftSlots;
        layoutData.rightPageSlots = rightSlots;
      }

      // In effectivelySingle (Single Mode), 'slots' should reflect whichever page we are "looking" at.
      if (effectivelySingle) {
        layoutData.slots = (isEntrySingle || $activePage === 'left') ? layoutData.leftPageSlots : layoutData.rightPageSlots;
      }

      return layoutData;
    } catch (e) {
      console.error('CRITICAL Error in activeSpreadLayout derived store:', e);
      return { ...layoutData, error: true, message: e.message };
    }
  }
);

