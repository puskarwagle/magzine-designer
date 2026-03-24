import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { 
  spreadsStore, 
  currentSpreadIndexStore, 
  layoutModeStore, 
  activePageStore, 
  addImageToCurrentSpread,
  addSpread,
  removeSpread,
  destroySpread,
  updateSlotImage,
  isSpreadPopulated,
  activeSpreadLayout,
  archivedSpreadsStore,
  shuffleAllImages
} from '../spreads.js';
import { albumSettingsStore } from '../settings.js';
import { projectStore } from '../project.js';

describe('spreads store - basic operations', () => {
  beforeEach(() => {
    spreadsStore.set([{
      id: 1,
      type: 'spread',
      imageIds: [],
      currentPresetIndex: 0,
      useCustomMargins: false,
      margins: { top: 0.5, bottom: 0.5, inner: 0.5, outer: 0.5 }
    }]);
    currentSpreadIndexStore.set(0);
    layoutModeStore.set('single');
    activePageStore.set('left');
    archivedSpreadsStore.set([]);
  });

  it('addSpread correctly appends to the store', () => {
    addSpread('single');
    const spreads = get(spreadsStore);
    expect(spreads).toHaveLength(2);
    expect(spreads[1].type).toBe('single');
  });

  it('updateSlotImage updates image ID in the unified pool', () => {
    spreadsStore.update(s => {
      s[0].imageIds = ['img1', 'img2'];
      return s;
    });

    updateSlotImage(0, 'left', 'img2', 'img-new');
    
    const spreads = get(spreadsStore);
    expect(spreads[0].imageIds).toEqual(['img1', 'img-new']);
  });
});

describe('activeSpreadLayout derived store (View Lens)', () => {
  beforeEach(() => {
    albumSettingsStore.set({
      pageWidth: 10,
      pageHeight: 10,
      unit: 'in',
      dpi: 100,
      globalMargins: { top: 1, bottom: 1, inner: 1, outer: 1 }
    });
    projectStore.set({ images: [] });
    spreadsStore.set([{
      id: 1,
      type: 'spread',
      imageIds: ['img1', 'img2'],
      currentPresetIndex: 0,
      useCustomMargins: false,
      margins: { top: 0.5, bottom: 0.5, inner: 0.5, outer: 0.5 }
    }]);
    currentSpreadIndexStore.set(0);
    layoutModeStore.set('single');
    activePageStore.set('left');
  });

  it('totalSpreadWidthPx matches pageWidthPx in single mode', () => {
    const layout = get(activeSpreadLayout);
    expect(layout.pageWidthPx).toBe(1000);
    expect(layout.totalSpreadWidthPx).toBe(1000);
  });

  it('provides both left and right slots even in single mode', () => {
    const layout = get(activeSpreadLayout);
    // Even in single mode, it splits all spread slots into left/right buckets
    expect(layout.leftPageSlots).toBeDefined();
    expect(layout.rightPageSlots).toBeDefined();
  });

  it('correctly shifts right-page slots in the derived store', () => {
      // Mock images to force a layout
      projectStore.set({ images: [{id: 'img1', path: ''}, {id: 'img2', path: ''}] });
      
      const layout = get(activeSpreadLayout);
      // If we assume a layout that puts 'img2' on the right page:
      if (layout.rightPageSlots.length > 0) {
          const firstRightSlot = layout.rightPageSlots[0];
          // Its x should be small (relative to right page origin)
          expect(firstRightSlot.slotRect.x).toBeLessThan(layout.pageWidthPx);
      }
  });

  it('toggles activePage correctly for spreads', () => {
    activePageStore.set('right');
    const layout = get(activeSpreadLayout);
    expect(layout.activePage).toBe('right');
  });

  it('forces activePage to left for single entries (covers)', () => {
    spreadsStore.update(s => {
      s[0].type = 'single';
      return s;
    });
    activePageStore.set('right');
    const layout = get(activeSpreadLayout);
    expect(layout.activePage).toBe('left');
  });
});

describe('spreads store - shuffleAllImages', () => {
  beforeEach(() => {
    spreadsStore.set([
      {
        id: 1,
        type: 'spread',
        imageIds: ['img1', 'img2', 'img3'],
        currentPresetIndex: 0
      },
      {
        id: 2,
        type: 'single',
        imageIds: ['img4', 'img5'],
        currentPresetIndex: 0
      }
    ]);
  });

  it('shuffles images while preserving counts in the unified pools', () => {
    const originalImageIds = ['img1', 'img2', 'img3', 'img4', 'img5'];
    shuffleAllImages();
    const spreads = get(spreadsStore);
    const allNewIds = spreads.flatMap(s => s.imageIds);
    expect(allNewIds).toHaveLength(5);
    expect(allNewIds.sort()).toEqual(originalImageIds.sort());
    expect(spreads[0].imageIds).toHaveLength(3);
  });
});


