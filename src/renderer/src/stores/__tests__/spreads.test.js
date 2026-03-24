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
      leftPage: { imageIds: [], currentPresetIndex: 0 },
      rightPage: { imageIds: [], currentPresetIndex: 0 },
      spreadPage: { imageIds: [], currentPresetIndex: 0 },
      useCustomMargins: false,
      margins: { top: 0.5, bottom: 0.5, inner: 0.5, outer: 0.5 }
    }]);
    currentSpreadIndexStore.set(0);
    layoutModeStore.set('single');
    activePageStore.set('left');
    archivedSpreadsStore.set([]);
  });

  it('addSpread adds a new spread and sets it as current', () => {
    addSpread('single');
    const spreads = get(spreadsStore);
    expect(spreads).toHaveLength(2);
    expect(spreads[1].type).toBe('single');
    expect(get(currentSpreadIndexStore)).toBe(1);
  });

  it('removeSpread moves it to archive and adjusts index', () => {
    addSpread('spread');
    expect(get(spreadsStore)).toHaveLength(2);
    
    removeSpread(0);
    expect(get(spreadsStore)).toHaveLength(1);
    expect(get(archivedSpreadsStore)).toHaveLength(1);
    expect(get(currentSpreadIndexStore)).toBe(0);
  });

  it('destroySpread permanently deletes and adjusts index', () => {
    addSpread('spread');
    destroySpread(0);
    expect(get(spreadsStore)).toHaveLength(1);
    expect(get(archivedSpreadsStore)).toHaveLength(0);
  });

  it('updateSlotImage updates image ID in a specific slot', () => {
    spreadsStore.update(s => {
      s[0].leftPage.imageIds = ['img1', 'img2'];
      return s;
    });

    updateSlotImage(0, 'left', 'img2', 'img-new');
    
    const spreads = get(spreadsStore);
    expect(spreads[0].leftPage.imageIds).toEqual(['img1', 'img-new']);
  });

  it('isSpreadPopulated correctly detects images', () => {
    const emptySpread = get(spreadsStore)[0];
    expect(isSpreadPopulated(emptySpread)).toBe(false);

    const populatedSpread = { ...emptySpread, leftPage: { imageIds: ['a'] } };
    expect(isSpreadPopulated(populatedSpread)).toBe(true);
  });
});

describe('spreads store - addImageToCurrentSpread', () => {
  beforeEach(() => {
    // Reset stores to default state
    spreadsStore.set([{
      id: 1,
      type: 'spread',
      leftPage: { imageIds: [], currentPresetIndex: 0 },
      rightPage: { imageIds: [], currentPresetIndex: 0 },
      spreadPage: { imageIds: [], currentPresetIndex: 0 },
      useCustomMargins: false,
      margins: { top: 0.5, bottom: 0.5, inner: 0.5, outer: 0.5 }
    }]);
    currentSpreadIndexStore.set(0);
    layoutModeStore.set('single');
    activePageStore.set('left');
  });

  it('adds an image to the left page in single mode', () => {
    addImageToCurrentSpread('img1');
    const spreads = get(spreadsStore);
    expect(spreads[0].leftPage.imageIds).toEqual(['img1']);
  });

  it('adds an image to the right page in single mode', () => {
    activePageStore.set('right');
    addImageToCurrentSpread('img2');
    const spreads = get(spreadsStore);
    expect(spreads[0].rightPage.imageIds).toEqual(['img2']);
  });

  it('adds an image to the spread page in spread mode', () => {
    layoutModeStore.set('spread');
    addImageToCurrentSpread('img3');
    const spreads = get(spreadsStore);
    expect(spreads[0].spreadPage.imageIds).toEqual(['img3']);
  });
});

describe('activeSpreadLayout derived store', () => {
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
      leftPage: { imageIds: [], currentPresetIndex: 0 },
      rightPage: { imageIds: [], currentPresetIndex: 0 },
      spreadPage: { imageIds: [], currentPresetIndex: 0 },
      useCustomMargins: false,
      margins: { top: 0.5, bottom: 0.5, inner: 0.5, outer: 0.5 }
    }]);
    currentSpreadIndexStore.set(0);
    layoutModeStore.set('spread');
  });

  it('computes correct basic dimensions', () => {
    const layout = get(activeSpreadLayout);
    expect(layout.pageWidthPx).toBe(1000);
    expect(layout.spreadHeightPx).toBe(1000);
    // 2 * 1000 + 10 (spine)
    expect(layout.totalSpreadWidthPx).toBe(2010);
  });

  it('provides error when no spreads available', () => {
    spreadsStore.set([]);
    const layout = get(activeSpreadLayout);
    expect(layout.error).toBe(true);
    expect(layout.message).toContain('No spreads available');
  });

  it('applies margins to page margin boxes', () => {
    const layout = get(activeSpreadLayout);
    // globalMargins { top: 1, bottom: 1, inner: 1, outer: 1 }
    // left page margin box
    expect(layout.leftPageMarginBox.left).toBe(100); // outer
    expect(layout.leftPageMarginBox.top).toBe(100);
    expect(layout.leftPageMarginBox.width).toBe(800); // 1000 - 100 - 100
    expect(layout.leftPageMarginBox.height).toBe(800);
  });
});

describe('spreads store - shuffleAllImages', () => {
  beforeEach(() => {
    spreadsStore.set([
      {
        id: 1,
        type: 'spread',
        leftPage: { imageIds: ['img1', 'img2'], currentPresetIndex: 0 },
        rightPage: { imageIds: ['img3'], currentPresetIndex: 0 },
        spreadPage: { imageIds: [], currentPresetIndex: 0 },
      },
      {
        id: 2,
        type: 'single',
        leftPage: { imageIds: ['img4', 'img5'], currentPresetIndex: 0 },
        rightPage: { imageIds: [], currentPresetIndex: 0 }, // Should be ignored for single type
        spreadPage: { imageIds: [], currentPresetIndex: 0 },
      }
    ]);
    layoutModeStore.set('single');
  });

  it('shuffles images across all pages while keeping counts', () => {
    const originalImageIds = ['img1', 'img2', 'img3', 'img4', 'img5'];
    
    // Mock Math.random to get a deterministic shuffle for testing if needed, 
    // but here we just want to verify counts and presence.
    shuffleAllImages();
    
    const spreads = get(spreadsStore);
    
    // Check counts
    expect(spreads[0].leftPage.imageIds).toHaveLength(2);
    expect(spreads[0].rightPage.imageIds).toHaveLength(1);
    expect(spreads[1].leftPage.imageIds).toHaveLength(2);
    
    // Check that all original images are still there
    const allNewIds = [
      ...spreads[0].leftPage.imageIds,
      ...spreads[0].rightPage.imageIds,
      ...spreads[1].leftPage.imageIds
    ];
    
    expect(allNewIds.sort()).toEqual(originalImageIds.sort());
  });

  it('respects layoutMode spread', () => {
    layoutModeStore.set('spread');
    spreadsStore.set([
      {
        id: 1,
        type: 'spread',
        leftPage: { imageIds: ['img1'], currentPresetIndex: 0 },
        rightPage: { imageIds: ['img2'], currentPresetIndex: 0 },
        spreadPage: { imageIds: ['img3', 'img4'], currentPresetIndex: 0 },
      }
    ]);

    shuffleAllImages();
    
    const spreads = get(spreadsStore);
    // In spread mode for a spread type, only spreadPage.imageIds should be shuffled
    expect(spreads[0].spreadPage.imageIds).toHaveLength(2);
    expect(spreads[0].spreadPage.imageIds.sort()).toEqual(['img3', 'img4'].sort());
    
    // Left and right page should be untouched in this specific mode/type combo
    expect(spreads[0].leftPage.imageIds).toEqual(['img1']);
    expect(spreads[0].rightPage.imageIds).toEqual(['img2']);
  });
});
