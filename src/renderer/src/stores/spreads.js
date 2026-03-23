import { writable, derived } from 'svelte/store';
import { albumSettingsStore } from './settings.js';
import { projectStore } from './project.js';
import { LayoutEngine } from '../lib/layoutEngine.js';
import { toPixels } from '../lib/utils.js';

export const spreadsStore = writable([
  {
    id: 1,
    leftPage: { imageIds: ['1', '2'], currentPresetIndex: 0 },
    rightPage: { imageIds: ['3'], currentPresetIndex: 0 },
    spreadPage: { imageIds: ['1', '2', '3'], currentPresetIndex: 0 },
    useCustomMargins: false,
    margins: { top: 0.5, bottom: 0.5, inner: 0.5, outer: 0.5 }
  }
]);

export const currentSpreadIndexStore = writable(0);
export const activePageStore = writable('left'); // 'left' or 'right'
export const layoutModeStore = writable('spread'); // 'single' (per-page) or 'spread' (cross-gutter)

export const lockedSlotsStore = writable(new Map());

/**
 * Updates an image in a specific slot within the current spread.
 * @param {number} spreadIndex - Index of the spread
 * @param {'left'|'right'|'spread'} pageType - Which page/mode to update
 * @param {string} oldImageId - The image ID currently in the slot
 * @param {string} newImageId - The new image ID to place in the slot
 */
export function updateSlotImage(spreadIndex, pageType, oldImageId, newImageId) {
  spreadsStore.update($spreads => {
    const spread = { ...$spreads[spreadIndex] };
    if (!spread) return $spreads;

    const updatePage = (pageState) => {
      const index = pageState.imageIds.indexOf(oldImageId);
      if (index !== -1) {
        const newIds = [...pageState.imageIds];
        newIds[index] = newImageId;
        return { ...pageState, imageIds: newIds };
      }
      return pageState;
    };

    if (pageType === 'left') spread.leftPage = updatePage(spread.leftPage);
    else if (pageType === 'right') spread.rightPage = updatePage(spread.rightPage);
    else if (pageType === 'spread') spread.spreadPage = updatePage(spread.spreadPage);

    const newSpreads = [...$spreads];
    newSpreads[spreadIndex] = spread;
    return newSpreads;
  });
}

/**
 * Derived store that computes the layout data for the currently active spread.
 * This centralizes the calculation logic previously held in Spread.svelte and Page.svelte.
 */
export const activeSpreadLayout = derived(
  [spreadsStore, currentSpreadIndexStore, albumSettingsStore, projectStore, layoutModeStore],
  ([$spreads, $currentIndex, $settings, $project, $layoutMode]) => {
    // Initial default layout data to prevent NaN and undefined errors
    let layoutData = {
      isCover: false,
      layoutMode: $layoutMode || 'spread',
      spineWidthPx: 10,
      totalSpreadWidthPx: 1000,
      pageWidthPx: 500,
      pageHeightPx: 500,
      spreadHeightPx: 500,
      margins: { top: 0, bottom: 0, inner: 0, outer: 0 },
      slots: [],
      leftPageSlots: [],
      rightPageSlots: [],
      loading: false,
      error: false,
      message: ''
    };

    try {
      // Guard: Ensure LayoutEngine is ready and stores are valid
      if (!LayoutEngine || typeof LayoutEngine.applyPresetToSpread !== 'function') {
        console.warn('activeSpreadLayout: LayoutEngine not ready');
        return { ...layoutData, loading: true };
      }

      if (!$spreads || $spreads.length === 0) {
        return { ...layoutData, error: true, message: 'No spreads available.' };
      }

      const spread = $spreads[$currentIndex];
      if (!spread) {
        return { ...layoutData, error: true, message: `Spread at index ${$currentIndex} does not exist.` };
      }

      // Ensure settings have valid dimensions to avoid NaN
      const pageWidth = $settings.pageWidth || 12;
      const pageHeight = $settings.pageHeight || 12;
      const unit = $settings.unit || 'in';
      const dpi = $settings.dpi || 300;

      const isCover = $settings.includeCover && $currentIndex === 0;
      const margins = spread.useCustomMargins ? (spread.margins || $settings.globalMargins) : $settings.globalMargins;
      
      // Spine width - hardcoded default for now
      const spineWidthPx = isCover ? 0 : 10;

      // Page-level dimensions
      const pageWidthPx = toPixels(pageWidth, unit, dpi);
      const pageHeightPx = toPixels(pageHeight, unit, dpi);

      // Spread-level dimensions (2 pages + spine)
      const totalSpreadWidthPx = (pageWidthPx * 2) + spineWidthPx;
      const spreadHeightPx = pageHeightPx;

      layoutData = {
        ...layoutData,
        isCover,
        layoutMode: $layoutMode,
        spineWidthPx,
        totalSpreadWidthPx,
        pageWidthPx,
        pageHeightPx,
        spreadHeightPx,
        margins
      };

      if ($layoutMode === 'spread' || (isCover && $settings.includeCover)) {
        layoutData.slots = LayoutEngine.applyPresetToSpread({
          spreadState: spread.spreadPage,
          images: $project.images || [],
          margins: margins,
          spreadWidthPx: totalSpreadWidthPx,
          spreadHeightPx,
          unit: unit,
          dpi: dpi
        });
      } else {
        layoutData.leftPageSlots = LayoutEngine.applyPresetToPage({
          pageState: spread.leftPage,
          images: $project.images || [],
          margins: margins,
          pageWidthPx,
          pageHeightPx,
          unit: unit,
          dpi: dpi,
          isLeftPage: true
        });

        layoutData.rightPageSlots = LayoutEngine.applyPresetToPage({
          pageState: spread.rightPage,
          images: $project.images || [],
          margins: margins,
          pageWidthPx,
          pageHeightPx,
          unit: unit,
          dpi: dpi,
          isLeftPage: false
        });
      }

      return layoutData;
    } catch (e) {
      console.error('CRITICAL Error in activeSpreadLayout derived store:', e);
      return { ...layoutData, error: true, message: e.message };
    }
  }
);
