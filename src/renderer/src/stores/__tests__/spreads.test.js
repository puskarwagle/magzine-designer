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
  archivedSpreadsStore
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
