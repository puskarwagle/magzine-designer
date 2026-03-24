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
      pageAssignments: {},
      leftPage: { customSlots: {} },
      rightPage: { customSlots: {} },
      spreadPage: { customSlots: {} },
      useCustomMargins: false,
      margins: { top: 0.5, bottom: 0.5, inner: 0.5, outer: 0.5 }
    }]);
    currentSpreadIndexStore.set(0);
    layoutModeStore.set('single');
    activePageStore.set('left');
    archivedSpreadsStore.set([]);
  });

  it('addSpread: every two pages makes a spread', () => {
    // Start with 1 spread of type 'spread'
    expect(get(spreadsStore)).toHaveLength(1);
    
    // Add 1 page -> generates a new 'single' spread
    addSpread('single');
    let spreads = get(spreadsStore);
    expect(spreads).toHaveLength(2);
    expect(spreads[1].type).toBe('single');
    
    // Add 1 more page -> the existing 'single' spread becomes 'spread'
    addSpread('single');
    spreads = get(spreadsStore);
    expect(spreads).toHaveLength(2);
    expect(spreads[1].type).toBe('spread');
    
    // Add another page -> new 'single' spread
    addSpread('single');
    spreads = get(spreadsStore);
    expect(spreads).toHaveLength(3);
    expect(spreads[2].type).toBe('single');
  });

  it('removeSpread moves it to archive and adjusts index', () => {
    addSpread('spread');
    expect(get(spreadsStore)).toHaveLength(2);
    
    removeSpread(0);
    expect(get(spreadsStore)).toHaveLength(1);
    expect(get(archivedSpreadsStore)).toHaveLength(1);
    expect(get(currentSpreadIndexStore)).toBe(0);
  });

  it('updateSlotImage updates image ID in the unified pool', () => {
    spreadsStore.update(s => {
      s[0].imageIds = ['img1', 'img2'];
      s[0].pageAssignments = { 'img1': 'left', 'img2': 'left' };
      return s;
    });

    updateSlotImage(0, 'left', 'img2', 'img-new');
    
    const spreads = get(spreadsStore);
    expect(spreads[0].imageIds).toEqual(['img1', 'img-new']);
    expect(spreads[0].pageAssignments['img-new']).toBe('left');
  });

  it('isSpreadPopulated correctly detects images in the unified pool', () => {
    const emptySpread = get(spreadsStore)[0];
    expect(isSpreadPopulated(emptySpread)).toBe(false);

    const populatedSpread = { ...emptySpread, imageIds: ['a'] };
    expect(isSpreadPopulated(populatedSpread)).toBe(true);
  });
});

describe('spreads store - addImageToCurrentSpread', () => {
  beforeEach(() => {
    spreadsStore.set([{
      id: 1,
      type: 'spread',
      imageIds: [],
      currentPresetIndex: 0,
      pageAssignments: {},
      leftPage: { customSlots: {} },
      rightPage: { customSlots: {} },
      spreadPage: { customSlots: {} },
      useCustomMargins: false,
      margins: { top: 0.5, bottom: 0.5, inner: 0.5, outer: 0.5 }
    }]);
    currentSpreadIndexStore.set(0);
    layoutModeStore.set('single');
    activePageStore.set('left');
  });

  it('adds an image to the pool and assigns to active page in single mode', () => {
    addImageToCurrentSpread('img1');
    const spreads = get(spreadsStore);
    expect(spreads[0].imageIds).toEqual(['img1']);
    expect(spreads[0].pageAssignments['img1']).toBe('left');
    
    activePageStore.set('right');
    addImageToCurrentSpread('img2');
    expect(get(spreadsStore)[0].imageIds).toEqual(['img1', 'img2']);
    expect(get(spreadsStore)[0].pageAssignments['img2']).toBe('right');
  });

  it('adds an image to the pool in spread mode', () => {
    layoutModeStore.set('spread');
    addImageToCurrentSpread('img3');
    const spreads = get(spreadsStore);
    expect(spreads[0].imageIds).toEqual(['img3']);
    // In spread mode, default assignment is 'left' for now
    expect(spreads[0].pageAssignments['img3']).toBe('left');
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
      imageIds: [],
      currentPresetIndex: 0,
      pageAssignments: {},
      leftPage: { customSlots: {} },
      rightPage: { customSlots: {} },
      spreadPage: { customSlots: {} },
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
    expect(layout.totalSpreadWidthPx).toBe(2010);
  });

  it('distributes images between left and right slots in single mode', () => {
    layoutModeStore.set('single');
    spreadsStore.update(s => {
      s[0].imageIds = ['imgL', 'imgR'];
      s[0].pageAssignments = { 'imgL': 'left', 'imgR': 'right' };
      return s;
    });
    
    const layout = get(activeSpreadLayout);
    // Note: We need some actual image data in projectStore for slots to be generated if we use LayoutEngine,
    // but here we can just check if slot sources are correct if we mock project images.
    
    // Actually, LayoutEngine needs images to find dimensions.
    projectStore.set({ images: [{id: 'imgL', path: ''}, {id: 'imgR', path: ''}] });
    
    const newLayout = get(activeSpreadLayout);
    expect(newLayout.leftPageSlots.map(s => s.imageId)).toContain('imgL');
    expect(newLayout.rightPageSlots.map(s => s.imageId)).toContain('imgR');
  });
});

describe('spreads store - shuffleAllImages', () => {
  beforeEach(() => {
    spreadsStore.set([
      {
        id: 1,
        type: 'spread',
        imageIds: ['img1', 'img2', 'img3'],
        pageAssignments: { 'img1': 'left', 'img2': 'left', 'img3': 'right' },
        currentPresetIndex: 0,
        leftPage: {}, rightPage: {}, spreadPage: {}
      },
      {
        id: 2,
        type: 'single',
        imageIds: ['img4', 'img5'],
        pageAssignments: { 'img4': 'left', 'img5': 'left' },
        currentPresetIndex: 0,
        leftPage: {}, rightPage: {}, spreadPage: {}
      }
    ]);
    layoutModeStore.set('single');
  });

  it('shuffles images across all spreads while keeping counts', () => {
    const originalImageIds = ['img1', 'img2', 'img3', 'img4', 'img5'];
    
    shuffleAllImages();
    
    const spreads = get(spreadsStore);
    
    // Check total count across all spreads
    const allNewIds = spreads.flatMap(s => s.imageIds);
    expect(allNewIds).toHaveLength(5);
    expect(allNewIds.sort()).toEqual(originalImageIds.sort());
    
    // Check individual spread counts preserved
    expect(spreads[0].imageIds).toHaveLength(3);
    expect(spreads[1].imageIds).toHaveLength(2);
  });
});

